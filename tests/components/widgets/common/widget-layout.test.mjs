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
const configPath = path.resolve("src/config.ts");
const widgetManagerPath = path.resolve("src/utils/widget-manager.ts");

const readUtf8 = (filePath) => readFile(filePath, "utf8");

test("widget layout auto-hides the expand control when content does not overflow", async () => {
	const source = await readUtf8(widgetLayoutPath);

	assert.match(
		source,
		/this\.toggleContainer\.hidden\s*=\s*!this\.shouldCollapse;/,
	);
	assert.match(
		source,
		/this\.shouldCollapse\s*=\s*rowCount\s*>\s*this\.collapsedRows;/,
	);
	assert.match(source, /measureCollapseRows\(\)/);
	assert.match(source, /ResizeObserver/);
});

test("categories and tags read collapse behavior from config instead of local constants", async () => {
	const [configSource, categoriesSource, tagsSource, widgetManagerSource] =
		await Promise.all([
		readUtf8(configPath),
		readUtf8(categoriesPath),
		readUtf8(tagsPath),
		readUtf8(widgetManagerPath),
	]);

	assert.match(configSource, /type:\s*"categories"[\s\S]*?collapseThreshold:\s*3/);
	assert.match(configSource, /type:\s*"tags"[\s\S]*?collapseThreshold:\s*20/);
	assert.match(configSource, /type:\s*"categories"[\s\S]*?collapsedRows:\s*3/);
	assert.match(configSource, /type:\s*"tags"[\s\S]*?collapsedRows:\s*3/);
	assert.match(
		configSource,
		/type:\s*"categories"[\s\S]*?collapsedHeight:\s*"7\.5rem"/,
	);
	assert.match(
		configSource,
		/type:\s*"tags"[\s\S]*?collapsedHeight:\s*"7\.5rem"/,
	);
	assert.match(categoriesSource, /widgetManager\.isCollapsed\(/);
	assert.match(tagsSource, /widgetManager\.isCollapsed\(/);
	assert.match(categoriesSource, /widgetManager\.getCustomProp\([\s\S]*?"collapsedRows"/);
	assert.match(tagsSource, /widgetManager\.getCustomProp\([\s\S]*?"collapsedRows"/);
	assert.match(
		categoriesSource,
		/widgetManager\.getCustomProp\([\s\S]*?"collapsedHeight"/,
	);
	assert.match(tagsSource, /widgetManager\.getCustomProp\([\s\S]*?"collapsedHeight"/);
	assert.match(categoriesSource, /collapsedRows=\{collapsedRows\}/);
	assert.match(tagsSource, /collapsedRows=\{collapsedRows\}/);
	assert.match(categoriesSource, /collapsedHeight=\{collapsedHeight\}/);
	assert.match(tagsSource, /collapsedHeight=\{collapsedHeight\}/);
	assert.doesNotMatch(categoriesSource, /isCollapsed=\{categories\.length > 0\}/);
	assert.doesNotMatch(tagsSource, /isCollapsed=\{tags\.length > 0\}/);
	assert.doesNotMatch(categoriesSource, /const COLLAPSED_HEIGHT/);
	assert.doesNotMatch(tagsSource, /const COLLAPSED_HEIGHT/);
	assert.match(widgetManagerSource, /return itemCount > threshold;/);
});
