import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const wallpaperPath = path.resolve("src/components/misc/FullscreenWallpaper.astro");

const readWallpaper = async () => readFile(wallpaperPath, "utf8");

test("fullscreen wallpaper keeps a theme-aware fallback backdrop behind images", async () => {
	const source = await readWallpaper();

	assert.match(source, /background-color:\s*var\(--page-bg\)/);
	assert.match(source, /transition:\s*background-color var\(--theme-switch-duration,\s*220ms\)/);
});

test("fullscreen wallpaper carousel warms and verifies the next image before switching", async () => {
	const source = await readWallpaper();

	assert.match(source, /function ensureImageReady\(/);
	assert.match(source, /function warmImage\(/);
	assert.match(source, /await ensureImageReady\(\s*nextItem\s*\)/);
	assert.match(source, /transitioning:\s*false/);
	assert.match(source, /function primeUpcomingImages\(/);
});

test("fullscreen wallpaper carousel prefers an already decoded image during initialization", async () => {
	const source = await readWallpaper();

	assert.match(source, /function resolveInitialIndex\(/);
	assert.match(source, /items\.findIndex\(\s*\(item\)\s*=>\s*isImageReady\(item\)\s*\)/);
	assert.match(source, /stateItem\.currentIndex = resolveInitialIndex/);
});
