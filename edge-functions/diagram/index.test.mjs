import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "./proxy.js";

const ALLOWED_REFERER = "https://ynga.kingcola-icg.cn/posts/security-demo/";

test("diagram proxy serves mermaid from unpkg through /diagram/mermaid.js", async () => {
	const originalFetch = global.fetch;
	let fetchArgs;

	global.fetch = async (...args) => {
		fetchArgs = args;
		return new Response("window.mermaid = {};", {
			status: 200,
			headers: {
				"content-type": "application/javascript; charset=utf-8",
				"content-encoding": "gzip",
				"content-length": "1024",
			},
		});
	};

	try {
		const response = await onRequest({
			request: new Request("https://example.com/diagram/mermaid.js", {
				headers: {
					referer: ALLOWED_REFERER,
					"sec-fetch-site": "same-origin",
				},
			}),
			env: {},
		});

		assert.equal(
			fetchArgs[0],
			"https://unpkg.com/mermaid@11.12.0/dist/mermaid.min.js",
		);
		assert.equal(
			fetchArgs[1]?.headers.get("accept-encoding"),
			"identity",
		);
		assert.equal(response.status, 200);
		assert.equal(
			response.headers.get("content-type"),
			"application/javascript; charset=utf-8",
		);
		assert.equal(response.headers.get("x-diagram-proxy"), "edgeone-pages");
		assert.equal(response.headers.get("content-encoding"), null);
		assert.equal(response.headers.get("content-length"), null);
		assert.match(response.headers.get("cache-control") ?? "", /no-transform/);
		assert.equal(await response.text(), "window.mermaid = {};");
	} finally {
		global.fetch = originalFetch;
	}
});

test("diagram proxy serves plantuml svg through /diagram/plantuml and preserves query strings", async () => {
	const originalFetch = global.fetch;
	let fetchArgs;

	global.fetch = async (...args) => {
		fetchArgs = args;
		return new Response("<svg xmlns='http://www.w3.org/2000/svg'></svg>", {
			status: 200,
			headers: {
				"content-type": "image/svg+xml; charset=utf-8",
				"transfer-encoding": "chunked",
			},
		});
	};

	try {
		const response = await onRequest({
			request: new Request(
				"https://example.com/diagram/plantuml/svg/SoWkIImgAStDuNBKjNEo2rAaA?foo=bar",
				{
					headers: {
						referer: ALLOWED_REFERER,
						"sec-fetch-site": "same-origin",
					},
				},
			),
			env: {},
		});

		assert.equal(
			fetchArgs[0],
			"https://www.plantuml.com/plantuml/svg/SoWkIImgAStDuNBKjNEo2rAaA?foo=bar",
		);
		assert.equal(response.status, 200);
		assert.equal(
			response.headers.get("content-type"),
			"image/svg+xml; charset=utf-8",
		);
		assert.equal(response.headers.get("x-diagram-proxy"), "edgeone-pages");
		assert.equal(response.headers.get("transfer-encoding"), null);
		assert.match(response.headers.get("cache-control") ?? "", /no-transform/);
		assert.equal(
			await response.text(),
			"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("diagram proxy blocks localhost-driven requests before hitting upstream", async () => {
	const originalFetch = global.fetch;
	let fetchArgs;

	global.fetch = async (...args) => {
		fetchArgs = args;
		return new Response("should-not-run", { status: 200 });
	};

	try {
		const response = await onRequest({
			request: new Request("https://example.com/diagram/mermaid.js", {
				headers: {
					referer: "http://localhost:4321/posts/demo/",
					"sec-fetch-site": "cross-site",
				},
			}),
			env: {},
		});

		assert.equal(fetchArgs, undefined);
		assert.equal(response.status, 403);
		assert.equal(response.headers.get("x-edge-guard"), "blocked");
		assert.match(await response.text(), /forbidden/i);
	} finally {
		global.fetch = originalFetch;
	}
});
