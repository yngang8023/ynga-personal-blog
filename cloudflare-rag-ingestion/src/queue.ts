import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { BLOG_SYNC_POST_MAX_ATTEMPTS } from "../../cloudflare-rag/app/lib/blogSync/constants";
import { BLOG_SYNC_PROCESSING_LEASE_MS } from "../../cloudflare-rag/app/lib/blogSync/constants";
import {
  type BlogPostBundleInput,
  blogPostBundleInputSchema,
} from "../../cloudflare-rag/app/lib/blogRag";
import { blogSyncSessionPosts, blogSyncSessions } from "../../cloudflare-rag/schema";
import type { IngestionEnv } from "./env";
import { processLegacyBundleSync } from "./legacySync";

interface SessionPostQueueMessage {
  sessionId: string;
  postId: string;
  forceRebuild: boolean;
  revisionId?: string;
}

interface SessionPostTimings {
  bundle_download_ms?: number;
  bundle_decode_ms?: number;
  asset_upload_ms?: number;
  ocr_ms?: number;
  chunk_build_ms?: number;
  embedding_ms?: number;
  vectorize_ms?: number;
  db_write_ms?: number;
  finalize_ms?: number;
  total_ms?: number;
}

interface SessionPostStats {
  file_count?: number;
  referenced_image_count?: number;
  ocr_image_count?: number;
  section_count?: number;
  chunk_count?: number;
  vector_count?: number;
  reused_asset_count?: number;
  reused_ocr_count?: number;
  reused_embedding_count?: number;
  revisionId?: string;
  resultStatus?: string;
}

function logQueueEvent(event: string, fields: Record<string, unknown> = {}) {
  console.info(JSON.stringify({
    scope: "blog-sync-queue",
    event,
    ...fields,
  }));
}

function parseSessionPostQueueMessage(message: unknown): SessionPostQueueMessage | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const record = message as Record<string, unknown>;
  const sessionId = typeof record.sessionId === "string" ? record.sessionId.trim() : "";
  const postId = typeof record.postId === "string" ? record.postId.trim() : "";
  const forceRebuild = record.forceRebuild === true;
  const revisionId = typeof record.revisionId === "string" ? record.revisionId.trim() : undefined;

  if (!sessionId || !postId) {
    return null;
  }

  return {
    sessionId,
    postId,
    forceRebuild,
    revisionId,
  };
}

function toJson(value: unknown): string {
  return JSON.stringify(value || {});
}

function mergeTimings(
  current: string | null | undefined,
  next: SessionPostTimings,
): string {
  try {
    const parsed = current ? JSON.parse(current) : {};
    return JSON.stringify({ ...parsed, ...next });
  } catch {
    return JSON.stringify(next);
  }
}

function buildStatsFromResult(result: Awaited<ReturnType<typeof processLegacyBundleSync>>): SessionPostStats {
  return {
    file_count: result.fileCount || 0,
    chunk_count: result.metrics?.stats?.chunk_count || result.chunkCount || 0,
    vector_count: result.metrics?.stats?.vector_count || result.chunkCount || 0,
    referenced_image_count: result.metrics?.stats?.referenced_image_count || result.imageCount || 0,
    ocr_image_count: result.metrics?.stats?.ocr_image_count || 0,
    section_count: result.metrics?.stats?.section_count || 0,
    reused_asset_count: result.metrics?.stats?.reused_asset_count || 0,
    reused_ocr_count: result.metrics?.stats?.reused_ocr_count || 0,
    reused_embedding_count: result.metrics?.stats?.reused_embedding_count || 0,
    revisionId: result.revisionId,
    resultStatus: result.status,
  };
}

export async function processSessionPostMessage(
  message: unknown,
  env: IngestionEnv,
): Promise<"ack" | "retry"> {
  const db = drizzle(env.DB);
  const parsedMessage = parseSessionPostQueueMessage(message);
  if (!parsedMessage) {
    logQueueEvent("invalid_message", {
      messageType: typeof message,
    });
    return "ack";
  }
  const { sessionId, postId, forceRebuild } = parsedMessage;
  const rowId = `${sessionId}:${postId}`;

  const sessionPost =
    (await db.select().from(blogSyncSessionPosts).where(eq(blogSyncSessionPosts.id, rowId)).limit(1))[0] || null;
  const session =
    (await db.select().from(blogSyncSessions).where(eq(blogSyncSessions.id, sessionId)).limit(1))[0] || null;
  if (!sessionPost || !session) {
    logQueueEvent("missing_session_state", {
      sessionId,
      postId,
      hasSession: Boolean(session),
      hasSessionPost: Boolean(sessionPost),
    });
    return "ack";
  }

  if (sessionPost.status === "completed" || sessionPost.status === "skipped") {
    logQueueEvent("skip_terminal_post", {
      sessionId,
      postId,
      status: sessionPost.status,
    });
    return "ack";
  }
  if (sessionPost.status === "processing") {
    // Treat processing as a lease, not a terminal lock, so redelivery can recover stale processing rows.
    const leaseMs = Number(env.BLOG_SYNC_PROCESSING_LEASE_MS || BLOG_SYNC_PROCESSING_LEASE_MS);
    const processingStartedAt = sessionPost.processingStartedAt
      ? Date.parse(sessionPost.processingStartedAt)
      : Number.NaN;
    const leaseExpired =
      !Number.isFinite(processingStartedAt) || Date.now() - processingStartedAt >= leaseMs;
    if (!leaseExpired) {
      logQueueEvent("lease_active_retry", {
        sessionId,
        postId,
        status: sessionPost.status,
        attemptCount: sessionPost.attemptCount,
      });
      return "retry";
    }
  }

  const maxAttempts = Number(env.BLOG_SYNC_POST_MAX_ATTEMPTS || BLOG_SYNC_POST_MAX_ATTEMPTS);
  if (sessionPost.status === "failed" && sessionPost.attemptCount >= maxAttempts) {
    logQueueEvent("max_attempts_reached", {
      sessionId,
      postId,
      attemptCount: sessionPost.attemptCount,
      maxAttempts,
    });
    return "ack";
  }

  const startedAt = Date.now();
  const now = new Date().toISOString();
  const processingStartedAt = new Date().toISOString();
  await db
    .update(blogSyncSessionPosts)
    .set({
      status: "processing",
      stage: "bundle_download",
      attemptCount: sessionPost.attemptCount + 1,
      updatedAt: now,
      errorMessage: null,
      processingStartedAt,
      timingsJson: mergeTimings(sessionPost.timingsJson, {
        finalize_ms: 0,
      }),
    })
    .where(eq(blogSyncSessionPosts.id, rowId));

  try {
    logQueueEvent("processing_started", {
      sessionId,
      postId,
      attemptCount: sessionPost.attemptCount + 1,
      forceRebuild,
    });
    const bundleDownloadStartedAt = Date.now();
    const object = await env.BLOG_SYNC_STAGING.get(sessionPost.bundleR2Key);
    if (!object) {
      throw new Error(`Missing staged bundle ${sessionPost.bundleR2Key}.`);
    }

    const raw = await object.text();
    const bundleDownloadEndedAt = Date.now();
    const decodeStartedAt = Date.now();
    const post = blogPostBundleInputSchema.parse(JSON.parse(raw)) as BlogPostBundleInput;
    const decodeEndedAt = Date.now();

    await db
      .update(blogSyncSessionPosts)
      .set({
        stage: "indexing",
        updatedAt: new Date().toISOString(),
        timingsJson: mergeTimings(sessionPost.timingsJson, {
          bundle_download_ms: bundleDownloadEndedAt - bundleDownloadStartedAt,
          bundle_decode_ms: decodeEndedAt - decodeStartedAt,
        }),
      })
      .where(eq(blogSyncSessionPosts.id, rowId));

    const ingestStartedAt = Date.now();
    const result = await processLegacyBundleSync(
      env,
      post,
      session.siteUrl || undefined,
      forceRebuild,
      sessionId,
    );
    const ingestEndedAt = Date.now();
    const status = result.status === "skipped" ? "skipped" : "completed";
    const finishedAt = new Date().toISOString();

    await db
      .update(blogSyncSessionPosts)
      .set({
        status,
        stage: "done",
        revisionId: result.revisionId || sessionPost.revisionId,
        statsJson: toJson(buildStatsFromResult(result)),
        timingsJson: mergeTimings(sessionPost.timingsJson, {
          asset_upload_ms: result.metrics?.timings?.asset_upload_ms || 0,
          ocr_ms: result.metrics?.timings?.ocr_ms || 0,
          chunk_build_ms: result.metrics?.timings?.chunk_build_ms || 0,
          db_write_ms: result.metrics?.timings?.db_write_ms || 0,
          embedding_ms: result.metrics?.timings?.embedding_ms || 0,
          vectorize_ms: result.metrics?.timings?.vectorize_ms || 0,
          finalize_ms: result.metrics?.timings?.finalize_ms || (Date.now() - ingestEndedAt),
          total_ms: Date.now() - startedAt,
        }),
        updatedAt: finishedAt,
        completedAt: finishedAt,
        processingStartedAt: null,
        errorMessage: null,
      })
      .where(eq(blogSyncSessionPosts.id, rowId));
    logQueueEvent("processing_completed", {
      sessionId,
      postId,
      status,
      revisionId: result.revisionId || sessionPost.revisionId || "",
      totalMs: Date.now() - startedAt,
      chunkCount: result.chunkCount || 0,
      imageCount: result.imageCount || 0,
    });
    return "ack";
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const nextAttemptCount = sessionPost.attemptCount + 1;
    const canRetry = nextAttemptCount < maxAttempts;

    await db
      .update(blogSyncSessionPosts)
      .set({
        status: canRetry ? "queued" : "failed",
        stage: canRetry ? "retry_pending" : "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
        timingsJson: mergeTimings(sessionPost.timingsJson, {
          total_ms: Date.now() - startedAt,
          finalize_ms: Date.now() - startedAt,
        }),
        statsJson: toJson({
          resultStatus: "failed",
          revisionId: sessionPost.revisionId || parsedMessage.revisionId || "",
        }),
        processingStartedAt: null,
        updatedAt: finishedAt,
        completedAt: canRetry ? null : finishedAt,
      })
      .where(eq(blogSyncSessionPosts.id, rowId));

    if (canRetry) {
      await env.BLOG_SYNC_QUEUE.send(parsedMessage);
      logQueueEvent("processing_requeued", {
        sessionId,
        postId,
        attemptCount: nextAttemptCount,
        maxAttempts,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return "ack";
    }

    await db
      .update(blogSyncSessions)
      .set({
        errorMessage: error instanceof Error ? error.message : String(error),
        updatedAt: finishedAt,
      })
      .where(eq(blogSyncSessions.id, sessionId));
    logQueueEvent("processing_failed_terminal", {
      sessionId,
      postId,
      attemptCount: nextAttemptCount,
      maxAttempts,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return "ack";
  }
}
