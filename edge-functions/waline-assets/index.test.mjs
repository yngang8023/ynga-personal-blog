import test from "node:test";
import assert from "node:assert/strict";

import { onRequest } from "./proxy.js";

const ALLOWED_REFERER = "https://ynga.kingcola-icg.cn/posts/security-demo/";

test("waline assets proxy forwards emoji asset requests to unpkg and strips unsafe response headers", async () => {
	const originalFetch = global.fetch;
	let fetchCall;

	global.fetch = async (...args) => {
		fetchCall = args;
		return new Response(new Uint8Array([137, 80, 78, 71]), {
			status: 200,
			headers: {
				"content-type": "image/png",
				"content-encoding": "gzip",
				"content-length": "2048",
				"transfer-encoding": "chunked",
			},
		});
	};

	try {
		const response = await onRequest({
			request: new Request(
				"https://ynga.kingcola-icg.cn/waline-assets/@waline/emojis@1.4.0/tw/1f44d.png",
				{
					headers: {
						referer: ALLOWED_REFERER,
						"sec-fetch-site": "same-origin",
					},
				},
			),
			env: {},
		});

		assert.ok(fetchCall);
		assert.equal(
			fetchCall[0],
			"https://unpkg.com/@waline/emojis@1.4.0/tw/1f44d.png",
		);
		assert.equal(fetchCall[1]?.headers.get("accept-encoding"), "identity");
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-waline-assets-proxy"), "edgeone-pages");
		assert.match(response.headers.get("cache-control") ?? "", /no-transform/);
		assert.equal(response.headers.get("content-encoding"), null);
		assert.equal(response.headers.get("content-length"), null);
		assert.equal(response.headers.get("transfer-encoding"), null);
		assert.equal(response.headers.get("content-type"), "image/png");
	} finally {
		global.fetch = originalFetch;
	}
});

test("waline assets proxy only handles explicit online expansion paths", async () => {
	const originalFetch = global.fetch;
	let fetchCall;

	global.fetch = async (...args) => {
		fetchCall = args;
		return new Response("{}", {
			status: 200,
			headers: {
				"content-type": "application/json",
			},
		});
	};

	try {
		const missingResponse = await onRequest({
			request: new Request(
				"https://ynga.kingcola-icg.cn/waline-assets/tw/1f44d.png",
				{
					headers: {
						referer: ALLOWED_REFERER,
						"sec-fetch-site": "same-origin",
					},
				},
			),
			env: {},
		});

		assert.equal(missingResponse.status, 404);
		assert.equal(fetchCall, undefined);

		await onRequest({
			request: new Request(
				"https://ynga.kingcola-icg.cn/waline-assets/@waline/emojis@1.4.0/bmoji/index.json",
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
			fetchCall[0],
			"https://unpkg.com/@waline/emojis@1.4.0/bmoji/index.json",
		);
	} finally {
		global.fetch = originalFetch;
	}
});

test("waline assets proxy blocks localhost-driven requests before reaching upstream", async () => {
	const originalFetch = global.fetch;
	let fetchCall;

	global.fetch = async (...args) => {
		fetchCall = args;
		return new Response("should-not-run", { status: 200 });
	};

	try {
		const response = await onRequest({
			request: new Request(
				"https://ynga.kingcola-icg.cn/waline-assets/@waline/emojis@1.4.0/tw/1f44d.png",
				{
					headers: {
						referer: "http://localhost:4321/posts/demo/",
						"sec-fetch-site": "cross-site",
					},
				},
			),
			env: {},
		});

		assert.equal(fetchCall, undefined);
		assert.equal(response.status, 403);
		assert.equal(response.headers.get("x-edge-guard"), "blocked");
		assert.match(await response.text(), /forbidden/i);
	} finally {
		global.fetch = originalFetch;
	}
});
