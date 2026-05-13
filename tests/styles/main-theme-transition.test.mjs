import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const mainCssPath = path.resolve("src/styles/main.css");

const readMainCss = async () => readFile(mainCssPath, "utf8");

test("main theme transition styles expose a lightweight translucent theme veil", async () => {
	const source = await readMainCss();
	const veilRule = source.match(
		/#theme-transition-veil\s*\{(?<content>[\s\S]*?)\n\s*\}/,
	)?.groups?.content;

	assert.ok(veilRule);
	assert.match(source, /#theme-transition-veil/);
	assert.match(source, /\.is-theme-transitioning\.use-theme-veil #theme-transition-veil/);
	assert.match(veilRule, /background-image: radial-gradient\(/);
	assert.match(veilRule, /var\(--theme-veil-spotlight\) 0%/);
	assert.match(source, /opacity var\(--theme-switch-duration, 220ms\) cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
	assert.doesNotMatch(veilRule, /backdrop-filter: blur/);
	assert.doesNotMatch(veilRule, /-webkit-backdrop-filter: blur/);
	assert.doesNotMatch(source, /view-transition-name:/);
	assert.doesNotMatch(source, /::view-transition-/);
	assert.doesNotMatch(source, /use-coordinated-theme-transition/);
});
