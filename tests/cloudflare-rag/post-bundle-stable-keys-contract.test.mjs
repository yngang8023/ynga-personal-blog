import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const indexingPath = path.resolve("cloudflare-rag/app/lib/postBundleIndexing.ts");

test("post bundle indexing defines stable section and chunk keys with revision-scoped ids", async () => {
	const source = await readFile(indexingPath, "utf8");

	assert.match(source, /sectionKey:/);
	assert.match(source, /chunkKey:/);
	assert.match(source, /chunkHash:/);
	assert.match(source, /buildStableSectionKey/);
	assert.match(source, /buildStableChunkKey/);
	assert.match(source, /buildRevisionScopedId/);
	assert.doesNotMatch(source, /sectionId = await sha256\(`\$\{post\.id\}\\nsection\\n\$\{sectionIndex\}/);
	assert.doesNotMatch(source, /id: await sha256\(`\$\{post\.id\}\\n\$\{chunks\.length\}\\n\$\{piece\}`\)/);
});
