import { guardProxyReadRequest } from "../_shared/request-guard.js";
import {
	DEFAULT_UMAMI_API_BASE,
	EDGE_HOP_BY_HOP_REQUEST_HEADERS,
	EDGE_UNSAFE_RESPONSE_HEADERS,
	UMAMI_CACHE_CONTROL_BY_ROUTE,
} from "../config.js";

function getApiBase(env) {
	const apiBase = env?.UMAMI_API_BASE || DEFAULT_UMAMI_API_BASE;
	return apiBase.replace(/\/+$/, "");
}

function buildUpstreamHeaders(request, incomingUrl) {
	const headers = new Headers(request.headers);

	for (const header of EDGE_HOP_BY_HOP_REQUEST_HEADERS) {
		headers.delete(header);
	}

	headers.set("accept-encoding", "identity");
	headers.set("x-forwarded-host", incomingUrl.host);
	headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

	return headers;
}

function resolveRoute(incomingUrl, apiBase) {
	const shareMatch = incomingUrl.pathname.match(/^\/umami\/share\/([^/]+)$/);
	if (shareMatch) {
		return {
			cacheControl: UMAMI_CACHE_CONTROL_BY_ROUTE.share,
			targetUrl: `${apiBase}/share/${shareMatch[1]}`,
		};
	}

	const statsMatch = incomingUrl.pathname.match(
		/^\/umami\/websites\/([^/]+)\/stats$/,
	);
	if (statsMatch) {
		return {
			cacheControl: UMAMI_CACHE_CONTROL_BY_ROUTE.stats,
			targetUrl: `${apiBase}/websites/${statsMatch[1]}/stats${incomingUrl.search}`,
		};
	}

	const metricsExpandedMatch = incomingUrl.pathname.match(
		/^\/umami\/websites\/([^/]+)\/metrics\/expanded$/,
	);
	if (metricsExpandedMatch) {
		return {
			cacheControl: UMAMI_CACHE_CONTROL_BY_ROUTE.metricsExpanded,
			targetUrl: `${apiBase}/websites/${metricsExpandedMatch[1]}/metrics/expanded${incomingUrl.search}`,
		};
	}

	return null;
}

function sanitizeUpstreamResponseHeaders(upstreamHeaders, cacheControl, cacheState) {
	const responseHeaders = new Headers(upstreamHeaders);

	for (const header of EDGE_UNSAFE_RESPONSE_HEADERS) {
		responseHeaders.delete(header);
	}

	responseHeaders.set("cache-control", cacheControl);
	responseHeaders.set("x-umami-proxy", "edgeone-pages");
	responseHeaders.set("x-umami-cache", cacheState);

	return responseHeaders;
}

function getCacheStore() {
	return globalThis.caches?.default ?? null;
}

function buildCacheKey(request) {
	return new Request(request.url, {
		method: "GET",
		headers: {
			accept: request.headers.get("accept") || "*/*",
			"x-umami-share-token": request.headers.get("x-umami-share-token") || "",
			"x-umami-share-context": request.headers.get("x-umami-share-context") || "",
		},
	});
}

async function readCachedResponse(cacheStore, cacheKey, cacheControl) {
	if (!cacheStore || !cacheKey) {
		return null;
	}

	const cached = await cacheStore.match(cacheKey);
	if (!cached) {
		return null;
	}

	return new Response(await cached.arrayBuffer(), {
		status: cached.status,
		statusText: cached.statusText,
		headers: sanitizeUpstreamResponseHeaders(
			cached.headers,
			cacheControl,
			"hit",
		),
	});
}

async function queueCacheWrite(context, cacheStore, cacheKey, response) {
	if (!cacheStore || !cacheKey || !response.ok) {
		return;
	}

	const write = cacheStore.put(cacheKey, response.clone()).catch(() => undefined);
	if (typeof context.waitUntil === "function") {
		context.waitUntil(write);
		return;
	}

	await write;
}

function buildMethodNotAllowedResponse() {
	return new Response("Method Not Allowed", {
		status: 405,
		headers: {
			allow: "GET, HEAD",
			"cache-control": "no-store, no-transform",
			"x-umami-proxy": "edgeone-pages",
		},
	});
}

export async function onRequest(context) {
	const { request, env } = context;
	const method = request.method.toUpperCase();

	if (method !== "GET" && method !== "HEAD") {
		return buildMethodNotAllowedResponse();
	}

	const guardResponse = guardProxyReadRequest(request, env);
	if (guardResponse) {
		return guardResponse;
	}

	const incomingUrl = new URL(request.url);
	const route = resolveRoute(incomingUrl, getApiBase(env));
	if (!route) {
		return new Response("Not Found", {
			status: 404,
			headers: {
				"cache-control": "no-store, no-transform",
				"x-umami-proxy": "edgeone-pages",
			},
		});
	}

	const cacheStore = method === "GET" ? getCacheStore() : null;
	const cacheKey = method === "GET" ? buildCacheKey(request) : null;
	const cachedResponse = await readCachedResponse(
		cacheStore,
		cacheKey,
		route.cacheControl,
	);
	if (cachedResponse) {
		return cachedResponse;
	}

	const upstreamResponse = await fetch(route.targetUrl, {
		method,
		headers: buildUpstreamHeaders(request, incomingUrl),
		redirect: "manual",
	});

	const response = new Response(
		method === "HEAD" ? null : await upstreamResponse.arrayBuffer(),
		{
			status: upstreamResponse.status,
			statusText: upstreamResponse.statusText,
			headers: sanitizeUpstreamResponseHeaders(
				upstreamResponse.headers,
				route.cacheControl,
				"miss",
			),
		},
	);

	await queueCacheWrite(context, cacheStore, cacheKey, response);
	return response;
}
