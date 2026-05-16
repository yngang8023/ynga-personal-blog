import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const configPath = path.resolve("src/config.ts");

test("My dropdown exposes the Ask Y page from centralized page constants", async () => {
	const source = await readFile(configPath, "utf8");

	assert.match(source, /ASK_Y_PAGE_PATH/);
	assert.match(source, /ASK_Y_PAGE_TITLE/);
	assert.match(
		source,
		/name:\s*"My"[\s\S]*?children:\s*\[[\s\S]*?name:\s*ASK_Y_PAGE_TITLE,[\s\S]*?url:\s*ASK_Y_PAGE_PATH,[\s\S]*?fullPage:\s*true,[\s\S]*?icon:\s*"material-symbols:smart-toy-outline-rounded"/,
	);
});
