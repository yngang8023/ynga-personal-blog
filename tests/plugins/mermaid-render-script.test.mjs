import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const scriptPath = path.resolve("src/plugins/mermaid-render-script.js");

const readScript = async () => readFile(scriptPath, "utf8");

test("mermaid render script lazy-renders visible diagrams and caches themed SVG output", async () => {
	const script = await readScript();

	assert.match(script, /const MERMAID_SCRIPT_SOURCES = \[/);
	assert.match(script, /window\.__BLOG_DIAGRAM_CONFIG__/);
	assert.match(script, /diagramRuntimeConfig\.mermaidScriptUrl/);
	assert.match(script, /"\/diagram\/mermaid\.js"/);
	assert.match(script, /"https:\/\/unpkg\.com\/mermaid@11\.12\.0\/dist\/mermaid\.min\.js"/);
	assert.doesNotMatch(script, /cdn\.staticfile\.net/);
	assert.doesNotMatch(script, /cdn\.jsdelivr\.net/);
	assert.match(script, /const renderCache = new Map\(\)/);
	assert.match(script, /new IntersectionObserver\(/);
	assert.match(script, /const IDLE_PREFETCH_LIMIT = 0/);
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

test("mermaid render script uses adaptive CSS variables and keeps theme swaps off the render path", async () => {
	const script = await readScript();

	assert.match(script, /const ADAPTIVE_THEME = "adaptive"/);
	assert.match(script, /const IDLE_PREFETCH_LIMIT = 0/);
	assert.match(script, /let mermaidWorkPromise = Promise\.resolve\(\)/);
	assert.match(script, /const pendingRenderCache = new Map\(\)/);
	assert.match(script, /function runMermaidTask\(/);
	assert.match(script, /function cancelThemePrewarm\(/);
	assert.match(script, /function ensureAdaptiveMermaidThemeStyle\(/);
	assert.match(script, /function getMermaidRenderPalette\(/);
	assert.match(script, /function adaptMermaidSvgToCssVariables\(/);
	assert.match(script, /function replaceAllSvgColorTokens\(/);
	assert.match(script, /function getCssVariableName\(/);
	assert.match(script, /--mermaid-\$\{toKebabCase\(key\)\}/);
	assert.match(script, /`var\(\$\{getCssVariableName\(variableKey\)\}\)`/);
	assert.match(script, /function updateHostVisibility\(/);
	assert.match(script, /function yieldToMainThread\(/);
	assert.match(script, /function scheduleThemeSwitch\(/);
	assert.match(script, /const preparedRenderCache = new Map\(\)/);
	assert.match(script, /function ensureDiagramShell\(/);
	assert.match(script, /stage\.replaceChildren\(prepared\.svg\)/);
	assert.match(script, /const pending = pendingRenderCache\.get\(cacheKey\)/);
	assert.match(script, /function markMountedDiagramsTheme\(/);
	assert.match(script, /markMountedDiagramsTheme\(hosts,\s*nextTheme\)/);
	assert.doesNotMatch(script, /const missingVisible = applyThemeFromCache/);
	assert.doesNotMatch(script, /missingVisible\.forEach/);
	assert.doesNotMatch(script, /if \(nextTheme === currentTheme\)/);
	const scheduleThemeSwitchBody = script.match(
		/function scheduleThemeSwitch\(\)\s*\{(?<content>[\s\S]*?)\n\t\}/,
	)?.groups?.content;
	assert.ok(scheduleThemeSwitchBody);
	assert.doesNotMatch(scheduleThemeSwitchBody, /queueDiagramRender/);
	assert.doesNotMatch(scheduleThemeSwitchBody, /drainRenderQueue/);
	assert.doesNotMatch(scheduleThemeSwitchBody, /scheduleThemePrewarm/);
	assert.doesNotMatch(script, /diagramObserver\.unobserve\(entry\.target\)/);
	assert.doesNotMatch(script, /scheduleThemePrewarm\(getOppositeTheme\(currentTheme\),\s*visibleHosts\)/);
	assert.doesNotMatch(script, /window\.__diagramThemeUtils/);
	assert.doesNotMatch(script, /void loadMermaidLibrary\(\)/);
});

test("mermaid render script feeds official hex colors to Mermaid and adapts output SVG colors afterward", async () => {
	const script = await readScript();

	const getMermaidConfigBody = script.match(
		/function getMermaidConfig\(theme\)\s*\{(?<content>[\s\S]*?)\n\t\}/,
	)?.groups?.content;
	assert.ok(getMermaidConfigBody);
	assert.match(getMermaidConfigBody, /theme:\s*"base"/);
	assert.match(getMermaidConfigBody, /getMermaidRenderPalette\(\)/);
	assert.doesNotMatch(getMermaidConfigBody, /var\(--mermaid-/);
	assert.doesNotMatch(script, /function getAdaptiveMermaidPalette\(/);

	const buildPreparedDiagramBody = script.match(
		/function buildPreparedDiagram\(cacheKey, svgMarkup\)\s*\{(?<content>[\s\S]*?)\n\t\}/,
	)?.groups?.content;
	assert.ok(buildPreparedDiagramBody);
	assert.match(buildPreparedDiagramBody, /const adaptiveSvgMarkup = adaptMermaidSvgToCssVariables\(svgMarkup\)/);
	assert.match(buildPreparedDiagramBody, /parseSvgMarkup\(adaptiveSvgMarkup\)/);
	assert.match(buildPreparedDiagramBody, /assertNotMermaidErrorSvg\(svg, adaptiveSvgMarkup\)/);
});
