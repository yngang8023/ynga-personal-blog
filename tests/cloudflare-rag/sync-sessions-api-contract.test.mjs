import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const apiRoot = path.resolve("cloudflare-rag/functions/api/sync-sessions");
const sharedRoot = path.resolve("cloudflare-rag/functions/_shared");
const oldEndpointPath = path.resolve("cloudflare-rag/functions/api/sync-posts.ts");
const workerConfigPath = path.resolve("cloudflare-rag/worker-configuration.d.ts");
const wranglerPath = path.resolve("cloudflare-rag/wrangler.toml");

test("sync session api routes exist", async () => {
	await Promise.all([
		access(path.join(apiRoot, "index.ts")),
		access(path.join(apiRoot, "[sessionId].ts")),
		access(path.join(apiRoot, "[sessionId]", "finalize.ts")),
		access(path.join(apiRoot, "[sessionId]", "posts", "[postId].ts")),
		access(path.join(sharedRoot, "blog-sync-auth.ts")),
		access(path.join(sharedRoot, "blog-sync-db.ts")),
	]);
});

test("sync session api is configured and old sync endpoint is deprecated", async () => {
	const [oldEndpointSource, workerConfigSource, wranglerSource, finalizeSource, statusSource] = await Promise.all([
		readFile(oldEndpointPath, "utf8"),
		readFile(workerConfigPath, "utf8"),
		readFile(wranglerPath, "utf8"),
		readFile(path.join(apiRoot, "[sessionId]", "finalize.ts"), "utf8"),
		readFile(path.join(apiRoot, "[sessionId].ts"), "utf8"),
	]);

	assert.match(oldEndpointSource, /410|Gone|sync-sessions/);
	assert.match(workerConfigSource, /BLOG_SYNC_INGESTION/);
	assert.match(wranglerSource, /BLOG_SYNC_INGESTION/);
	assert.match(wranglerSource, /BLOG_SYNC_STAGING/);
	assert.match(finalizeSource, /workflowId|ingestion/i);
	assert.match(finalizeSource, /missingPostIds|uploadedPostCount/);
	assert.match(statusSource, /timingsJson|statsJson|attemptCount|workflowId/);
	assert.match(statusSource, /aggregate|slowest|sessionMetrics|slowestPosts/i);
	assert.match(statusSource, /BLOG_SYNC_INGESTION|session-status|workflowStatus|effectiveStatus/);
	assert.match(statusSource, /allProcessed|hasFailures|pendingRecoveryCount|convergenceStatus|statusSource/);
});
