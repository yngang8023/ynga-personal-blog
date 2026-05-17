import { and, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import {
  blogImageAssets,
  blogPostChunks,
  blogPostImages,
  blogPostRevisions,
  blogPosts,
  blogPostSections,
  blogSyncSessionPosts,
  blogSyncSessions,
} from "../../cloudflare-rag/schema";
import type { IngestionEnv } from "./env";

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function parseActivePostIds(value: string | null | undefined): string[] {
  return parseJsonArray(value);
}

function parseAssetContentHashes(value: string | null | undefined): string[] {
  return parseJsonArray(value);
}

async function decrementAssetReferencesForRevision(
  db: ReturnType<typeof drizzle>,
  env: IngestionEnv,
  revisionId: string,
) {
  const revision =
    (await db
      .select({
        assetContentHashesJson: blogPostRevisions.assetContentHashesJson,
      })
      .from(blogPostRevisions)
      .where(eq(blogPostRevisions.id, revisionId))
      .limit(1))[0] || null;
  if (!revision) {
    return;
  }

  const assetContentHashes = parseAssetContentHashes(revision.assetContentHashesJson);
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

    const nextRefCount = Math.max(0, Number(asset.assetRefCount || 0) - 1);
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

async function shouldDeleteLegacyOrphanAssetObject(
  db: ReturnType<typeof drizzle>,
  r2Key: string,
): Promise<boolean> {
  const linkedAsset =
    (await db
      .select({
        assetRefCount: blogImageAssets.assetRefCount,
      })
      .from(blogImageAssets)
      .where(eq(blogImageAssets.r2Key, r2Key))
      .limit(1))[0] || null;

  return !linkedAsset || Number(linkedAsset.assetRefCount || 0) <= 0;
}

export async function cleanupLegacyOrphanPostData(
  env: IngestionEnv,
  postId: string,
): Promise<{
  deletedLegacyOrphanChunkCount: number;
  deletedLegacyOrphanVectorCount: number;
  deletedLegacyOrphanImageCount: number;
  deletedLegacyOrphanSectionCount: number;
  deletedLegacyOrphanAssetCount: number;
}> {
  const db = drizzle(env.DB);
  const orphanChunkRows = await db
    .select({
      id: blogPostChunks.id,
    })
    .from(blogPostChunks)
    .where(and(eq(blogPostChunks.postId, postId), isNull(blogPostChunks.revisionId)));
  const orphanImageRows = await db
    .select({
      r2Key: blogPostImages.r2Key,
    })
    .from(blogPostImages)
    .where(and(eq(blogPostImages.postId, postId), isNull(blogPostImages.revisionId)));
  const orphanSectionRows = await db
    .select({
      id: blogPostSections.id,
    })
    .from(blogPostSections)
    .where(and(eq(blogPostSections.postId, postId), isNull(blogPostSections.revisionId)));

  const orphanChunkIds = orphanChunkRows.map((row) => row.id);
  let deletedLegacyOrphanVectorCount = 0;
  if (orphanChunkIds.length > 0) {
    for (let i = 0; i < orphanChunkIds.length; i += 1000) {
      const batch = orphanChunkIds.slice(i, i + 1000);
      await env.VECTORIZE_INDEX.deleteByIds(batch);
      deletedLegacyOrphanVectorCount += batch.length;
    }
  }

  let deletedLegacyOrphanAssetCount = 0;
  const orphanAssetKeys: string[] = Array.from(
    new Set(
      orphanImageRows
        .map((row) => row.r2Key)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ) as string[];
  for (const r2Key of orphanAssetKeys) {
    if (!(await shouldDeleteLegacyOrphanAssetObject(db, r2Key))) {
      continue;
    }
    await env.POST_ASSETS.delete(r2Key);
    deletedLegacyOrphanAssetCount += 1;
  }

  if (orphanImageRows.length > 0) {
    await db
      .delete(blogPostImages)
      .where(and(eq(blogPostImages.postId, postId), isNull(blogPostImages.revisionId)));
  }
  if (orphanChunkRows.length > 0) {
    await db
      .delete(blogPostChunks)
      .where(and(eq(blogPostChunks.postId, postId), isNull(blogPostChunks.revisionId)));
  }
  if (orphanSectionRows.length > 0) {
    await db
      .delete(blogPostSections)
      .where(and(eq(blogPostSections.postId, postId), isNull(blogPostSections.revisionId)));
  }

  return {
    deletedLegacyOrphanChunkCount: orphanChunkRows.length,
    deletedLegacyOrphanVectorCount,
    deletedLegacyOrphanImageCount: orphanImageRows.length,
    deletedLegacyOrphanSectionCount: orphanSectionRows.length,
    deletedLegacyOrphanAssetCount,
  };
}

export async function pruneMissingPostsForSession(
  env: IngestionEnv,
  sessionId: string,
): Promise<{ prunedPostCount: number; prunedPostIds: string[] }> {
  const db = drizzle(env.DB);
  const session =
    (await db.select().from(blogSyncSessions).where(eq(blogSyncSessions.id, sessionId)).limit(1))[0] || null;
  if (!session?.pruneMissing) {
    return { prunedPostCount: 0, prunedPostIds: [] };
  }

  const activePostIds = parseJsonArray(session.activePostIdsJson);
  const allPosts = await db.select({ id: blogPosts.id }).from(blogPosts);
  const prunedPostIds = allPosts
    .map((post) => post.id)
    .filter((postId) => !activePostIds.includes(postId));

  if (prunedPostIds.length === 0) {
    return { prunedPostCount: 0, prunedPostIds: [] };
  }

  const now = new Date().toISOString();
  for (const postId of prunedPostIds) {
    await db
      .update(blogPosts)
      .set({
        syncStatus: "pending_delete",
        vectorStatus: "pending",
        currentRevisionId: null,
        updatedAt: now,
        lastSessionId: sessionId,
      })
      .where(eq(blogPosts.id, postId));
  }

  return {
    prunedPostCount: prunedPostIds.length,
    prunedPostIds,
  };
}

export async function cleanupSessionArtifacts(
  env: IngestionEnv,
  sessionId: string,
): Promise<{ deletedStagingCount: number }> {
  const db = drizzle(env.DB);
  const sessionPosts = await db
    .select({
      bundleR2Key: blogSyncSessionPosts.bundleR2Key,
    })
    .from(blogSyncSessionPosts)
    .where(eq(blogSyncSessionPosts.sessionId, sessionId));

  let deletedStagingCount = 0;
  for (const post of sessionPosts) {
    if (!post.bundleR2Key) {
      continue;
    }
    await env.BLOG_SYNC_STAGING.delete(post.bundleR2Key);
    deletedStagingCount += 1;
  }

  return { deletedStagingCount };
}

export async function purgePendingDeletePosts(
  env: IngestionEnv,
  postIds: string[],
): Promise<{ deletedPostCount: number; deletedVectorCount: number }> {
  if (postIds.length === 0) {
    return { deletedPostCount: 0, deletedVectorCount: 0 };
  }

  const db = drizzle(env.DB);
  const revisions = await db
    .select({
      id: blogPostRevisions.id,
      postId: blogPostRevisions.postId,
    })
    .from(blogPostRevisions)
    .where(inArray(blogPostRevisions.postId, postIds));

  const revisionIds = revisions.map((revision) => revision.id);
  let deletedVectorCount = 0;

  for (const revisionId of revisionIds) {
    await decrementAssetReferencesForRevision(db, env, revisionId);
    const chunkRows = await db
      .select({
        id: blogPostChunks.id,
      })
      .from(blogPostChunks)
      .where(eq(blogPostChunks.revisionId, revisionId));

    const chunkIds = chunkRows.map((row) => row.id);
    if (chunkIds.length > 0) {
      for (let i = 0; i < chunkIds.length; i += 1000) {
        const batch = chunkIds.slice(i, i + 1000);
        await env.VECTORIZE_INDEX.deleteByIds(batch);
        deletedVectorCount += batch.length;
      }
    }

    await db.delete(blogPostImages).where(eq(blogPostImages.revisionId, revisionId));
    await db.delete(blogPostChunks).where(eq(blogPostChunks.revisionId, revisionId));
    await db.delete(blogPostSections).where(eq(blogPostSections.revisionId, revisionId));
    await db.delete(blogPostRevisions).where(eq(blogPostRevisions.id, revisionId));
  }

  for (const postId of postIds) {
    await db.delete(blogPosts).where(and(eq(blogPosts.id, postId), eq(blogPosts.syncStatus, "pending_delete")));
  }

  return {
    deletedPostCount: postIds.length,
    deletedVectorCount,
  };
}

export async function collectSessionPostSummary(
  env: IngestionEnv,
  sessionId: string,
): Promise<{
  expectedPostCount: number;
  uploadedPostCount: number;
  processedPostCount: number;
  succeededPostCount: number;
  failedPostCount: number;
  skippedPostCount: number;
  allProcessed: boolean;
  hasFailures: boolean;
}> {
  const db = drizzle(env.DB);
  const session =
    (await db.select().from(blogSyncSessions).where(eq(blogSyncSessions.id, sessionId)).limit(1))[0] || null;
  if (!session) {
    return {
      expectedPostCount: 0,
      uploadedPostCount: 0,
      processedPostCount: 0,
      succeededPostCount: 0,
      failedPostCount: 0,
      skippedPostCount: 0,
      allProcessed: true,
      hasFailures: true,
    };
  }

  const posts = await db
    .select({
      status: blogSyncSessionPosts.status,
    })
    .from(blogSyncSessionPosts)
    .where(eq(blogSyncSessionPosts.sessionId, sessionId));

  const uploadedPostCount = posts.length;
  const succeededPostCount = posts.filter((post) => post.status === "completed").length;
  const skippedPostCount = posts.filter((post) => post.status === "skipped").length;
  const failedPostCount = posts.filter((post) => post.status === "failed").length;
  const processedPostCount = posts.filter((post) =>
    post.status === "completed" || post.status === "skipped" || post.status === "failed"
  ).length;
  const expectedPostCount = session.expectedPostCount || posts.length;

  return {
    expectedPostCount,
    uploadedPostCount,
    processedPostCount,
    succeededPostCount,
    failedPostCount,
    skippedPostCount,
    allProcessed: processedPostCount >= expectedPostCount,
    hasFailures: failedPostCount > 0,
  };
}
