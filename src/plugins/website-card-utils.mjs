import { parse } from "node-html-parser";

const DEFAULT_FETCH_TIMEOUT_MS = 6000;
const metadataCache = new Map();

const URL_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;

const trimText = (value = "") =>
	value.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();

const normalizeHexColor = (value = "") => {
	const input = trimText(value).replace(/^#/, "");

	if (/^[0-9a-fA-F]{3}$/.test(input)) {
		return `#${input
			.split("")
			.map((char) => char + char)
			.join("")
			.toLowerCase()}`;
	}

	if (/^[0-9a-fA-F]{6}$/.test(input)) {
		return `#${input.toLowerCase()}`;
	}

	return "";
};

const hslToHex = (hue, saturation, lightness) => {
	const s = saturation / 100;
	const l = lightness / 100;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
	const m = l - c / 2;

	let red = 0;
	let green = 0;
	let blue = 0;

	if (hue < 60) {
		red = c;
		green = x;
	} else if (hue < 120) {
		red = x;
		green = c;
	} else if (hue < 180) {
		green = c;
		blue = x;
	} else if (hue < 240) {
		green = x;
		blue = c;
	} else if (hue < 300) {
		red = x;
		blue = c;
	} else {
		red = c;
		blue = x;
	}

	const toHex = (channel) =>
		Math.round((channel + m) * 255)
			.toString(16)
			.padStart(2, "0");

	return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const getHostnameAccentColor = (hostname) => {
	const normalized = trimText(hostname).toLowerCase();

	let hash = 0;
	for (const char of normalized) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}

	const hue = hash % 360;
	return hslToHex(hue, 58, 52);
};

const getPrimaryHostnameLabel = (hostname) => {
	const [firstSegment = ""] = trimText(hostname).split(".");
	return firstSegment.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "WS";
};

const buildInlineFaviconSvg = (hostname, accentColor) => {
	const label = getPrimaryHostnameLabel(hostname);
	const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${hostname}">
	<defs>
		<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
			<stop offset="0%" stop-color="${accentColor}" />
			<stop offset="100%" stop-color="#ffffff" stop-opacity="0.18" />
		</linearGradient>
	</defs>
	<rect width="128" height="128" rx="30" fill="#101827" />
	<rect x="8" y="8" width="112" height="112" rx="24" fill="url(#g)" />
	<text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="44" font-weight="700" fill="#ffffff">${label}</text>
</svg>`;

	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const stripWwwPrefix = (hostname = "") => hostname.replace(/^www\./i, "");

const getUrlPathSummary = (url) => {
	const pathname = trimText(url.pathname || "/");

	if (!pathname || pathname === "/") {
		return "首页";
	}

	return pathname.replace(/\/+$/, "") || "/";
};

const buildPreviewHint = (hostname) => `站点预览 · ${hostname}`;

export const normalizeWebsiteCardUrl = (value) => {
	const input = String(value ?? "").trim();

	if (!input) {
		throw new Error("Website card url is required");
	}

	const normalizedInput = URL_PROTOCOL_PATTERN.test(input)
		? input
		: `https://${input.replace(/^\/\//, "")}`;

	const url = new URL(normalizedInput);
	url.hash = "";

	return url;
};

export const createWebsiteCardFallbackMetadata = (urlInput) => {
	const url = normalizeWebsiteCardUrl(urlInput);
	const normalizedUrl = url.toString();
	const hostname = stripWwwPrefix(url.hostname);
	const accentColor = getHostnameAccentColor(hostname);
	const pathSummary = getUrlPathSummary(url);

	return {
		url: normalizedUrl,
		displayUrl: normalizedUrl,
		displayHost: hostname,
		hostname,
		siteName: hostname,
		title: hostname,
		description: `访问 ${hostname}${pathSummary === "首页" ? "" : ` 的 ${pathSummary}`}`,
		logoUrl: buildInlineFaviconSvg(hostname, accentColor),
		accentColor,
		themeColor: "",
		previewImageUrl: "",
		previewAlt: buildPreviewHint(hostname),
	};
};

export const normalizeWebsiteCardOverride = (value) => {
	const normalized = trimText(String(value ?? ""));
	return normalized || "";
};

const queryMetaContent = (root, selectors) => {
	for (const selector of selectors) {
		const value = root.querySelector(selector)?.getAttribute("content");
		const normalized = trimText(value ?? "");

		if (normalized) {
			return normalized;
		}
	}

	return "";
};

const queryLinkHref = (root, selectors) => {
	for (const selector of selectors) {
		const href = root.querySelector(selector)?.getAttribute("href");
		const normalized = trimText(href ?? "");

		if (normalized) {
			return normalized;
		}
	}

	return "";
};

const queryFirstImageSrc = (root, selectors, baseUrl) => {
	const candidates = [];

	for (const selector of selectors) {
		const nodes = root.querySelectorAll(selector);
		for (const node of nodes) {
			const src =
				node.getAttribute("src") || node.getAttribute("data-src") || "";
			const normalized = trimText(src);
			if (!normalized) {
				continue;
			}

			const alt = trimText(node.getAttribute("alt") || "");
			const resolved = resolveAssetUrl(normalized, baseUrl);
			if (!resolved) {
				continue;
			}

			candidates.push({ src: resolved, alt });
		}
	}

	const baseHost = new URL(baseUrl).hostname;
	const preferredCandidate = candidates.find((candidate) => {
		try {
			const hostname = new URL(candidate.src).hostname;
			return (
				hostname === baseHost &&
				!/logo|icon|avatar|favicon/i.test(candidate.alt)
			);
		} catch {
			return false;
		}
	});

	if (preferredCandidate) {
		return preferredCandidate.src;
	}

	return candidates[0]?.src || "";
};

const resolveAssetUrl = (value, baseUrl) => {
	if (!value) {
		return "";
	}

	try {
		return new URL(value, baseUrl).toString();
	} catch {
		return "";
	}
};

const createDescription = ({ description, title, fallbackDescription }) =>
	description || title || fallbackDescription;

export const extractWebsiteCardMetadataFromHtml = (html, urlInput) => {
	const fallback = createWebsiteCardFallbackMetadata(urlInput);
	const root = parse(String(html ?? ""));
	const titleText = trimText(root.querySelector("title")?.text ?? "");

	const siteName =
		queryMetaContent(root, [
			'meta[property="og:site_name"]',
			'meta[name="application-name"]',
			'meta[name="apple-mobile-web-app-title"]',
		]) ||
		titleText ||
		fallback.siteName;

	const title =
		queryMetaContent(root, [
			'meta[property="og:title"]',
			'meta[name="twitter:title"]',
		]) || titleText || siteName || fallback.title;

	const description = createDescription({
		description: queryMetaContent(root, [
			'meta[property="og:description"]',
			'meta[name="description"]',
			'meta[name="twitter:description"]',
			'meta[name="keywords"]',
		]),
		title,
		fallbackDescription: fallback.description,
	});

	const iconHref = queryLinkHref(root, [
		'link[rel="apple-touch-icon"]',
		'link[rel="apple-touch-icon-precomposed"]',
		'link[rel="icon"]',
		'link[rel="shortcut icon"]',
		'link[rel="mask-icon"]',
	]);

	const logoUrl =
		resolveAssetUrl(iconHref, fallback.url) || fallback.logoUrl;

	const previewImageUrl =
		resolveAssetUrl(
			queryMetaContent(root, [
				'meta[property="og:image"]',
				'meta[name="twitter:image"]',
			]),
			fallback.url,
		) ||
		resolveAssetUrl(
			queryFirstImageSrc(root, [
				'main img',
				'article img',
				'body img',
			], fallback.url),
			fallback.url,
		) ||
		"";

	const themeColor = normalizeHexColor(
		queryMetaContent(root, [
			'meta[name="theme-color"]',
			'meta[name="msapplication-TileColor"]',
		]),
	);

	return {
		...fallback,
		siteName,
		title,
		description,
		logoUrl,
		themeColor,
		accentColor: themeColor || fallback.accentColor,
		previewImageUrl,
	};
};

export const resolveWebsiteCardMetadata = async (
	urlInput,
	{ fetchImpl = globalThis.fetch, cache = metadataCache } = {},
) => {
	const normalizedUrl = normalizeWebsiteCardUrl(urlInput).toString();

	if (cache.has(normalizedUrl)) {
		return cache.get(normalizedUrl);
	}

	const metadataPromise = (async () => {
		const fallback = createWebsiteCardFallbackMetadata(normalizedUrl);

		if (typeof fetchImpl !== "function") {
			return fallback;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(
			() => controller.abort(),
			DEFAULT_FETCH_TIMEOUT_MS,
		);

		try {
			const response = await fetchImpl(normalizedUrl, {
				headers: {
					accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					"user-agent":
						"Mozilla/5.0 (compatible; MizukiWebsiteCard/1.0; +https://ynga.kingcola-icg.cn/)",
				},
				redirect: "follow",
				signal: controller.signal,
			});

			if (!response?.ok) {
				return fallback;
			}

			const contentType = response.headers?.get?.("content-type") ?? "";
			if (
				contentType &&
				!contentType.includes("text/html") &&
				!contentType.includes("application/xhtml+xml")
			) {
				return fallback;
			}

			const html = await response.text();
			return extractWebsiteCardMetadataFromHtml(html, normalizedUrl);
		} catch {
			return fallback;
		} finally {
			clearTimeout(timeoutId);
		}
	})();

	cache.set(normalizedUrl, metadataPromise);

	return metadataPromise;
};
