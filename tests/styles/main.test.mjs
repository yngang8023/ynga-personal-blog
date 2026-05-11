import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const mainCssPath = path.resolve("src/styles/main.css");

const readMainCss = async () => readFile(mainCssPath, "utf8");

test("raises Waline cards above footer/meta layers when popup is open", async () => {
	const css = await readMainCss();

	assert.match(
		css,
		/\.waline-container\s+\.wl-cards:has\(\.wl-emoji-popup\.display\),\s*\n\s*\.waline-container\s+\.wl-cards:has\(\.wl-gif-popup\.display\)\s*\{[\s\S]*?z-index:\s*500\s*!important;/,
	);
});

test("forces Waline emoji and gif popups to expand upward above the footer", async () => {
	const css = await readMainCss();

	assert.match(
		css,
		/\.waline-container\s+\.wl-emoji-popup,\s*\n\s*\.waline-container\s+\.wl-gif-popup\s*\{[\s\S]*?top:\s*auto\s*!important;[\s\S]*?bottom:\s*calc\(100%\s*\+\s*0\.75rem\)\s*!important;[\s\S]*?left:\s*1\.25em\s*!important;[\s\S]*?right:\s*auto\s*!important;[\s\S]*?z-index:\s*2147483647\s*!important;/,
	);
});

test("keeps zoom affordance for website card logo preview triggers", async () => {
	const css = await readMainCss();

	assert.match(
		css,
		/\.custom-md\s+a\.card-website\s+\.wc-logo-shell\s*\{[\s\S]*?cursor:\s*zoom-in;/,
	);
});

test("restores website cards as horizontal grid links instead of shell-only layout", async () => {
	const css = await readMainCss();

	assert.match(
		css,
		/\.custom-md\s+a\.card-website\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*4rem minmax\(0,\s*1fr\);/,
	);

	assert.doesNotMatch(css, /\.custom-md\s+\.card-website-shell\s*\{/);
});

test("supports compact website-card metadata blocks without rendering preview media", async () => {
	const css = await readMainCss();

	assert.match(
		css,
		/\.custom-md\s+a\.card-website\s*\{[\s\S]*?border:\s*1px solid color-mix\(in oklch, var\(--line-divider\) 70%, var\(--wc-accent\) 30%\);/,
	);

	assert.match(
		css,
		/\.custom-md\s+a\.card-website\s+\.wc-meta\s*\{[\s\S]*?display:\s*flex;/,
	);

	assert.match(
		css,
		/\.custom-md\s+a\.card-website\s+\.wc-head\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*space-between;/,
	);

	assert.doesNotMatch(css, /\.custom-md\s+a\.card-website\s+\.wc-title\s*\{/);
	assert.doesNotMatch(css, /\.custom-md\s+a\.card-website\s+\.wc-preview-shell\s*\{/);
	assert.doesNotMatch(css, /\.custom-md\s+a\.card-website\s+\.wc-preview-image\s*\{/);
	assert.doesNotMatch(css, /\.custom-md\s+a\.card-website\.card-website--with-preview\s*\{/);
});

test("keeps desktop home sidebar sticky offset anchored to the navbar instead of subtracting the banner translate", async () => {
	const mainGridLayoutPath = path.resolve("src/layouts/MainGridLayout.astro");
	const layoutSource = await readFile(mainGridLayoutPath, "utf8");

	assert.doesNotMatch(
		layoutSource,
		/--sidebar-sticky-top:\s*calc\([\s\S]*?var\(--banner-height-extend\)/,
	);
	assert.match(
		layoutSource,
		/--sidebar-sticky-top:\s*calc\([\s\S]*?var\(--navbar-height(?:,\s*4\.5rem)?\)[\s\S]*?\+[\s\S]*?var\(--sidebar-sticky-gap(?:,\s*1rem)?\)[\s\S]*?\);/,
	);
});
