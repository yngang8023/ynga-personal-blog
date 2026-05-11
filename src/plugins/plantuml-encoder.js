import { deflateRawSync } from "node:zlib";

const PLANTUML_ALPHABET =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function encode6bit(value) {
	return PLANTUML_ALPHABET.charAt(value & 0x3f);
}

function append3bytes(b1, b2, b3) {
	const c1 = b1 >> 2;
	const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
	const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
	const c4 = b3 & 0x3f;
	return encode6bit(c1) + encode6bit(c2) + encode6bit(c3) + encode6bit(c4);
}

function encode64(bytes) {
	let result = "";

	for (let i = 0; i < bytes.length; i += 3) {
		if (i + 2 === bytes.length) {
			result += append3bytes(bytes[i], bytes[i + 1], 0);
		} else if (i + 1 === bytes.length) {
			result += append3bytes(bytes[i], 0, 0);
		} else {
			result += append3bytes(bytes[i], bytes[i + 1], bytes[i + 2]);
		}
	}

	return result;
}

export function encodePlantUML(source) {
	if (typeof source !== "string") {
		throw new TypeError(
			`encodePlantUML expects a string, got ${typeof source}`,
		);
	}

	const utf8Bytes = new TextEncoder().encode(source);
	const deflated = deflateRawSync(utf8Bytes, { level: 9 });
	return encode64(deflated);
}

function hasExplicitTheme(source) {
	return /^\s*!theme\s+\S+/m.test(source);
}

function hasExplicitBackgroundColor(source) {
	return /^\s*skinparam\s+backgroundColor\b/im.test(source);
}

function injectDirective(source, directive) {
	const normalizedDirective = directive?.trim();
	if (!normalizedDirective) {
		return source;
	}

	const startumlMatch = source.match(/^[^\S\r\n]*@startuml[^\r\n]*\r?\n?/);

	if (startumlMatch) {
		const insertAt = startumlMatch.index + startumlMatch[0].length;
		return `${source.slice(0, insertAt)}${normalizedDirective}\n${source.slice(insertAt)}`;
	}

	return `${normalizedDirective}\n${source}`;
}

export function injectTheme(source, themeName) {
	if (typeof source !== "string") {
		throw new TypeError(
			`injectTheme expects a string source, got ${typeof source}`,
		);
	}

	if (!themeName?.trim() || hasExplicitTheme(source)) {
		return source;
	}

	return injectDirective(source, `!theme ${themeName.trim()}`);
}

export function injectBackgroundColor(source, backgroundColor) {
	if (typeof source !== "string") {
		throw new TypeError(
			`injectBackgroundColor expects a string source, got ${typeof source}`,
		);
	}

	if (!backgroundColor?.trim() || hasExplicitBackgroundColor(source)) {
		return source;
	}

	return injectDirective(
		source,
		`skinparam backgroundColor ${backgroundColor.trim()}`,
	);
}

export function buildUrl(server, encoded) {
	if (typeof server !== "string" || !server.trim()) {
		throw new TypeError("buildUrl expects a non-empty server string");
	}

	if (typeof encoded !== "string" || !encoded.trim()) {
		throw new TypeError("buildUrl expects a non-empty encoded string");
	}

	const normalizedServer = server.replace(/\/+$/, "");
	return `${normalizedServer}/svg/${encoded}`;
}
