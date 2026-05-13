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
	assert.match(source, /--theme-veil-spotlight:\s*rgba\(255,\s*255,\s*255,\s*0\.12\)/);
	assert.match(source, /opacity var\(--theme-switch-duration, 220ms\) cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
	assert.doesNotMatch(veilRule, /backdrop-filter: blur/);
	assert.doesNotMatch(veilRule, /-webkit-backdrop-filter: blur/);
	assert.doesNotMatch(source, /view-transition-name:/);
	assert.doesNotMatch(source, /::view-transition-/);
	assert.doesNotMatch(source, /use-coordinated-theme-transition/);
});

test("main theme transition styles suppress expensive article and diagram transitions", async () => {
	const source = await readMainCss();

	assert.match(source, /\.is-theme-transitioning :where\(\s*\.custom-md/);
	assert.match(source, /\.is-theme-transitioning :where\([\s\S]*?\.mermaid-diagram-container/);
	assert.match(source, /\.is-theme-transitioning :where\([\s\S]*?\.plantuml-diagram-container/);
	assert.match(source, /transition:\s*none !important;/);
	assert.match(source, /animation:\s*none !important;/);
	assert.match(source, /\.is-theme-transitioning :where\(\.mermaid-stage,\s*\.plantuml-image\)/);
	assert.match(source, /will-change:\s*auto !important;/);
});

test("main styles isolate long article blocks with content visibility", async () => {
	const source = await readMainCss();

	assert.match(source, /#post-container\s+\.custom-md\s*>\s*:where\(\.mermaid-diagram-container,\s*\.plantuml-diagram-container\)/);
	assert.match(source, /content-visibility:\s*auto;/);
	assert.match(source, /contain-intrinsic-size:\s*auto 360px;/);
	assert.match(source, /contain:\s*layout paint style;/);
	assert.doesNotMatch(source, /#post-container\s+\.custom-md\s*>\s*:where\([^)]*p,/);
	assert.doesNotMatch(source, /#post-container\s+\.custom-md\s*>\s*:where\([^)]*blockquote/);
	assert.doesNotMatch(source, /#post-container\s+\.custom-md\s*>\s*:where\([^)]*ul/);
	assert.doesNotMatch(source, /#post-container\s+\.custom-md\s*>\s*:where\([^)]*h1/);
	assert.doesNotMatch(source, /#post-container\s+\.custom-md\s*>\s*:where\([^)]*section/);
	assert.doesNotMatch(source, /\.is-theme-transitioning\s+\.expressive-code\s*\{[\s\S]*?content-visibility:\s*hidden !important;/);
});
