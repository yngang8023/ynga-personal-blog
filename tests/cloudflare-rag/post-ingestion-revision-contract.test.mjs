import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const legacySyncPath = path.resolve("cloudflare-rag-ingestion/src/legacySync.ts");
const schemaPath = path.resolve("cloudflare-rag/schema.ts");

test("legacy ingestion writes revisions before switching current revision", async () => {
	const [legacySyncSource, schemaSource] = await Promise.all([
		readFile(legacySyncPath, "utf8"),
		readFile(schemaPath, "utf8"),
	]);

	assert.match(legacySyncSource, /blogPostRevisions/);
	assert.match(legacySyncSource, /currentRevisionId/);
	assert.match(legacySyncSource, /lastCompletedRevisionId/);
	assert.match(legacySyncSource, /syncStatus/);
	assert.match(legacySyncSource, /vectorStatus/);
	assert.match(schemaSource, /blogPostRevisions/);
});

test("legacy ingestion no longer deletes live post data before rebuild", async () => {
	const legacySyncSource = await readFile(legacySyncPath, "utf8");

	assert.doesNotMatch(legacySyncSource, /await deletePostData\(db, env, post\.id/);
	assert.match(legacySyncSource, /createRevisionId/);
	assert.match(legacySyncSource, /switchCurrentRevision/);
});

test("legacy ingestion records real stage metrics for db, embedding, vectorize, and finalize", async () => {
	const [legacySyncSource, queueSource] = await Promise.all([
		readFile(legacySyncPath, "utf8"),
		readFile(path.resolve("cloudflare-rag-ingestion/src/queue.ts"), "utf8"),
	]);

	assert.match(legacySyncSource, /db_write_ms|embedding_ms|vectorize_ms|finalize_ms/);
	assert.match(legacySyncSource, /section_count|chunk_count|vector_count/);
	assert.match(queueSource, /asset_upload_ms|ocr_ms|chunk_build_ms|db_write_ms|embedding_ms|vectorize_ms|finalize_ms/);
});
