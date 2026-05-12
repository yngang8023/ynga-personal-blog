import test from "node:test";
import assert from "node:assert/strict";

import { onRequest } from "./proxy.js";

const ALLOWED_ORIGIN = "https://ynga.kingcola-icg.cn";
const ALLOWED_REFERER = `${ALLOWED_ORIGIN}/posts/security-demo/`;

test("waline proxy strips upstream encoding headers before returning response", async () => {
	const originalFetch = global.fetch;
	let fetchCall;

	global.fetch = async (...args) => {
		fetchCall = args;
		return new Response(JSON.stringify({ ok: true }), {
			status: 200,
			headers: {
				"content-type": "application/json",
				"content-encoding": "gzip",
				"content-length": "128",
				"transfer-encoding": "chunked",
			},
		});
	};

	try {
		const request = new Request(
			"https://ynga.kingcola-icg.cn/waline/api/comment/2?lang=zh-CN",
			{
				method: "PUT",
				headers: {
					"content-type": "application/json",
					origin: ALLOWED_ORIGIN,
					referer: ALLOWED_REFERER,
					"sec-fetch-site": "same-origin",
				},
				body: JSON.stringify({ comment: "patched" }),
			},
		);

		const response = await onRequest({
			request,
			env: {},
		});

		assert.ok(fetchCall);
		assert.equal(fetchCall[1]?.method, "PUT");
		assert.equal(fetchCall[1]?.headers.get("accept-encoding"), "identity");
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-waline-proxy"), "edgeone-pages");
		assert.match(
			response.headers.get("cache-control") ?? "",
			/no-transform/,
		);
		assert.equal(response.headers.get("content-encoding"), null);
		assert.equal(response.headers.get("content-length"), null);
		assert.equal(response.headers.get("transfer-encoding"), null);
		assert.deepEqual(await response.json(), { ok: true });
	} finally {
		global.fetch = originalFetch;
	}
});

test("waline proxy blocks cross-site write requests before reaching upstream", async () => {
	const originalFetch = global.fetch;
	let fetchCall;

	global.fetch = async (...args) => {
		fetchCall = args;
		return new Response("should-not-run", { status: 200 });
	};

	try {
		const response = await onRequest({
			request: new Request(
				"https://ynga.kingcola-icg.cn/waline/api/comment/2?lang=zh-CN",
				{
					method: "PUT",
					headers: {
						"content-type": "application/json",
						origin: "http://localhost:4321",
						referer: "http://localhost:4321/posts/demo/",
						"sec-fetch-site": "cross-site",
					},
					body: JSON.stringify({ comment: "blocked" }),
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

test("waline proxy rejects disallowed preflight requests locally", async () => {
	const originalFetch = global.fetch;
	let fetchCall;

	global.fetch = async (...args) => {
		fetchCall = args;
		return new Response("should-not-run", { status: 200 });
	};

	try {
		const response = await onRequest({
			request: new Request(
				"https://ynga.kingcola-icg.cn/waline/api/comment/2?lang=zh-CN",
				{
					method: "OPTIONS",
					headers: {
						origin: "http://localhost:4321",
						referer: "http://localhost:4321/posts/demo/",
						"sec-fetch-site": "cross-site",
						"access-control-request-method": "PUT",
					},
				},
			),
			env: {},
		});

		assert.equal(fetchCall, undefined);
		assert.equal(response.status, 403);
		assert.equal(response.headers.get("x-edge-guard"), "blocked");
	} finally {
		global.fetch = originalFetch;
	}
});
