import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const rootPath = path.resolve("cloudflare-rag/app/root.tsx");

test("cloudflare-rag root does not preload or preconnect a custom WenKai font", async () => {
	const source = await readFile(rootPath, "utf8");

	assert.doesNotMatch(source, /LXGWWenKai-Regular\.woff2/);
	assert.doesNotMatch(source, /rel="preload"/);
	assert.doesNotMatch(source, /rel="preconnect"\s+href="https:\/\/ynga\.kingcola-icg\.cn"/);
});
