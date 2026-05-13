import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const scriptPath = path.resolve("src/plugins/mermaid-render-script.js");

const readScript = async () => readFile(scriptPath, "utf8");

test("mermaid render script lazy-renders visible diagrams and caches themed SVG output", async () => {
	const script = await readScript();

	assert.match(script, /const MERMAID_SCRIPT_SOURCES = \[/);
	assert.match(script, /"\/diagram\/mermaid\.js"/);
	assert.doesNotMatch(script, /cdn\.staticfile\.net/);
	assert.doesNotMatch(script, /cdn\.jsdelivr\.net/);
	assert.doesNotMatch(script, /unpkg\.com\/mermaid@11\.12\.0\/dist\/mermaid\.min\.js/);
	assert.match(script, /const renderCache = new Map\(\)/);
	assert.match(script, /new IntersectionObserver\(/);
	assert.match(script, /requestIdleCallback/);
	assert.match(
		script,
		/window\.dispatchEvent\(\s*new CustomEvent\("mermaid:render:start"/,
	);
	assert.match(script, /window\.dispatchEvent\(\s*new CustomEvent\("mermaid:render:done"/);
});

test("mermaid render script uses the unified toolbar and fullscreen classes", async () => {
	const script = await readScript();

	assert.match(script, /createControlButtons\("mermaid-controls"/);
	assert.match(script, /createControlButtons\("mermaid-fs-controls"/);
	assert.match(script, /className = "mermaid-viewport"/);
	assert.match(script, /className = "mermaid-stage"/);
	assert.match(
		script,
		/"zoom-in"[\s\S]*?"zoom-out"[\s\S]*?"reset"[\s\S]*?"fullscreen"/,
	);

	assert.doesNotMatch(script, /mermaid-zoom-controls/);
	assert.doesNotMatch(script, /minHeight\s*=\s*"300px"/);
});

test("mermaid render script uses safe literal theme colors and centers fullscreen after mount", async () => {
	const script = await readScript();

	assert.match(script, /const MERMAID_THEME_PALETTES = \{/);
	assert.match(script, /theme:\s*"base"/);
	assert.match(script, /suppressErrorRendering:\s*true/);
	assert.match(script, /function assertNotMermaidErrorSvg\(/);
	assert.doesNotMatch(script, /function normalizeCssColor\(/);
	assert.doesNotMatch(script, /getComputedStyle\(document\.documentElement\)/);
	assert.match(
		script,
		/document\.body\.appendChild\(overlay\)[\s\S]*?requestAnimationFrame\(\(\)\s*=>\s*\{[\s\S]*?resetView\(fullscreenState\)/,
	);
});

test("mermaid render script prewarms alternate theme caches and defers theme swaps off the mutation path", async () => {
	const script = await readScript();

	assert.match(script, /let mermaidWorkPromise = Promise\.resolve\(\)/);
	assert.match(script, /const pendingRenderCache = new Map\(\)/);
	assert.match(script, /function runMermaidTask\(/);
	assert.match(script, /function cancelThemePrewarm\(/);
	assert.match(script, /function splitHostsForThemeSwitch\(/);
	assert.match(script, /function getMermaidThemePrewarmHosts\(/);
	assert.match(script, /function yieldToMainThread\(/);
	assert.match(script, /function prewarmThemeCache\(hosts,\s*theme,\s*options = \{\}\)/);
	assert.match(script, /function scheduleThemeSwitch\(/);
	assert.match(script, /const preparedRenderCache = new Map\(\)/);
	assert.match(script, /function ensureDiagramShell\(/);
	assert.match(script, /stage\.replaceChildren\(prepared\.svg\)/);
	assert.match(
		script,
		/requestAnimationFrame\(\(\)\s*=>\s*\{[\s\S]*?applyThemeFromCache\(/,
	);
	assert.match(
		script,
		/prewarmThemeCache\(\s*prewarmPlan\.deferredHosts,\s*theme,\s*\{\s*limit:\s*THEME_PREWARM_LIMIT\s*\}\s*,?\s*\)/,
	);
	assert.match(script, /const nextPrewarmHost = queue\.shift\(\)/);
	assert.match(
		script,
		/void getPreparedDiagram\(code,\s*theme\)\.catch\(\(\) => undefined\)\.finally\(\(\) => \{/,
	);
	assert.match(script, /cancelThemePrewarm\(\);\s*const missingVisible = applyThemeFromCache/);
	assert.match(script, /const pending = pendingRenderCache\.get\(cacheKey\)/);
	assert.match(script, /scheduleIdleWork\(\(\)\s*=>\s*prewarmThemeCache\(/);
	assert.doesNotMatch(script, /window\.__diagramThemeUtils/);
	assert.doesNotMatch(script, /void loadMermaidLibrary\(\)/);
});
