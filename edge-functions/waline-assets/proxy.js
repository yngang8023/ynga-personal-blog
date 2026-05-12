import { guardProxyReadRequest } from "../_shared/request-guard.js";

const DEFAULT_WALINE_ASSETS_ORIGIN = "https://unpkg.com";
const WALINE_ASSET_CACHE_CONTROL =
	"public, max-age=31536000, s-maxage=31536000, immutable, no-transform";

const HOP_BY_HOP_REQUEST_HEADERS = ["host", "content-length"];
const UNSAFE_RESPONSE_HEADERS = [
	"content-encoding",
	"content-length",
	"transfer-encoding",
];

function getOrigin(env) {
	const origin = env?.WALINE_ASSETS_ORIGIN || DEFAULT_WALINE_ASSETS_ORIGIN;
	return origin.replace(/\/+$/, "");
}

function buildUpstreamUrl(incomingUrl, env) {
	const upstreamPath =
		incomingUrl.pathname.replace(/^\/waline-assets(?=\/|$)/, "") || "/";
	const normalizedPath = upstreamPath.startsWith("/")
		? upstreamPath
		: `/${upstreamPath}`;
	if (!normalizedPath.startsWith("/@waline/emojis@")) {
		return null;
	}

	return new URL(`${normalizedPath}${incomingUrl.search}`, getOrigin(env));
}

function buildUpstreamHeaders(request, incomingUrl) {
	const headers = new Headers(request.headers);

	for (const header of HOP_BY_HOP_REQUEST_HEADERS) {
		headers.delete(header);
	}

	headers.set("accept-encoding", "identity");
	headers.set("x-forwarded-host", incomingUrl.host);
	headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

	return headers;
}

function sanitizeUpstreamResponseHeaders(upstreamHeaders) {
	const responseHeaders = new Headers(upstreamHeaders);

	for (const header of UNSAFE_RESPONSE_HEADERS) {
		responseHeaders.delete(header);
	}

	responseHeaders.set("cache-control", WALINE_ASSET_CACHE_CONTROL);
	responseHeaders.set("x-waline-assets-proxy", "edgeone-pages");
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
		},
	});
}

async function readCachedResponse(cacheStore, cacheKey, method) {
	if (!cacheStore || !cacheKey) {
		return null;
	}

	const cached = await cacheStore.match(cacheKey);
	if (!cached) {
		return null;
	}

	return new Response(method === "HEAD" ? null : await cached.arrayBuffer(), {
		status: cached.status,
		statusText: cached.statusText,
		headers: sanitizeUpstreamResponseHeaders(cached.headers),
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
			"x-waline-assets-proxy": "edgeone-pages",
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
	const cacheable = method === "GET" || method === "HEAD";
	const cacheStore = cacheable ? getCacheStore() : null;
	const cacheKey = cacheable ? buildCacheKey(request) : null;
	const upstreamUrl = buildUpstreamUrl(incomingUrl, env);

	if (!upstreamUrl) {
		return new Response("Not Found", {
			status: 404,
			headers: {
				"cache-control": "no-store, no-transform",
				"x-waline-assets-proxy": "edgeone-pages",
			},
		});
	}

	if (cacheable) {
		const cachedResponse = await readCachedResponse(
			cacheStore,
			cacheKey,
			method,
		);
		if (cachedResponse) {
			return cachedResponse;
		}
	}

	const upstreamResponse = await fetch(upstreamUrl.toString(), {
		method,
		headers: buildUpstreamHeaders(request, incomingUrl),
		body:
			method === "GET" || method === "HEAD"
				? undefined
				: request.body,
		redirect: "manual",
	});

	const response = new Response(
		method === "HEAD" ? null : await upstreamResponse.arrayBuffer(),
		{
			status: upstreamResponse.status,
			statusText: upstreamResponse.statusText,
			headers: sanitizeUpstreamResponseHeaders(upstreamResponse.headers),
		},
	);

	await queueCacheWrite(context, cacheStore, cacheKey, response);
	return response;
}
