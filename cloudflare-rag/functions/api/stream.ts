import { RoleScopedChatInput } from "@cloudflare/workers-types";
import { inArray, sql } from "drizzle-orm";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { blogPostChunks, blogPostImages, blogPostSections, blogPosts } from "schema";
import { authorizeEmbedStreamRequest } from "../_shared/embed-access.js";
import {
  BlogSource,
  dedupeSources,
  getBlogCorpusId,
  getChatModel,
  getEmbeddingModel,
  getRerankModel,
  getEmbeddingData,
  parseRetrievalPreferences,
  normalizeQueries,
  sanitizeFtsQuery,
  type RetrievalPreferences,
} from "~/lib/blogRag";

interface BlogChunkResult {
  id: string;
  post_id: string;
  title: string;
  url: string;
  text: string;
  heading?: string;
  anchor?: string;
  image_refs?: string;
  rank?: number;
}

interface ChunkRecord {
  id: string;
  postId: string;
  sectionId?: string;
  sectionIndex?: number;
  title: string;
  url: string;
  text: string;
  heading?: string | null;
  anchor?: string | null;
  category?: string | null;
  tags?: string | null;
  topic?: string | null;
  series?: string | null;
  published?: string | null;
  updated?: string | null;
  hasImages?: boolean;
  hasCodeBlocks?: boolean;
  imageRefs?: string | null;
  parentText?: string | null;
}

interface RerankItem {
  id: string;
  score: number;
}

interface RetrievalConfidence {
  confident: boolean;
  reason: string;
  topScore: number;
  scoreGap: number;
  uniquePosts: number;
}

async function writeSse(writer: WritableStreamDefaultWriter, payload: unknown) {
  await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
}

async function checkRateLimit(env: Env, request: Request): Promise<Response | null> {
  const ipAddress = request.headers.get("cf-connecting-ip") || "";
  const rateLimit = await env.rate_limiter.get(ipAddress);

  if (rateLimit) {
    const lastRequestTime = parseInt(rateLimit);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - lastRequestTime < 3) {
      return new Response("Too many requests", { status: 429 });
    }
  }

  await env.rate_limiter.put(ipAddress, Math.floor(Date.now() / 1000).toString(), {
    expirationTtl: 60,
  });

  return null;
}

function getConversationWindow(messages: RoleScopedChatInput[], limit = 4): string {
  return messages
    .filter((message) => typeof message.content === "string" && message.role !== "system")
    .slice(-limit)
    .map((message) => `${message.role === "user" ? "用户" : "助手"}：${String(message.content).trim()}`)
    .join("\n");
}

async function analyzeRetrievalPreferences(
  query: string,
  env: Env,
  conversationContext: string,
): Promise<RetrievalPreferences> {
  const chatModel = getChatModel(env);
  const prompt = `你是个人博客 RAG 的检索画像分析器。请根据用户问题和最近对话，判断这次提问更适合怎样检索博客知识库。

只输出严格 JSON，不要输出 Markdown，不要输出解释，不要输出多余文字。

JSON 格式：
{
  "mode": "search" | "chat",
  "preferImages": boolean,
  "preferCode": boolean,
  "preferRecent": boolean,
  "emphasizeProcess": boolean,
  "confidence": number,
  "rationale": string
}

判断原则：
- mode=search：用户在问博客文章、教程、部署、配置、报错、截图、示例、命令、流程、某个主题是否写过，或者明显需要结合博客内容回答
- mode=chat：用户主要是寒暄、泛问、闲聊、问你是谁、怎么使用、能力边界这类不需要博客知识库的内容
- preferImages：只有当问题明显需要截图、界面、示意图、图片、流程图、预览图时才设为 true
- preferCode：只有当问题明显需要代码、命令、配置、脚本、代理、环境变量、JSON/YAML 时才设为 true
- preferRecent：只有当问题明显在问“最新/现在/近期/当前版本/最近更新”时才设为 true
- emphasizeProcess：只有当问题更像部署、配置、排查、步骤、流程、教程时才设为 true
- confidence：0 到 1，表示你对这次画像判断的把握程度

最近对话上下文：
${conversationContext || "（无）"}

用户问题：
${query}`;

  try {
    const response = await env.AI.run(chatModel as any, {
      messages: [{ role: "user", content: prompt }],
    });

    const raw = String((response as { response?: string }).response || "");
    const parsed = parseRetrievalPreferences(raw);
    if (parsed) {
      return parsed;
    }
  } catch {
    // fallback below
  }

  return {
    mode: "search",
    preferImages: false,
    preferCode: false,
    preferRecent: false,
    emphasizeProcess: false,
    confidence: 0,
  };
}

async function rewriteToQueries(
  content: string,
  env: Env,
  conversationContext: string,
): Promise<string[]> {
  const chatModel = getChatModel(env);
  const prompt = `你是个人博客 RAG 知识库的检索词生成器。请把用户问题改写成 5 条适合同时用于全文检索和向量检索的搜索短语。

生成策略：
- 第 1 条尽量保留用户原意和核心实体
- 第 2-3 条提取关键技术名词、产品名、配置项、错误现象或文章主题
- 第 4-5 条补充同义表达、相关流程词、截图/图片/示例/步骤等检索线索
- 保留中文、英文、日文、代码标识、域名、路径、命令、配置字段
- 对博客场景优先使用：部署、配置、流程、教程、截图、示例、问题、修复、总结、注意事项等词
- 如果用户问“有没有截图/图片/流程图”，至少生成 1 条包含“截图 图片 图示 流程”的短语

要求：
- 每行一条
- 只输出 5 行
- 每条 3-18 个词或短语片段，适合搜索，不要写成长句
- 不要编号、不要项目符号、不要引号、不要解释
- 不要编造用户问题里完全无关的产品名或文章标题
- 不要解释

最近对话上下文：
${conversationContext || "（无）"}

用户问题：${content}`;

  const response = await env.AI.run(chatModel as any, {
    messages: [{ role: "user", content: prompt }],
  });

  const rewritten = normalizeQueries((response as { response?: string }).response || "");
  return Array.from(new Set([content.trim(), ...rewritten].filter(Boolean))).slice(0, 5);
}

async function searchFullText(searchTerms: string[], db: DrizzleD1Database<any>) {
  const queries = searchTerms.map(sanitizeFtsQuery).filter(Boolean);
  if (queries.length === 0) {
    return [];
  }

  const results = await Promise.all(
    queries.map(async (query) => {
      const { results } = (await db.run(sql`
        SELECT blog_post_chunks.*, blog_post_chunks_fts.rank
        FROM blog_post_chunks_fts
        JOIN blog_post_chunks ON blog_post_chunks_fts.id = blog_post_chunks.id
        WHERE blog_post_chunks_fts MATCH ${query}
        ORDER BY blog_post_chunks_fts.rank
        LIMIT 8
      `)) as { results: BlogChunkResult[] };

      return results;
    })
  );

  return results.flat().slice(0, 24);
}

function applyChunkPreferenceScore(chunk: ChunkRecord, preferences: RetrievalPreferences): number {
  let score = 0;
  if (preferences.preferImages && chunk.hasImages) {
    score += 1.2;
  }
  if (preferences.preferCode && chunk.hasCodeBlocks) {
    score += 1.2;
  }
  if (preferences.preferRecent && chunk.updated) {
    score += 0.4;
  }
  return score;
}

async function queryVectorIndex(queries: string[], env: Env) {
  const embeddingModel = getEmbeddingModel(env);
  const blogCorpusId = getBlogCorpusId(env);
  const embeddingResults = await Promise.all(
    queries.map((query) => env.AI.run(embeddingModel as any, { text: [query] }))
  );

  return await Promise.all(
    embeddingResults.map((embeddingResult) => {
      const vectors = getEmbeddingData(embeddingResult as any);
      return env.VECTORIZE_INDEX.query(vectors[0], {
        topK: 12,
        returnValues: false,
        returnMetadata: "all",
        namespace: blogCorpusId,
      });
    })
  );
}

async function queryVectorIndexWithPreferences(
  queries: string[],
  env: Env,
  preferences: RetrievalPreferences,
) {
  const embeddingModel = getEmbeddingModel(env);
  const blogCorpusId = getBlogCorpusId(env);
  const embeddingResults = await Promise.all(
    queries.map((query) => env.AI.run(embeddingModel as any, { text: [query] }))
  );

  return await Promise.all(
    embeddingResults.map((embeddingResult) => {
      const vectors = getEmbeddingData(embeddingResult as any);
      const filter: VectorizeVectorMetadataFilter = {};
      if (preferences.preferImages) {
        filter.hasImages = { $eq: true };
      } else if (preferences.preferCode) {
        filter.hasCodeBlocks = { $eq: true };
      }

      return env.VECTORIZE_INDEX.query(vectors[0], {
        topK: 12,
        returnValues: false,
        returnMetadata: "all",
        namespace: blogCorpusId,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      });
    })
  );
}

function reciprocalRankFusion(
  fullTextResults: BlogChunkResult[],
  vectorResults: VectorizeMatches[]
): string[] {
  const scores: Record<string, number> = {};
  const k = 60;

  fullTextResults.forEach((result, index) => {
    scores[result.id] = (scores[result.id] || 0) + 1 / (k + index + 1);
  });

  vectorResults.forEach((resultSet) => {
    resultSet.matches.forEach((match, index) => {
      scores[match.id] = (scores[match.id] || 0) + 1 / (k + index + 1);
    });
  });

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

async function getRelevantChunks(ids: string[], db: DrizzleD1Database<any>) {
  if (ids.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: blogPostChunks.id,
      postId: blogPostChunks.postId,
      sectionId: blogPostChunks.sectionId,
      sectionIndex: blogPostChunks.sectionIndex,
      title: blogPostChunks.title,
      url: blogPostChunks.url,
      heading: blogPostChunks.heading,
      anchor: blogPostChunks.anchor,
      category: blogPostChunks.category,
      tags: blogPostChunks.tags,
      topic: blogPostChunks.topic,
      series: blogPostChunks.series,
      published: blogPostChunks.published,
      updated: blogPostChunks.updated,
      hasImages: blogPostChunks.hasImages,
      hasCodeBlocks: blogPostChunks.hasCodeBlocks,
      imageRefs: blogPostChunks.imageRefs,
      parentText: blogPostChunks.parentText,
      text: blogPostChunks.text,
    })
    .from(blogPostChunks)
    .where(inArray(blogPostChunks.id, ids.slice(0, 24)));

  const order = new Map(ids.map((id, index) => [id, index]));
  return rows.sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

function parseImageRefs(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function normalizeImageMatchText(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeImageMatchText(value: string | null | undefined): string[] {
  return normalizeImageMatchText(value).match(/[\p{L}\p{N}_-]{2,}/gu) || [];
}

function scoreImageAgainstChunk(
  chunk: Awaited<ReturnType<typeof getRelevantChunks>>[number],
  image: {
    relativePath: string;
    alt: string;
    title: string;
    heading: string | null;
    anchor: string | null;
    surroundingText: string;
    ocrText: string;
  },
): number {
  let score = 0;
  const chunkAnchor = normalizeImageMatchText(chunk.anchor);
  const imageAnchor = normalizeImageMatchText(image.anchor);
  const chunkHeading = normalizeImageMatchText(chunk.heading);
  const imageHeading = normalizeImageMatchText(image.heading);

  if (chunkAnchor && imageAnchor && chunkAnchor === imageAnchor) {
    score += 6;
  }

  if (chunkHeading && imageHeading && chunkHeading === imageHeading) {
    score += 5;
  }

  const chunkTokens = new Set(
    tokenizeImageMatchText(
      [chunk.title, chunk.heading, chunk.anchor, chunk.parentText || chunk.text]
        .filter(Boolean)
        .join(" "),
    ).slice(0, 24),
  );

  if (chunkTokens.size === 0) {
    return score;
  }

  const haystack = normalizeImageMatchText(
    [
      image.relativePath,
      image.alt,
      image.title,
      image.heading,
      image.anchor,
      image.surroundingText,
      image.ocrText,
    ]
      .filter(Boolean)
      .join(" "),
  );

  for (const token of chunkTokens) {
    if (!haystack.includes(token)) {
      continue;
    }
    score += token.length >= 4 ? 0.8 : 0.45;
  }

  if (image.ocrText) {
    score += 0.3;
  }

  if (image.surroundingText) {
    score += 0.3;
  }

  return score;
}

function toAbsoluteUrl(value: string, requestOrigin: string): string {
  if (!value) {
    return value;
  }

  try {
    return new URL(value, requestOrigin).toString();
  } catch {
    return value;
  }
}

function getBlogSiteOrigin(env: Env): string | null {
  const siteURL = env.BLOG_SITE_URL?.trim();
  if (!siteURL) {
    return null;
  }

  try {
    return new URL(siteURL).origin;
  } catch {
    return null;
  }
}

function normalizeBlogPostUrl(value: string, env: Env): string {
  const blogOrigin = getBlogSiteOrigin(env);
  if (!blogOrigin || !value) {
    return value;
  }

  try {
    const url = new URL(value);
    const embedMatch = url.pathname.match(/^\/embed\/(posts\/.+)$/);
    if (embedMatch) {
      return `${blogOrigin}/${embedMatch[1]}${url.hash}`;
    }
    return url.toString();
  } catch {
    return value;
  }
}

interface SuggestedInlineImage {
  sourceIndex: number;
  source: BlogSource;
  image: NonNullable<BlogSource["images"]>[number];
  score: number;
}

function scoreSourceImageForInlineUse(
  query: string,
  source: BlogSource,
  image: NonNullable<BlogSource["images"]>[number],
): number {
  let score = 0;
  const queryText = normalizeImageMatchText(query);
  const sourceText = normalizeImageMatchText(
    [source.title, source.heading, source.snippet, source.text, image.alt, image.text]
      .filter(Boolean)
      .join(" "),
  );

  const queryTokens = tokenizeImageMatchText(queryText).slice(0, 20);
  for (const token of queryTokens) {
    if (!sourceText.includes(token)) {
      continue;
    }
    score += token.length >= 4 ? 1 : 0.5;
  }

  if (image.alt) {
    score += 0.8;
  }
  if (image.text) {
    score += 0.6;
  }
  if (source.heading) {
    score += 0.4;
  }

  return score;
}

function selectInlineImageSuggestions(query: string, sources: BlogSource[]): SuggestedInlineImage[] {
  const ranked = sources
    .flatMap((source, sourceIndex) =>
      (source.images || []).map((image) => ({
        sourceIndex,
        source,
        image,
        score: scoreSourceImageForInlineUse(query, source, image),
      })),
    )
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return [];
  }

  const topScore = ranked[0]?.score ?? 0;
  const threshold = Math.max(1.6, topScore * 0.45);
  const selected = ranked.filter((item, index) => item.score >= threshold || index === 0);

  return selected.slice(0, 5);
}

function buildRerankDocument(chunk: ChunkRecord): string {
  return [
    chunk.title,
    chunk.heading || "",
    chunk.anchor || "",
    chunk.text,
  ]
    .filter(Boolean)
    .join("\n");
}

function parseRerankResponse(result: unknown, ids: string[]): RerankItem[] {
  if (!result || typeof result !== "object") {
    return [];
  }

  const payload = result as Record<string, unknown>;
  const candidates = [
    payload.data,
    payload.response,
    payload.results,
    payload.rankings,
  ].find(Array.isArray) as Array<Record<string, unknown>> | undefined;

  if (!candidates?.length) {
    return [];
  }

  return candidates
    .map((item, index) => {
      const rawIndex = item.index ?? item.document_index ?? item.id;
      const resolvedIndex =
        typeof rawIndex === "number"
          ? rawIndex
          : typeof rawIndex === "string" && /^\d+$/.test(rawIndex)
            ? Number.parseInt(rawIndex, 10)
            : index;
      const id = ids[resolvedIndex];
      const rawScore = item.score ?? item.relevance_score ?? item.relevance ?? item.similarity;
      const score = typeof rawScore === "number" ? rawScore : Number(rawScore ?? 0);
      if (!id || !Number.isFinite(score)) {
        return null;
      }

      return { id, score };
    })
    .filter((item): item is RerankItem => Boolean(item))
    .sort((a, b) => b.score - a.score);
}

function compressChunksForGeneration(
  chunks: Awaited<ReturnType<typeof getRelevantChunks>>,
  preferences: RetrievalPreferences,
): Awaited<ReturnType<typeof getRelevantChunks>> {
  const seenSections = new Set<string>();
  const byPostCount = new Map<string, number>();
  const result: Awaited<ReturnType<typeof getRelevantChunks>> = [];

  const sorted = [...chunks].sort((a, b) => {
    return applyChunkPreferenceScore(b, preferences) - applyChunkPreferenceScore(a, preferences);
  });

  for (const chunk of sorted) {
    const sectionKey = chunk.sectionId || `${chunk.postId}#${chunk.anchor || chunk.heading || chunk.id}`;
    const perPost = byPostCount.get(chunk.postId) || 0;
    if (seenSections.has(sectionKey) || perPost >= 2) {
      continue;
    }

    seenSections.add(sectionKey);
    byPostCount.set(chunk.postId, perPost + 1);
    result.push(chunk);

    if (result.length >= 6) {
      break;
    }
  }

  return result;
}

function evaluateRetrievalConfidence(
  reranked: RerankItem[],
  chunks: Awaited<ReturnType<typeof getRelevantChunks>>,
): RetrievalConfidence {
  const topScore = reranked[0]?.score ?? 0;
  const secondScore = reranked[1]?.score ?? 0;
  const scoreGap = topScore - secondScore;
  const uniquePosts = new Set(chunks.map((chunk) => chunk.postId)).size;

  if (reranked.length === 0 || chunks.length === 0) {
    return {
      confident: false,
      reason: "no-match",
      topScore,
      scoreGap,
      uniquePosts,
    };
  }

  if (topScore < 0.18) {
    return {
      confident: false,
      reason: "low-rerank-score",
      topScore,
      scoreGap,
      uniquePosts,
    };
  }

  if (scoreGap < 0.015 && uniquePosts <= 1 && chunks.length < 2) {
    return {
      confident: false,
      reason: "ambiguous-single-source",
      topScore,
      scoreGap,
      uniquePosts,
    };
  }

  return {
    confident: true,
    reason: "ok",
    topScore,
    scoreGap,
    uniquePosts,
  };
}

async function rerankChunks(
  query: string,
  chunks: Awaited<ReturnType<typeof getRelevantChunks>>,
  env: Env,
): Promise<{ chunks: Awaited<ReturnType<typeof getRelevantChunks>>; rankings: RerankItem[] }> {
  if (chunks.length <= 1) {
    return {
      chunks,
      rankings: chunks.map((chunk, index) => ({ id: chunk.id, score: 1 - index * 0.01 })),
    };
  }

  const rerankModel = getRerankModel(env);
  const ids = chunks.map((chunk) => chunk.id);
  const documents = chunks.map((chunk) => buildRerankDocument(chunk));
  const aiRunner = env.AI.run as unknown as (
    model: string,
    input: {
      query: string;
      documents: string[];
      top_k: number;
    },
  ) => Promise<unknown>;

  try {
    const result = await aiRunner(rerankModel, {
      query,
      documents,
      top_k: Math.min(8, chunks.length),
    });

    const reranked = parseRerankResponse(result, ids);
    if (!reranked.length) {
      return {
        chunks: chunks.slice(0, 8),
        rankings: chunks.slice(0, 8).map((chunk, index) => ({ id: chunk.id, score: 1 - index * 0.01 })),
      };
    }

    const chunkMap = new Map(chunks.map((chunk) => [chunk.id, chunk]));
    return {
      chunks: reranked
        .map((item) => chunkMap.get(item.id))
        .filter((chunk): chunk is Awaited<ReturnType<typeof getRelevantChunks>>[number] => Boolean(chunk)),
      rankings: reranked,
    };
  } catch {
    return {
      chunks: chunks.slice(0, 8),
      rankings: chunks.slice(0, 8).map((chunk, index) => ({ id: chunk.id, score: 1 - index * 0.01 })),
    };
  }
}

async function buildSources(
  chunks: Awaited<ReturnType<typeof getRelevantChunks>>,
  db: DrizzleD1Database<any>,
  env: Env,
  requestOrigin: string,
  preferences: RetrievalPreferences,
): Promise<BlogSource[]> {
  const postIds = Array.from(new Set(chunks.map((chunk) => chunk.postId)));
  const images =
    postIds.length > 0
      ? await db
          .select({
            postId: blogPostImages.postId,
            relativePath: blogPostImages.relativePath,
            url: blogPostImages.url,
            alt: blogPostImages.alt,
            title: blogPostImages.title,
            heading: blogPostImages.heading,
            anchor: blogPostImages.anchor,
            surroundingText: blogPostImages.surroundingText,
            ocrText: blogPostImages.ocrText,
          })
          .from(blogPostImages)
          .where(inArray(blogPostImages.postId, postIds))
      : [];
  const imagesByPostAndPath = new Map(
    images.map((image) => [`${image.postId}:${image.relativePath}`, image]),
  );
  const imagesByPost = new Map<string, typeof images>();
  for (const image of images) {
    const current = imagesByPost.get(image.postId) || [];
    current.push(image);
    imagesByPost.set(image.postId, current);
  }

  return dedupeSources(
    chunks.map((chunk) => {
      const imageRefs = parseImageRefs(chunk.imageRefs);
      const directImages = imageRefs
        .map((path) => imagesByPostAndPath.get(`${chunk.postId}:${path}`))
        .filter(Boolean);
      const fallbackImages =
        directImages.length > 0
          ? []
          : [...(imagesByPost.get(chunk.postId) || [])]
              .map((image) => ({
                image,
                score: scoreImageAgainstChunk(chunk, image),
              }))
              .sort((a, b) => b.score - a.score)
              .filter(({ score }, index) => score > 0.5 || index === 0)
              .slice(0, 3)
              .map(({ image }) => image);
      const selectedImages = [...directImages, ...fallbackImages].slice(0, 2);

      return {
        postId: chunk.postId,
        title: chunk.title,
        url: normalizeBlogPostUrl(chunk.url, env),
        heading: chunk.heading,
        anchor: chunk.anchor,
        snippet: chunk.parentText ? chunk.parentText.slice(0, 240) : chunk.text.slice(0, 240),
        category: chunk.category || null,
        topic: chunk.topic || null,
        series: chunk.series || null,
        tags: (() => {
          try {
            return JSON.parse(chunk.tags || "[]");
          } catch {
            return [];
          }
        })(),
        hasCodeBlocks: chunk.hasCodeBlocks,
        text: chunk.text,
        images: selectedImages.map((image) => ({
            path: image!.relativePath,
            url: toAbsoluteUrl(image!.url, requestOrigin),
            alt: image!.alt,
            text: image!.ocrText,
          })),
      };
    }),
  );
}

function buildMessages(
  originalMessages: RoleScopedChatInput[],
  sources: BlogSource[],
  query: string,
): RoleScopedChatInput[] {
  const inlineImageSuggestions = selectInlineImageSuggestions(query, sources);
  const context = sources
    .map(
      (source, index) =>
        [
          `[${index + 1}] ${source.title}${source.heading ? ` / ${source.heading}` : ""}`,
          `参考来源行：[${index + 1}] ${source.title}${source.heading ? ` / ${source.heading}` : ""} - ${source.url}`,
          `URL: ${source.url}`,
          source.snippet ? `摘要：${source.snippet}` : "",
          source.category ? `分类：${source.category}` : "",
          source.topic ? `主题：${source.topic}` : "",
          source.series ? `系列：${source.series}` : "",
          `片段：${source.text}`,
          source.hasCodeBlocks ? "本段包含代码或命令配置" : "",
          ...(source.images || []).map((image) =>
            [
              `图片：${image.alt || image.path}`,
              `图片地址：${image.url}`,
              image.text ? `图片识别：${image.text}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        ]
          .filter(Boolean)
          .join("\n")
    )
    .join("\n\n");
  const inlineImageGuidance = inlineImageSuggestions.length
    ? inlineImageSuggestions
        .map(
          ({ sourceIndex, source, image }) =>
            [
              `候选配图 [${sourceIndex + 1}] ${source.title}${source.heading ? ` / ${source.heading}` : ""}`,
              `适合配图的位置：优先放在引用 [${sourceIndex + 1}] 的相关段落后面`,
              `图片说明：${image.alt || source.heading || source.title}`,
              `图片地址：${image.url}`,
              image.text ? `图片识别：${image.text}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
        )
        .join("\n\n")
    : "";

  return [
    {
      role: "system",
      content: `你是 HiYngaの随✏️记 - 小Y，一个智能的个人博客文章网站知识库助手。只根据提供的博客上下文回答问题。
如果上下文不足，请明确说博客知识库里没有足够信息，不要编造。
回答使用用户提问的语言，默认中文。
回答要直接、结构清楚，优先总结博客文章里已经写明的配置、流程、注意事项、问题原因和最终效果。
回答时保持“小Y”这个助手身份，语气自然、可靠、克制，不要把自己说成官方客服或通用站外搜索引擎。
在回答正文里直接使用内联引用标注，例如 [1]、[2]，把引用贴在对应句子或段落末尾；如果一句话同时依赖多个来源，分别标注多个编号。
如果上下文里包含“图片/图片地址/图片识别”信息，且该图确实有助于说明界面、流程、截图、配置结果或示意内容，就在对应段落里自然提到“可结合该截图/界面图理解”之类的话，并把引用编号放在该段落末尾；前端会根据引用自动插入相关图片。
不要为了每个来源都强行提图，只在图片确实帮助理解时才使用。
不要说“没有截图”或“需要查看官方文档”，除非检索上下文确实完全没有图片信息或流程内容。
回答末尾必须单独列一个“参考来源”小节。
参考来源只列正文实际用到的编号，最多 5 条；不要重复列同一编号；如果同一文章命中多个小节，保留各自不同的小节标题和带 #hash 的精确 URL。
参考来源格式必须逐字使用上下文里的“参考来源行”，也就是：[编号] 文章标题 / 小节标题 - URL。
URL 必须使用上下文给出的 URL 原文，包含 #hash 时必须完整保留，不要截断成文章根路径，不要自行改写、合并或省略。`,
    },
    {
      role: "assistant",
      content: context
        ? `以下是从博客知识库检索到的相关上下文：\n\n${context}${inlineImageGuidance ? `\n\n以下是优先考虑的候选配图，请只在真正能帮助解释对应段落时自然使用：\n\n${inlineImageGuidance}` : ""}`
        : "博客知识库暂时没有检索到相关上下文。",
    },
    ...originalMessages.filter((message) => message.role !== "system"),
  ];
}

function buildFallbackChatMessages(originalMessages: RoleScopedChatInput[]): RoleScopedChatInput[] {
  return [
    {
      role: "system",
      content: `你是 HiYngaの随✏️记 - 小Y，一个智能的个人博客文章网站知识库助手。
这一次没有使用到博客知识库，也不要伪造“来自博客文章”的事实。
在没有检索上下文时，你仍然保持“小Y”的身份，但要明确这是一般性回答，不要假装引用过站内内容。
回答使用用户提问的语言，默认中文。
不要输出“参考来源”小节，不要输出引用编号，不要假装检索过博客内容。
如果用户是在问你能做什么、如何提问、能回答什么范围，就简洁说明：你擅长结合 HiYnga 博客里的文章、页面、项目记录和折腾经验，回答部署、配置、排错、教程、截图流程等问题；在缺少站内上下文时，也可以先给出一般性思路。`,
    },
    ...originalMessages.filter((message) => message.role !== "system"),
  ];
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const embedAccess = await authorizeEmbedStreamRequest({
    request: ctx.request,
    env: ctx.env,
  });
  if (!embedAccess.ok) {
    return (
      embedAccess.response ??
      new Response("Not Found", {
        status: 404,
        headers: {
          "Cache-Control": "no-store, no-transform",
        },
      })
    );
  }
  const renewedSessionCookie = embedAccess.renewedSessionCookie;
  if (!renewedSessionCookie) {
    return new Response("Embed session renewal failed.", {
      status: 500,
      headers: {
        "Cache-Control": "no-store, no-transform",
      },
    });
  }

  if (ctx.request.method !== "POST") {
    return new Response("Expected POST.", { status: 405 });
  }

  const rateLimitResponse = await checkRateLimit(ctx.env, ctx.request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  ctx.waitUntil(
    (async () => {
      try {
        const chatModel = getChatModel(ctx.env);
        const json = (await ctx.request.json()) as {
          messages?: RoleScopedChatInput[];
        };
        const messages = Array.isArray(json.messages) ? json.messages : [];
        const lastMessage = messages[messages.length - 1];
        const query = typeof lastMessage?.content === "string" ? lastMessage.content : "";

        if (!query.trim()) {
          await writeSse(writer, { error: "请输入一个问题。" });
          await writer.close();
          return;
        }

        const db = drizzle(ctx.env.DB);
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(blogPosts);

        if (!count) {
          await writeSse(writer, {
            error: "博客知识库还没有同步文章，请先运行 /api/sync-posts。",
          });
          await writer.close();
          return;
        }

        const conversationContext = getConversationWindow(messages);
        const preferences = await analyzeRetrievalPreferences(query, ctx.env, conversationContext);
        if (preferences.mode === "chat" && preferences.confidence >= 0.55) {
          await writeSse(writer, {
            message: "正在进行普通回答...",
          });
          const response = await ctx.env.AI.run(chatModel as any, {
            messages: buildFallbackChatMessages(messages),
            stream: true,
          });

          writer.releaseLock();
          const streamedResponse = response as unknown as Response | ReadableStream;
          if ((streamedResponse as Response).body) {
            await (streamedResponse as Response).body?.pipeTo(writable);
          } else {
            await (streamedResponse as ReadableStream).pipeTo(writable);
          }
          return;
        }

        await writeSse(writer, { message: "正在改写检索问题..." });
        const queries = await rewriteToQueries(query, ctx.env, conversationContext);

        await writeSse(writer, {
          message: "正在检索博客知识库...",
          queries,
        });

        const [fullTextResults, vectorResults] = await Promise.all([
          searchFullText(queries, db),
          queryVectorIndexWithPreferences(queries, ctx.env, preferences),
        ]);
        const mergedIds = reciprocalRankFusion(fullTextResults, vectorResults);
        const candidateChunks = await getRelevantChunks(mergedIds, db);

        if (!candidateChunks.length) {
          await writeSse(writer, {
            message: "博客知识库未命中，正在切换普通回答...",
            sources: [],
            relevantContext: [],
            queries,
          });

          const response = await ctx.env.AI.run(chatModel as any, {
            messages: buildFallbackChatMessages(messages),
            stream: true,
          });

          writer.releaseLock();
          const streamedResponse = response as unknown as Response | ReadableStream;
          if ((streamedResponse as Response).body) {
            await (streamedResponse as Response).body?.pipeTo(writable);
          } else {
            await (streamedResponse as ReadableStream).pipeTo(writable);
          }
          return;
        }

        await writeSse(writer, {
          message: "正在对候选内容进行相关性重排...",
          queries,
        });

        const reranked = await rerankChunks(query, candidateChunks, ctx.env);
        const confidence = evaluateRetrievalConfidence(reranked.rankings, reranked.chunks);
        if (!confidence.confident) {
          await writeSse(writer, {
            message: "命中置信度不足，正在切换普通回答...",
            confidence,
            queries,
          });

          const response = await ctx.env.AI.run(chatModel as any, {
            messages: buildFallbackChatMessages(messages),
            stream: true,
          });

          writer.releaseLock();
          const streamedResponse = response as unknown as Response | ReadableStream;
          if ((streamedResponse as Response).body) {
            await (streamedResponse as Response).body?.pipeTo(writable);
          } else {
            await (streamedResponse as ReadableStream).pipeTo(writable);
          }
          return;
        }

        const chunks = compressChunksForGeneration(reranked.chunks, preferences);
        const sources = await buildSources(
          chunks,
          db,
          ctx.env,
          new URL(ctx.request.url).origin,
          preferences,
        );

        await writeSse(writer, {
          message: "已找到相关博客内容，正在生成回答...",
          sources,
          relevantContext: chunks,
          confidence,
          queries,
        });

        const response = await ctx.env.AI.run(chatModel as any, {
          messages: buildMessages(messages, sources, query),
          stream: true,
        });

        writer.releaseLock();
        const streamedResponse = response as unknown as Response | ReadableStream;
        if ((streamedResponse as Response).body) {
          await (streamedResponse as Response).body?.pipeTo(writable);
        } else {
          await (streamedResponse as ReadableStream).pipeTo(writable);
        }
      } catch (error) {
        try {
          await writeSse(writer, { error: (error as Error).message });
          await writer.close();
        } catch {
          await writable.abort(error);
        }
      }
    })()
  );

  const response = new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "content-encoding": "identity",
      "Cache-Control": "no-cache",
    },
  });
  response.headers.append("set-cookie", renewedSessionCookie);
  return response;
};
