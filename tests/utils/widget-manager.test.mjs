import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const configPath = path.resolve("src/config.ts");

const readConfig = async () => readFile(configPath, "utf8");

test("restores the desktop sidebar layout with announcement on the left sticky stack", async () => {
	const source = await readConfig();

	assert.match(
		source,
		/components:\s*\{[\s\S]*?left:\s*\["profile",\s*"announcement",\s*"tags",\s*"card-toc"\]/,
	);
	assert.match(
		source,
		/components:\s*\{[\s\S]*?right:\s*\["site-stats",\s*"calendar",\s*"categories",\s*"music-sidebar"\]/,
	);
});

test("keeps the mobile drawer sticky stack starting with announcement before categories", async () => {
	const source = await readConfig();

	assert.match(
		source,
		/drawer:\s*\[[\s\S]*?"profile",[\s\S]*?"announcement",[\s\S]*?"tags",[\s\S]*?"categories",[\s\S]*?"music-sidebar"[\s\S]*?\]/,
	);
});
