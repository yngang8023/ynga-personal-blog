import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const askYPagePath = path.join(projectRoot, "src", "pages", "ask-y.astro");

test("ask-y page renders a dedicated wide rag chat entry without sidebars or intro cards", () => {
	const source = fs.readFileSync(askYPagePath, "utf8");

	assert.match(source, /ASK_Y_PAGE_TITLE/);
	assert.match(source, /ASK_Y_PAGE_SUBTITLE/);
	assert.match(source, /hideSidebars=\{true\}/);
	assert.match(source, /<ProtectedRagEmbed/);
	assert.match(source, /class="ask-y-shell"/);
	assert.match(source, /class="ask-y-embed-card"/);
	assert.doesNotMatch(source, /ask-y-overview-grid/);
	assert.doesNotMatch(source, /ask-y-intro-card/);
	assert.doesNotMatch(source, /ask-y-note-card/);
});
