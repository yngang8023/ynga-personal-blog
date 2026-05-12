const DEFAULT_ALLOWED_SITE_ORIGINS = ["https://ynga.kingcola-icg.cn"];

const BLOCKED_RESPONSE_HEADERS = {
	"cache-control": "no-store, no-transform",
	"content-type": "text/plain; charset=utf-8",
	"x-edge-guard": "blocked",
};

function trimTrailingSlash(value) {
	return value.replace(/\/+$/, "");
}

function normalizeOrigin(value) {
	if (!value || typeof value !== "string") {
		return null;
	}

	try {
		return trimTrailingSlash(new URL(value).origin);
	} catch {
		return null;
	}
}

function normalizeHeaderValue(value) {
	return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getAllowedSiteOrigins(env) {
	const configuredOrigins = env?.ALLOWED_SITE_ORIGINS;
	const values =
		typeof configuredOrigins === "string" && configuredOrigins.trim().length > 0
			? configuredOrigins.split(",")
			: DEFAULT_ALLOWED_SITE_ORIGINS;

	return new Set(
		values
			.map((value) => normalizeOrigin(value))
			.filter(Boolean),
	);
}

function buildBlockedResponse(reason = "Forbidden") {
	return new Response(reason, {
		status: 403,
		headers: BLOCKED_RESPONSE_HEADERS,
	});
}

function getRequestMetadata(request) {
	const headers = request.headers;
	return {
		origin: normalizeOrigin(headers.get("origin")),
		refererOrigin: normalizeOrigin(headers.get("referer")),
		secFetchSite: normalizeHeaderValue(headers.get("sec-fetch-site")),
		requestedHeaders:
			headers.get("access-control-request-headers") || "content-type",
	};
}

function isAllowedOrigin(origin, allowedOrigins) {
	return Boolean(origin && allowedOrigins.has(origin));
}

function buildCorsHeaders(origin, requestedHeaders, allowMethods) {
	const headers = new Headers({
		"access-control-allow-credentials": "true",
		"access-control-allow-headers": requestedHeaders,
		"access-control-allow-methods": allowMethods.join(", "),
		"access-control-allow-origin": origin,
		"access-control-max-age": "86400",
		"cache-control": "no-store, no-transform",
		vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
		"x-edge-guard": "preflight",
	});

	return headers;
}

export function guardProxyReadRequest(request, env) {
	const allowedOrigins = getAllowedSiteOrigins(env);
	const { origin, refererOrigin, secFetchSite } = getRequestMetadata(request);

	if (secFetchSite === "cross-site") {
		return buildBlockedResponse();
	}

	if (
		isAllowedOrigin(origin, allowedOrigins) ||
		isAllowedOrigin(refererOrigin, allowedOrigins) ||
		secFetchSite === "same-origin"
	) {
		return null;
	}

	return buildBlockedResponse();
}

export function guardProxyWriteRequest(request, env) {
	const allowedOrigins = getAllowedSiteOrigins(env);
	const { origin, refererOrigin, secFetchSite } = getRequestMetadata(request);

	if (secFetchSite !== "same-origin") {
		return buildBlockedResponse();
	}

	if (
		isAllowedOrigin(origin, allowedOrigins) ||
		(!origin && isAllowedOrigin(refererOrigin, allowedOrigins))
	) {
		return null;
	}

	return buildBlockedResponse();
}

export function handleProxyPreflight(request, env, allowMethods) {
	const allowedOrigins = getAllowedSiteOrigins(env);
	const { origin, requestedHeaders } = getRequestMetadata(request);
	const requestedMethod = normalizeHeaderValue(
		request.headers.get("access-control-request-method"),
	).toUpperCase();

	if (
		!isAllowedOrigin(origin, allowedOrigins) ||
		!requestedMethod ||
		!allowMethods.includes(requestedMethod)
	) {
		return buildBlockedResponse();
	}

	return new Response(null, {
		status: 204,
		headers: buildCorsHeaders(origin, requestedHeaders, allowMethods),
	});
}

