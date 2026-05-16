import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

const rootDir = path.resolve(".");

test("sync blog rag dry run loads default endpoints from src/config.ts", () => {
	const result = spawnSync(
		process.execPath,
		["scripts/sync-blog-rag.mjs", "--dry-run"],
		{
			cwd: rootDir,
			encoding: "utf8",
			env: process.env,
		},
	);

	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.match(
		result.stdout,
		/同步地址：https:\/\/rag\.ynga\.kingcola-icg\.cn\/api\/sync-posts/,
	);
	assert.match(result.stdout, /Dry run 模式/);
});
