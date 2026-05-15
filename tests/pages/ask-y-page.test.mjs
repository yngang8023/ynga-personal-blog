import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const askYPagePath = path.join(projectRoot, "src", "pages", "ask-y.astro");

test("ask-y page renders a dedicated inline rag chat entry with the shared right-sidebar layout script", () => {
	const source = fs.readFileSync(askYPagePath, "utf8");

	assert.match(source, /ASK_Y_PAGE_TITLE/);
	assert.match(source, /ASK_Y_PAGE_SUBTITLE/);
	assert.match(source, /import\("\.\.\/scripts\/right-sidebar-layout\.js"\)/);
	assert.match(source, /<ProtectedRagEmbed/);
	assert.match(source, /class="ask-y-shell"/);
	assert.match(source, /class="ask-y-embed-card"/);
});
