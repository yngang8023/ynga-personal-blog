import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { blogSyncSessions } from "../../cloudflare-rag/schema";
import type { IngestionEnv } from "./env";

export async function startSessionOrchestration(
  env: IngestionEnv,
  sessionId: string,
): Promise<{ sessionId: string; workflowId: string }> {
  const db = drizzle(env.DB);
  const session =
    (await db.select().from(blogSyncSessions).where(eq(blogSyncSessions.id, sessionId)).limit(1))[0] ||
    null;
  if (!session) {
    throw new Error(`Session ${sessionId} not found.`);
  }

  if (session.status !== "finalized" && session.status !== "running" && session.status !== "pruning") {
    throw new Error(`Session ${sessionId} is not ready for orchestration from status ${session.status}.`);
  }

  const workflowId = `blog-sync-session-${sessionId}`;
  let instance;
  try {
    instance = await env.BLOG_SYNC_WORKFLOW.create({
      id: workflowId,
      params: {
        sessionId,
      },
    });
  } catch {
    instance = await env.BLOG_SYNC_WORKFLOW.get(workflowId);
  }

  return {
    sessionId,
    workflowId: instance.id,
  };
}
