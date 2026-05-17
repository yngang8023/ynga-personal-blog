import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const legacySyncPath = path.resolve("cloudflare-rag-ingestion/src/legacySync.ts");

test("legacy ingestion cleans obsolete revisions and removes stale vectors", async () => {
	const [legacySyncSource, cleanupSource] = await Promise.all([
		readFile(legacySyncPath, "utf8"),
		readFile(path.resolve("cloudflare-rag-ingestion/src/cleanup.ts"), "utf8"),
	]);

	assert.match(legacySyncSource, /cleanupObsoleteRevisions/);
	assert.match(legacySyncSource, /cleanupLegacyOrphanPostData/);
	assert.match(legacySyncSource, /deleteByIds/);
	assert.match(legacySyncSource, /sectionKey: section\.sectionKey/);
	assert.match(legacySyncSource, /chunkKey: chunk\.chunkKey/);
	assert.match(legacySyncSource, /chunkHash: chunk\.chunkHash/);
	assert.match(cleanupSource, /legacy orphan|orphan legacy|orphan/i);
	assert.match(cleanupSource, /revisionId[^\\n]*null|revision_id[^\\n]*null/i);
	assert.match(cleanupSource, /deleteByIds/);
	assert.match(cleanupSource, /POST_ASSETS/);
});
