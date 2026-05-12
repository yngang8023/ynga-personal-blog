const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_STATS_CACHE_TTL_MS = 3_000;
const SITE_STATS_CACHE_KEY = "__site__";
const ARTICLE_TOTAL_CACHE_KEY_PREFIX = "__article_total__";

function trimTrailingSlash(value) {
	return value.replace(/\/+$/, "");
}

function buildProxyUrl(proxyBasePath, route) {
	const normalizedBase = trimTrailingSlash(proxyBasePath || "/umami");
	const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
	return `${normalizedBase}${normalizedRoute}`;
}

function normalizeStats(stats) {
	return {
		pageviews: stats?.pageviews?.value ?? stats?.pageviews ?? 0,
		visitors: stats?.visitors?.value ?? stats?.visitors ?? 0,
		visits: stats?.visits?.value ?? stats?.visits ?? 0,
	};
}

function normalizeExpandedMetricRows(rows) {
	if (!Array.isArray(rows)) {
		return [];
	}

	return rows
		.map((row) => ({
			name: typeof row?.name === "string" ? row.name : "",
			pageviews: Number(row?.pageviews ?? 0),
		}))
		.filter((row) => row.name.length > 0);
}

export function parseUmamiShareUrl(rawUrl) {
	const parsed = new URL(rawUrl);
	const segments = parsed.pathname.split("/").filter(Boolean);
	const shareIndex = segments.indexOf("share");

	if (shareIndex === -1 || shareIndex >= segments.length - 1) {
		throw new Error("无效的 Umami 分享链接");
	}

	const shareId = segments[shareIndex + 1];
	const prefix = segments.slice(0, shareIndex).join("/");

	return {
		apiBase: `${parsed.origin}/${prefix}/api`,
		shareId,
	};
}

export function createUmamiStatsClient({
	shareUrl,
	proxyBasePath = "/umami",
	requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
	statsCacheTtlMs = DEFAULT_STATS_CACHE_TTL_MS,
	fetchImpl = (...args) => fetch(...args),
	now = () => Date.now(),
}) {
	if (!shareUrl) {
		throw new Error("缺少 Umami 分享链接配置");
	}

	const { shareId } = parseUmamiShareUrl(shareUrl);
	const shareState = {
		data: null,
		promise: null,
	};
	const statsState = new Map();

	const fetchWithTimeout = async (url, options = {}) => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), requestTimeoutMs);

		try {
			return await fetchImpl(url, {
				...options,
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timer);
		}
	};

	const clearCache = () => {
		shareState.data = null;
		shareState.promise = null;
		statsState.clear();
	};

	const getShareData = async () => {
		if (shareState.data) {
			return shareState.data;
		}

		if (shareState.promise) {
			return shareState.promise;
		}

		const sharePromise = (async () => {
			const response = await fetchWithTimeout(
				buildProxyUrl(proxyBasePath, `/share/${shareId}`),
				{
					headers: {
						accept: "application/json",
					},
				},
			);

			if (!response.ok) {
				throw new Error(
					`获取 Umami 分享信息失败: ${response.status}`,
				);
			}

			const data = await response.json();
			shareState.data = data;
			return data;
		})();

		shareState.promise = sharePromise;

		try {
			return await sharePromise;
		} finally {
			shareState.promise = null;
		}
	};

	const getStats = async (path, { fresh = false } = {}) => {
		const cacheKey = path || SITE_STATS_CACHE_KEY;
		const cached = statsState.get(cacheKey);
		const currentTime = now();

		if (
			!fresh &&
			cached?.value &&
			typeof cached.expiresAt === "number" &&
			cached.expiresAt > currentTime
		) {
			return cached.value;
		}

		if (cached?.promise) {
			return cached.promise;
		}

		const statsPromise = (async () => {
			const shareData = await getShareData();
			const params = new URLSearchParams({
				startAt: "0",
				endAt: currentTime.toString(),
			});

			if (path) {
				params.set("path", `eq.${path}`);
			}

			if (fresh) {
				params.set("_", now().toString());
			}

			const response = await fetchWithTimeout(
				buildProxyUrl(
					proxyBasePath,
					`/websites/${shareData.websiteId}/stats?${params.toString()}`,
				),
				{
					headers: {
						accept: "application/json",
						"x-umami-share-token": shareData.token,
						"x-umami-share-context": "1",
					},
				},
			);

			if (!response.ok) {
				throw new Error(`获取统计失败: ${response.status}`);
			}

			const normalized = normalizeStats(await response.json());
			statsState.set(cacheKey, {
				value: normalized,
				promise: null,
				expiresAt: now() + statsCacheTtlMs,
			});
			return normalized;
		})();

		statsState.set(cacheKey, {
			value: cached?.value ?? null,
			promise: statsPromise,
			expiresAt: cached?.expiresAt ?? 0,
		});

		try {
			return await statsPromise;
		} catch (error) {
			const current = statsState.get(cacheKey);
			if (current?.promise === statsPromise) {
				statsState.delete(cacheKey);
			}
			throw error;
		}
	};

	const getArticleTotalViews = async (articlePaths, { fresh = false } = {}) => {
		const uniquePaths = Array.from(
			new Set((articlePaths || []).filter(Boolean)),
		);

		if (uniquePaths.length === 0) {
			return 0;
		}

		const cacheKey = `${ARTICLE_TOTAL_CACHE_KEY_PREFIX}:${uniquePaths.join("|")}`;
		const cached = statsState.get(cacheKey);
		const currentTime = now();

		if (
			!fresh &&
			cached &&
			cached?.value !== null &&
			typeof cached.expiresAt === "number" &&
			cached.expiresAt > currentTime
		) {
			return cached.value;
		}

		if (cached?.promise) {
			return cached.promise;
		}

		const totalPromise = (async () => {
			const shareData = await getShareData();
			const pathSet = new Set(uniquePaths);
			const limit = 500;
			let offset = 0;
			let totalViews = 0;
			let matchedPathCount = 0;

			while (true) {
				const params = new URLSearchParams({
					startAt: "0",
					endAt: currentTime.toString(),
					type: "path",
					limit: String(limit),
					offset: String(offset),
				});

				if (fresh) {
					params.set("_", now().toString());
				}

				const response = await fetchWithTimeout(
					buildProxyUrl(
						proxyBasePath,
						`/websites/${shareData.websiteId}/metrics/expanded?${params.toString()}`,
					),
					{
						headers: {
							accept: "application/json",
							"x-umami-share-token": shareData.token,
							"x-umami-share-context": "1",
						},
					},
				);

				if (!response.ok) {
					throw new Error(
						`获取文章总阅读量失败: ${response.status}`,
					);
				}

				const rows = normalizeExpandedMetricRows(await response.json());
				if (rows.length === 0) {
					break;
				}

				for (const row of rows) {
					if (pathSet.has(row.name)) {
						totalViews += row.pageviews;
						matchedPathCount += 1;
					}
				}

				if (rows.length < limit || matchedPathCount >= pathSet.size) {
					break;
				}

				offset += limit;
			}

			statsState.set(cacheKey, {
				value: totalViews,
				promise: null,
				expiresAt: now() + statsCacheTtlMs,
			});
			return totalViews;
		})();

		statsState.set(cacheKey, {
			value: cached?.value ?? null,
			promise: totalPromise,
			expiresAt: cached?.expiresAt ?? 0,
		});

		try {
			return await totalPromise;
		} catch (error) {
			const current = statsState.get(cacheKey);
			if (current?.promise === totalPromise) {
				statsState.delete(cacheKey);
			}
			throw error;
		}
	};

	return {
		getStats,
		getSiteStats: (options) => getStats(undefined, options),
		getPageStats: (path, options) => getStats(path, options),
		getArticleTotalViews,
		clearCache,
	};
}
