import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const oldSyncEndpointPath = path.resolve("cloudflare-rag/functions/api/sync-posts.ts");
const sessionCreatePath = path.resolve("cloudflare-rag/functions/api/sync-sessions/index.ts");
const sessionUploadPath = path.resolve("cloudflare-rag/functions/api/sync-sessions/[sessionId]/posts/[postId].ts");
const sessionFinalizePath = path.resolve("cloudflare-rag/functions/api/sync-sessions/[sessionId]/finalize.ts");

test("cloudflare rag sync endpoint is deprecated in favor of session protocol", async () => {
	const [oldEndpointSource, createSource, uploadSource, finalizeSource] = await Promise.all([
		readFile(oldSyncEndpointPath, "utf8"),
		readFile(sessionCreatePath, "utf8"),
		readFile(sessionUploadPath, "utf8"),
		readFile(sessionFinalizePath, "utf8"),
	]);

	assert.match(oldEndpointSource, /410/);
	assert.match(oldEndpointSource, /sync-sessions/);
	assert.match(createSource, /sessionId/);
	assert.match(uploadSource, /BLOG_SYNC_STAGING/);
	assert.match(finalizeSource, /activePostIds/);
	assert.match(finalizeSource, /forceRebuild/);
	assert.match(finalizeSource, /pruneMissing/);
});
