import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";
import path from "node:path";

const layoutPath = path.resolve("src/layouts/Layout.astro");

const readLayout = async () => readFile(layoutPath, "utf8");

test("layout mounts the reusable confirm dialog globally", async () => {
	const layout = await readLayout();

	assert.match(
		layout,
		/import ConfirmDialog from "@components\/widgets\/common\/ConfirmDialog\.svelte";/,
	);
	assert.match(layout, /<ConfirmDialog\s+client:load/);
});

test("layout does not load the deprecated page shell layout helper", async () => {
	const layout = await readLayout();

	assert.doesNotMatch(layout, /page-shell-layout/);
});
