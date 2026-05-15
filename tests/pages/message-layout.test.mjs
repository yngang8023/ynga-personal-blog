import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const messagePagePath = path.join(projectRoot, "src", "pages", "message.astro");

test("message page promotes brighter dark-mode copy for the intro cards", () => {
	const source = fs.readFileSync(messagePagePath, "utf8");

	assert.match(
		source,
		/:global\(\.dark\)\s+\.message-hero-grid\s*\{[\s\S]*?--message-title-color:\s*[^;]*white[^;]*;[\s\S]*?--message-body-color:\s*[^;]*white[^;]*;/,
		"message intro cards should override dark-mode title and body copy colors toward white for stronger contrast",
	);
});
