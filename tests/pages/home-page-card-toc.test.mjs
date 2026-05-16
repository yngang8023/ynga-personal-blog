import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const homePagePath = path.join(projectRoot, "src", "pages", "[...page].astro");

test("home pagination page passes current-page posts to the card toc navigation", () => {
	const source = fs.readFileSync(homePagePath, "utf8");

	assert.match(source, /const postNavigationItems = page\.data\.map\(/);
	assert.match(source, /href:\s*getPostUrl\(entry\)/);
	assert.match(source, /label:\s*entry\.data\.title/);
	assert.match(source, /meta:\s*entry\.data\.category \|\| formatDateToYYYYMMDD\(entry\.data\.published\)/);
	assert.match(source, /<MainGridLayout[\s\S]*?cardTocItems=\{postNavigationItems\}/);
});
