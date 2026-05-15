import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const componentPath = path.resolve("src/components/rag/ProtectedRagEmbed.astro");

test("protected rag embed bootstraps the iframe through the blog token endpoint", async () => {
	const source = await readFile(componentPath, "utf8");

	assert.match(source, /import \{ blogRagConfig \} from "..\/..\/config";/);
	assert.match(source, /const embedUrl = blogRagConfig\.embedUrl;/);
	assert.match(source, /const tokenEndpoint = blogRagConfig\.tokenEndpoint;/);
	assert.match(source, /const \{ title = "问问小Y对话页" \} = Astro\.props;/);
	assert.match(source, /<iframe/);
	assert.match(source, /fetch\(tokenEndpointUrl/);
	assert.match(source, /embed_token/);
	assert.match(source, /type:\s*"ynga-theme-change"/);
	assert.match(source, /allow="clipboard-write"/);
	assert.match(source, /@media \(max-width:\s*900px\)/);
});

test("protected rag embed waits for the rag ready message and retries on timeout", async () => {
	const source = await readFile(componentPath, "utf8");

	assert.match(source, /const IFRAME_READY_TIMEOUT_MS = 12000;/);
	assert.match(source, /const IFRAME_MAX_LOAD_ATTEMPTS = 2;/);
	assert.match(source, /data\.type !== "ynga-rag-embed-ready"/);
	assert.match(source, /win\.addEventListener\("message", handleMessage\);/);
	assert.match(source, /retry \? "连接较慢，正在重新连接问问小Y\.\.\." : "正在连接问问小Y\.\.\."/,);
	assert.match(source, /setStatus\("问问小Y连接超时，请刷新页面后重试。", "error"\);/);
	assert.doesNotMatch(source, /iframe\.addEventListener\("load"/);
});
