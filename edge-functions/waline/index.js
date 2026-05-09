const DEFAULT_WALINE_ORIGIN = "https://waline.kingcola-icg.cn";

function getOrigin(env) {
	const origin = env?.WALINE_ORIGIN || DEFAULT_WALINE_ORIGIN;
	return origin.replace(/\/+$/, "");
}

async function proxyWaline(context) {
	const { request, env } = context;
	const incomingUrl = new URL(request.url);
	const upstreamPath = incomingUrl.pathname.replace(/^\/waline(?=\/|$)/, "") || "/";
	const targetUrl = new URL(upstreamPath + incomingUrl.search, getOrigin(env));

	const headers = new Headers(request.headers);
	headers.delete("host");
	headers.set("x-forwarded-host", incomingUrl.host);
	headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

	const upstreamResponse = await fetch(targetUrl.toString(), {
		method: request.method,
		headers,
		body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
		redirect: "manual",
	});

	const responseHeaders = new Headers(upstreamResponse.headers);
	responseHeaders.set("x-waline-proxy", "edgeone-pages");

	return new Response(upstreamResponse.body, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers: responseHeaders,
	});
}

export function onRequest(context) {
	return proxyWaline(context);
}
