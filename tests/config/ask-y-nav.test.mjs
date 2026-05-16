import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const configPath = path.resolve("src/config.ts");
const astroConfigPath = path.resolve("astro.config.mjs");
const dropdownMenuPath = path.resolve(
	"src/components/organisms/navigation/DropdownMenu.astro",
);
const navMenuPanelPath = path.resolve(
	"src/components/organisms/navigation/NavMenuPanel.astro",
);

test("My dropdown exposes the Ask Y page from centralized page constants", async () => {
	const source = await readFile(configPath, "utf8");

	assert.match(source, /ASK_Y_PAGE_PATH/);
	assert.match(source, /ASK_Y_PAGE_TITLE/);
	assert.match(
		source,
		/name:\s*"My"[\s\S]*?children:\s*\[[\s\S]*?name:\s*ASK_Y_PAGE_TITLE,[\s\S]*?url:\s*ASK_Y_PAGE_PATH,[\s\S]*?fullPage:\s*true,[\s\S]*?icon:\s*"material-symbols:smart-toy-outline-rounded"/,
	);
});

test("full page Ask Y navigation bypasses swup interception in desktop and mobile menus", async () => {
	const [dropdownMenuSource, navMenuPanelSource] = await Promise.all([
		readFile(dropdownMenuPath, "utf8"),
		readFile(navMenuPanelPath, "utf8"),
	]);

	assert.match(
		dropdownMenuSource,
		/data-no-swup=\{child\.fullPage \? "" : null\}/,
	);
	assert.match(
		navMenuPanelSource,
		/data-no-swup=\{\s*child\.fullPage \? "" : null\s*\}/,
	);
	assert.match(
		navMenuPanelSource,
		/data-no-swup=\{link\.fullPage \? "" : null\}/,
	);
});

test("swup ignores the full page Ask Y route globally", async () => {
	const source = await readFile(astroConfigPath, "utf8");

	assert.match(source, /ignore:\s*\[[\s\S]*?"\/ask-y"[\s\S]*?\]/);
});
