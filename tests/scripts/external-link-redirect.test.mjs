import assert from "node:assert/strict";
import test from "node:test";

import { readFile } from "node:fs/promises";
import path from "node:path";

const scriptPath = path.resolve("src/scripts/external-link-redirect.ts");

const readScript = async () => readFile(scriptPath, "utf8");

test("bypasses the external-link modal when clicking a website card logo preview trigger", async () => {
	const script = await readScript();

	assert.match(
		script,
		/const isWebsiteCardLogoClick = Boolean\([\s\S]*?target\.closest\("\.card-website \.wc-logo-shell"\),[\s\S]*?\);/,
	);

	assert.match(
		script,
		/if\s*\(\s*isWebsiteCardLogoClick\s*\)\s*\{\s*return;\s*\}/,
	);
});
