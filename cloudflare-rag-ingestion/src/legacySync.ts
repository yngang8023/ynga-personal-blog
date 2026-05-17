import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import {
  getBlogCorpusId,
  getEmbeddingData,
  getEmbeddingModel,
  type BlogPostBundleInput,
} from "../../cloudflare-rag/app/lib/blogRag";
import {
  preparePostBundle,
  buildPostRevisionId,
  type PreparePostBundleMetrics,
  type PreparedPostBundle,
  type StoredBundleFile,
} from "../../cloudflare-rag/app/lib/postBundleIndexing";
import {
  blogImageAssets,
  blogImageOcrCache,
  blogPostChunks,
  blogPostImages,
  blogPostRevisions,
  blogPosts,
  blogPostSections,
} from "../../cloudflare-rag/schema";
import { cleanupLegacyOrphanPostData } from "./cleanup";
import type { IngestionEnv } from "./env";

const blogPostImageInsertBatchSize = 5;
const blogPostSectionInsertBatchSize = 6;
const blogPostChunkInsertBatchSize = 4;

interface IngestionStageMetrics {
  timings: {
    asset_upload_ms: number;
    ocr_ms: number;
    chunk_build_ms: number;
    db_write_ms: number;
    embedding_ms: number;
    vectorize_ms: number;
    finalize_ms: number;
  };
  stats: {
    file_count: number;
    referenced_image_count: number;
    ocr_image_count: number;
    section_count: number;
    chunk_count: number;
    vector_count: number;
    reused_asset_count: number;
    reused_ocr_count: number;
    reused_embedding_count: number;
  };
}

function createEmptyStageMetrics(): IngestionStageMetrics {
  return {
    timings: {
      asset_upload_ms: 0,
      ocr_ms: 0,
      chunk_build_ms: 0,
      db_write_ms: 0,
      embedding_ms: 0,
      vectorize_ms: 0,
      finalize_ms: 0,
    },
    stats: {
      file_count: 0,
      referenced_image_count: 0,
      ocr_image_count: 0,
      section_count: 0,
      chunk_count: 0,
      vector_count: 0,
      reused_asset_count: 0,
      reused_ocr_count: 0,
      reused_embedding_count: 0,
    },
  };
}

function mergeStageMetrics(
  base: IngestionStageMetrics,
  next: {
    timings?: Partial<IngestionStageMetrics["timings"]>;
    stats?: Partial<IngestionStageMetrics["stats"]>;
  },
): IngestionStageMetrics {
  return {
    timings: {
      ...base.timings,
      ...(next.timings || {}),
    },
    stats: {
      ...base.stats,
      ...(next.stats || {}),
    },
  };
}

function createRevisionId(postId: string, contentHash: string): string {
  return buildPostRevisionId(postId, contentHash);
}

function collectAssetContentHashes(prepared: PreparedPostBundle): string[] {
  return Array.from(new Set(prepared.files.map((file) => file.hash).filter(Boolean)));
}

function parseAssetContentHashes(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

async function adjustAssetReferenceCounts(
  db: ReturnType<typeof drizzle>,
  env: IngestionEnv,
  assetContentHashes: string[],
  delta: 1 | -1,
) {
  const now = new Date().toISOString();
  for (const contentHash of assetContentHashes) {
    const asset =
      (await db
        .select()
        .from(blogImageAssets)
        .where(eq(blogImageAssets.contentHash, contentHash))
        .limit(1))[0] || null;
    if (!asset) {
      continue;
    }

    const nextRefCount = Math.max(0, Number(asset.assetRefCount || 0) + delta);
    if (nextRefCount === 0) {
      await env.POST_ASSETS.delete(asset.r2Key);
      await db.delete(blogImageAssets).where(eq(blogImageAssets.contentHash, contentHash));
      continue;
    }

    await db
      .update(blogImageAssets)
      .set({
        assetRefCount: nextRefCount,
        updatedAt: now,
      })
      .where(eq(blogImageAssets.contentHash, contentHash));
  }
}

async function resolveExistingAssetKey(
  db: ReturnType<typeof drizzle>,
  file: StoredBundleFile,
): Promise<string | null> {
  const existingAsset =
    (await db
      .select()
      .from(blogImageAssets)
      .where(eq(blogImageAssets.contentHash, file.hash))
      .limit(1))[0] || null;

  return existingAsset?.r2Key || null;
}

async function resolveCachedImageOcrText(
  db: ReturnType<typeof drizzle>,
  file: StoredBundleFile,
): Promise<string | null> {
  const cachedOcr =
    (await db
      .select()
      .from(blogImageOcrCache)
      .where(eq(blogImageOcrCache.contentHash, file.hash))
      .limit(1))[0] || null;

  return cachedOcr?.ocrStatus === "completed" ? cachedOcr.ocrText : null;
}

async function cleanupObsoleteRevisions(
  db: ReturnType<typeof drizzle>,
  env: IngestionEnv,
  postId: string,
  keepRevisionId: string,
) {
  const obsoleteRevisions = await db
    .select({
      id: blogPostRevisions.id,
      assetContentHashesJson: blogPostRevisions.assetContentHashesJson,
    })
    .from(blogPostRevisions)
    .where(eq(blogPostRevisions.postId, postId));

  const staleRevisionIds = obsoleteRevisions
    .map((revision) => revision.id)
    .filter((revisionId) => revisionId !== keepRevisionId);

  if (staleRevisionIds.length === 0) {
    return;
  }

  const staleChunkRows = await db
    .select({
      id: blogPostChunks.id,
      revisionId: blogPostChunks.revisionId,
    })
    .from(blogPostChunks)
    .where(eq(blogPostChunks.postId, postId));
  const staleRevisionIdSet = new Set(staleRevisionIds);
  const staleChunkIds = staleChunkRows
    .filter((row) => row.revisionId && staleRevisionIdSet.has(row.revisionId))
    .map((row) => row.id);

  if (staleChunkIds.length > 0) {
    const batchSize = 1000;
    for (let i = 0; i < staleChunkIds.length; i += batchSize) {
      await env.VECTORIZE_INDEX.deleteByIds(staleChunkIds.slice(i, i + batchSize));
    }
  }

  for (const revisionId of staleRevisionIds) {
    const revision = obsoleteRevisions.find((entry) => entry.id === revisionId);
    await adjustAssetReferenceCounts(db, env, parseAssetContentHashes(revision?.assetContentHashesJson), -1);
    await db.delete(blogPostImages).where(eq(blogPostImages.revisionId, revisionId));
    await db.delete(blogPostChunks).where(eq(blogPostChunks.revisionId, revisionId));
    await db.delete(blogPostSections).where(eq(blogPostSections.revisionId, revisionId));
    await db.delete(blogPostRevisions).where(eq(blogPostRevisions.id, revisionId));
  }
}

async function switchCurrentRevision(
  db: ReturnType<typeof drizzle>,
  postId: string,
  revisionId: string,
  prepared: PreparedPostBundle,
  sessionId?: string,
) {
  const now = new Date().toISOString();
  await db
    .update(blogPosts)
    .set({
      slug: prepared.post.slug,
      title: prepared.post.title,
      description: prepared.post.description,
      url: prepared.post.url,
      published: prepared.post.published,
      updated: prepared.post.updated,
      tags: JSON.stringify(prepared.post.tags),
      category: prepared.post.category,
      topic: prepared.post.topic,
      series: prepared.post.series,
      hasImages: prepared.post.hasImages,
      hasCodeBlocks: prepared.post.hasCodeBlocks,
      sectionCount: prepared.post.sectionCount,
      imageCount: prepared.post.imageCount,
      contentHash: prepared.post.contentHash,
      sourcePrefix: prepared.post.sourcePrefix,
      currentRevisionId: revisionId,
      lastCompletedRevisionId: revisionId,
      syncStatus: "completed",
      vectorStatus: "completed",
      lastError: null,
      lastSessionId: sessionId || null,
      updatedAt: now,
    })
    .where(eq(blogPosts.id, postId));
}

async function ensurePostRecord(
  db: ReturnType<typeof drizzle>,
  prepared: PreparedPostBundle,
  sessionId?: string,
) {
  const now = new Date().toISOString();
  const existing =
    (await db.select().from(blogPosts).where(eq(blogPosts.id, prepared.post.id)).limit(1))[0] || null;

  if (existing) {
    await db
      .update(blogPosts)
      .set({
        slug: prepared.post.slug,
        title: prepared.post.title,
        description: prepared.post.description,
        url: prepared.post.url,
        published: prepared.post.published,
        updated: prepared.post.updated,
        tags: JSON.stringify(prepared.post.tags),
        category: prepared.post.category,
        topic: prepared.post.topic,
        series: prepared.post.series,
        hasImages: prepared.post.hasImages,
        hasCodeBlocks: prepared.post.hasCodeBlocks,
        sectionCount: prepared.post.sectionCount,
        imageCount: prepared.post.imageCount,
        contentHash: prepared.post.contentHash,
        sourcePrefix: prepared.post.sourcePrefix,
        syncStatus: "processing",
        vectorStatus: "processing",
        lastError: null,
        lastSessionId: sessionId || existing.lastSessionId || null,
        updatedAt: now,
      })
      .where(eq(blogPosts.id, prepared.post.id));
    return existing;
  }

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
    topic: prepared.post.topic,
    series: prepared.post.series,
    hasImages: prepared.post.hasImages,
    hasCodeBlocks: prepared.post.hasCodeBlocks,
    sectionCount: prepared.post.sectionCount,
    imageCount: prepared.post.imageCount,
    contentHash: prepared.post.contentHash,
    sourcePrefix: prepared.post.sourcePrefix,
    syncStatus: "processing",
    vectorStatus: "processing",
    lastSessionId: sessionId || null,
    createdAt: now,
    updatedAt: now,
  });

  return null;
}

async function ensureAssetAndOcrCache(
  db: ReturnType<typeof drizzle>,
  prepared: PreparedPostBundle,
) {
  const now = new Date().toISOString();
  const uniqueAssets = new Map(prepared.files.map((file) => [file.hash, file]));

  for (const file of uniqueAssets.values()) {
    const existingAsset =
      (await db
        .select()
        .from(blogImageAssets)
        .where(eq(blogImageAssets.contentHash, file.hash))
        .limit(1))[0] || null;

    if (!existingAsset) {
      await db.insert(blogImageAssets).values({
        contentHash: file.hash,
        r2Key: file.r2Key,
        contentType: file.contentType,
        byteSize: file.size || 0,
        assetRefCount: 0,
        firstSeenPostId: prepared.post.id,
        createdAt: now,
        updatedAt: now,
      });
      continue;
    }

    await db
      .update(blogImageAssets)
      .set({
        r2Key: existingAsset.r2Key || file.r2Key,
        contentType: existingAsset.contentType || file.contentType,
        byteSize: existingAsset.byteSize || file.size || 0,
        updatedAt: now,
      })
      .where(eq(blogImageAssets.contentHash, file.hash));
  }

  for (const image of prepared.images) {
    const existingAsset =
      (await db
        .select()
        .from(blogImageAssets)
        .where(eq(blogImageAssets.contentHash, image.contentHash))
        .limit(1))[0] || null;

    if (!existingAsset) {
      await db.insert(blogImageAssets).values({
        contentHash: image.contentHash,
        r2Key: image.r2Key,
        contentType: image.contentType,
        byteSize: 0,
        assetRefCount: 0,
        firstSeenPostId: prepared.post.id,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingOcr =
      (await db
        .select()
        .from(blogImageOcrCache)
        .where(eq(blogImageOcrCache.contentHash, image.contentHash))
        .limit(1))[0] || null;

    if (!existingOcr) {
      await db.insert(blogImageOcrCache).values({
        contentHash: image.contentHash,
        ocrText: image.ocrText,
        ocrStatus: "completed",
        model: "workers-ai-to-markdown",
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

async function writeRevisionData(
  db: ReturnType<typeof drizzle>,
  env: IngestionEnv,
  prepared: PreparedPostBundle,
  revisionId: string,
  sessionId?: string,
) {
  const now = new Date().toISOString();
  const embeddingModel = getEmbeddingModel(env as never);
  const blogCorpusId = getBlogCorpusId(env as never);
  const nextAssetContentHashes = collectAssetContentHashes(prepared);
  let dbWriteMs = 0;
  let embeddingMs = 0;
  let vectorizeMs = 0;
  const existingRevision =
    (await db
      .select({
        assetContentHashesJson: blogPostRevisions.assetContentHashesJson,
      })
      .from(blogPostRevisions)
      .where(eq(blogPostRevisions.id, revisionId))
      .limit(1))[0] || null;
  const existingAssetContentHashes = parseAssetContentHashes(existingRevision?.assetContentHashesJson);

  let dbStartedAt = Date.now();
  await db.delete(blogPostImages).where(eq(blogPostImages.revisionId, revisionId));
  await db.delete(blogPostChunks).where(eq(blogPostChunks.revisionId, revisionId));
  await db.delete(blogPostSections).where(eq(blogPostSections.revisionId, revisionId));
  await db.delete(blogPostRevisions).where(eq(blogPostRevisions.id, revisionId));
  dbWriteMs += Date.now() - dbStartedAt;

  dbStartedAt = Date.now();
  await db.insert(blogPostRevisions).values({
    id: revisionId,
    postId: prepared.post.id,
    sessionId: sessionId || null,
    contentHash: prepared.post.contentHash,
    status: "processing",
    vectorStatus: "processing",
    sourcePrefix: prepared.post.sourcePrefix,
    bundleR2Key: "",
    title: prepared.post.title,
    description: prepared.post.description,
    url: prepared.post.url,
    published: prepared.post.published,
    updated: prepared.post.updated,
    tags: JSON.stringify(prepared.post.tags),
    category: prepared.post.category,
    topic: prepared.post.topic,
    series: prepared.post.series,
    sectionCount: prepared.post.sectionCount,
    imageCount: prepared.post.imageCount,
    chunkCount: prepared.chunks.length,
    hasImages: prepared.post.hasImages,
    hasCodeBlocks: prepared.post.hasCodeBlocks,
    assetContentHashesJson: JSON.stringify(nextAssetContentHashes),
    createdAt: now,
    updatedAt: now,
  });
  dbWriteMs += Date.now() - dbStartedAt;
  const staleAssetContentHashes = existingAssetContentHashes.filter((hash) => !nextAssetContentHashes.includes(hash));
  const freshAssetContentHashes = nextAssetContentHashes.filter((hash) => !existingAssetContentHashes.includes(hash));
  await adjustAssetReferenceCounts(db, env, staleAssetContentHashes, -1);
  await adjustAssetReferenceCounts(db, env, freshAssetContentHashes, 1);

  for (let i = 0; i < prepared.sections.length; i += blogPostSectionInsertBatchSize) {
    const batch = prepared.sections.slice(i, i + blogPostSectionInsertBatchSize);
    if (batch.length === 0) {
      continue;
    }
    dbStartedAt = Date.now();
    await db.insert(blogPostSections).values(
      batch.map((section) => ({
        id: section.id,
        postId: prepared.post.id,
        revisionId,
        sectionKey: section.sectionKey,
        sectionIndex: section.sectionIndex,
        title: section.title,
        url: section.url,
        heading: section.heading,
        anchor: section.anchor,
        summary: section.summary,
        text: section.text,
        hasImages: section.hasImages,
        hasCodeBlocks: section.hasCodeBlocks,
        imageRefs: JSON.stringify(section.imageRefs),
      })),
    );
    dbWriteMs += Date.now() - dbStartedAt;
  }

  for (let i = 0; i < prepared.images.length; i += blogPostImageInsertBatchSize) {
    const batch = prepared.images.slice(i, i + blogPostImageInsertBatchSize);
    if (batch.length === 0) {
      continue;
    }
    dbStartedAt = Date.now();
    await db.insert(blogPostImages).values(
      batch.map((image) => ({
        id: image.id,
        postId: prepared.post.id,
        revisionId,
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
    dbWriteMs += Date.now() - dbStartedAt;
  }

  if (prepared.chunks.length === 0) {
    dbStartedAt = Date.now();
    await db
      .update(blogPostRevisions)
      .set({
        status: "completed",
        vectorStatus: "completed",
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(blogPostRevisions.id, revisionId));
    dbWriteMs += Date.now() - dbStartedAt;

    return {
      chunkCount: 0,
      imageCount: prepared.images.length,
      metrics: {
        timings: {
          db_write_ms: dbWriteMs,
          embedding_ms: 0,
          vectorize_ms: 0,
          finalize_ms: 0,
        },
        stats: {
          section_count: prepared.sections.length,
          chunk_count: 0,
          vector_count: 0,
          reused_embedding_count: 0,
        },
      },
    };
  }

  for (let i = 0; i < prepared.chunks.length; i += blogPostChunkInsertBatchSize) {
    const batch = prepared.chunks.slice(i, i + blogPostChunkInsertBatchSize);
    if (batch.length === 0) {
      continue;
    }
    dbStartedAt = Date.now();
    await db.insert(blogPostChunks).values(
      batch.map((chunk) => ({
        id: chunk.id,
        postId: prepared.post.id,
        revisionId,
        sectionId: chunk.sectionId,
        chunkKey: chunk.chunkKey,
        chunkHash: chunk.chunkHash,
        chunkIndex: chunk.chunkIndex,
        sectionIndex: chunk.sectionIndex,
        title: chunk.title,
        url: chunk.url,
        heading: chunk.heading,
        anchor: chunk.anchor,
        category: chunk.category,
        tags: JSON.stringify(chunk.tags),
        topic: chunk.topic,
        series: chunk.series,
        published: chunk.published,
        updated: chunk.updated,
        hasImages: chunk.hasImages,
        hasCodeBlocks: chunk.hasCodeBlocks,
        imageRefs: JSON.stringify(chunk.imageRefs),
        parentText: chunk.parentText,
        text: chunk.text,
      })),
    );
    dbWriteMs += Date.now() - dbStartedAt;
  }

  const embeddingBatchSize = 20;
  for (let i = 0; i < prepared.chunks.length; i += embeddingBatchSize) {
    const batch = prepared.chunks.slice(i, i + embeddingBatchSize);
    const embeddingStartedAt = Date.now();
    const embeddingResult = await env.AI.run(embeddingModel as never, {
      text: batch.map((chunk) => chunk.text),
    });
    embeddingMs += Date.now() - embeddingStartedAt;
    const vectors = getEmbeddingData(embeddingResult as never);
    const vectorizeStartedAt = Date.now();
    await env.VECTORIZE_INDEX.upsert(
      batch.map((chunk, index) => ({
        id: chunk.id,
        values: vectors[index],
        namespace: blogCorpusId,
        metadata: {
          corpusId: blogCorpusId,
          postId: prepared.post.id,
          revisionId,
          title: prepared.post.title,
          url: chunk.url,
          heading: chunk.heading || "",
          anchor: chunk.anchor || "",
          category: chunk.category || "",
          tags: chunk.tags,
          topic: chunk.topic || "",
          series: chunk.series || "",
          published: chunk.published || "",
          updated: chunk.updated || "",
          hasImages: chunk.hasImages,
          hasCodeBlocks: chunk.hasCodeBlocks,
          sectionIndex: chunk.sectionIndex,
          parentText: chunk.parentText,
          chunkIndex: chunk.chunkIndex,
          imageRefs: JSON.stringify(chunk.imageRefs),
          text: chunk.text,
        },
      })),
    );
    vectorizeMs += Date.now() - vectorizeStartedAt;
  }

  dbStartedAt = Date.now();
  await db
    .update(blogPostRevisions)
    .set({
      status: "completed",
      vectorStatus: "completed",
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(blogPostRevisions.id, revisionId));
  dbWriteMs += Date.now() - dbStartedAt;

  return {
    chunkCount: prepared.chunks.length,
    imageCount: prepared.images.length,
    metrics: {
      timings: {
        db_write_ms: dbWriteMs,
        embedding_ms: embeddingMs,
        vectorize_ms: vectorizeMs,
        finalize_ms: 0,
      },
      stats: {
        section_count: prepared.sections.length,
        chunk_count: prepared.chunks.length,
        vector_count: prepared.chunks.length,
        reused_embedding_count: 0,
      },
    },
  };
}

async function hasHealthyRevision(
  db: ReturnType<typeof drizzle>,
  revisionId: string | null | undefined,
): Promise<boolean> {
  if (!revisionId) {
    return false;
  }

  const revision =
    (await db
      .select()
      .from(blogPostRevisions)
      .where(eq(blogPostRevisions.id, revisionId))
      .limit(1))[0] || null;

  return Boolean(revision && revision.status === "completed" && revision.vectorStatus === "completed");
}

function shouldSkipPostSync(
  existing: typeof blogPosts.$inferSelect | undefined,
  post: BlogPostBundleInput,
  healthyCurrentRevision: boolean,
  forceRebuild: boolean,
) {
  if (forceRebuild || !existing || !healthyCurrentRevision) {
    return false;
  }

  const expectedSlug = post.slug || post.id;
  const expectedSourcePrefix = "assets/posts/by-hash/";

  return (
    existing.contentHash === post.contentHash &&
    existing.slug === expectedSlug &&
    existing.url === (post.url || existing.url) &&
    (existing.sourcePrefix || "") === expectedSourcePrefix
  );
}

export async function processLegacyBundleSync(
  env: IngestionEnv,
  post: BlogPostBundleInput,
  siteURL?: string,
  forceRebuild = false,
  sessionId?: string,
) {
  const db = drizzle(env.DB);
  const overallStartedAt = Date.now();
  const existing =
    (await db.select().from(blogPosts).where(eq(blogPosts.id, post.id)).limit(1))[0] || undefined;
  const healthyCurrentRevision = await hasHealthyRevision(db, existing?.currentRevisionId);
  await cleanupLegacyOrphanPostData(env, post.id);

  if (shouldSkipPostSync(existing, post, healthyCurrentRevision, forceRebuild)) {
    return {
      status: "skipped",
      chunkCount: 0,
      imageCount: 0,
      fileCount: 0,
      metrics: createEmptyStageMetrics(),
    };
  }

  const prepared = await preparePostBundle(env as never, post, siteURL, {
    includeUnreferencedImages: false,
    resolveExistingAssetKey: (file) => resolveExistingAssetKey(db, file),
    resolveCachedImageOcrText: (file) => resolveCachedImageOcrText(db, file),
  });
  const revisionId = createRevisionId(prepared.post.id, prepared.post.contentHash);
  const metrics = mergeStageMetrics(createEmptyStageMetrics(), {
    timings: {
      asset_upload_ms: prepared.metrics.timings.asset_upload_ms,
      ocr_ms: prepared.metrics.timings.ocr_ms,
      chunk_build_ms: prepared.metrics.timings.chunk_build_ms,
    },
    stats: {
      file_count: prepared.metrics.stats.file_count,
      referenced_image_count: prepared.metrics.stats.referenced_image_count,
      ocr_image_count: prepared.metrics.stats.ocr_image_count,
      section_count: prepared.metrics.stats.section_count,
      chunk_count: prepared.metrics.stats.chunk_count,
      reused_asset_count: prepared.metrics.stats.reused_asset_count,
      reused_ocr_count: prepared.metrics.stats.reused_ocr_count,
    },
  });
  await ensurePostRecord(db, prepared, sessionId);
  await ensureAssetAndOcrCache(db, prepared);
  const result = await writeRevisionData(db, env, prepared, revisionId, sessionId);
  const finalizeStartedAt = Date.now();
  await switchCurrentRevision(db, post.id, revisionId, prepared, sessionId);
  await cleanupObsoleteRevisions(db, env, post.id, revisionId);
  metrics.timings.finalize_ms = Date.now() - finalizeStartedAt;
  metrics.timings.db_write_ms = result.metrics.timings.db_write_ms;
  metrics.timings.embedding_ms = result.metrics.timings.embedding_ms;
  metrics.timings.vectorize_ms = result.metrics.timings.vectorize_ms;
  metrics.stats.section_count = result.metrics.stats.section_count;
  metrics.stats.chunk_count = result.metrics.stats.chunk_count;
  metrics.stats.vector_count = result.metrics.stats.vector_count;
  metrics.stats.reused_embedding_count = result.metrics.stats.reused_embedding_count;
  const totalFinalizeMs = Date.now() - overallStartedAt;

  return {
    status: "completed",
    revisionId,
    chunkCount: result.chunkCount,
    imageCount: result.imageCount,
    fileCount: prepared.files.length,
    metrics: {
      ...metrics,
      timings: {
        ...metrics.timings,
        finalize_ms: metrics.timings.finalize_ms || totalFinalizeMs,
      },
    },
  };
}
