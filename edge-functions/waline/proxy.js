import {
	guardProxyReadRequest,
	guardProxyWriteRequest,
	handleProxyPreflight,
} from "../_shared/request-guard.js";
import {
	DEFAULT_WALINE_ORIGIN,
	EDGE_HOP_BY_HOP_REQUEST_HEADERS,
	EDGE_UNSAFE_RESPONSE_HEADERS,
	WALINE_READ_METHODS,
	WALINE_WRITE_METHODS,
} from "../config.js";

const READ_METHODS = new Set(WALINE_READ_METHODS);
const WRITE_METHODS = [...WALINE_WRITE_METHODS];

function getOrigin(env) {
	const origin = env?.WALINE_ORIGIN || DEFAULT_WALINE_ORIGIN;
	return origin.replace(/\/+$/, "");
}

function buildUpstreamHeaders(request, incomingUrl) {
	const headers = new Headers(request.headers);

	for (const header of EDGE_HOP_BY_HOP_REQUEST_HEADERS) {
		headers.delete(header);
	}

	// Let the upstream return an uncompressed body when possible.
	headers.set("accept-encoding", "identity");
	headers.set("x-forwarded-host", incomingUrl.host);
	headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

	return headers;
}

function sanitizeUpstreamResponseHeaders(upstreamHeaders) {
	const responseHeaders = new Headers(upstreamHeaders);

	for (const header of EDGE_UNSAFE_RESPONSE_HEADERS) {
		responseHeaders.delete(header);
	}

	const cacheControl = responseHeaders.get("cache-control");
	if (cacheControl) {
		if (!/no-transform/i.test(cacheControl)) {
			responseHeaders.set("cache-control", `${cacheControl}, no-transform`);
		}
	} else {
		responseHeaders.set("cache-control", "no-store, no-transform");
	}

	responseHeaders.set("x-waline-proxy", "edgeone-pages");
	return responseHeaders;
}

function buildMethodNotAllowedResponse() {
	return new Response("Method Not Allowed", {
		status: 405,
		headers: {
			allow: `${Array.from(READ_METHODS).join(", ")}, ${WRITE_METHODS.join(", ")}, OPTIONS`,
			"cache-control": "no-store, no-transform",
			"x-waline-proxy": "edgeone-pages",
		},
	});
}

export async function onRequest(context) {
	const { request, env } = context;
	const method = request.method.toUpperCase();

	if (method === "OPTIONS") {
		return handleProxyPreflight(request, env, WRITE_METHODS);
	}

	if (!READ_METHODS.has(method) && !WRITE_METHODS.includes(method)) {
		return buildMethodNotAllowedResponse();
	}

	const guardResponse = READ_METHODS.has(method)
		? guardProxyReadRequest(request, env)
		: guardProxyWriteRequest(request, env);
	if (guardResponse) {
		return guardResponse;
	}

	const incomingUrl = new URL(request.url);
	const upstreamPath =
		incomingUrl.pathname.replace(/^\/waline(?=\/|$)/, "") || "/";
	const targetUrl = new URL(
		upstreamPath + incomingUrl.search,
		getOrigin(env),
	);

	const upstreamResponse = await fetch(targetUrl.toString(), {
		method,
		headers: buildUpstreamHeaders(request, incomingUrl),
		body:
			method === "GET" || method === "HEAD"
				? undefined
				: request.body,
		redirect: "manual",
	});

	// Materialize the upstream body before returning it.
	// This breaks any coupling between the original encoded stream metadata
	// and the outgoing Pages response, which avoids browser decode failures
	// on proxied JSON API responses.
	const responseBody = await upstreamResponse.arrayBuffer();

	return new Response(method === "HEAD" ? null : responseBody, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers: sanitizeUpstreamResponseHeaders(upstreamResponse.headers),
	});
}
