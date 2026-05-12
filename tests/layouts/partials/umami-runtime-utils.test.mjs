import assert from "node:assert/strict";
import test from "node:test";

import {
	createUmamiStatsClient,
	parseUmamiShareUrl,
} from "../../../src/layouts/partials/umami-runtime-utils.js";

test("parseUmamiShareUrl extracts the Umami api base and share id", () => {
	assert.deepEqual(
		parseUmamiShareUrl(
			"https://cloud.umami.is/analytics/us/share/VXfzKN9KrGekRNdd",
		),
		{
			apiBase: "https://cloud.umami.is/analytics/us/api",
			shareId: "VXfzKN9KrGekRNdd",
		},
	);
});

test("createUmamiStatsClient reuses the same in-flight share and stats request for an identical path", async () => {
	let shareFetchCount = 0;
	let statsFetchCount = 0;

	const client = createUmamiStatsClient({
		shareUrl: "https://cloud.umami.is/analytics/us/share/demo-share",
		proxyBasePath: "/umami",
		statsCacheTtlMs: 3000,
		fetchImpl: async (url) => {
			if (url === "/umami/share/demo-share") {
				shareFetchCount += 1;
				return Response.json({
					websiteId: "website-demo",
					token: "share-token",
				});
			}

			if (url.includes("/umami/websites/website-demo/stats?")) {
				statsFetchCount += 1;
				await new Promise((resolve) => setTimeout(resolve, 0));
				return Response.json({
					pageviews: { value: 9 },
					visitors: { value: 4 },
					visits: { value: 5 },
				});
			}

			throw new Error(`Unexpected fetch url: ${url}`);
		},
	});

	const [first, second] = await Promise.all([
		client.getStats("/posts/demo/"),
		client.getStats("/posts/demo/"),
	]);

	assert.equal(shareFetchCount, 1);
	assert.equal(statsFetchCount, 1);
	assert.deepEqual(first, {
		pageviews: 9,
		visitors: 4,
		visits: 5,
	});
	assert.deepEqual(second, first);
});

test("createUmamiStatsClient serves short-lived cached stats but allows a fresh follow-up refresh", async () => {
	let nowValue = 1_000;
	let statsFetchCount = 0;
	const statsUrls = [];

	const client = createUmamiStatsClient({
		shareUrl: "https://cloud.umami.is/analytics/us/share/demo-share",
		proxyBasePath: "/umami",
		statsCacheTtlMs: 3_000,
		now: () => nowValue,
		fetchImpl: async (url) => {
			if (url === "/umami/share/demo-share") {
				return Response.json({
					websiteId: "website-demo",
					token: "share-token",
				});
			}

			if (url.includes("/umami/websites/website-demo/stats?")) {
				statsFetchCount += 1;
				statsUrls.push(url);
				return Response.json({
					pageviews: statsFetchCount,
					visitors: 2,
					visits: 3,
				});
			}

			throw new Error(`Unexpected fetch url: ${url}`);
		},
	});

	const first = await client.getStats("/posts/demo/");
	const second = await client.getStats("/posts/demo/");

	nowValue += 2_000;
	const third = await client.getStats("/posts/demo/");

	const fresh = await client.getStats("/posts/demo/", {
		fresh: true,
	});

	assert.equal(statsFetchCount, 2);
	assert.deepEqual(first, {
		pageviews: 1,
		visitors: 2,
		visits: 3,
	});
	assert.deepEqual(second, first);
	assert.deepEqual(third, first);
	assert.deepEqual(fresh, {
		pageviews: 2,
		visitors: 2,
		visits: 3,
	});
	assert.match(statsUrls[0], /path=eq\./);
	assert.doesNotMatch(statsUrls[0], /(?:^|[?&])_=/);
	assert.match(statsUrls[1], /(?:^|[?&])_=\d+/);
});

test("createUmamiStatsClient aggregates only matching article paths for total reading count", async () => {
	let metricsFetchCount = 0;

	const client = createUmamiStatsClient({
		shareUrl: "https://cloud.umami.is/analytics/us/share/demo-share",
		proxyBasePath: "/umami",
		statsCacheTtlMs: 3_000,
		fetchImpl: async (url) => {
			if (url === "/umami/share/demo-share") {
				return Response.json({
					websiteId: "website-demo",
					token: "share-token",
				});
			}

			if (url.includes("/umami/websites/website-demo/metrics/expanded?")) {
				metricsFetchCount += 1;
				return Response.json([
					{
						name: "/posts/demo-1/",
						pageviews: 12,
						visitors: 3,
						visits: 4,
					},
					{
						name: "/posts/demo-2/",
						pageviews: 18,
						visitors: 5,
						visits: 6,
					},
					{
						name: "/friends/",
						pageviews: 99,
						visitors: 20,
						visits: 21,
					},
				]);
			}

			throw new Error(`Unexpected fetch url: ${url}`);
		},
	});

	const total = await client.getArticleTotalViews([
		"/posts/demo-1/",
		"/posts/demo-2/",
	]);

	assert.equal(metricsFetchCount, 1);
	assert.equal(total, 30);
});
