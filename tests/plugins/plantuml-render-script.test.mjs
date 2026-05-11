import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const scriptPath = path.resolve("src/plugins/plantuml-render-script.js");

const readScript = async () => readFile(scriptPath, "utf8");

test("plantuml render script supports theme-aware image switching and fullscreen controls", async () => {
	const script = await readScript();

	assert.match(script, /window\.plantumlInitialized/);
	assert.match(script, /document\.documentElement\.classList\.contains\("dark"\)/);
	assert.match(script, /data-light-src/);
	assert.match(script, /data-dark-src/);
	assert.match(script, /data-light-sources/);
	assert.match(script, /data-dark-sources/);
	assert.match(script, /plantuml-controls/);
	assert.match(script, /plantuml-fullscreen-overlay/);
	assert.match(script, /window\.open\(.*_blank/);
	assert.match(script, /data-source-base64/);
	assert.match(script, /显示源码/);
	assert.match(script, /复制源码/);
	assert.match(script, /复制成功/);
	assert.match(script, /复制失败/);
	assert.match(script, /请手动复制/);
	assert.match(script, /data-copy-state/);
	assert.match(script, /removeAttribute\("data-copy-state"\)/);
	assert.match(script, /atob|TextDecoder/);
	assert.match(script, /navigator\.clipboard/);
	assert.match(script, /document\.execCommand\("copy"\)/);
	assert.match(script, /document\.createRange\(\)/);
	assert.match(script, /selection\.addRange/);
	assert.match(script, /window\.prompt/);
	assert.match(script, /closest\("\.plantuml-source-panel"\)/);
	assert.match(script, /PlantUML 图表加载中\.\.\./);
	assert.match(script, /const imagePreloadCache = new Map\(\)/);
	assert.match(script, /const ACTIVATION_MARGIN = "540px 0px 540px 0px"/);
	assert.match(script, /function preloadPlantumlSource\(/);
	assert.match(script, /function resolveThemeSource\(/);
	assert.match(script, /function applyThemeToContainer\(/);
	assert.match(script, /function observeActivation\(/);
	assert.match(script, /dataset\.plantumlActivated/);
	assert.match(script, /function scheduleThemeApply\(/);
	assert.match(script, /requestAnimationFrame\(\(\)\s*=>\s*\{[\s\S]*?applyTheme\(/);
	assert.match(
		script,
		/if\s*\(isPlaceholderSource\(currentSrc\)\)\s*\{\s*return;\s*\}/,
	);
	assert.doesNotMatch(script, /下载 SVG/);
	assert.doesNotMatch(script, /downloadCurrentSvg/);
	assert.match(script, /astro:page-load/);
});
