import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const layoutPath = path.resolve("src/layouts/Layout.astro");
const gridScriptsPath = path.resolve("src/layouts/partials/GridScripts.astro");
const bannerCssPath = path.resolve("src/styles/banner.css");

const readLayout = async () => readFile(layoutPath, "utf8");
const readGridScripts = async () => readFile(gridScriptsPath, "utf8");
const readBannerCss = async () => readFile(bannerCssPath, "utf8");

test("layout initializes wallpaper mode on the root element before body content renders", async () => {
	const layout = await readLayout();

	assert.match(layout, /document\.documentElement\.setAttribute\(\s*["']data-wallpaper-mode["']/);
	assert.match(layout, /localStorage\.getItem\(["']wallpaperMode["']\)/);
	assert.match(layout, /document\.documentElement\.setAttribute\(\s*["']data-wallpaper-init["']/);
});

test("grid scripts keep the root wallpaper mode attribute synchronized with runtime mode changes", async () => {
	const source = await readGridScripts();

	assert.match(source, /document\.documentElement\.setAttribute\(\s*["']data-wallpaper-mode["']\s*,[\s\S]*?wallpaperMode[\s\S]*?\)/);
	assert.match(source, /syncWallpaperRootState\(\s*wallpaperMode\s*,\s*["']ready["']\s*\)/);
});

test("banner css applies pre-hydration visibility rules for fullscreen and hidden wallpaper modes", async () => {
	const source = await readBannerCss();

	assert.match(source, /html\[data-wallpaper-mode=["']fullscreen["']\]\s+#banner-wrapper\s*\{\s*display:\s*none !important;/);
	assert.match(source, /html\[data-wallpaper-mode=["']none["']\]\s+#banner-wrapper\s*\{\s*display:\s*none !important;/);
	assert.match(source, /html\[data-wallpaper-mode=["']fullscreen["']\]\s+\[data-fullscreen-wallpaper\]\s*\{\s*display:\s*block !important;/);
	assert.match(source, /html\[data-wallpaper-mode=["']banner["']\]\s+\[data-fullscreen-wallpaper\]\s*\{\s*display:\s*none !important;/);
	assert.match(source, /html\[data-wallpaper-init=["']pending["']\]\[data-wallpaper-mode=["']fullscreen["']\]\s+body\.enable-banner\s+#banner-wrapper\s*\{\s*visibility:\s*hidden;/);
});
