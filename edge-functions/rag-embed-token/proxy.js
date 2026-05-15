import {
	issueEmbedBootstrapToken,
} from "../_shared/rag-embed-auth.js";
import {
	ALLOWED_BLOG_ORIGIN,
	EDGE_BLOCKED_RESPONSE_HEADERS,
} from "../config.js";

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

function buildBlockedResponse(reason = "Forbidden") {
	return new Response(reason, {
		status: 403,
		headers: EDGE_BLOCKED_RESPONSE_HEADERS,
	});
}

function buildMethodNotAllowedResponse() {
	return new Response("Method Not Allowed", {
		status: 405,
		headers: {
			allow: "GET",
			"cache-control": "no-store, no-transform",
			"content-type": "text/plain; charset=utf-8",
			"x-edge-guard": "method-not-allowed",
		},
	});
}

function isAllowedSameOriginRequest(request, requestOrigin) {
	const origin = normalizeOrigin(request.headers.get("origin"));
	const refererOrigin = normalizeOrigin(request.headers.get("referer"));
	const secFetchSite = (request.headers.get("sec-fetch-site") || "")
		.trim()
		.toLowerCase();

	if (requestOrigin !== ALLOWED_BLOG_ORIGIN) {
		return false;
	}

	if (secFetchSite !== "same-origin") {
		return false;
	}

	if (origin && origin !== ALLOWED_BLOG_ORIGIN) {
		return false;
	}

	if (refererOrigin && refererOrigin !== ALLOWED_BLOG_ORIGIN) {
		return false;
	}

	return true;
}

export async function onRequest(context) {
	const { request, env } = context;

	if (request.method !== "GET") {
		return buildMethodNotAllowedResponse();
	}

	const requestOrigin = new URL(request.url).origin;
	if (!isAllowedSameOriginRequest(request, requestOrigin)) {
		return buildBlockedResponse();
	}

	if (
		typeof env?.RAG_EMBED_SHARED_SECRET !== "string" ||
		env.RAG_EMBED_SHARED_SECRET.length === 0
	) {
		return new Response("RAG_EMBED_SHARED_SECRET is not configured.", {
			status: 500,
			headers: {
				"cache-control": "no-store, no-transform",
				"content-type": "text/plain; charset=utf-8",
				"x-edge-guard": "misconfigured",
			},
		});
	}

	const now = Date.now();
	const token = await issueEmbedBootstrapToken({
		secret: env.RAG_EMBED_SHARED_SECRET,
		origin: ALLOWED_BLOG_ORIGIN,
		now,
	});

	return Response.json(
		{
			token,
			expiresAt: now + 60_000,
		},
		{
			headers: {
				"cache-control": "no-store, no-transform",
				"content-type": "application/json; charset=utf-8",
			},
		},
	);
}
