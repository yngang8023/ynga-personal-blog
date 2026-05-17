import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const streamPath = path.resolve("cloudflare-rag/functions/api/stream.ts");

test("stream retrieval only searches and loads current revisions", async () => {
	const source = await readFile(streamPath, "utf8");

	assert.match(source, /currentRevisionId/);
	assert.match(source, /blogPostChunks\.revisionId/);
	assert.match(source, /blogPostImages\.revisionId/);
	assert.match(source, /blogPosts\.currentRevisionId/);
	assert.match(source, /blog_post_chunks\.revision_id = blog_posts\.current_revision_id/);
});
