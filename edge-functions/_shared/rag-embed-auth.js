const RAG_EMBED_PROTOCOL_VERSION = 1;
const RAG_EMBED_ISSUER = "mizuki-ynga-blog";
const RAG_EMBED_AUDIENCE = "cloudflare-rag-embed";
const RAG_EMBED_ALLOWED_PATH = "/embed";
const RAG_EMBED_BOOTSTRAP_KIND = "bootstrap";
const RAG_EMBED_SESSION_KIND = "session";
const RAG_EMBED_BOOTSTRAP_TTL_SECONDS = 60;
const RAG_EMBED_SESSION_TTL_SECONDS = 30 * 60;

export const RAG_EMBED_QUERY_PARAM = "embed_token";
export const RAG_EMBED_SESSION_COOKIE_NAME = "rag_embed_session";
const BASE64_ALPHABET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LOOKUP = Object.freeze(
	Object.fromEntries(
		Array.from(BASE64_ALPHABET).map((character, index) => [character, index]),
	),
);

function getCrypto() {
	if (!globalThis.crypto?.subtle) {
		throw new Error("Web Crypto API is not available in this runtime.");
	}

	return globalThis.crypto;
}

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

function toUnixSeconds(now = Date.now()) {
	return Math.floor(now / 1000);
}

function bytesToBase64(bytes) {
	let output = "";

	for (let index = 0; index < bytes.length; index += 3) {
		const first = bytes[index];
		const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
		const third = index + 2 < bytes.length ? bytes[index + 2] : 0;

		const firstChunk = first >> 2;
		const secondChunk = ((first & 0b11) << 4) | (second >> 4);
		const thirdChunk = ((second & 0b1111) << 2) | (third >> 6);
		const fourthChunk = third & 0b111111;

		output += BASE64_ALPHABET[firstChunk];
		output += BASE64_ALPHABET[secondChunk];
		output += index + 1 < bytes.length ? BASE64_ALPHABET[thirdChunk] : "=";
		output += index + 2 < bytes.length ? BASE64_ALPHABET[fourthChunk] : "=";
	}

	return output;
}

function base64ToBytes(value) {
	const normalized = value.replace(/\s+/g, "");
	if (normalized.length % 4 !== 0) {
		throw new Error("Invalid base64 input.");
	}

	const output = [];

	for (let index = 0; index < normalized.length; index += 4) {
		const first = normalized[index];
		const second = normalized[index + 1];
		const third = normalized[index + 2];
		const fourth = normalized[index + 3];

		const firstValue = BASE64_LOOKUP[first];
		const secondValue = BASE64_LOOKUP[second];
		const thirdValue = third === "=" ? 0 : BASE64_LOOKUP[third];
		const fourthValue = fourth === "=" ? 0 : BASE64_LOOKUP[fourth];

		if (
			firstValue === undefined ||
			secondValue === undefined ||
			(third !== "=" && thirdValue === undefined) ||
			(fourth !== "=" && fourthValue === undefined)
		) {
			throw new Error("Invalid base64 input.");
		}

		output.push((firstValue << 2) | (secondValue >> 4));
		if (third !== "=") {
			output.push(((secondValue & 0b1111) << 4) | (thirdValue >> 2));
		}
		if (fourth !== "=") {
			output.push(((thirdValue & 0b11) << 6) | fourthValue);
		}
	}

	return new Uint8Array(output);
}

function toBase64Url(bytes) {
	return bytesToBase64(bytes)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function fromBase64Url(value) {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padding =
		normalized.length % 4 === 0
			? ""
			: "=".repeat(4 - (normalized.length % 4));

	return base64ToBytes(`${normalized}${padding}`);
}

function encodeTokenSegment(value) {
	return toBase64Url(new TextEncoder().encode(value));
}

function decodeTokenSegment(value) {
	return new TextDecoder().decode(fromBase64Url(value));
}

async function signTokenSegment(secret, payloadSegment) {
	const crypto = getCrypto();
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(payloadSegment),
	);

	return toBase64Url(new Uint8Array(signature));
}

function timingSafeEqual(left, right) {
	if (typeof left !== "string" || typeof right !== "string") {
		return false;
	}

	let mismatch = left.length === right.length ? 0 : 1;
	const maxLength = Math.max(left.length, right.length);

	for (let index = 0; index < maxLength; index += 1) {
		const leftCode = left.charCodeAt(index) || 0;
		const rightCode = right.charCodeAt(index) || 0;
		mismatch |= leftCode ^ rightCode;
	}

	return mismatch === 0;
}

function buildTokenPayload({ kind, origin, now, ttlSeconds }) {
	const normalizedOrigin = normalizeOrigin(origin);
	if (!normalizedOrigin) {
		throw new Error("A valid blog origin is required to issue an embed token.");
	}

	const iat = toUnixSeconds(now);
	return {
		v: RAG_EMBED_PROTOCOL_VERSION,
		iss: RAG_EMBED_ISSUER,
		aud: RAG_EMBED_AUDIENCE,
		kind,
		origin: normalizedOrigin,
		path: RAG_EMBED_ALLOWED_PATH,
		iat,
		exp: iat + ttlSeconds,
	};
}

async function issueSignedToken({ secret, payload }) {
	if (typeof secret !== "string" || secret.length === 0) {
		throw new Error("RAG_EMBED_SHARED_SECRET is required.");
	}

	const payloadSegment = encodeTokenSegment(JSON.stringify(payload));
	const signatureSegment = await signTokenSegment(secret, payloadSegment);
	return `${payloadSegment}.${signatureSegment}`;
}

async function verifySignedToken({
	token,
	secret,
	expectedOrigin,
	expectedKind,
	now,
}) {
	if (typeof token !== "string" || token.length === 0) {
		return null;
	}

	if (typeof secret !== "string" || secret.length === 0) {
		return null;
	}

	const segments = token.split(".");
	if (segments.length !== 2) {
		return null;
	}

	const [payloadSegment, signatureSegment] = segments;
	if (!payloadSegment || !signatureSegment) {
		return null;
	}

	const expectedSignature = await signTokenSegment(secret, payloadSegment);
	if (!timingSafeEqual(signatureSegment, expectedSignature)) {
		return null;
	}

	let payload;
	try {
		payload = JSON.parse(decodeTokenSegment(payloadSegment));
	} catch {
		return null;
	}

	const normalizedExpectedOrigin = normalizeOrigin(expectedOrigin);
	const currentTime = toUnixSeconds(now);

	if (
		payload?.v !== RAG_EMBED_PROTOCOL_VERSION ||
		payload?.iss !== RAG_EMBED_ISSUER ||
		payload?.aud !== RAG_EMBED_AUDIENCE ||
		payload?.kind !== expectedKind ||
		payload?.path !== RAG_EMBED_ALLOWED_PATH ||
		payload?.origin !== normalizedExpectedOrigin
	) {
		return null;
	}

	if (
		!Number.isInteger(payload?.iat) ||
		!Number.isInteger(payload?.exp) ||
		payload.iat > currentTime + 5 ||
		payload.exp <= currentTime
	) {
		return null;
	}

	return payload;
}

export async function issueEmbedBootstrapToken({
	secret,
	origin,
	now = Date.now(),
}) {
	return issueSignedToken({
		secret,
		payload: buildTokenPayload({
			kind: RAG_EMBED_BOOTSTRAP_KIND,
			origin,
			now,
			ttlSeconds: RAG_EMBED_BOOTSTRAP_TTL_SECONDS,
		}),
	});
}

export async function verifyEmbedBootstrapToken({
	token,
	secret,
	expectedOrigin,
	now = Date.now(),
}) {
	return verifySignedToken({
		token,
		secret,
		expectedOrigin,
		expectedKind: RAG_EMBED_BOOTSTRAP_KIND,
		now,
	});
}

export async function issueEmbedSessionToken({
	secret,
	origin,
	now = Date.now(),
}) {
	return issueSignedToken({
		secret,
		payload: buildTokenPayload({
			kind: RAG_EMBED_SESSION_KIND,
			origin,
			now,
			ttlSeconds: RAG_EMBED_SESSION_TTL_SECONDS,
		}),
	});
}

export async function verifyEmbedSessionToken({
	token,
	secret,
	expectedOrigin,
	now = Date.now(),
}) {
	return verifySignedToken({
		token,
		secret,
		expectedOrigin,
		expectedKind: RAG_EMBED_SESSION_KIND,
		now,
	});
}

export function buildEmbedSessionCookie(
	token,
	maxAgeSeconds = RAG_EMBED_SESSION_TTL_SECONDS,
) {
	return [
		`${RAG_EMBED_SESSION_COOKIE_NAME}=${token}`,
		"Path=/",
		`Max-Age=${maxAgeSeconds}`,
		"HttpOnly",
		"Secure",
		"SameSite=Strict",
	].join("; ");
}

export function stripEmbedTokenFromUrl(inputUrl) {
	const url = new URL(inputUrl);
	url.searchParams.delete(RAG_EMBED_QUERY_PARAM);
	return url.toString();
}
