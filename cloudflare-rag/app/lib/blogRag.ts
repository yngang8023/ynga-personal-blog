import { z } from "zod";

const DEFAULT_BLOG_CORPUS_ID = "mizuki-blog";
const DEFAULT_EMBEDDING_MODEL = "@cf/baai/bge-m3";
const DEFAULT_CHAT_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8";
const DEFAULT_RERANK_MODEL = "@cf/baai/bge-reranker-base";

export function getBlogCorpusId(env: Pick<Env, "BLOG_CORPUS_ID">): string {
  return env.BLOG_CORPUS_ID?.trim() || DEFAULT_BLOG_CORPUS_ID;
}

export function getEmbeddingModel(env: Pick<Env, "EMBEDDING_MODEL">): string {
  return env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

export function getChatModel(env: Pick<Env, "CHAT_MODEL">): string {
  return env.CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL;
}

export function getRerankModel(env: Pick<Env, "RERANK_MODEL">): string {
  return env.RERANK_MODEL?.trim() || DEFAULT_RERANK_MODEL;
}

export interface BlogPostInput {
  id: string;
  slug: string;
  title: string;
  description: string;
  url: string;
  published?: string | null;
  updated?: string | null;
  tags: string[];
  category?: string | null;
  body: string;
  contentHash?: string;
}

export interface BlogSource {
  postId: string;
  title: string;
  url: string;
  text: string;
  heading?: string | null;
  anchor?: string | null;
  snippet?: string;
  category?: string | null;
  topic?: string | null;
  series?: string | null;
  tags?: string[];
  hasCodeBlocks?: boolean;
  images?: BlogSourceImage[];
  score?: number;
}

export interface BlogSourceImage {
  path: string;
  url: string;
  alt?: string;
  text?: string;
}

export interface RetrievalPreferences {
  mode: "search" | "chat";
  preferImages: boolean;
  preferCode: boolean;
  preferRecent: boolean;
  emphasizeProcess: boolean;
  confidence: number;
  rationale?: string;
}

export interface BlogBundleFileInput {
  path: string;
  contentType: string;
  encoding: "utf8" | "base64";
  content: string;
  hash?: string;
  size?: number;
}

export interface BlogPostBundleInput {
  id: string;
  slug?: string;
  entryPath: string;
  url?: string;
  metadata?: {
    title?: string;
    description?: string;
    published?: string | null;
    updated?: string | null;
    tags?: string[];
    category?: string | null;
    topic?: string | null;
    series?: string | null;
  };
  files: BlogBundleFileInput[];
  contentHash?: string;
}

export interface EmbeddingResponse {
  shape?: number[];
  data?: number[][];
  response?: number[][];
}

const blogPostInputSchema = z.object({
  id: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  description: z.string().optional().default(""),
  url: z.string().trim().min(1),
  published: z.string().nullable().optional(),
  updated: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  category: z.string().nullable().optional(),
  body: z.string().trim().min(1),
  contentHash: z.string().trim().min(1).optional(),
});

const syncPayloadSchema = z.union([
  z.array(blogPostInputSchema),
  z.object({
    posts: z.array(blogPostInputSchema),
  }),
]);

const blogBundleFileInputSchema = z.object({
  path: z.string().trim().min(1),
  contentType: z.string().trim().min(1).optional().default("application/octet-stream"),
  encoding: z.enum(["utf8", "base64"]),
  content: z.string(),
  hash: z.string().trim().optional(),
  size: z.number().int().nonnegative().optional(),
});

const blogPostBundleInputSchema = z.object({
  id: z.string().trim().min(1),
  slug: z.string().trim().min(1).optional(),
  entryPath: z.string().trim().min(1),
  url: z.string().trim().min(1).optional(),
  metadata: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      published: z.string().nullable().optional(),
      updated: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().nullable().optional(),
      topic: z.string().nullable().optional(),
      series: z.string().nullable().optional(),
    })
    .optional(),
  files: z.array(blogBundleFileInputSchema).min(1),
  contentHash: z.string().trim().min(1).optional(),
});

const bundleSyncPayloadSchema = z.union([
  z.array(blogPostBundleInputSchema),
  z.object({
    posts: z.array(blogPostBundleInputSchema),
  }),
]);

export function getBearerToken(header: string | null): string | null {
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function parseSyncPayload(value: unknown): BlogPostInput[] {
  const parsed = syncPayloadSchema.parse(value);
  const posts = Array.isArray(parsed) ? parsed : parsed.posts;

  return posts.map((post) => ({
    ...post,
    slug: post.slug || post.id,
    description: post.description || "",
    tags: post.tags || [],
    category: post.category || null,
    published: post.published || null,
    updated: post.updated || null,
  }));
}

export function parseBundleSyncPayload(value: unknown): BlogPostBundleInput[] {
  const parsed = bundleSyncPayloadSchema.parse(value);
  const posts = Array.isArray(parsed) ? parsed : parsed.posts;

  return posts.map((post) => ({
    ...post,
    slug: post.slug || post.id.replace(/\.(md|mdx|markdown)$/i, "").replace(/\/index$/, ""),
    metadata: {
      title: post.metadata?.title || "",
      description: post.metadata?.description || "",
      published: post.metadata?.published || null,
      updated: post.metadata?.updated || null,
      tags: post.metadata?.tags || [],
      category: post.metadata?.category || null,
      topic: post.metadata?.topic || null,
      series: post.metadata?.series || null,
    },
  }));
}

export async function createContentHash(post: BlogPostInput): Promise<string> {
  if (post.contentHash) {
    return post.contentHash;
  }

  const payload = [
    post.id,
    post.slug,
    post.title,
    post.description,
    post.url,
    post.published || "",
    post.updated || "",
    JSON.stringify(post.tags || []),
    post.category || "",
    post.body,
  ].join("\n");

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getEmbeddingData(result: EmbeddingResponse): number[][] {
  if (Array.isArray(result.data)) {
    return result.data;
  }

  if (Array.isArray(result.response)) {
    return result.response;
  }

  throw new Error("Workers AI embedding response did not include vectors.");
}

export function sanitizeFtsQuery(term: string): string {
  const tokens = term
    .normalize("NFKC")
    .match(/[\p{L}\p{N}_]+/gu)
    ?.map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 12);

  if (!tokens?.length) {
    return "";
  }

  return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(" OR ");
}

export function normalizeQueries(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function parseRetrievalPreferences(raw: string): RetrievalPreferences | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  const candidates = [
    text,
    text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() || "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<RetrievalPreferences>;
      const confidence = Number(parsed.confidence ?? 0);
      const mode = parsed.mode === "chat" ? "chat" : "search";

      return {
        mode,
        preferImages: Boolean(parsed.preferImages),
        preferCode: Boolean(parsed.preferCode),
        preferRecent: Boolean(parsed.preferRecent),
        emphasizeProcess: Boolean(parsed.emphasizeProcess),
        confidence: Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0,
        rationale: typeof parsed.rationale === "string" ? parsed.rationale.trim() : undefined,
      };
    } catch {
      continue;
    }
  }

  return null;
}

export function dedupeSources(sources: BlogSource[], maxCount = 5): BlogSource[] {
  const seen = new Set<string>();
  const result: BlogSource[] = [];

  for (const source of sources) {
    const key = [
      source.postId || source.url,
      source.anchor || source.url,
      source.images?.[0]?.path || "",
    ].join("#");
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(source);

    if (result.length >= maxCount) {
      break;
    }
  }

  return result;
}
