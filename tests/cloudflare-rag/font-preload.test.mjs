import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const rootPath = path.resolve("cloudflare-rag/app/root.tsx");

test("cloudflare-rag font preload uses the bundled asset import URL", async () => {
	const source = await readFile(rootPath, "utf8");

	assert.match(source, /import lxgwWenkaiRegularWoff2Url from "\.\.\/assets\/LXGWWenKai-Regular\.woff2";/);
	assert.match(source, /href=\{lxgwWenkaiRegularWoff2Url\}/);
	assert.doesNotMatch(source, /href="\/assets\/LXGWWenKai-Regular\.woff2"/);
});
