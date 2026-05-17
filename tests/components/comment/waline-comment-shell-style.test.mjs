import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const mainCssPath = path.resolve("src/styles/main.css");
const walineComponentPath = path.resolve("src/components/comment/Waline.astro");

test("keeps Waline comment header shell styles in global main.css for swup page transitions", async () => {
	const [mainCssSource, walineComponentSource] = await Promise.all([
		readFile(mainCssPath, "utf8"),
		readFile(walineComponentPath, "utf8"),
	]);

	assert.match(walineComponentSource, /class="waline-comment-header"/);
	assert.match(walineComponentSource, /class="waline-comment-stats"/);
	assert.match(walineComponentSource, /class="waline-comment-stat"/);

	assert.match(
		mainCssSource,
		/\.waline-comment-header\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*space-between;/,
	);
	assert.match(
		mainCssSource,
		/\.waline-comment-stats\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?justify-content:\s*flex-end;/,
	);
	assert.match(
		mainCssSource,
		/\.waline-comment-stat\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?border-radius:\s*999px;/,
	);
});
