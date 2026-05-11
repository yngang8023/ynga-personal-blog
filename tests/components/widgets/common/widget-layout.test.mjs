import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const widgetLayoutPath = path.resolve(
	"src/components/widgets/common/WidgetLayout.astro",
);
const categoriesPath = path.resolve(
	"src/components/widgets/categories/Categories.astro",
);
const tagsPath = path.resolve("src/components/widgets/tags/Tags.astro");

const readUtf8 = (filePath) => readFile(filePath, "utf8");

test("widget layout auto-hides the expand control when content does not overflow", async () => {
	const source = await readUtf8(widgetLayoutPath);

	assert.match(
		source,
		/this\.toggleContainer\.hidden\s*=\s*!this\.shouldCollapse;/,
	);
	assert.match(
		source,
		/this\.shouldCollapse\s*=\s*contentHeight\s*>\s*collapsedHeightPx\s*\+\s*1;/,
	);
	assert.match(source, /ResizeObserver/);
});

test("categories and tags rely on overflow-based collapse instead of item-count thresholds", async () => {
	const [categoriesSource, tagsSource] = await Promise.all([
		readUtf8(categoriesPath),
		readUtf8(tagsPath),
	]);

	assert.doesNotMatch(categoriesSource, /widgetManager\.isCollapsed/);
	assert.doesNotMatch(tagsSource, /widgetManager\.isCollapsed/);
	assert.match(categoriesSource, /isCollapsed=\{categories\.length > 0\}/);
	assert.match(tagsSource, /isCollapsed=\{tags\.length > 0\}/);
});
