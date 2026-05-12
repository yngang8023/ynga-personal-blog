import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const friendsPagePath = path.join(projectRoot, "src", "pages", "friends.astro");

test("friends page loads the right sidebar layout synchronizer", () => {
	const source = fs.readFileSync(friendsPagePath, "utf8");

	assert.match(
		source,
		/import\("\.\.\/scripts\/right-sidebar-layout\.js"\)/,
		"friends page should import the shared right-sidebar layout script so header layout toggles work consistently",
	);
});
