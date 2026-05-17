import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  blogSyncSessionPosts,
  blogSyncSessions,
} from "schema";
import { BLOG_SYNC_STAGING_PREFIX } from "~/lib/blogSync/constants";

export function getBlogSyncDb(env: Pick<Env, "DB">) {
  return drizzle(env.DB);
}

export function createSessionId(): string {
  return crypto.randomUUID();
}

export function createSessionPostId(sessionId: string, postId: string): string {
  return `${sessionId}:${postId}`;
}

export function createStagingBundleKey(sessionId: string, postId: string): string {
  return `${BLOG_SYNC_STAGING_PREFIX}/${sessionId}/${encodeURIComponent(postId)}.json`;
}

export async function getSessionOrNull(db: ReturnType<typeof drizzle>, sessionId: string) {
  return (
    (await db.select().from(blogSyncSessions).where(eq(blogSyncSessions.id, sessionId)).limit(1))[0] ||
    null
  );
}

export async function getSessionPostOrNull(
  db: ReturnType<typeof drizzle>,
  sessionId: string,
  postId: string,
) {
  return (
    (await db
      .select()
      .from(blogSyncSessionPosts)
      .where(eq(blogSyncSessionPosts.id, createSessionPostId(sessionId, postId)))
      .limit(1))[0] || null
  );
}
