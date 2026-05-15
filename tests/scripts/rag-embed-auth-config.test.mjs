import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const blogHelperPath = path.resolve("edge-functions/_shared/rag-embed-auth.js");
const ragHelperPath = path.resolve("cloudflare-rag/functions/_shared/rag-embed-auth.js");

test("rag embed auth helpers do not hardcode the blog origin internally", async () => {
	const [blogHelperSource, ragHelperSource] = await Promise.all([
		readFile(blogHelperPath, "utf8"),
		readFile(ragHelperPath, "utf8"),
	]);

	assert.doesNotMatch(
		blogHelperSource,
		/RAG_EMBED_ALLOWED_ORIGIN\s*=\s*"https:\/\/ynga\.kingcola-icg\.cn"/,
	);
	assert.doesNotMatch(
		ragHelperSource,
		/RAG_EMBED_ALLOWED_ORIGIN\s*=\s*"https:\/\/ynga\.kingcola-icg\.cn"/,
	);
});
