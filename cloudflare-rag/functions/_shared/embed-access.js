import {
	RAG_EMBED_QUERY_PARAM,
	RAG_EMBED_SESSION_COOKIE_NAME,
	buildEmbedSessionCookie,
	issueEmbedSessionToken,
	verifyEmbedBootstrapToken,
	verifyEmbedSessionToken,
	stripEmbedTokenFromUrl,
} from "./rag-embed-auth.js";

if (
	typeof Response !== "undefined" &&
	typeof Response.text !== "function"
) {
	Response.text = function text(body = "", init = undefined) {
		return new Response(body, init);
	};
}

const NOT_FOUND_HEADERS = {
	"cache-control": "no-store, no-transform",
	"content-type": "text/plain; charset=utf-8",
};

function normalizeOrigin(value) {
	if (typeof value !== "string" || value.trim().length === 0) {
		return null;
	}

	try {
		return new URL(value).origin;
	} catch {
		return null;
	}
}

function getAllowedBlogOrigin(env) {
	return normalizeOrigin(env?.BLOG_SITE_URL);
}

function buildNotFoundResponse() {
	return new Response("Not Found", {
		status: 404,
		headers: NOT_FOUND_HEADERS,
	});
}

function buildMisconfiguredResponse(message) {
	return new Response(message, {
		status: 500,
		headers: {
			"cache-control": "no-store, no-transform",
			"content-type": "text/plain; charset=utf-8",
		},
	});
}

function getCookieValue(request, cookieName) {
	const cookieHeader = request.headers.get("cookie") || "";
	const parts = cookieHeader.split(/;\s*/);

	for (const part of parts) {
		if (!part) {
			continue;
		}

		const separatorIndex = part.indexOf("=");
		if (separatorIndex <= 0) {
			continue;
		}

		const key = part.slice(0, separatorIndex).trim();
		if (key !== cookieName) {
			continue;
		}

		return part.slice(separatorIndex + 1).trim();
	}

	return null;
}

function hasEmbedIframeRequestShape(request, allowedOrigin) {
	const refererOrigin = normalizeOrigin(request.headers.get("referer"));
	const secFetchDest = (request.headers.get("sec-fetch-dest") || "")
		.trim()
		.toLowerCase();
	const secFetchSite = (request.headers.get("sec-fetch-site") || "")
		.trim()
		.toLowerCase();

	if (secFetchDest !== "iframe") {
		return false;
	}

	if (!refererOrigin || refererOrigin !== allowedOrigin) {
		return false;
	}

	return secFetchSite === "same-site" || secFetchSite === "same-origin";
}

function mergeFrameAncestorsPolicy(existingPolicy, allowedOrigin) {
	const frameAncestorsDirective = `frame-ancestors ${allowedOrigin}`;
	if (typeof existingPolicy !== "string" || existingPolicy.trim().length === 0) {
		return frameAncestorsDirective;
	}

	const directives = existingPolicy
		.split(";")
		.map((directive) => directive.trim())
		.filter(Boolean)
		.filter((directive) => !directive.toLowerCase().startsWith("frame-ancestors "));

	directives.push(frameAncestorsDirective);
	return directives.join("; ");
}

function finalizeEmbedPageResponse(response, allowedOrigin) {
	const headers = new Headers(response.headers);
	headers.set(
		"content-security-policy",
		mergeFrameAncestorsPolicy(
			headers.get("content-security-policy"),
			allowedOrigin,
		),
	);
	headers.set("cache-control", "no-store, no-transform");
	headers.set(
		"vary",
		"Cookie, Referer, Sec-Fetch-Dest, Sec-Fetch-Site",
	);

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export async function authorizeEmbedPageRequest({
	request,
	env,
	now = Date.now(),
	renderAuthorized,
}) {
	const allowedOrigin = getAllowedBlogOrigin(env);
	if (!allowedOrigin) {
		return buildMisconfiguredResponse("BLOG_SITE_URL is not configured.");
	}

	if (
		typeof env?.RAG_EMBED_SHARED_SECRET !== "string" ||
		env.RAG_EMBED_SHARED_SECRET.length === 0
	) {
		return buildMisconfiguredResponse(
			"RAG_EMBED_SHARED_SECRET is not configured.",
		);
	}

	if (!hasEmbedIframeRequestShape(request, allowedOrigin)) {
		return buildNotFoundResponse();
	}

	const sessionToken = getCookieValue(request, RAG_EMBED_SESSION_COOKIE_NAME);
	if (sessionToken) {
		const sessionPayload = await verifyEmbedSessionToken({
			token: sessionToken,
			secret: env.RAG_EMBED_SHARED_SECRET,
			expectedOrigin: allowedOrigin,
			now,
		});

		if (sessionPayload) {
			const response = await renderAuthorized();
			return finalizeEmbedPageResponse(response, allowedOrigin);
		}
	}

	const url = new URL(request.url);
	const embedToken = url.searchParams.get(RAG_EMBED_QUERY_PARAM);
	if (!embedToken) {
		return buildNotFoundResponse();
	}

	const bootstrapPayload = await verifyEmbedBootstrapToken({
		token: embedToken,
		secret: env.RAG_EMBED_SHARED_SECRET,
		expectedOrigin: allowedOrigin,
		now,
	});
	if (!bootstrapPayload) {
		return buildNotFoundResponse();
	}

	const renewedSessionToken = await issueEmbedSessionToken({
		secret: env.RAG_EMBED_SHARED_SECRET,
		origin: allowedOrigin,
		now,
	});

	return new Response(null, {
		status: 302,
		headers: {
			location: stripEmbedTokenFromUrl(request.url),
			"set-cookie": buildEmbedSessionCookie(renewedSessionToken),
			"cache-control": "no-store, no-transform",
		},
	});
}

export async function authorizeEmbedStreamRequest({
	request,
	env,
	now = Date.now(),
}) {
	const allowedOrigin = getAllowedBlogOrigin(env);
	if (!allowedOrigin) {
		return {
			ok: false,
			response: buildMisconfiguredResponse("BLOG_SITE_URL is not configured."),
		};
	}

	if (
		typeof env?.RAG_EMBED_SHARED_SECRET !== "string" ||
		env.RAG_EMBED_SHARED_SECRET.length === 0
	) {
		return {
			ok: false,
			response: buildMisconfiguredResponse(
				"RAG_EMBED_SHARED_SECRET is not configured.",
			),
		};
	}

	const sessionToken = getCookieValue(request, RAG_EMBED_SESSION_COOKIE_NAME);
	if (!sessionToken) {
		return {
			ok: false,
			response: buildNotFoundResponse(),
		};
	}

	const sessionPayload = await verifyEmbedSessionToken({
		token: sessionToken,
		secret: env.RAG_EMBED_SHARED_SECRET,
		expectedOrigin: allowedOrigin,
		now,
	});
	if (!sessionPayload) {
		return {
			ok: false,
			response: buildNotFoundResponse(),
		};
	}

	const renewedSessionToken = await issueEmbedSessionToken({
		secret: env.RAG_EMBED_SHARED_SECRET,
		origin: allowedOrigin,
		now,
	});

	return {
		ok: true,
		renewedSessionCookie: buildEmbedSessionCookie(renewedSessionToken),
	};
}
