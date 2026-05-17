import { WorkflowEntrypoint } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { BLOG_SYNC_POST_MAX_ATTEMPTS } from "../../cloudflare-rag/app/lib/blogSync/constants";
import { BLOG_SYNC_PROCESSING_LEASE_MS } from "../../cloudflare-rag/app/lib/blogSync/constants";
import {
  BLOG_SYNC_WORKFLOW_POLL_INTERVAL_MS,
  BLOG_SYNC_WORKFLOW_TIMEOUT_MS,
} from "../../cloudflare-rag/app/lib/blogSync/constants";
import { blogSyncSessionPosts, blogSyncSessions } from "../../cloudflare-rag/schema";
import {
  cleanupSessionArtifacts,
  collectSessionPostSummary,
  parseActivePostIds,
  pruneMissingPostsForSession,
  purgePendingDeletePosts,
} from "./cleanup";
import type { IngestionEnv } from "./env";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";

interface WorkflowPayload {
  sessionId?: string;
}

async function enqueueSessionPosts(env: IngestionEnv, sessionId: string) {
  const db = drizzle(env.DB);
  const session =
    (await db.select().from(blogSyncSessions).where(eq(blogSyncSessions.id, sessionId)).limit(1))[0] || null;
  if (!session) {
    throw new Error(`Session ${sessionId} not found.`);
  }

  const posts = await db
    .select()
    .from(blogSyncSessionPosts)
    .where(eq(blogSyncSessionPosts.sessionId, sessionId));
  const activePostIds = new Set(parseActivePostIds(session.activePostIdsJson));
  const now = new Date().toISOString();

  await db
    .update(blogSyncSessions)
    .set({
      status: posts.length === 0 ? "completed" : "running",
      expectedPostCount: session.expectedPostCount || posts.length,
      uploadedPostCount: posts.length,
      updatedAt: now,
      completedAt: posts.length === 0 ? now : session.completedAt,
    })
    .where(eq(blogSyncSessions.id, sessionId));

  for (const post of posts) {
    if (activePostIds.size > 0 && !activePostIds.has(post.postId)) {
      continue;
    }
    if (post.status === "completed" || post.status === "skipped") {
      continue;
    }
    if (post.status === "processing" || post.stage === "retry_pending") {
      continue;
    }

    await db
      .update(blogSyncSessionPosts)
      .set({
        status: "queued",
        stage: "queued",
        updatedAt: now,
        errorMessage: null,
      })
      .where(eq(blogSyncSessionPosts.id, post.id));

    await env.BLOG_SYNC_QUEUE.send({
      sessionId,
      postId: post.postId,
      forceRebuild: session.forceRebuild,
      revisionId: post.revisionId || undefined,
    });
  }

  return { queued: posts.length };
}

async function reconcileSession(env: IngestionEnv, sessionId: string) {
  const db = drizzle(env.DB);
  const processingLeaseMs = Number(env.BLOG_SYNC_PROCESSING_LEASE_MS || BLOG_SYNC_PROCESSING_LEASE_MS);
  const posts = await db
    .select()
    .from(blogSyncSessionPosts)
    .where(eq(blogSyncSessionPosts.sessionId, sessionId));
  const nowIso = new Date().toISOString();

  for (const post of posts) {
    const updatedAtMs = post.updatedAt ? Date.parse(post.updatedAt) : Number.NaN;
    const staleQueuedState =
      (post.status === "uploaded" || post.status === "queued" || post.stage === "retry_pending") &&
      (!Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs >= processingLeaseMs);

    if (post.status !== "processing") {
      if (!staleQueuedState) {
        continue;
      }

      await db
        .update(blogSyncSessionPosts)
        .set({
          status: "queued",
          stage: "requeued_stale_queue",
          processingStartedAt: null,
          updatedAt: nowIso,
          errorMessage: "Recovered stale queued state; requeued for retry.",
        })
        .where(eq(blogSyncSessionPosts.id, post.id));

      await env.BLOG_SYNC_QUEUE.send({
        sessionId,
        postId: post.postId,
        forceRebuild: false,
        revisionId: post.revisionId || undefined,
      });
      continue;
    }
    const processingStartedAt = post.processingStartedAt ? Date.parse(post.processingStartedAt) : Number.NaN;
    const staleProcessing =
      !Number.isFinite(processingStartedAt) || Date.now() - processingStartedAt >= processingLeaseMs;
    if (!staleProcessing) {
      continue;
    }

    await db
      .update(blogSyncSessionPosts)
      .set({
        status: "queued",
        stage: "requeued_stale_processing",
        processingStartedAt: null,
        updatedAt: nowIso,
        errorMessage: "Recovered stale processing lease; requeued for retry.",
      })
      .where(eq(blogSyncSessionPosts.id, post.id));

    await env.BLOG_SYNC_QUEUE.send({
      sessionId,
      postId: post.postId,
      forceRebuild: false,
      revisionId: post.revisionId || undefined,
    });
  }

  const summary = await collectSessionPostSummary(env, sessionId);
  const now = new Date().toISOString();

  await db
    .update(blogSyncSessions)
    .set({
      expectedPostCount: summary.expectedPostCount,
      uploadedPostCount: summary.uploadedPostCount,
      processedPostCount: summary.processedPostCount,
      succeededPostCount: summary.succeededPostCount,
      failedPostCount: summary.failedPostCount,
      skippedPostCount: summary.skippedPostCount,
      updatedAt: now,
    })
    .where(eq(blogSyncSessions.id, sessionId));

  return summary;
}

async function finalizeSession(
  env: IngestionEnv,
  sessionId: string,
  summary: Awaited<ReturnType<typeof collectSessionPostSummary>>,
) {
  const db = drizzle(env.DB);
  const now = new Date().toISOString();

  if (!summary.allProcessed) {
    return {
      status: "running",
      cleanup: { deletedStagingCount: 0, deletedPostCount: 0, deletedVectorCount: 0, prunedPostCount: 0 },
    };
  }

  if (summary.hasFailures) {
    await db
      .update(blogSyncSessions)
      .set({
        status: "failed",
        updatedAt: now,
        completedAt: now,
      })
      .where(eq(blogSyncSessions.id, sessionId));

    const cleanup = await cleanupSessionArtifacts(env, sessionId);
    return {
      status: "failed",
      cleanup: {
        ...cleanup,
        deletedPostCount: 0,
        deletedVectorCount: 0,
        prunedPostCount: 0,
      },
    };
  }

  await db
    .update(blogSyncSessions)
    .set({
      status: "pruning",
      updatedAt: now,
    })
    .where(eq(blogSyncSessions.id, sessionId));

  const pruneResult = await pruneMissingPostsForSession(env, sessionId);
  const purgeResult = await purgePendingDeletePosts(env, pruneResult.prunedPostIds);
  const cleanupResult = await cleanupSessionArtifacts(env, sessionId);
  const completedStatus = purgeResult.deletedPostCount === pruneResult.prunedPostCount
    ? "completed"
    : "completed_with_warnings";

  await db
    .update(blogSyncSessions)
    .set({
      status: completedStatus,
      updatedAt: now,
      completedAt: now,
      errorMessage:
        completedStatus === "completed_with_warnings"
          ? "Session completed, but cleanup did not fully converge."
          : null,
    })
    .where(eq(blogSyncSessions.id, sessionId));

  return {
    status: completedStatus,
    cleanup: {
      ...cleanupResult,
      ...purgeResult,
      prunedPostCount: pruneResult.prunedPostCount,
    },
  };
}

async function waitForSessionCompletion(
  step: WorkflowStep,
  env: IngestionEnv,
  sessionId: string,
) {
  const maxAttempts = Number(env.BLOG_SYNC_POST_MAX_ATTEMPTS || BLOG_SYNC_POST_MAX_ATTEMPTS);
  const pollIntervalMs = Number(env.BLOG_SYNC_WORKFLOW_POLL_INTERVAL_MS || BLOG_SYNC_WORKFLOW_POLL_INTERVAL_MS);
  const timeoutMs = Number(env.BLOG_SYNC_WORKFLOW_TIMEOUT_MS || BLOG_SYNC_WORKFLOW_TIMEOUT_MS);
  const maxRounds = Math.max(
    maxAttempts * 20,
    Math.ceil(timeoutMs / Math.max(1000, pollIntervalMs)),
  );

  for (let round = 0; round < maxRounds; round += 1) {
    const summary = await step.do(`reconcile-session-${round}`, async () => reconcileSession(env, sessionId));
    if (summary.allProcessed) {
      return summary;
    }

    await step.sleep(`wait-for-queue-${round}`, `${Math.max(1, Math.ceil(pollIntervalMs / 1000))} seconds`);
  }

  const summary = await reconcileSession(env, sessionId);
  if (!summary.allProcessed) {
    throw new Error(`Session ${sessionId} did not converge before workflow timeout window.`);
  }
  return summary;
}

export class BlogSyncWorkflow extends WorkflowEntrypoint<IngestionEnv> {
  async run(event: WorkflowEvent<WorkflowPayload>, step: WorkflowStep) {
    const sessionId = (event.payload as WorkflowPayload | undefined)?.sessionId || "";
    if (!sessionId) {
      throw new Error("Missing sessionId in workflow payload.");
    }
    const db = drizzle(this.env.DB);

    try {
      await step.do("enqueue-session-posts", async () => enqueueSessionPosts(this.env, sessionId));
      const summary = await waitForSessionCompletion(step, this.env, sessionId);
      return step.do("finalize-session", async () => finalizeSession(this.env, sessionId, summary));
    } catch (error) {
      const now = new Date().toISOString();
      await db
        .update(blogSyncSessions)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
          updatedAt: now,
          completedAt: now,
        })
        .where(eq(blogSyncSessions.id, sessionId));
      throw error;
    }
  }
}
