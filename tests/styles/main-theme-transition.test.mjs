import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const mainCssPath = path.resolve("src/styles/main.css");

const readMainCss = async () => readFile(mainCssPath, "utf8");

test("main theme transition styles expose a translucent blurred theme veil", async () => {
	const source = await readMainCss();

	assert.match(source, /#theme-transition-veil/);
	assert.match(source, /\.is-theme-transitioning\.use-theme-veil #theme-transition-veil/);
	assert.match(source, /background-image: radial-gradient\(/);
	assert.match(source, /var\(--theme-veil-spotlight\) 0%/);
	assert.match(source, /opacity var\(--theme-switch-duration, 220ms\) cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
	assert.match(source, /background-color var\(--theme-switch-duration, 220ms\) cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
	assert.match(source, /backdrop-filter: blur\(14px\) saturate\(0\.92\)/);
	assert.doesNotMatch(source, /view-transition-name:/);
	assert.doesNotMatch(source, /::view-transition-/);
	assert.doesNotMatch(source, /use-coordinated-theme-transition/);
});
