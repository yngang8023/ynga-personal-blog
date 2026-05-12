import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const configPath = path.resolve("src/config.ts");

test("waline config supports local and online asset modes with shared same-origin asset paths", async () => {
	const source = await readFile(configPath, "utf8");

	assert.match(
		source,
		/const WALINE_ASSET_BASE = "\/waline-assets" as const;/,
	);
	assert.match(
		source,
		/const WALINE_ONLINE_ASSET_BASE =[\s\S]*?"\/waline-assets\/@waline\/emojis@1\.4\.0" as const;/,
	);
	assert.match(source, /const WALINE_ASSET_MODE = "local" as const;/);
	assert.match(source, /const WALINE_BASE_REACTION_ASSETS = \[/);
	assert.match(source, /const WALINE_ONLINE_EXTRA_REACTION_ASSETS = \[\] as const;/);
	assert.match(source, /assetMode:\s*WALINE_ASSET_MODE\s*,/);
	assert.match(source, /function buildWalineReactionPaths\(mode: "local" \| "online"\)/);
	assert.match(source, /function buildWalineEmojiPaths\(mode: "local" \| "online"\)/);
	assert.match(source, /WALINE_ASSET_BASE\}\/\$\{assetPath\}/);
	assert.match(source, /WALINE_ONLINE_ASSET_BASE\}\/\$\{assetPath\}/);
	assert.match(source, /WALINE_ASSET_BASE\}\/\$\{preset\}/);
	assert.match(source, /WALINE_ONLINE_ASSET_BASE\}\/\$\{preset\}/);
	assert.match(source, /reaction:\s*buildWalineReactionPaths\(WALINE_ASSET_MODE\)/);
	assert.match(source, /emoji:\s*buildWalineEmojiPaths\(WALINE_ASSET_MODE\)/);
});
