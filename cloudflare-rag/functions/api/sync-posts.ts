import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { blogPostChunks, blogPostImages, blogPosts } from "schema";
import {
  BlogPostBundleInput,
  getBearerToken,
  getBlogCorpusId,
  getEmbeddingModel,
  getEmbeddingData,
  parseBundleSyncPayload,
} from "~/lib/blogRag";
import { PreparedPostBundle, deleteR2Prefix, preparePostBundle } from "~/lib/postBundleIndexing";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

const blogPostImageInsertBatchSize = 5;
const blogPostChunkInsertBatchSize = 8;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function shouldForceRebuild(payload: unknown): boolean {
  return (
    payload !== null &&
    typeof payload === "object" &&
    (payload as { force?: unknown }).force === true
  );
}

async function getPostIdsWithChunks(
  db: ReturnType<typeof drizzle>,
  postIds: string[],
): Promise<Set<string>> {
  const result = new Set<string>();
  const batchSize = 50;

  for (let i = 0; i < postIds.length; i += batchSize) {
    const batch = postIds.slice(i, i + batchSize);
    if (batch.length === 0) {
      continue;
    }

    const rows = await db
      .select({ postId: blogPostChunks.postId })
      .from(blogPostChunks)
      .where(inArray(blogPostChunks.postId, batch));

    for (const row of rows) {
      result.add(row.postId);
    }
  }

  return result;
}

async function deleteVectorsForChunks(index: VectorizeIndex, chunkIds: string[]) {
  const batchSize = 100;
  for (let i = 0; i < chunkIds.length; i += batchSize) {
    await index.deleteByIds(chunkIds.slice(i, i + batchSize));
  }
}

async function deletePostData(
  db: ReturnType<typeof drizzle>,
  env: Env,
  postId: string,
  sourcePrefix?: string,
) {
  const chunks = await db
    .select({ id: blogPostChunks.id })
    .from(blogPostChunks)
    .where(eq(blogPostChunks.postId, postId));

  if (chunks.length > 0) {
    await deleteVectorsForChunks(env.VECTORIZE_INDEX, chunks.map((chunk) => chunk.id));
  }

  await db.delete(blogPostImages).where(eq(blogPostImages.postId, postId));
  await db.delete(blogPostChunks).where(eq(blogPostChunks.postId, postId));
  await db.delete(blogPosts).where(eq(blogPosts.id, postId));

  if (sourcePrefix) {
    await deleteR2Prefix(env.POST_ASSETS, sourcePrefix);
  }
}

async function upsertPreparedPost(
  db: ReturnType<typeof drizzle>,
  env: Env,
  prepared: PreparedPostBundle,
) {
  const now = new Date().toISOString();
  const embeddingModel = getEmbeddingModel(env);
  const blogCorpusId = getBlogCorpusId(env);

  await db.insert(blogPosts).values({
    id: prepared.post.id,
    slug: prepared.post.slug,
    title: prepared.post.title,
    description: prepared.post.description,
    url: prepared.post.url,
    published: prepared.post.published,
    updated: prepared.post.updated,
    tags: JSON.stringify(prepared.post.tags),
    category: prepared.post.category,
    contentHash: prepared.post.contentHash,
    sourcePrefix: prepared.post.sourcePrefix,
    createdAt: now,
    updatedAt: now,
  });

  if (prepared.images.length > 0) {
    for (let i = 0; i < prepared.images.length; i += blogPostImageInsertBatchSize) {
      await db.insert(blogPostImages).values(
        prepared.images.slice(i, i + blogPostImageInsertBatchSize).map((image) => ({
          id: image.id,
          postId: prepared.post.id,
          relativePath: image.relativePath,
          r2Key: image.r2Key,
          url: image.url,
          alt: image.alt,
          title: image.title,
          heading: image.heading,
          anchor: image.anchor,
          surroundingText: image.surroundingText,
          ocrText: image.ocrText,
          contentType: image.contentType,
          contentHash: image.contentHash,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
  }

  if (prepared.chunks.length === 0) {
    return { chunkCount: 0, imageCount: prepared.images.length };
  }

  for (let i = 0; i < prepared.chunks.length; i += blogPostChunkInsertBatchSize) {
    await db.insert(blogPostChunks).values(
      prepared.chunks.slice(i, i + blogPostChunkInsertBatchSize).map((chunk) => ({
        id: chunk.id,
        postId: prepared.post.id,
        chunkIndex: chunk.chunkIndex,
        title: chunk.title,
        url: chunk.url,
        heading: chunk.heading,
        anchor: chunk.anchor,
        imageRefs: JSON.stringify(chunk.imageRefs),
        text: chunk.text,
      })),
    );
  }

  const embeddingBatchSize = 20;
  for (let i = 0; i < prepared.chunks.length; i += embeddingBatchSize) {
    const batch = prepared.chunks.slice(i, i + embeddingBatchSize);
    const embeddingResult = await env.AI.run(embeddingModel as any, {
      text: batch.map((chunk) => chunk.text),
    });
    const vectors = getEmbeddingData(embeddingResult as any);

    await env.VECTORIZE_INDEX.upsert(
      batch.map((chunk, index) => ({
        id: chunk.id,
        values: vectors[index],
        namespace: blogCorpusId,
        metadata: {
          corpusId: blogCorpusId,
          postId: prepared.post.id,
          title: prepared.post.title,
          url: chunk.url,
          heading: chunk.heading || "",
          anchor: chunk.anchor || "",
          chunkIndex: chunk.chunkIndex,
          imageRefs: JSON.stringify(chunk.imageRefs),
          text: chunk.text,
        },
      })),
    );
  }

  return { chunkCount: prepared.chunks.length, imageCount: prepared.images.length };
}

function shouldSkipPostSync(
  existing: typeof blogPosts.$inferSelect | undefined,
  post: BlogPostBundleInput,
  hasStoredChunks: boolean,
  forceRebuild: boolean,
) {
  if (forceRebuild) {
    return false;
  }

  if (!existing) {
    return false;
  }

  const expectedSlug = post.slug || post.id;
  const expectedSourcePrefix = `posts/${expectedSlug}/`;

  return (
    existing.contentHash === post.contentHash &&
    existing.slug === expectedSlug &&
    existing.url === (post.url || existing.url) &&
    (existing.sourcePrefix || "") === expectedSourcePrefix &&
    hasStoredChunks
  );
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  try {
    if (ctx.request.method !== "POST") {
      return jsonResponse({ error: "Expected POST." }, 405);
    }

    const token = getBearerToken(ctx.request.headers.get("authorization"));
    if (!ctx.env.RAG_SYNC_TOKEN || token !== ctx.env.RAG_SYNC_TOKEN) {
      return jsonResponse({ error: "Unauthorized." }, 401);
    }

    let payload: unknown;
    let posts;
    try {
      payload = await ctx.request.json();
      posts = parseBundleSyncPayload(payload);
    } catch (error) {
      return jsonResponse(
        {
          error: `Invalid sync payload: ${(error as Error).message}`,
        },
        400,
      );
    }

    if (posts.length === 0) {
      return jsonResponse({ error: "Sync payload must include at least one post bundle." }, 400);
    }

    const forceRebuild = shouldForceRebuild(payload);

    const siteURL =
      payload &&
      typeof payload === "object" &&
      typeof (payload as { siteURL?: unknown }).siteURL === "string"
        ? (payload as { siteURL: string }).siteURL
        : undefined;

    const db = drizzle(ctx.env.DB);
    const existingPosts = await db.select().from(blogPosts);
    const incomingIds = new Set(posts.map((post) => post.id));
    const existingById = new Map(existingPosts.map((post) => [post.id, post]));
    const postIdsWithChunks = await getPostIdsWithChunks(db, posts.map((post) => post.id));
    const deletedPosts = existingPosts.filter((post) => !incomingIds.has(post.id));

    for (const post of deletedPosts) {
      await deletePostData(db, ctx.env, post.id, post.sourcePrefix || undefined);
    }

    let unchanged = 0;
    let updated = 0;
    let created = 0;
    let chunks = 0;
    let images = 0;
    let files = 0;

    for (const post of posts) {
      const existing = existingById.get(post.id);

      if (shouldSkipPostSync(existing, post, postIdsWithChunks.has(post.id), forceRebuild)) {
        unchanged += 1;
        continue;
      }

      if (existing) {
        await deletePostData(db, ctx.env, post.id, existing.sourcePrefix || undefined);
        updated += 1;
      } else {
        created += 1;
      }

      const prepared = await preparePostBundle(ctx.env, post, siteURL);
      const result = await upsertPreparedPost(db, ctx.env, prepared);
      chunks += result.chunkCount;
      images += result.imageCount;
      files += prepared.files.length;
    }

    const activeIds = posts.map((post) => post.id);
    if (activeIds.length > 0) {
      const storedActivePosts = await db
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(inArray(blogPosts.id, activeIds));

      if (storedActivePosts.length !== activeIds.length) {
        return jsonResponse(
          {
            error: "Sync finished but stored post count did not match incoming post count.",
            incoming: activeIds.length,
            stored: storedActivePosts.length,
          },
          500,
        );
      }
    }

    return jsonResponse({
      ok: true,
      corpusId: getBlogCorpusId(ctx.env),
      forceRebuild,
      received: posts.length,
      created,
      updated,
      unchanged,
      deleted: deletedPosts.length,
      files,
      images,
      chunks,
    });
  } catch (error) {
    return jsonResponse(
      {
        error: "Blog post sync failed.",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      },
      500,
    );
  }
};
