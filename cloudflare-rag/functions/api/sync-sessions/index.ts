import { blogSyncSessions } from "schema";
import { createSessionPayloadSchema } from "~/lib/blogSync/schema";

import { jsonResponse, requireSyncAuth } from "../../_shared/blog-sync-auth";
import { createSessionId, getBlogSyncDb } from "../../_shared/blog-sync-db";

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "POST") {
    return jsonResponse({ error: "Expected POST." }, 405);
  }

  const unauthorized = requireSyncAuth(ctx.request, ctx.env.RAG_SYNC_TOKEN);
  if (unauthorized) {
    return unauthorized;
  }

  const now = new Date().toISOString();
  const payload = createSessionPayloadSchema.parse(await ctx.request.json().catch(() => ({})));
  const db = getBlogSyncDb(ctx.env);
  const sessionId = createSessionId();

  await db.insert(blogSyncSessions).values({
    id: sessionId,
    status: "created",
    siteUrl: payload.siteURL || "",
    client: payload.client || "blog-sync-script",
    createdAt: now,
    updatedAt: now,
  });

  return jsonResponse({
    ok: true,
    sessionId,
    status: "created",
  });
};
