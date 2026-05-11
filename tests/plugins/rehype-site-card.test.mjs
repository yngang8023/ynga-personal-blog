import assert from "node:assert/strict";
import test from "node:test";

import { rehypeSiteCard } from "../../src/plugins/rehype-site-card.mjs";

test("rehypeSiteCard replaces site directives with website card anchors", async () => {
	const html = `<!doctype html>
<html>
	<head>
		<title>Waline</title>
		<meta property="og:site_name" content="Waline" />
		<meta property="og:title" content="Waline" />
		<meta property="og:description" content="A simple and fast comment system." />
		<meta name="theme-color" content="#4a8f7b" />
		<meta property="og:image" content="/social-card.png" />
		<link rel="icon" href="/favicon.png" />
	</head>
</html>`;

	const tree = {
		type: "root",
		children: [
			{
				type: "element",
				tagName: "site",
				properties: {
					url: "https://waline.js.org/",
				},
				children: [],
			},
		],
	};

	const transform = rehypeSiteCard({
		fetchImpl: async () =>
			new Response(html, {
				status: 200,
				headers: { "content-type": "text/html; charset=utf-8" },
			}),
	});

	await transform(tree);

	const [card] = tree.children;
	assert.equal(card.properties.href, "https://waline.js.org/");
	assert.ok(card.properties.className.includes("card-website"));
	assert.ok(!card.properties.className.includes("card-website--with-preview"));
	assert.equal(card.properties.dataAccent, "#4a8f7b");
	assert.equal(card.properties.dataLogoSrc, "https://waline.js.org/favicon.png");
	assert.equal(card.properties.dataLogoCaption, "Waline logo");
	assert.equal(card.properties.style, "--wc-accent: #4a8f7b;");
	assert.equal(card.children[0].tagName, "span");
	assert.equal(
		card.children[0].children[0].properties.src,
		"https://waline.js.org/favicon.png",
	);
	const meta = card.children[1].children[0].children[0];
	const [head, description] = meta.children;
	const [siteName, domainTag] = head.children;
	assert.equal(meta.children.length, 2);
	assert.equal(head.properties.className[0], "wc-head");
	assert.equal(siteName.properties.className[0], "wc-site-name");
	assert.equal(siteName.children[0].value, "Waline");
	assert.equal(domainTag.properties.className[0], "wc-domain-tag");
	assert.equal(domainTag.children[0].value, "waline.js.org");
	assert.equal(description.properties.className[0], "wc-description");
	assert.equal(description.children[0].value, "A simple and fast comment system.");
	assert.equal(card.children[1].children[0].children.length, 1);
});

test("rehypeSiteCard allows manual metadata overrides from directive attributes", async () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "element",
				tagName: "site",
				properties: {
					url: "https://t.alcy.cc/",
					title: "栗次元图库",
					description: "高质量随机图与壁纸 API 服务",
					logo: "https://t.alcy.cc/favicon.ico",
					preview: "https://t.alcy.cc/ycy",
					accent: "#ff7a59",
				},
				children: [],
			},
		],
	};

	const transform = rehypeSiteCard({
		fetchImpl: async () => {
			throw new Error("offline");
		},
	});

	await transform(tree);

	const [card] = tree.children;
	const meta = card.children[1].children[0].children[0];
	const [head, description] = meta.children;
	const [siteName] = head.children;
	assert.equal(card.properties.href, "https://t.alcy.cc/");
	assert.ok(!card.properties.className.includes("card-website--with-preview"));
	assert.equal(card.properties.dataAccent, "#ff7a59");
	assert.equal(card.properties.dataLogoSrc, "https://t.alcy.cc/favicon.ico");
	assert.equal(card.properties.style, "--wc-accent: #ff7a59;");
	assert.equal(siteName.children[0].value, "栗次元图库");
	assert.equal(description.children[0].value, "高质量随机图与壁纸 API 服务");
	assert.equal(card.children[1].children[0].children.length, 1);
});
