import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const widgetPath = path.resolve("src/components/control/AiChatWidget.astro");
const controlsPath = path.resolve("src/components/control/FloatingControls.astro");

test("AI chat widget embeds the deployed Cloudflare RAG chat UI lazily", async () => {
	const source = await readFile(widgetPath, "utf8");

	assert.match(source, /import \{ blogRagConfig \} from "..\/..\/config";/);
	assert.match(source, /const embedUrl = blogRagConfig\.embedUrl;/);
	assert.match(source, /const tokenEndpoint = blogRagConfig\.tokenEndpoint;/);
	assert.doesNotMatch(source, /https:\/\/cloudflare-rag-1mw\.pages\.dev\/embed/);
	assert.match(source, /id="ai-chat-btn"/);
	assert.match(source, /data-src=\{embedUrl\}/);
	assert.match(source, /data-token-endpoint=\{tokenEndpoint\}/);
	assert.match(source, /<iframe/);
	assert.match(source, /fetch\(tokenEndpointUrl/);
	assert.match(source, /embed_token/);
	assert.match(source, /ai-chat-status/);
	assert.match(source, /window\.toggleAiChat/);
	assert.match(source, /IFRAME_READY_TIMEOUT_MS = 12000/);
	assert.match(source, /IFRAME_MAX_LOAD_ATTEMPTS = 2/);
	assert.match(source, /连接较慢，正在重试 AI 助手/);
	assert.match(source, /AI 助手连接超时，请稍后再试/);
	assert.match(source, /data\.type !== "ynga-rag-embed-ready"/);
	assert.doesNotMatch(source, /iframe\.addEventListener\("load"/);
});

test("floating controls mount and track the AI chat button", async () => {
	const source = await readFile(controlsPath, "utf8");

	assert.match(source, /import AiChatWidget from "\.\/AiChatWidget\.astro";/);
	assert.match(source, /data-control-key="ai"/);
	assert.match(source, /<AiChatWidget \/>/);
	assert.match(source, /"ai-chat-btn"/);
});
