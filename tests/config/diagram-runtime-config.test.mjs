import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const configPath = path.resolve("src/config.ts");
const astroConfigPath = path.resolve("astro.config.mjs");
const headTagsPath = path.resolve("src/layouts/partials/HeadTags.astro");

test("diagram runtime config is centralized in src/config.ts with dev/prod mode defaults", async () => {
	const source = await readFile(configPath, "utf8");

	assert.match(source, /export const DIAGRAM_LOCAL_MODE = "local"/);
	assert.match(source, /export const DIAGRAM_ONLINE_MODE = "online"/);
	assert.match(source, /export const BLOG_DIAGRAM_MODE =/);
	assert.match(source, /process\.env\.NODE_ENV === "production"\s*\?\s*DIAGRAM_ONLINE_MODE\s*:\s*DIAGRAM_LOCAL_MODE/);
	assert.match(source, /MERMAID_PROXY_PATH/);
	assert.match(source, /MERMAID_ONLINE_SCRIPT_URL/);
	assert.match(source, /PLANTUML_PROXY_PATH/);
	assert.match(source, /PLANTUML_ONLINE_SERVER_URL/);
	assert.match(source, /export const blogDiagramConfig =/);
	assert.match(source, /mode:\s*BLOG_DIAGRAM_MODE/);
	assert.match(source, /mermaidScriptUrl:/);
	assert.match(source, /plantumlServerUrl:/);
});

test("Astro markdown pipeline reads plantuml diagram server from centralized blog diagram config", async () => {
	const source = await readFile(astroConfigPath, "utf8");

	assert.match(source, /import\s+\{[\s\S]*?blogDiagramConfig[\s\S]*?\}\s+from\s+"\.\/src\/config\.ts";/);
	assert.match(source, /servers:\s*\[\s*blogDiagramConfig\.plantumlServerUrl\s*\]/);
	assert.doesNotMatch(source, /new URL\("\/diagram\/plantuml", siteConfig\.siteURL\)/);
});

test("Head tags expose diagram runtime config to browser scripts", async () => {
	const source = await readFile(headTagsPath, "utf8");

	assert.match(source, /blogDiagramConfig/);
	assert.match(source, /BLOG_DIAGRAM_CONFIG/);
	assert.match(source, /window\.__BLOG_DIAGRAM_CONFIG = JSON\.parse\(BLOG_DIAGRAM_CONFIG\)/);
});
