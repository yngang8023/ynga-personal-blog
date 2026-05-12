import assert from "node:assert/strict";
import test from "node:test";

import { onRequest } from "./proxy.js";

const ALLOWED_REFERER = "https://ynga.kingcola-icg.cn/posts/security-demo/";

test("umami proxy serves share metadata through the same-origin edge route", async () => {
	const originalFetch = global.fetch;
	let fetchArgs;

	global.fetch = async (...args) => {
		fetchArgs = args;
		return Response.json({
			websiteId: "website-demo",
			token: "share-token",
		});
	};

	try {
		const response = await onRequest({
			request: new Request(
				"https://ynga.kingcola-icg.cn/umami/share/demo-share",
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
			"https://cloud.umami.is/analytics/us/api/share/demo-share",
		);
		assert.equal(fetchArgs[1]?.headers.get("accept-encoding"), "identity");
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-umami-proxy"), "edgeone-pages");
		assert.match(response.headers.get("cache-control") ?? "", /max-age=300/);
		assert.deepEqual(await response.json(), {
			websiteId: "website-demo",
			token: "share-token",
		});
	} finally {
		global.fetch = originalFetch;
	}
});

test("umami proxy serves stats with a short cache policy", async () => {
	const originalFetch = global.fetch;
	let fetchArgs;

	global.fetch = async (...args) => {
		fetchArgs = args;
		return Response.json({
			pageviews: { value: 12 },
			visitors: { value: 7 },
			visits: { value: 9 },
		});
	};

	try {
		const response = await onRequest({
			request: new Request(
				"https://ynga.kingcola-icg.cn/umami/websites/website-demo/stats?startAt=0&endAt=123&path=eq.%2Fposts%2Fdemo%2F",
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
			"https://cloud.umami.is/analytics/us/api/websites/website-demo/stats?startAt=0&endAt=123&path=eq.%2Fposts%2Fdemo%2F",
		);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("x-umami-proxy"), "edgeone-pages");
		assert.match(response.headers.get("cache-control") ?? "", /max-age=5/);
		assert.deepEqual(await response.json(), {
			pageviews: { value: 12 },
			visitors: { value: 7 },
			visits: { value: 9 },
		});
	} finally {
		global.fetch = originalFetch;
	}
});

test("umami proxy blocks localhost-driven requests before reaching upstream", async () => {
	const originalFetch = global.fetch;
	let fetchArgs;

	global.fetch = async (...args) => {
		fetchArgs = args;
		return new Response("should-not-run", { status: 200 });
	};

	try {
		const response = await onRequest({
			request: new Request("https://ynga.kingcola-icg.cn/umami/share/demo-share", {
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
