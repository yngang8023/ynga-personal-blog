import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const articlePath = path.resolve(
	"src/content/posts/cloudflare-rag-mizuki-integration-detail/index.md",
);

test("cloudflare-rag integration detail article keeps Mermaid route labels in a parser-safe form", async () => {
	const source = await readFile(articlePath, "utf8");
	const mermaidBlocks = [...source.matchAll(/```mermaid\s+([\s\S]*?)```/g)].map(
		([, block]) => block,
	);
	const combinedBlocks = mermaidBlocks.join("\n\n");

	assert.ok(mermaidBlocks.length > 0);
	assert.match(combinedBlocks, /D --> E\["POST \/api\/sync-sessions"\]/);
	assert.match(combinedBlocks, /N\[博客前端 \/ask-y 或悬浮窗\] --> O\["\/rag-embed-token"\]/);
	assert.match(combinedBlocks, /P --> Q\["\/embed\?embed_token=\.\.\."\]/);
	assert.match(combinedBlocks, /R --> S\["\/api\/stream"\]/);
	assert.match(
		combinedBlocks,
		/D\["路由守卫<br\/>functions\/\[\.\.\.path\]\.ts"\]/,
	);
	assert.doesNotMatch(combinedBlocks, /\[[/][^"\]]+\]/);
	assert.doesNotMatch(combinedBlocks, /functions\/\[\[path\]\]\.ts/);
});

test("cloudflare-rag integration detail article uses a supported dotenv fence for local env examples", async () => {
	const source = await readFile(articlePath, "utf8");

	assert.match(source, /```dotenv/);
	assert.doesNotMatch(source, /```env/);
});
