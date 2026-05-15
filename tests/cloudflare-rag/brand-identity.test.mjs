import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const blogChatPath = path.resolve("cloudflare-rag/app/components/BlogChat.tsx");
const embedRoutePath = path.resolve("cloudflare-rag/app/routes/embed.tsx");
const streamPath = path.resolve("cloudflare-rag/functions/api/stream.ts");

test("cloudflare-rag embed surface uses the 小Y brand identity", async () => {
	const [blogChatSource, embedRouteSource] = await Promise.all([
		readFile(blogChatPath, "utf8"),
		readFile(embedRoutePath, "utf8"),
	]);

	assert.match(blogChatSource, /HiYngaの随✏️记 - 小Y/);
	assert.match(embedRouteSource, /HiYngaの随✏️记 - 小Y/);
	assert.doesNotMatch(blogChatSource, /HiYngaの随✏️记 - AI助手/);
	assert.doesNotMatch(embedRouteSource, /HiYnga Blog AI Assistant/);
});

test("cloudflare-rag stream prompts keep the 小Y knowledge-base assistant identity", async () => {
	const source = await readFile(streamPath, "utf8");

	assert.match(source, /你是 HiYngaの随✏️记 - 小Y，一个智能的个人博客文章网站知识库助手。/);
	assert.match(source, /回答时保持“小Y”这个助手身份/);
	assert.match(source, /在没有检索上下文时，你仍然保持“小Y”的身份/);
	assert.doesNotMatch(source, /普通 AI 助手/);
});
