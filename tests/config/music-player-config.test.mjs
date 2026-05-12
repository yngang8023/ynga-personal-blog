import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const configPath = path.resolve("src/config.ts");

test("music player mode switches automatically by environment", async () => {
	const source = await readFile(configPath, "utf8");

	assert.match(
		source,
		/const MUSIC_PLAYER_MODE: MusicPlayerConfig\["mode"\] =[\s\S]*?process\.env\.NODE_ENV === "production" \? "meting" : "local";/,
	);
	assert.match(source, /mode:\s*MUSIC_PLAYER_MODE,/);
	assert.doesNotMatch(source, /mode:\s*"local",\s*\/\/ 音乐播放器模式/);
});

