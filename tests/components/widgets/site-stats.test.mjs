import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const siteStatsPath = path.resolve(
	"src/components/widgets/site-stats/SiteStats.astro",
);

test("site stats widget uses article-path aggregate stats for total reading count", async () => {
	const source = await readFile(siteStatsPath, "utf8");

	assert.match(source, /window\.oddmisc\.getArticleTotalViews\(/);
	assert.match(source, /const postPaths = posts\.map\(/);
	assert.doesNotMatch(source, /postPaths\.map\(/);
	assert.doesNotMatch(source, /window\.oddmisc\.getStats\(path\)/);
	assert.doesNotMatch(source, /window\.oddmisc\.getSiteStats\(/);
});
