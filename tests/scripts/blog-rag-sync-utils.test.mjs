import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	buildPostUrl,
	collectBlogRagPosts,
	parseFrontmatter,
	shouldSyncPost,
} from "../../scripts/blog-rag-sync-utils.mjs";

test("parseFrontmatter reads scalar values, arrays, booleans, and dates", () => {
	const parsed = parseFrontmatter(`---
title: EdgeOne Pages 部署博客
published: 2026-05-07
draft: false
tags:
  - EdgeOne
  - Astro
category: 部署
---

# 正文`);

	assert.equal(parsed.data.title, "EdgeOne Pages 部署博客");
	assert.equal(parsed.data.published, "2026-05-07");
	assert.equal(parsed.data.draft, false);
	assert.deepEqual(parsed.data.tags, ["EdgeOne", "Astro"]);
	assert.equal(parsed.data.category, "部署");
	assert.match(parsed.body, /# 正文/);
});

test("shouldSyncPost excludes draft, encrypted, and password posts", () => {
	assert.equal(shouldSyncPost({ title: "公开" }), true);
	assert.equal(shouldSyncPost({ title: "草稿", draft: true }), false);
	assert.equal(shouldSyncPost({ title: "加密", encrypted: true }), false);
	assert.equal(shouldSyncPost({ title: "密码", password: "secret" }), false);
});

test("buildPostUrl respects permalink, alias, and default post path", () => {
	assert.equal(
		buildPostUrl({
			siteURL: "https://example.com/",
			id: "edgeone-pages-deploy/index.md",
			data: {},
		}),
		"https://example.com/posts/edgeone-pages-deploy/"
	);
	assert.equal(
		buildPostUrl({
			siteURL: "https://example.com/",
			id: "demo/index.md",
			data: { alias: "custom-demo" },
		}),
		"https://example.com/posts/custom-demo/"
	);
	assert.equal(
		buildPostUrl({
			siteURL: "https://example.com/",
			id: "demo/index.md",
			data: { permalink: "notes/demo" },
		}),
		"https://example.com/notes/demo/"
	);
});

test("collectBlogRagPosts returns public raw post bundles with markdown and images", async () => {
	const tempRoot = await mkdtemp(path.join(os.tmpdir(), "blog-rag-"));
	const postsDir = path.join(tempRoot, "src", "content", "posts");
	await mkdir(path.join(postsDir, "public-post", "images"), { recursive: true });
	await mkdir(path.join(postsDir, "draft-post"), { recursive: true });

	await writeFile(
		path.join(postsDir, "public-post", "index.md"),
		`---
title: 公开文章
description: 摘要
published: 2026-05-07
tags: [EdgeOne, Astro]
category: 部署
---

# 正文标题

这里是正文内容。

![](./images/cover.png)`,
		"utf8"
	);
	await writeFile(
		path.join(postsDir, "public-post", "images", "cover.png"),
		Buffer.from([0x89, 0x50, 0x4e, 0x47]),
	);
	await writeFile(
		path.join(postsDir, "draft-post", "index.md"),
		`---
title: 草稿文章
draft: true
---

不会同步。`,
		"utf8"
	);

	const posts = await collectBlogRagPosts({
		rootDir: tempRoot,
		siteURL: "https://example.com/",
	});

	assert.equal(posts.length, 1);
	assert.equal(posts[0].id, "public-post/index.md");
	assert.equal(posts[0].slug, "public-post");
	assert.equal(posts[0].url, "https://example.com/posts/public-post/");
	assert.equal(posts[0].entryPath, "index.md");
	assert.equal(posts[0].metadata.title, "公开文章");
	assert.deepEqual(posts[0].metadata.tags, ["EdgeOne", "Astro"]);
	assert.equal(posts[0].files.length, 2);
	assert.equal(posts[0].files.find((file) => file.path === "index.md").encoding, "utf8");
	assert.equal(posts[0].files.find((file) => file.path === "images/cover.png").encoding, "base64");
	assert.match(posts[0].contentHash, /^[a-f0-9]{64}$/);
});
