import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("stream api empty-index message points to sync-sessions protocol instead of deprecated sync-posts", async () => {
	const source = await readFile(path.resolve("cloudflare-rag/functions/api/stream.ts"), "utf8");

	assert.doesNotMatch(source, /请先运行 \/api\/sync-posts/);
	assert.match(source, /sync-sessions|pnpm sync-rag/i);
});
