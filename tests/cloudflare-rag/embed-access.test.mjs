import assert from "node:assert/strict";
import test from "node:test";

import {
	authorizeEmbedPageRequest,
	authorizeEmbedStreamRequest,
} from "../../cloudflare-rag/functions/_shared/embed-access.js";
import {
	RAG_EMBED_QUERY_PARAM,
	RAG_EMBED_SESSION_COOKIE_NAME,
	buildEmbedSessionCookie,
	issueEmbedBootstrapToken,
	issueEmbedSessionToken,
	verifyEmbedSessionToken,
} from "../../cloudflare-rag/functions/_shared/rag-embed-auth.js";

const SHARED_SECRET = "shared-secret-for-tests";
const BLOG_ORIGIN = "https://ynga.kingcola-icg.cn";
const RAG_ORIGIN = "https://rag.ynga.kingcola-icg.cn";
const FIXED_NOW = Date.UTC(2026, 4, 15, 4, 0, 0);

const env = {
	BLOG_SITE_URL: `${BLOG_ORIGIN}/`,
	RAG_EMBED_SHARED_SECRET: SHARED_SECRET,
};

test("embed page access returns 404 for direct top-level document requests", async () => {
	const response = await authorizeEmbedPageRequest({
		request: new Request(`${RAG_ORIGIN}/embed`),
		env,
		now: FIXED_NOW,
		renderAuthorized: async () => Response.text("ok"),
	});

	assert.equal(response.status, 404);
	assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("valid bootstrap token establishes a session and redirects to a clean embed URL", async () => {
	const token = await issueEmbedBootstrapToken({
		secret: SHARED_SECRET,
		origin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});

	const response = await authorizeEmbedPageRequest({
		request: new Request(
			`${RAG_ORIGIN}/embed?theme=dark&${RAG_EMBED_QUERY_PARAM}=${encodeURIComponent(token)}`,
			{
				headers: {
					referer: `${BLOG_ORIGIN}/posts/security-demo/`,
					"sec-fetch-site": "same-site",
					"sec-fetch-dest": "iframe",
				},
			},
		),
		env,
		now: FIXED_NOW,
		renderAuthorized: async () => Response.text("ok"),
	});

	assert.equal(response.status, 302);

	const location = response.headers.get("location") ?? "";
	assert.equal(
		location,
		"/embed?theme=dark",
	);

	const setCookie = response.headers.get("set-cookie") ?? "";
	assert.match(setCookie, new RegExp(`^${RAG_EMBED_SESSION_COOKIE_NAME}=`));
	assert.match(setCookie, /HttpOnly/i);
	assert.match(setCookie, /Secure/i);
	assert.match(setCookie, /SameSite=Strict/i);
});

test("bootstrap redirect stays on the current host even when the origin request host differs", async () => {
	const token = await issueEmbedBootstrapToken({
		secret: SHARED_SECRET,
		origin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});

	const response = await authorizeEmbedPageRequest({
		request: new Request(
			`https://cloudflare-rag-1mw.pages.dev/embed?theme=dark&${RAG_EMBED_QUERY_PARAM}=${encodeURIComponent(token)}`,
			{
				headers: {
					referer: `${BLOG_ORIGIN}/posts/security-demo/`,
					"sec-fetch-site": "same-site",
					"sec-fetch-dest": "iframe",
				},
			},
		),
		env,
		now: FIXED_NOW,
		renderAuthorized: async () => Response.text("ok"),
	});

	assert.equal(response.status, 302);
	assert.equal(response.headers.get("location"), "/embed?theme=dark");
});

test("valid iframe session allows embed rendering and adds frame-ancestors protection", async () => {
	const sessionToken = await issueEmbedSessionToken({
		secret: SHARED_SECRET,
		origin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});

	const response = await authorizeEmbedPageRequest({
		request: new Request(`${RAG_ORIGIN}/embed?theme=light`, {
			headers: {
				cookie: buildEmbedSessionCookie(sessionToken),
				referer: `${BLOG_ORIGIN}/posts/security-demo/`,
				"sec-fetch-site": "same-site",
				"sec-fetch-dest": "iframe",
			},
		}),
		env,
		now: FIXED_NOW,
		renderAuthorized: async () => Response.text("embedded"),
	});

	assert.equal(response.status, 200);
	assert.equal(await response.text(), "embedded");
	assert.match(
		response.headers.get("content-security-policy") ?? "",
		/frame-ancestors https:\/\/ynga\.kingcola-icg\.cn/,
	);
});

test("embed page access still returns 404 when a valid session is used outside an iframe", async () => {
	const sessionToken = await issueEmbedSessionToken({
		secret: SHARED_SECRET,
		origin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});

	const response = await authorizeEmbedPageRequest({
		request: new Request(`${RAG_ORIGIN}/embed`, {
			headers: {
				cookie: buildEmbedSessionCookie(sessionToken),
				"sec-fetch-site": "none",
				"sec-fetch-dest": "document",
			},
		}),
		env,
		now: FIXED_NOW,
		renderAuthorized: async () => Response.text("embedded"),
	});

	assert.equal(response.status, 404);
});

test("stream access rejects missing sessions and renews valid sessions", async () => {
	const blocked = await authorizeEmbedStreamRequest({
		request: new Request(`${RAG_ORIGIN}/api/stream`, {
			method: "POST",
		}),
		env,
		now: FIXED_NOW,
	});

	assert.equal(blocked.ok, false);
	assert.equal(blocked.response.status, 404);

	const sessionToken = await issueEmbedSessionToken({
		secret: SHARED_SECRET,
		origin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});

	const authorized = await authorizeEmbedStreamRequest({
		request: new Request(`${RAG_ORIGIN}/api/stream`, {
			method: "POST",
			headers: {
				cookie: buildEmbedSessionCookie(sessionToken),
			},
		}),
		env,
		now: FIXED_NOW + 10_000,
	});

	assert.equal(authorized.ok, true);
	assert.equal(typeof authorized.renewedSessionCookie, "string");

	const renewedToken = authorized.renewedSessionCookie
		.split(";")[0]
		.split("=")[1];
	const renewedPayload = await verifyEmbedSessionToken({
		token: renewedToken,
		secret: SHARED_SECRET,
		expectedOrigin: BLOG_ORIGIN,
		now: FIXED_NOW + 10_000,
	});

	assert.ok(renewedPayload);
	assert.equal(renewedPayload.origin, BLOG_ORIGIN);
});
