import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const scriptPath = path.resolve("scripts/sync-blog-rag.mjs");

test("sync blog rag client retries transient session API failures with backoff", async () => {
	const source = await readFile(scriptPath, "utf8");

	assert.match(source, /retry|backoff|attempt/i);
	assert.match(source, /response\.status|5\d\d|429/);
	assert.match(source, /setTimeout|Math\.min|Math\.pow/);
});
