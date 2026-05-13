import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const readUtf8 = (filePath) => readFile(path.resolve(filePath), "utf8");

test("music player exposes lyrics state and keeps Meting lrc data", async () => {
	const [typesSource, storeSource] = await Promise.all([
		readUtf8("src/components/widgets/music-player/types.ts"),
		readUtf8("src/stores/musicPlayerStore.ts"),
	]);

	assert.match(typesSource, /lrc\?:\s*string;/);
	assert.match(storeSource, /lyrics:\s*LyricLine\[\];/);
	assert.match(storeSource, /lyricsStatus:\s*LyricsStatus;/);
	assert.match(storeSource, /currentLyricIndex:\s*number;/);
	assert.match(storeSource, /lyricsStatus\s*=\s*lrc\s*\?\s*"loading"\s*:\s*"none"/);
	assert.match(storeSource, /lrc:\s*song\.lrc\s*\?\?\s*song\.lyric\s*\?\?\s*""/);
	assert.match(storeSource, /this\.loadLyrics\(song\);/);
	assert.match(storeSource, /this\.updateCurrentLyricIndex\(\);/);
});

test("music player has a reusable lyrics parser and loader", async () => {
	const source = await readUtf8(
		"src/components/widgets/music-player/utils/lyrics.ts",
	);

	assert.match(source, /export interface LyricLine/);
	assert.match(source, /export type LyricsStatus/);
	assert.match(source, /export function parseLrc/);
	assert.match(source, /export async function resolveLyrics/);
	assert.match(source, /matchAll\(LRC_TIME_PATTERN\)/);
	assert.match(source, /status:\s*"failed"/);
});

test("music player renders lyrics toggle beside song info in both player entries", async () => {
	const [
		trackDisplaySource,
		playerBarSource,
		fabPanelSource,
		sidebarTrackInfoSource,
		sidebarClientSource,
		lyricsPanelSource,
	] = await Promise.all([
		readUtf8("src/components/widgets/music-player/molecules/TrackDisplay.svelte"),
		readUtf8("src/components/widgets/music-player/organisms/PlayerBar.svelte"),
		readUtf8("src/components/widgets/music-player/FabMusicPanel.svelte"),
		readUtf8(
			"src/components/widgets/music-sidebar/components/SidebarTrackInfo.svelte",
		),
		readUtf8("src/components/widgets/music-sidebar/SidebarMusicClient.svelte"),
		readUtf8(
			"src/components/widgets/music-player/molecules/LyricsPanel.svelte",
		),
	]);

	assert.match(trackDisplaySource, /onLyricsClick/);
	assert.match(trackDisplaySource, /showLyrics/);
	assert.match(trackDisplaySource, /musicPlayerLyrics/);
	assert.match(playerBarSource, /<LyricsPanel/);
	assert.match(playerBarSource, /currentLyricIndex=\{currentLyricIndex\}/);
	assert.match(playerBarSource, /onLyricClick=\{onLyricClick\}/);
	assert.match(fabPanelSource, /<LyricsPanel/);
	assert.match(fabPanelSource, /showLyrics/);
	assert.match(sidebarTrackInfoSource, /onLyricsClick/);
	assert.match(sidebarTrackInfoSource, /musicPlayerLyrics/);
	assert.match(sidebarClientSource, /toggleLyricsView/);
	assert.match(sidebarClientSource, /onSeek=\{seek\}/);
	assert.match(lyricsPanelSource, /scrollIntoView/);
	assert.match(lyricsPanelSource, /aria-current=\{index === currentLyricIndex\}/);
});
