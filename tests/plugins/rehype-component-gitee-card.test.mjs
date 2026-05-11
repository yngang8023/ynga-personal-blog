import assert from "node:assert/strict";
import test from "node:test";

import { GiteeCardComponent } from "../../src/plugins/rehype-component-gitee-card.mjs";

test("GiteeCardComponent creates a gitee repository card shell", () => {
	const card = GiteeCardComponent(
		{
			repo: "yngang/kingcola-icg-blog-web",
		},
		[],
	);

	assert.equal(card.tagName, "a");
	assert.ok(card.properties.className.includes("card-gitee"));
	assert.ok(card.properties.className.includes("fetch-waiting"));
	assert.equal(card.properties.href, "https://gitee.com/yngang/kingcola-icg-blog-web");
	assert.equal(card.properties.repo, "yngang/kingcola-icg-blog-web");

	const titlebar = card.children[0];
	const infobar = card.children[2];
	const brand = titlebar.children[1];

	assert.equal(titlebar.properties.className[0], "gc-titlebar");
	assert.equal(infobar.properties.className[0], "gc-infobar");
	assert.equal(brand.properties.className[0], "gitee-logo");
	assert.equal(card.children[3].tagName, "script");
	assert.match(card.children[3].children[0].value, /api\/v5\/repos\/yngang\/kingcola-icg-blog-web/);
	assert.match(card.children[3].children[0].value, /forks_count/);
	assert.match(card.children[3].children[0].value, /stargazers_count/);
});

test("GiteeCardComponent rejects invalid repository values", () => {
	const node = GiteeCardComponent(
		{
			repo: "invalid-repo",
		},
		[],
	);

	assert.equal(node.tagName, "div");
	assert.match(node.children[0].value, /Invalid repository/);
});
