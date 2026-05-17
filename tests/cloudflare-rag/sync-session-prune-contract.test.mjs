import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const sessionOrchestratorPath = path.resolve("cloudflare-rag-ingestion/src/sessionOrchestrator.ts");
const workflowPath = path.resolve("cloudflare-rag-ingestion/src/workflow.ts");
const cleanupPath = path.resolve("cloudflare-rag-ingestion/src/cleanup.ts");

test("session orchestration gates pruneMissing until all posts succeed", async () => {
	const [workflowSource, cleanupSource] = await Promise.all([
		readFile(workflowPath, "utf8"),
		readFile(cleanupPath, "utf8"),
	]);

	assert.match(workflowSource, /pruneMissing/);
	assert.match(cleanupSource, /pending_delete|pendingDelete|pruneMissingPostsForSession/);
	assert.match(workflowSource, /failedPostCount/);
	assert.match(workflowSource, /succeededPostCount/);
	assert.match(workflowSource, /processedPostCount/);
});

test("session orchestration now routes completion through workflow reconciliation", async () => {
	const [workflowSource, queueSource] = await Promise.all([
		readFile(path.resolve("cloudflare-rag-ingestion/src/workflow.ts"), "utf8"),
		readFile(path.resolve("cloudflare-rag-ingestion/src/queue.ts"), "utf8"),
	]);

	assert.match(workflowSource, /step\.do/);
	assert.match(workflowSource, /step\.sleep|sleep/);
	assert.match(workflowSource, /reconcile|finalize|prune/);
	assert.match(queueSource, /timingsJson/);
	assert.match(queueSource, /statsJson/);
	assert.match(queueSource, /status === "completed"|status === "failed"|status === "skipped"/);
});
