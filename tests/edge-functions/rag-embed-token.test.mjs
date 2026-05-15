import assert from "node:assert/strict";
import test from "node:test";

import { verifyEmbedBootstrapToken } from "../../edge-functions/_shared/rag-embed-auth.js";
import { onRequest } from "../../edge-functions/rag-embed-token/proxy.js";

const SHARED_SECRET = "shared-secret-for-tests";
const ALLOWED_ORIGIN = "https://ynga.kingcola-icg.cn";
const ALLOWED_REFERER = `${ALLOWED_ORIGIN}/posts/security-demo/`;

test("rag embed token endpoint issues a short-lived bootstrap token for same-origin requests", async () => {
	const response = await onRequest({
		request: new Request("https://ynga.kingcola-icg.cn/rag-embed-token", {
			headers: {
				referer: ALLOWED_REFERER,
				"sec-fetch-site": "same-origin",
			},
		}),
		env: {
			RAG_EMBED_SHARED_SECRET: SHARED_SECRET,
		},
	});

	assert.equal(response.status, 200);
	assert.match(response.headers.get("cache-control") ?? "", /no-store/);
	assert.match(
		response.headers.get("content-type") ?? "",
		/application\/json/i,
	);

	const payload = await response.json();
	assert.equal(typeof payload.token, "string");
	assert.equal(typeof payload.expiresAt, "number");

	const verified = await verifyEmbedBootstrapToken({
		token: payload.token,
		secret: SHARED_SECRET,
		expectedOrigin: ALLOWED_ORIGIN,
		now: Date.now(),
	});

	assert.ok(verified);
	assert.equal(verified.origin, ALLOWED_ORIGIN);
	assert.equal(verified.path, "/embed");
});

test("rag embed token endpoint rejects cross-site requests", async () => {
	const response = await onRequest({
		request: new Request("https://ynga.kingcola-icg.cn/rag-embed-token", {
			headers: {
				referer: "https://attacker.example/embed/",
				origin: "https://attacker.example",
				"sec-fetch-site": "cross-site",
			},
		}),
		env: {
			RAG_EMBED_SHARED_SECRET: SHARED_SECRET,
		},
	});

	assert.equal(response.status, 403);
	assert.equal(response.headers.get("x-edge-guard"), "blocked");
	assert.match(await response.text(), /forbidden/i);
});
