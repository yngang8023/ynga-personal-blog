import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
	getMarkdownContentHotUpdateAction,
	shouldInvalidateMarkdownContent,
} from "../../src/dev/markdown-content-hmr.mjs";

const rootDir = path.resolve("D:/demo/project");

test("matches local content and markdown pipeline files for forced content reloads", () => {
	assert.equal(
		shouldInvalidateMarkdownContent(
			path.join(rootDir, "src/content/posts/demo/index.md"),
			rootDir,
		),
		true,
	);

	assert.equal(
		shouldInvalidateMarkdownContent(
			path.join(rootDir, "src/plugins/rehype-site-card.mjs"),
			rootDir,
		),
		true,
	);

	assert.equal(
		shouldInvalidateMarkdownContent(
			path.join(rootDir, "src/content.config.ts"),
			rootDir,
		),
		true,
	);
});

test("uses a safe full reload for markdown content edits", () => {
	assert.equal(
		getMarkdownContentHotUpdateAction(
			path.join(rootDir, "src/content/posts/demo/index.md"),
			rootDir,
		),
		"full-reload",
	);
});

test("restarts the dev server for markdown pipeline edits", () => {
	assert.equal(
		getMarkdownContentHotUpdateAction(
			path.join(rootDir, "src/plugins/rehype-site-card.mjs"),
			rootDir,
		),
		"restart",
	);

	assert.equal(
		getMarkdownContentHotUpdateAction(
			path.join(rootDir, "src/content.config.ts"),
			rootDir,
		),
		"restart",
	);
});

test("ignores normal component and style edits that Vite HMR already handles well", () => {
	assert.equal(
		shouldInvalidateMarkdownContent(
			path.join(rootDir, "src/components/misc/Markdown.astro"),
			rootDir,
		),
		false,
	);

	assert.equal(
		shouldInvalidateMarkdownContent(
			path.join(rootDir, "src/styles/main.css"),
			rootDir,
		),
		false,
	);

	assert.equal(
		getMarkdownContentHotUpdateAction(
			path.join(rootDir, "src/components/misc/Markdown.astro"),
			rootDir,
		),
		null,
	);
});
