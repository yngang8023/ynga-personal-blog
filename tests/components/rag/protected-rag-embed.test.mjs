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
	assert.match(source, /<iframe/);
	assert.match(source, /fetch\(tokenEndpointUrl/);
	assert.match(source, /embed_token/);
	assert.match(source, /type:\s*"ynga-theme-change"/);
	assert.match(source, /allow="clipboard-write"/);
	assert.match(source, /@media \(max-width:\s*900px\)/);
});
