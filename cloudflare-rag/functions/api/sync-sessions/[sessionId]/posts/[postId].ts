import { eq } from "drizzle-orm";
import { blogSyncSessionPosts, blogSyncSessions } from "schema";
import { uploadSessionPostPayloadSchema } from "~/lib/blogSync/schema";
import { canUploadToSession } from "~/lib/blogSync/sessionState";

import { jsonResponse, requireSyncAuth } from "../../../../_shared/blog-sync-auth";
import {
  createSessionPostId,
  createStagingBundleKey,
  getBlogSyncDb,
  getSessionOrNull,
} from "../../../../_shared/blog-sync-db";

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "POST") {
    return jsonResponse({ error: "Expected POST." }, 405);
  }

  const unauthorized = requireSyncAuth(ctx.request, ctx.env.RAG_SYNC_TOKEN);
  if (unauthorized) {
    return unauthorized;
  }

  const sessionId = String(ctx.params.sessionId || "").trim();
  const rawPostId = String(ctx.params.postId || "").trim();
  const postId = decodeURIComponent(rawPostId);
  if (!sessionId || !postId) {
    return jsonResponse({ error: "Missing sessionId or postId." }, 400);
  }

  const payload = uploadSessionPostPayloadSchema.parse(await ctx.request.json());
  const db = getBlogSyncDb(ctx.env);
  const session = await getSessionOrNull(db, sessionId);
  if (!session) {
    return jsonResponse({ error: "Session not found." }, 404);
  }
  if (!canUploadToSession(session.status as any)) {
    return jsonResponse({ error: `Session ${sessionId} is not accepting uploads.` }, 409);
  }

  const now = new Date().toISOString();
  const rowId = createSessionPostId(sessionId, postId);
  const bundleR2Key = createStagingBundleKey(sessionId, postId);
  await ctx.env.BLOG_SYNC_STAGING.put(bundleR2Key, JSON.stringify(payload.post), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
    customMetadata: {
      sessionId,
      postId,
      contentHash: payload.post.contentHash || "",
    },
  });

  await db.delete(blogSyncSessionPosts).where(eq(blogSyncSessionPosts.id, rowId));
  await db.insert(blogSyncSessionPosts).values({
    id: rowId,
    sessionId,
    postId,
    bundleR2Key,
    contentHash: payload.post.contentHash || "",
    status: "uploaded",
    createdAt: now,
    updatedAt: now,
  });

  await db
    .update(blogSyncSessions)
    .set({
      status: "uploading",
      uploadedPostCount: session.uploadedPostCount + 1,
      updatedAt: now,
    })
    .where(eq(blogSyncSessions.id, sessionId));

  return jsonResponse({
    ok: true,
    sessionId,
    postId,
    status: "uploaded",
  });
};
