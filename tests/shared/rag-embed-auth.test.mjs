import assert from "node:assert/strict";
import test from "node:test";

import {
	RAG_EMBED_SESSION_COOKIE_NAME,
	buildEmbedSessionCookie,
	issueEmbedBootstrapToken,
	issueEmbedSessionToken,
	stripEmbedTokenFromUrl,
	verifyEmbedBootstrapToken,
	verifyEmbedSessionToken,
} from "../../scripts/rag-embed-auth.mjs";

const SHARED_SECRET = "shared-secret-for-tests";
const BLOG_ORIGIN = "https://ynga.kingcola-icg.cn";
const FIXED_NOW = Date.UTC(2026, 4, 15, 3, 30, 0);

test("bootstrap tokens round-trip only for the configured blog origin and embed path", async () => {
	const token = await issueEmbedBootstrapToken({
		secret: SHARED_SECRET,
		origin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});

	const payload = await verifyEmbedBootstrapToken({
		token,
		secret: SHARED_SECRET,
		expectedOrigin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});

	assert.ok(payload);
	assert.equal(payload.origin, BLOG_ORIGIN);
	assert.equal(payload.path, "/embed");
	assert.equal(payload.v, 1);
});

test("tampered or expired bootstrap tokens are rejected", async () => {
	const token = await issueEmbedBootstrapToken({
		secret: SHARED_SECRET,
		origin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});

	const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
	const tamperedPayload = await verifyEmbedBootstrapToken({
		token: tampered,
		secret: SHARED_SECRET,
		expectedOrigin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});
	assert.equal(tamperedPayload, null);

	const expiredPayload = await verifyEmbedBootstrapToken({
		token,
		secret: SHARED_SECRET,
		expectedOrigin: BLOG_ORIGIN,
		now: FIXED_NOW + 120_000,
	});
	assert.equal(expiredPayload, null);
});

test("session tokens build strict host cookies and validate against the expected origin", async () => {
	const token = await issueEmbedSessionToken({
		secret: SHARED_SECRET,
		origin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});

	const cookie = buildEmbedSessionCookie(token);
	assert.match(cookie, new RegExp(`^${RAG_EMBED_SESSION_COOKIE_NAME}=`));
	assert.match(cookie, /Path=\//);
	assert.match(cookie, /HttpOnly/i);
	assert.match(cookie, /Secure/i);
	assert.match(cookie, /SameSite=Strict/i);

	const payload = await verifyEmbedSessionToken({
		token,
		secret: SHARED_SECRET,
		expectedOrigin: BLOG_ORIGIN,
		now: FIXED_NOW,
	});

	assert.ok(payload);
	assert.equal(payload.origin, BLOG_ORIGIN);
});

test("embed token query parameter is stripped without dropping unrelated search params", () => {
	const cleaned = stripEmbedTokenFromUrl(
		"https://rag.ynga.kingcola-icg.cn/embed?theme=dark&embed_token=demo&foo=bar",
	);

	assert.equal(
		cleaned,
		"https://rag.ynga.kingcola-icg.cn/embed?theme=dark&foo=bar",
	);
});
