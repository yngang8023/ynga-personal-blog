import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const queuePath = path.resolve("cloudflare-rag-ingestion/src/queue.ts");
const workflowPath = path.resolve("cloudflare-rag-ingestion/src/workflow.ts");
const cleanupPath = path.resolve("cloudflare-rag-ingestion/src/cleanup.ts");

test("ingestion queue records timing and stats fields for session posts", async () => {
	const source = await readFile(queuePath, "utf8");

	assert.match(source, /timingsJson/);
	assert.match(source, /statsJson/);
	assert.match(source, /bundle|embedding|vectorize|db_write|finalize/i);
	assert.match(source, /attemptCount/);
	assert.match(source, /retry_pending/);
	assert.match(source, /bundle_download_ms/);
	assert.match(source, /bundle_decode_ms/);
	assert.match(source, /processing_started_at|processingStartedAt/i);
	assert.match(source, /processing_lease|processingLease|stale processing|stale lease/i);
});

test("workflow coordinates reconcile and cleanup through explicit helpers", async () => {
	const [workflowSource, cleanupSource] = await Promise.all([
		readFile(workflowPath, "utf8"),
		readFile(cleanupPath, "utf8"),
	]);

	assert.match(workflowSource, /reconcileSession|finalizeSession|waitForSession/i);
	assert.match(workflowSource, /pruneMissing/);
	assert.match(workflowSource, /activePostIdsJson|activePostIds/);
	assert.match(cleanupSource, /cleanup|prune|staging|pending_delete/i);
});

test("session status api exposes aggregated metrics and slowest post summaries", async () => {
	const source = await readFile(path.resolve("cloudflare-rag/functions/api/sync-sessions/[sessionId].ts"), "utf8");

	assert.match(source, /aggregate|aggregated|sessionMetrics/i);
	assert.match(source, /slowestPosts|slowestStage|slowestPost/i);
	assert.match(source, /bundle_download_ms/);
	assert.match(source, /bundle_decode_ms/);
	assert.match(source, /asset_upload_ms|ocr_ms|embedding_ms|vectorize_ms|db_write_ms|finalize_ms/);
	assert.match(source, /no-store|private,? ?no-store|Cache-Control/i);
	assert.match(source, /processing_started_at|processingStartedAt/i);
	assert.match(source, /queued|retry_pending|uploaded/i);
});
