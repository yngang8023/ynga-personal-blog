import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const workerRoot = path.resolve("cloudflare-rag-ingestion");

test("standalone ingestion worker project exists", async () => {
	await Promise.all([
		access(path.join(workerRoot, "package.json")),
		access(path.join(workerRoot, "tsconfig.json")),
		access(path.join(workerRoot, "wrangler.toml")),
		access(path.join(workerRoot, "src", "index.ts")),
		access(path.join(workerRoot, "src", "env.ts")),
		access(path.join(workerRoot, "src", "queue.ts")),
		access(path.join(workerRoot, "src", "sessionStatus.ts")),
		access(path.join(workerRoot, "src", "workflow.ts")),
		access(path.join(workerRoot, "src", "sessionOrchestrator.ts")),
	]);
});

test("standalone ingestion worker exposes queue and workflow entrypoints", async () => {
	const [indexSource, queueSource, sessionStatusSource, workflowSource, orchestratorSource] = await Promise.all([
		readFile(path.join(workerRoot, "src", "index.ts"), "utf8"),
		readFile(path.join(workerRoot, "src", "queue.ts"), "utf8"),
		readFile(path.join(workerRoot, "src", "sessionStatus.ts"), "utf8"),
		readFile(path.join(workerRoot, "src", "workflow.ts"), "utf8"),
		readFile(path.join(workerRoot, "src", "sessionOrchestrator.ts"), "utf8"),
	]);

	assert.match(indexSource, /fetch/);
	assert.match(indexSource, /queue/);
	assert.match(indexSource, /workflows?/i);
	assert.match(indexSource, /session-status|getInternalSessionStatus/);
	assert.match(orchestratorSource, /BLOG_SYNC_WORKFLOW/);
	assert.match(queueSource, /processSessionPostMessage/);
	assert.match(queueSource, /attemptCount/);
	assert.match(queueSource, /timingsJson/);
	assert.match(queueSource, /statsJson/);
	assert.match(queueSource, /processing_started_at|processingStartedAt/i);
	assert.match(sessionStatusSource, /status\(\)|effectiveStatus|normalizedWorkflowStatus/);
	assert.match(workflowSource, /from "cloudflare:workers"|from 'cloudflare:workers'/);
	assert.match(workflowSource, /WorkflowEntrypoint/);
	assert.match(workflowSource, /stale processing|staleProcessing|requeue/i);
	assert.match(workflowSource, /BlogSyncWorkflow/);
	assert.match(workflowSource, /step\.sleep|sleep/);
	assert.match(workflowSource, /reconcile|enqueue|prune|cleanup/);
});
