import { RoleScopedChatInput } from "@cloudflare/workers-types";
import { inArray, sql } from "drizzle-orm";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { blogPostChunks, blogPostImages, blogPosts } from "schema";
import {
  BlogSource,
  dedupeSources,
  getBlogCorpusId,
  getChatModel,
  getEmbeddingModel,
  getEmbeddingData,
  normalizeQueries,
  sanitizeFtsQuery,
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

async function rewriteToQueries(content: string, env: Env): Promise<string[]> {
  const chatModel = getChatModel(env);
  const prompt = `请把下面的用户问题改写成 5 条适合检索个人博客文章的搜索短语。
要求：
- 每行一条
- 保留中文、英文、日文关键词
- 不要解释

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
        LIMIT 6
      `)) as { results: BlogChunkResult[] };

      return results;
    })
  );

  return results.flat().slice(0, 15);
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
        topK: 8,
        returnValues: false,
        returnMetadata: "all",
        namespace: blogCorpusId,
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

  return await db
    .select({
      id: blogPostChunks.id,
      postId: blogPostChunks.postId,
      title: blogPostChunks.title,
      url: blogPostChunks.url,
      heading: blogPostChunks.heading,
      anchor: blogPostChunks.anchor,
      imageRefs: blogPostChunks.imageRefs,
      text: blogPostChunks.text,
    })
    .from(blogPostChunks)
    .where(inArray(blogPostChunks.id, ids.slice(0, 12)));
}

function parseImageRefs(value: string): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
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

async function buildSources(
  chunks: Awaited<ReturnType<typeof getRelevantChunks>>,
  db: DrizzleD1Database<any>,
  env: Env,
  requestOrigin: string,
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
            ocrText: blogPostImages.ocrText,
          })
          .from(blogPostImages)
          .where(inArray(blogPostImages.postId, postIds))
      : [];
  const imagesByPostAndPath = new Map(
    images.map((image) => [`${image.postId}:${image.relativePath}`, image]),
  );

  return dedupeSources(
    chunks.map((chunk) => {
      const imageRefs = parseImageRefs(chunk.imageRefs);
      return {
        postId: chunk.postId,
        title: chunk.title,
        url: normalizeBlogPostUrl(chunk.url, env),
        heading: chunk.heading,
        anchor: chunk.anchor,
        text: chunk.text,
        images: imageRefs
          .map((path) => imagesByPostAndPath.get(`${chunk.postId}:${path}`))
          .filter(Boolean)
          .map((image) => ({
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
  sources: BlogSource[]
): RoleScopedChatInput[] {
  const context = sources
    .map(
      (source, index) =>
        [
          `[${index + 1}] ${source.title}${source.heading ? ` / ${source.heading}` : ""}`,
          `URL: ${source.url}`,
          `片段：${source.text}`,
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

  return [
    {
      role: "system",
      content: `你是 HiYnga 博客的 AI 助手。只根据提供的博客上下文回答问题。
如果上下文不足，请明确说博客知识库里没有足够信息，不要编造。
回答使用用户提问的语言，默认中文。
在回答正文里直接使用内联引用标注，例如 [1]、[2]，把引用贴在对应句子或段落末尾。
如果一句话同时依赖多个来源，分别标注多个编号。
回答末尾单独列一个“参考来源”小节，格式为 [1] 文章标题 / 小节标题 - URL。
如果上下文里包含图片识别内容，可以说明图片相关信息，并优先引用对应小节 URL。
不要编造图片链接；前端会根据引用来源自动展示 Cloudflare 资产域里的相关图片。`,
    },
    {
      role: "assistant",
      content: context
        ? `以下是从博客知识库检索到的相关上下文：\n\n${context}`
        : "博客知识库暂时没有检索到相关上下文。",
    },
    ...originalMessages.filter((message) => message.role !== "system"),
  ];
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
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

        await writeSse(writer, { message: "正在改写检索问题..." });
        const queries = await rewriteToQueries(query, ctx.env);

        await writeSse(writer, {
          message: "正在检索博客知识库...",
          queries,
        });

        const [fullTextResults, vectorResults] = await Promise.all([
          searchFullText(queries, db),
          queryVectorIndex(queries, ctx.env),
        ]);
        const mergedIds = reciprocalRankFusion(fullTextResults, vectorResults);
        const chunks = await getRelevantChunks(mergedIds, db);
        const sources = await buildSources(chunks, db, ctx.env, new URL(ctx.request.url).origin);

        await writeSse(writer, {
          message: "已找到相关博客内容，正在生成回答...",
          sources,
          relevantContext: chunks,
          queries,
        });

        const response = await ctx.env.AI.run(chatModel as any, {
          messages: buildMessages(messages, sources),
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

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "content-encoding": "identity",
      "Cache-Control": "no-cache",
    },
  });
};
