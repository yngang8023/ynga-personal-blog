import { guardProxyReadRequest } from "../_shared/request-guard.js";
import {
	DIAGRAM_CACHE_CONTROL_BY_ROUTE,
	EDGE_HOP_BY_HOP_REQUEST_HEADERS,
	EDGE_UNSAFE_RESPONSE_HEADERS,
	MERMAID_ROUTE,
	MERMAID_UPSTREAM,
	PLANTUML_ROUTE_PREFIX,
	PLANTUML_UPSTREAM,
} from "../config.js";

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

function resolveRoute(incomingUrl) {
	if (incomingUrl.pathname === MERMAID_ROUTE) {
		return {
			cacheControl: DIAGRAM_CACHE_CONTROL_BY_ROUTE.mermaid,
			targetUrl: MERMAID_UPSTREAM,
		};
	}

	if (
		incomingUrl.pathname === PLANTUML_ROUTE_PREFIX ||
		incomingUrl.pathname.startsWith(`${PLANTUML_ROUTE_PREFIX}/`)
	) {
		const upstreamPath =
			incomingUrl.pathname.replace(
				/^\/diagram\/plantuml(?=\/|$)/,
				"",
			) || "/";
		const normalizedUpstreamPath = upstreamPath.replace(/^\/+/, "");

		return {
			cacheControl: DIAGRAM_CACHE_CONTROL_BY_ROUTE.plantuml,
			targetUrl: new URL(
				`${normalizedUpstreamPath}${incomingUrl.search}`,
				PLANTUML_UPSTREAM,
			).toString(),
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
	responseHeaders.set("x-diagram-proxy", "edgeone-pages");
	responseHeaders.set("x-diagram-cache", cacheState);

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

async function readCachedResponse(cacheStore, cacheKey) {
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
				cached.headers.get("cache-control") ||
					DIAGRAM_CACHE_CONTROL_BY_ROUTE.plantuml,
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
			"x-diagram-proxy": "edgeone-pages",
		},
	});
}

export async function onRequest(context) {
	const { request } = context;
	const method = request.method.toUpperCase();

	if (method !== "GET" && method !== "HEAD") {
		return buildMethodNotAllowedResponse();
	}

	const guardResponse = guardProxyReadRequest(request, context.env);
	if (guardResponse) {
		return guardResponse;
	}

	const incomingUrl = new URL(request.url);
	const route = resolveRoute(incomingUrl);

	if (!route) {
		return new Response("Not Found", {
			status: 404,
			headers: {
				"cache-control": "no-store, no-transform",
				"x-diagram-proxy": "edgeone-pages",
			},
		});
	}

	const cacheStore = method === "GET" ? getCacheStore() : null;
	const cacheKey = method === "GET" ? buildCacheKey(request) : null;
	const cachedResponse = await readCachedResponse(cacheStore, cacheKey);
	if (cachedResponse) {
		return cachedResponse;
	}

	const upstreamResponse = await fetch(route.targetUrl, {
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
