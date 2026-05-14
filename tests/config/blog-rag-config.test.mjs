import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const configPath = path.resolve("src/config.ts");
const syncScriptPath = path.resolve("scripts/sync-blog-rag.mjs");

test("blog RAG URLs are centralized in src/config.ts with Chinese comments", async () => {
	const source = await readFile(configPath, "utf8");

	assert.match(source, /BLOG_RAG_SYNC_ENDPOINT/);
	assert.match(source, /BLOG_RAG_EMBED_URL/);
	assert.match(source, /BLOG_RAG_SITE_URL/);
	assert.match(source, /export const blogRagConfig/);
	assert.match(source, /Cloudflare RAG/);
	assert.match(source, /同步接口/);
	assert.match(source, /悬浮聊天窗口/);
});

test("RAG sync script reads defaults from src/config.ts instead of hardcoding deployment URLs", async () => {
	const source = await readFile(syncScriptPath, "utf8");

	assert.match(source, /typescript/);
	assert.match(source, /BLOG_RAG_SYNC_ENDPOINT/);
	assert.match(source, /BLOG_RAG_SITE_URL/);
	assert.doesNotMatch(source, /const DEFAULT_RAG_ENDPOINT/);
	assert.doesNotMatch(source, /const DEFAULT_SITE_URL/);
	assert.doesNotMatch(source, /https:\/\/cloudflare-rag-1mw\.pages\.dev/);
	assert.doesNotMatch(source, /https:\/\/ynga\.kingcola-icg\.cn\//);
});
