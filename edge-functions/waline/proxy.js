const DEFAULT_WALINE_ORIGIN = "https://waline.kingcola-icg.cn";

const HOP_BY_HOP_REQUEST_HEADERS = [
	"host",
	"content-length",
];

const UNSAFE_RESPONSE_HEADERS = [
	"content-encoding",
	"content-length",
	"transfer-encoding",
];

function getOrigin(env) {
	const origin = env?.WALINE_ORIGIN || DEFAULT_WALINE_ORIGIN;
	return origin.replace(/\/+$/, "");
}

function buildUpstreamHeaders(request, incomingUrl) {
	const headers = new Headers(request.headers);

	for (const header of HOP_BY_HOP_REQUEST_HEADERS) {
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

	for (const header of UNSAFE_RESPONSE_HEADERS) {
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

export async function onRequest(context) {
	const { request, env } = context;
	const incomingUrl = new URL(request.url);
	const upstreamPath =
		incomingUrl.pathname.replace(/^\/waline(?=\/|$)/, "") || "/";
	const targetUrl = new URL(
		upstreamPath + incomingUrl.search,
		getOrigin(env),
	);

	const upstreamResponse = await fetch(targetUrl.toString(), {
		method: request.method,
		headers: buildUpstreamHeaders(request, incomingUrl),
		body:
			request.method === "GET" || request.method === "HEAD"
				? undefined
				: request.body,
		redirect: "manual",
	});

	// Materialize the upstream body before returning it.
	// This breaks any coupling between the original encoded stream metadata
	// and the outgoing Pages response, which avoids browser decode failures
	// on proxied JSON API responses.
	const responseBody = await upstreamResponse.arrayBuffer();

	return new Response(request.method === "HEAD" ? null : responseBody, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers: sanitizeUpstreamResponseHeaders(upstreamResponse.headers),
	});
}
