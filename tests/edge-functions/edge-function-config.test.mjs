import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const edgeConfigPath = path.resolve("edge-functions/config.js");
const requestGuardPath = path.resolve("edge-functions/_shared/request-guard.js");
const diagramProxyPath = path.resolve("edge-functions/diagram/proxy.js");
const ragEmbedTokenProxyPath = path.resolve("edge-functions/rag-embed-token/proxy.js");
const umamiProxyPath = path.resolve("edge-functions/umami/proxy.js");
const walineProxyPath = path.resolve("edge-functions/waline/proxy.js");
const walineAssetsProxyPath = path.resolve("edge-functions/waline-assets/proxy.js");

test("edge function defaults are centralized in edge-functions/config.js", async () => {
	const source = await readFile(edgeConfigPath, "utf8");

	assert.match(source, /DEFAULT_ALLOWED_SITE_ORIGINS/);
	assert.match(source, /EDGE_BLOCKED_RESPONSE_HEADERS/);
	assert.match(source, /EDGE_HOP_BY_HOP_REQUEST_HEADERS/);
	assert.match(source, /EDGE_UNSAFE_RESPONSE_HEADERS/);
	assert.match(source, /MERMAID_ROUTE/);
	assert.match(source, /MERMAID_UPSTREAM/);
	assert.match(source, /PLANTUML_ROUTE_PREFIX/);
	assert.match(source, /PLANTUML_UPSTREAM/);
	assert.match(source, /DIAGRAM_CACHE_CONTROL_BY_ROUTE/);
	assert.match(source, /ALLOWED_BLOG_ORIGIN/);
	assert.match(source, /DEFAULT_UMAMI_API_BASE/);
	assert.match(source, /UMAMI_CACHE_CONTROL_BY_ROUTE/);
	assert.match(source, /DEFAULT_WALINE_ORIGIN/);
	assert.match(source, /DEFAULT_WALINE_ASSETS_ORIGIN/);
	assert.match(source, /WALINE_ASSET_CACHE_CONTROL/);
	assert.match(source, /WALINE_READ_METHODS/);
	assert.match(source, /WALINE_WRITE_METHODS/);
});

test("edge function proxies import shared defaults from edge-functions/config.js", async () => {
	const [
		requestGuardSource,
		diagramProxySource,
		ragEmbedTokenProxySource,
		umamiProxySource,
		walineProxySource,
		walineAssetsProxySource,
	] = await Promise.all([
		readFile(requestGuardPath, "utf8"),
		readFile(diagramProxyPath, "utf8"),
		readFile(ragEmbedTokenProxyPath, "utf8"),
		readFile(umamiProxyPath, "utf8"),
		readFile(walineProxyPath, "utf8"),
		readFile(walineAssetsProxyPath, "utf8"),
	]);

	assert.match(requestGuardSource, /from "\.\.\/config\.js";/);
	assert.match(diagramProxySource, /from "\.\.\/config\.js";/);
	assert.match(ragEmbedTokenProxySource, /from "\.\.\/config\.js";/);
	assert.match(umamiProxySource, /from "\.\.\/config\.js";/);
	assert.match(walineProxySource, /from "\.\.\/config\.js";/);
	assert.match(walineAssetsProxySource, /from "\.\.\/config\.js";/);
});
