import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const siteStatsPath = path.resolve(
	"src/components/widgets/site-stats/SiteStats.astro",
);

test("site stats widget uses Umami site-level aggregate stats instead of summing every post path", async () => {
	const source = await readFile(siteStatsPath, "utf8");

	assert.match(source, /window\.oddmisc\.getSiteStats\(/);
	assert.doesNotMatch(source, /postPaths\.map\(/);
	assert.doesNotMatch(source, /window\.oddmisc\.getStats\(path\)/);
	assert.doesNotMatch(source, /pageviewsList\.reduce/);
});
