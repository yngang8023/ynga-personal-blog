import { eq } from "drizzle-orm";
import { blogSyncSessionPosts, blogSyncSessions } from "schema";
import { finalizeSessionPayloadSchema } from "~/lib/blogSync/schema";

import { jsonResponse, requireSyncAuth } from "../../../_shared/blog-sync-auth";
import { getBlogSyncDb, getSessionOrNull } from "../../../_shared/blog-sync-db";

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "POST") {
    return jsonResponse({ error: "Expected POST." }, 405);
  }

  const unauthorized = requireSyncAuth(ctx.request, ctx.env.RAG_SYNC_TOKEN);
  if (unauthorized) {
    return unauthorized;
  }

  const sessionId = String(ctx.params.sessionId || "").trim();
  if (!sessionId) {
    return jsonResponse({ error: "Missing sessionId." }, 400);
  }

  const payload = finalizeSessionPayloadSchema.parse(await ctx.request.json());
  const db = getBlogSyncDb(ctx.env);
  const session = await getSessionOrNull(db, sessionId);
  if (!session) {
    return jsonResponse({ error: "Session not found." }, 404);
  }
  if (
    session.status === "running" ||
    session.status === "pruning" ||
    session.status === "completed" ||
    session.status === "completed_with_warnings"
  ) {
    return jsonResponse({
      ok: true,
      sessionId,
      status: session.status,
      workflowId: `blog-sync-session-${sessionId}`,
    });
  }

  const uploadedPosts = await db
    .select({
      postId: blogSyncSessionPosts.postId,
    })
    .from(blogSyncSessionPosts)
    .where(eq(blogSyncSessionPosts.sessionId, sessionId));
  const uploadedPostIds = new Set(uploadedPosts.map((post) => post.postId));
  const missingUploads = payload.activePostIds.filter((postId) => !uploadedPostIds.has(postId));
  if (missingUploads.length > 0) {
    return jsonResponse(
      {
        error: "Cannot finalize session with missing uploaded bundles.",
        missingPostIds: missingUploads,
      },
      409,
    );
  }

  const now = new Date().toISOString();
  await db
    .update(blogSyncSessions)
    .set({
      status: "running",
      forceRebuild: payload.forceRebuild,
      pruneMissing: payload.pruneMissing,
      activePostIdsJson: JSON.stringify(payload.activePostIds),
      expectedPostCount: uploadedPosts.length,
      uploadedPostCount: uploadedPosts.length,
      updatedAt: now,
      finalizedAt: now,
    })
    .where(eq(blogSyncSessions.id, sessionId));

  let workflowId = `blog-sync-session-${sessionId}`;
  if (ctx.env.BLOG_SYNC_INGESTION?.fetch) {
    const ingestionResponse = await ctx.env.BLOG_SYNC_INGESTION.fetch(
      "https://blog-sync-ingestion.internal/start-session",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          sessionId,
        }),
      },
    );
    const ingestionText = await ingestionResponse.text();
    let ingestionPayload: any = {};
    try {
      ingestionPayload = ingestionText ? JSON.parse(ingestionText) : {};
    } catch {
      ingestionPayload = { raw: ingestionText };
    }
    if (!ingestionResponse.ok) {
      return jsonResponse(
        {
          error: "Failed to start ingestion workflow.",
          ingestion: ingestionPayload,
        },
        502,
      );
    }
    workflowId = ingestionPayload.workflowId || workflowId;
  }

  return jsonResponse({
    ok: true,
    sessionId,
    status: "running",
    workflowId,
  });
};
