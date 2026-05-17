import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const legacySyncPath = path.resolve("cloudflare-rag-ingestion/src/legacySync.ts");
const schemaPath = path.resolve("cloudflare-rag/schema.ts");

test("ingestion code references image asset and OCR cache tables", async () => {
	const [legacySyncSource, schemaSource] = await Promise.all([
		readFile(legacySyncPath, "utf8"),
		readFile(schemaPath, "utf8"),
	]);

	assert.match(legacySyncSource, /blogImageAssets/);
	assert.match(legacySyncSource, /blogImageOcrCache/);
	assert.match(legacySyncSource, /contentHash/);
	assert.match(legacySyncSource, /assetRefCount|asset_ref_count/);
	assert.match(legacySyncSource, /assetContentHashesJson|asset_content_hashes_json/);
	assert.match(schemaSource, /blogImageAssets/);
	assert.match(schemaSource, /blogImageOcrCache/);
});

test("ingestion code exposes stage metrics for asset upload and OCR reuse", async () => {
	const [legacySyncSource, indexingSource] = await Promise.all([
		readFile(legacySyncPath, "utf8"),
		readFile(path.resolve("cloudflare-rag/app/lib/postBundleIndexing.ts"), "utf8"),
	]);

	assert.match(indexingSource, /asset_upload_ms|ocr_ms|chunk_build_ms/);
	assert.match(indexingSource, /reused_asset_count|reused_ocr_count|ocr_image_count/);
	assert.match(legacySyncSource, /metrics|stageMetrics|prepareMetrics/);
});

test("cleanup code decrements shared asset references before deleting post assets", async () => {
	const cleanupSource = await readFile(path.resolve("cloudflare-rag-ingestion/src/cleanup.ts"), "utf8");

	assert.match(cleanupSource, /assetRefCount|asset_ref_count/);
	assert.match(cleanupSource, /assetContentHashesJson|asset_content_hashes_json/);
	assert.match(cleanupSource, /POST_ASSETS/);
	assert.match(cleanupSource, /delete/i);
});
