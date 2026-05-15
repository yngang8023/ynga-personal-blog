import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const ogImagePath = path.join(projectRoot, "src", "pages", "og", "[...slug].png.ts");

test("og image template stays satori-native without a React import", () => {
	const source = fs.readFileSync(ogImagePath, "utf8");

	assert.doesNotMatch(
		source,
		/from\s+["']react["']/,
		"og image generation should not import React directly",
	);
	assert.match(
		source,
		/type\s+SatoriRenderable\s*=\s*Parameters<typeof satori>\[0\]/,
		"og image generation should use satori's own parameter type instead of a React import",
	);
	assert.match(
		source,
		/function\s+createSatoriNode\s*\(/,
		"og image generation should build Satori nodes through a local helper",
	);
	assert.match(
		source,
		/key:\s*null/,
		"generated Satori nodes should include a null key to satisfy the current ReactNode-compatible shape",
	);
});
