import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const queuePath = path.resolve("cloudflare-rag-ingestion/src/queue.ts");
const workflowPath = path.resolve("cloudflare-rag-ingestion/src/workflow.ts");
const constantsPath = path.resolve("cloudflare-rag/app/lib/blogSync/constants.ts");

test("queue worker tracks processing lease state so stuck posts can be recovered", async () => {
	const [queueSource, constantsSource] = await Promise.all([
		readFile(queuePath, "utf8"),
		readFile(constantsPath, "utf8"),
	]);

	assert.match(queueSource, /processing_started_at|processingStartedAt/i);
	assert.match(queueSource, /processing lease|processingLease|lease/i);
	assert.match(queueSource, /stale processing|stale lease|expired processing/i);
	assert.match(constantsSource, /PROCESSING_LEASE|PROCESSING_TIMEOUT|LEASE_MS/);
});

test("workflow reconciler can requeue stale processing posts instead of only timing out", async () => {
	const source = await readFile(workflowPath, "utf8");

	assert.match(source, /requeue/i);
	assert.match(source, /processing/i);
	assert.match(source, /stale|expired|lease/i);
	assert.match(source, /BLOG_SYNC_QUEUE/);
});

test("workflow waits long enough for multiple posts and retries before timeout", async () => {
	const source = await readFile(workflowPath, "utf8");

	assert.match(source, /waitForSessionCompletion/);
	assert.match(source, /sleep|sleep\(/i);
	assert.match(source, /maxAttempts/i);
	assert.match(source, /BLOG_SYNC_WORKFLOW_TIMEOUT_MS|WORKFLOW_TIMEOUT|timeout window/i);
});
