import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const themeOptimizerPath = path.resolve("src/scripts/theme-optimizer.js");

const readThemeOptimizer = async () => readFile(themeOptimizerPath, "utf8");

test("theme optimizer does not treat the article body as a heavy element during theme switches", async () => {
	const source = await readThemeOptimizer();
	const heavySelectors = source.match(
		/this\.heavySelectors\s*=\s*\[(?<content>[\s\S]*?)\];/,
	)?.groups?.content;
	const temporaryTransitionStyles = source.match(
		/this\.tempStyleSheet\.textContent = `(?<content>[\s\S]*?)`;/,
	)?.groups?.content;

	assert.ok(heavySelectors);
	assert.ok(temporaryTransitionStyles);
	assert.doesNotMatch(heavySelectors, /\.custom-md/);
	assert.doesNotMatch(
		temporaryTransitionStyles,
		/\.is-theme-transitioning \.custom-md \*/,
	);
	assert.match(
		temporaryTransitionStyles,
		/\.is-theme-transitioning \.float-panel:not\(\.float-panel-closed\),/,
	);
	assert.doesNotMatch(source, /this\.hideOffscreenHeavyElements\(\)/);
	assert.doesNotMatch(source, /function hideOffscreenHeavyElements/);
	assert.doesNotMatch(source, /getBoundingClientRect\(\)/);
	assert.doesNotMatch(source, /use-view-transition/);
});

test("theme optimizer avoids mass compositing writes during theme switches", async () => {
	const source = await readThemeOptimizer();
	const forceCompositingBody = source.match(
		/forceCompositing\(\)\s*\{(?<content>[\s\S]*?)\n\t\}/,
	)?.groups?.content;

	assert.ok(forceCompositingBody);
	assert.doesNotMatch(forceCompositingBody, /\.expressive-code/);
	assert.doesNotMatch(forceCompositingBody, /\.post-card/);
	assert.doesNotMatch(forceCompositingBody, /\.widget/);
	assert.match(forceCompositingBody, /#navbar/);
});
