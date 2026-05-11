import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const settingUtilsPath = path.resolve("src/utils/setting-utils.ts");

const readSettingUtils = async () => readFile(settingUtilsPath, "utf8");

test("theme switching always uses a translucent blurred theme veil", async () => {
	const source = await readSettingUtils();

	assert.match(source, /const THEME_TRANSITION_VEIL_ID = "theme-transition-veil"/);
	assert.match(source, /const THEME_VEIL_MAX_OPACITY = 0\.56/);
	assert.match(source, /const THEME_VEIL_SETTLE_OPACITY = 0\.34/);
	assert.match(source, /const THEME_VEIL_BLUR = "blur\(14px\)"/);
	assert.match(source, /function ensureThemeTransitionVeil\(\)/);
	assert.match(source, /function updateThemeTransitionOrigin\(/);
	assert.match(source, /function runMaskedThemeSwitch\(/);
	assert.match(
		source,
		/root\.classList\.add\(\s*"is-theme-transitioning",\s*"use-theme-veil",?\s*\)/,
	);
	assert.match(
		source,
		/veil\.style\.setProperty\(\s*"opacity",\s*String\(THEME_VEIL_MAX_OPACITY\),\s*"important",?\s*\)/,
	);
	assert.match(
		source,
		/veil\.style\.setProperty\(\s*"backdrop-filter",\s*`\$\{THEME_VEIL_BLUR\} saturate\(0\.92\)`,\s*"important",?\s*\)/,
	);
	assert.match(
		source,
		/veil\.style\.setProperty\(\s*"opacity",\s*String\(THEME_VEIL_SETTLE_OPACITY\),\s*"important",?\s*\)/,
	);
	assert.match(source, /veil\.style\.setProperty\("opacity", "0", "important"\)/);
	assert.match(source, /function dispatchThemeSwitchEvent\(/);
	assert.match(source, /new CustomEvent\(`theme-switch:\$\{type\}`/);
	assert.match(source, /const mode: ThemeTransitionMode = "theme-veil"/);
	assert.doesNotMatch(source, /use-view-transition/);
	assert.doesNotMatch(source, /startThemeViewTransition/);
	assert.doesNotMatch(source, /runViewThemeSwitch/);
	assert.doesNotMatch(source, /shouldUseViewTransitionForThemeSwitch/);
	assert.match(
		source,
		/if \(needsThemeChange\) {\s*return runMaskedThemeSwitch\(performThemeChange, theme, options\);\s*}/,
	);
});
