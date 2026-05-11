import assert from "node:assert/strict";
import test from "node:test";

import {
	extractWebsiteCardMetadataFromHtml,
	resolveWebsiteCardMetadata,
} from "../../src/plugins/website-card-utils.mjs";

test("extractWebsiteCardMetadataFromHtml resolves relative icon urls and trims description", () => {
	const html = `<!doctype html>
<html lang="en">
	<head>
		<title>Example Docs</title>
		<meta property="og:site_name" content="Example" />
		<meta property="og:title" content="Example Docs Hub" />
		<meta name="description" content="  Build fast and ship calm.  " />
		<meta name="theme-color" content="#ff6600" />
		<meta property="og:image" content="/images/cover-card.png" />
		<link rel="apple-touch-icon" href="/icons/apple-touch.png" />
	</head>
</html>`;

	const metadata = extractWebsiteCardMetadataFromHtml(
		html,
		"https://example.com/docs/",
	);

	assert.equal(metadata.siteName, "Example");
	assert.equal(metadata.title, "Example Docs Hub");
	assert.equal(metadata.description, "Build fast and ship calm.");
	assert.equal(metadata.themeColor, "#ff6600");
	assert.equal(metadata.accentColor, "#ff6600");
	assert.equal(
		metadata.logoUrl,
		"https://example.com/icons/apple-touch.png",
	);
	assert.equal(
		metadata.previewImageUrl,
		"https://example.com/images/cover-card.png",
	);
	assert.equal(metadata.displayHost, "example.com");
	assert.equal(metadata.displayUrl, "https://example.com/docs/");
});

test("resolveWebsiteCardMetadata falls back to a stable card payload when fetch fails", async () => {
	const metadata = await resolveWebsiteCardMetadata("example.com", {
		fetchImpl: async () => {
			throw new Error("offline");
		},
	});

	assert.equal(metadata.url, "https://example.com/");
	assert.equal(metadata.displayUrl, "https://example.com/");
	assert.equal(metadata.siteName, "example.com");
	assert.equal(metadata.displayHost, "example.com");
	assert.match(metadata.logoUrl, /^data:image\/svg\+xml/i);
	assert.match(metadata.accentColor, /^#[0-9a-f]{6}$/i);
	assert.match(metadata.description, /example\.com/i);
});

test("extractWebsiteCardMetadataFromHtml falls back to title and body images when open graph metadata is missing", () => {
	const html = `<!doctype html>
<html lang="zh-CN">
	<head>
		<title>栗次元API-举个栗子</title>
	</head>
	<body>
		<img src="https://edgeone.ai/_next/static/media/headLogo.daeb48ad.png" alt="CDN Logo" />
		<img src="/ycy" alt="二次元自适应" />
	</body>
</html>`;

	const metadata = extractWebsiteCardMetadataFromHtml(html, "https://t.alcy.cc/");

	assert.equal(metadata.siteName, "栗次元API-举个栗子");
	assert.equal(metadata.title, "栗次元API-举个栗子");
	assert.equal(metadata.description, "栗次元API-举个栗子");
	assert.equal(metadata.previewImageUrl, "https://t.alcy.cc/ycy");
	assert.match(metadata.logoUrl, /^data:image\/svg\+xml/i);
});

test("extractWebsiteCardMetadataFromHtml falls back to keywords when description metadata is missing", () => {
	const html = `<!doctype html>
<html lang="zh-CN">
	<head>
		<title>栗次元API-举个栗子</title>
		<meta name="keywords" content="个人,分享,api,随机图床API,二次元,随机图,壁纸,萌图,ai图,自适应,原神,风景,横图,竖图,白底,头像,高清,背景图片,手机壁纸,图片url,随机图片,栗次元" />
	</head>
</html>`;

	const metadata = extractWebsiteCardMetadataFromHtml(html, "https://t.alcy.cc/");

	assert.match(metadata.description, /随机图床API/);
	assert.match(metadata.description, /二次元/);
	assert.doesNotMatch(metadata.description, /^访问 t\.alcy\.cc/);
});
