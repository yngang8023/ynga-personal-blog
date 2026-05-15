import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const blogMainCssPath = path.resolve("src/styles/main.css");
const blogConfigPath = path.resolve("src/config.ts");
const headTagsPath = path.resolve("src/layouts/partials/HeadTags.astro");
const ragTailwindCssPath = path.resolve("cloudflare-rag/app/tailwind.css");
const ragGlobalsCssPath = path.resolve("cloudflare-rag/app/globals.css");
const ragRootPath = path.resolve("cloudflare-rag/app/root.tsx");
const blogWoff2Path = path.resolve("public/assets/font/LXGWWenKai-Regular.woff2");
const blogTtfPath = path.resolve("public/assets/font/LXGWWenKai-Regular.ttf");
const ragTtfPath = path.resolve("cloudflare-rag/assets/LXGWWenKai-Regular.ttf");

test("blog font config and styles prefer woff2 with swap, unicode-range, and preload", async () => {
	const [mainCss, configSource, headTagsSource] = await Promise.all([
		readFile(blogMainCssPath, "utf8"),
		readFile(blogConfigPath, "utf8"),
		readFile(headTagsPath, "utf8"),
	]);

	assert.match(
		mainCss,
		/src:\s*url\("\/assets\/font\/LXGWWenKai-Regular\.woff2"\)\s*format\("woff2"\);/,
	);
	assert.match(mainCss, /font-display:\s*swap;/);
	assert.match(
		mainCss,
		/unicode-range:\s*[\s\S]*?U\+0020-007F,[\s\S]*?U\+4E00-9FFF,[\s\S]*?U\+3000-303F;/,
	);
	assert.doesNotMatch(mainCss, /LXGWWenKai-Regular\.ttf/);

	assert.match(configSource, /localFonts:\s*\["LXGWWenKai-Regular\.woff2"\]/);
	assert.doesNotMatch(configSource, /localFonts:\s*\["LXGWWenKai-Regular\.ttf"\]/);

	assert.match(headTagsSource, /if \(lowerName\.endsWith\("\.woff2"\)\) return "font\/woff2";/);
	assert.match(
		headTagsSource,
		/<link[\s\S]*?rel="preload"[\s\S]*?href=\{url\(`\/assets\/font\/\$\{fontFile\}`\)\}[\s\S]*?as="font"[\s\S]*?type=\{getFontMimeType\(fontFile\)\}[\s\S]*?crossorigin/,
	);
});

test("cloudflare-rag uses system serif fonts and does not reference WenKai assets", async () => {
	const [tailwindCss, globalsCss, rootSource] = await Promise.all([
		readFile(ragTailwindCssPath, "utf8"),
		readFile(ragGlobalsCssPath, "utf8"),
		readFile(ragRootPath, "utf8"),
	]);

	for (const cssSource of [tailwindCss, globalsCss]) {
		assert.match(
			cssSource,
			/font-family:\s*[\s\S]*?ui-serif,[\s\S]*?Georgia,[\s\S]*?Cambria,[\s\S]*?"Times New Roman",[\s\S]*?serif;/,
		);
		assert.doesNotMatch(cssSource, /LXGWWenKai/);
		assert.doesNotMatch(cssSource, /LXGWWenKai-Regular\.woff2/);
		assert.doesNotMatch(cssSource, /@font-face/);
	}

	assert.doesNotMatch(rootSource, /LXGWWenKai-Regular\.woff2/);
	assert.doesNotMatch(rootSource, /rel="preload"/);
	assert.doesNotMatch(rootSource, /rel="preconnect"\s+href="https:\/\/ynga\.kingcola-icg\.cn"/);
});

test("the blog keeps its WenKai woff2 asset while no ttf fallback is present", async () => {
	await access(blogWoff2Path);

	await assert.rejects(access(blogTtfPath));
	await assert.rejects(access(ragTtfPath));
});
