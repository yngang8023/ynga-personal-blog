import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const deployWorkflowPath = path.resolve(".github/workflows/deploy.yml");

test("deploy workflow syncs blog posts to the Cloudflare RAG service after a successful build", async () => {
	const source = await readFile(deployWorkflowPath, "utf8");

	assert.match(source, /name:\s*Sync Cloudflare RAG knowledge base/);
	assert.match(source, /run:\s*pnpm sync-rag/);
	assert.match(
		source,
		/BLOG_RAG_SYNC_TOKEN:\s*\$\{\{\s*secrets\.BLOG_RAG_SYNC_TOKEN\s*\}\}/,
	);
	assert.match(
		source,
		/BLOG_RAG_SYNC_ENDPOINT:\s*\$\{\{\s*vars\.BLOG_RAG_SYNC_ENDPOINT\s*\}\}/,
	);
	assert.match(
		source,
		/BLOG_RAG_SITE_URL:\s*\$\{\{\s*vars\.BLOG_RAG_SITE_URL\s*\}\}/,
	);
	assert.doesNotMatch(source, /https:\/\/cloudflare-rag-1mw\.pages\.dev/);
	assert.doesNotMatch(source, /https:\/\/ynga\.kingcola-icg\.cn\//);
});
