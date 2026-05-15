import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const configPath = path.resolve("src/config.ts");

test("blog RAG embed config includes a dedicated same-origin token endpoint", async () => {
	const source = await readFile(configPath, "utf8");

	assert.match(source, /BLOG_RAG_SERVICE_ORIGIN/);
	assert.match(source, /BLOG_RAG_SITE_ORIGIN/);
	assert.match(source, /BLOG_RAG_TOKEN_ENDPOINT/);
	assert.match(source, /serviceOrigin:\s*BLOG_RAG_SERVICE_ORIGIN/);
	assert.match(source, /siteOrigin:\s*BLOG_RAG_SITE_ORIGIN/);
	assert.match(source, /tokenEndpoint:\s*BLOG_RAG_TOKEN_ENDPOINT/);
	assert.match(source, /\/rag-embed-token/);
});
