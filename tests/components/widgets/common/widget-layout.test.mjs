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
		/const collapsible = Boolean\(isCollapsed\);/,
	);
	assert.match(source, /this\.shouldCollapse\s*=\s*true;/);
	assert.match(source, /measureCollapseRows\(\)/);
	assert.match(source, /ResizeObserver/);
	assert.match(source, /isVisibleForCollapseMeasurement\(\)/);
	assert.match(source, /if\s*\(!this\.isVisibleForCollapseMeasurement\(\)\)\s*\{/);
	assert.match(source, /this\.resizeObserver\.observe\(this\);/);
	assert.match(source, /this\.resizeObserver\.observe\(this\.wrapper\);/);
	assert.match(source, /const fonts = document\.fonts;/);
	assert.match(source, /if\s*\(!fonts\?\.ready\)\s*\{\s*return;/);
	assert.match(
		source,
		/const targetCollapsedHeight = rowCount > 0[\s\S]*?collapsedHeightPx \|\| contentHeight[\s\S]*?: contentHeight;/,
	);
	assert.match(source, /this\.collapsedHeightPx = targetCollapsedHeight;/);
	assert.match(
		source,
		/wrapper\.style\.maxHeight = `\$\{this\.collapsedHeightPx\}px`;/,
	);
	assert.doesNotMatch(source, /data-collapsed-height=/);
	assert.doesNotMatch(source, /getCollapsedHeightPx\(/);
});

test("categories and tags read collapse behavior from config instead of local constants", async () => {
	const [configSource, categoriesSource, tagsSource, widgetManagerSource] =
		await Promise.all([
		readUtf8(configPath),
		readUtf8(categoriesPath),
		readUtf8(tagsPath),
		readUtf8(widgetManagerPath),
	]);

	assert.match(configSource, /type:\s*"categories"[\s\S]*?collapseThreshold:\s*2/);
	assert.match(configSource, /type:\s*"tags"[\s\S]*?collapseThreshold:\s*10/);
	assert.match(configSource, /type:\s*"categories"[\s\S]*?collapsedRows:\s*2/);
	assert.match(configSource, /type:\s*"tags"[\s\S]*?collapsedRows:\s*4/);
	assert.match(categoriesSource, /widgetManager\.isCollapsed\(/);
	assert.match(tagsSource, /widgetManager\.isCollapsed\(/);
	assert.match(categoriesSource, /widgetManager\.getCustomProp\([\s\S]*?"collapsedRows"/);
	assert.match(tagsSource, /widgetManager\.getCustomProp\([\s\S]*?"collapsedRows"/);
	assert.match(categoriesSource, /collapsedRows=\{collapsedRows\}/);
	assert.match(tagsSource, /collapsedRows=\{collapsedRows\}/);
	assert.doesNotMatch(categoriesSource, /collapsedHeight=/);
	assert.doesNotMatch(tagsSource, /collapsedHeight=/);
	assert.doesNotMatch(categoriesSource, /isCollapsed=\{categories\.length > 0\}/);
	assert.doesNotMatch(tagsSource, /isCollapsed=\{tags\.length > 0\}/);
	assert.doesNotMatch(configSource, /collapsedHeight:/);
	assert.match(widgetManagerSource, /return itemCount > threshold;/);
});
