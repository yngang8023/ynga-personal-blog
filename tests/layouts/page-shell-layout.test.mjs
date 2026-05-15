import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const mainGridLayoutPath = path.resolve("src/layouts/MainGridLayout.astro");
const gridScriptsPath = path.resolve("src/layouts/partials/GridScripts.astro");
const layoutPath = path.resolve("src/layouts/Layout.astro");

test("main grid layout emits page shell markers for sidebarless pages", async () => {
	const source = await readFile(mainGridLayoutPath, "utf8");

	assert.match(source, /data-page-shell-layout=\{hideSidebars \? "no-sidebars" : "default"\}/);
	assert.match(source, /data-page-shell-layout-source/);
	assert.match(source, /#main-grid\[data-page-shell-layout="no-sidebars"\] #sidebar/);
	assert.match(source, /#main-grid\[data-page-shell-layout="no-sidebars"\] \.right-sidebar-container/);
	assert.match(source, /#main-grid\[data-page-shell-layout="no-sidebars"\] #swup-container/);
});

test("grid scripts resync the persistent shell layout after content replacement", async () => {
	const source = await readFile(gridScriptsPath, "utf8");

	assert.match(source, /window\.__mizukiPageShellLayout/);
	assert.match(source, /const syncPageShellLayoutState = \(doc = document\) =>/);
	assert.match(source, /syncPageShellLayoutState\(document\);/);
	assert.doesNotMatch(source, /import \{ syncPageShellLayout \} from "\/scripts\/core\/page-shell-layout\.js";/);
	assert.match(source, /window\.swup\.hooks\.on\("content:replace", function \(\) \{/);
	assert.match(source, /document\.addEventListener\("swup:page:view", function \(\) \{/);
});

test("layout loads the page shell helper from src for client-side layout sync", async () => {
	const source = await readFile(layoutPath, "utf8");

	assert.match(source, /import "\.\.\/scripts\/core\/page-shell-layout\.js";/);
});
