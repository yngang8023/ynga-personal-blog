import { h } from "hastscript";
import { visit } from "unist-util-visit";

import {
	normalizeWebsiteCardOverride,
	resolveWebsiteCardMetadata,
} from "./website-card-utils.mjs";

const SUPPORTED_SITE_CARD_TAGS = new Set(["site", "website", "linkcard"]);

const createInvalidCardNode = (message) =>
	h("div", { class: "hidden" }, [message]);

const applyWebsiteCardOverrides = (metadata, properties = {}) => {
	const title =
		normalizeWebsiteCardOverride(properties.title || properties.name) ||
		metadata.siteName;
	const description =
		normalizeWebsiteCardOverride(properties.description || properties.desc) ||
		metadata.description;
	const logoUrl =
		normalizeWebsiteCardOverride(
			properties.logo || properties.icon || properties.favicon,
		) || metadata.logoUrl;
	const previewImageUrl =
		normalizeWebsiteCardOverride(
			properties.preview || properties.image || properties.cover,
		) || metadata.previewImageUrl;
	const accentColor =
		normalizeWebsiteCardOverride(
			properties.accent || properties.color || properties.themeColor,
		) || metadata.accentColor;

	return {
		...metadata,
		siteName: title,
		title: normalizeWebsiteCardOverride(properties.pageTitle) || title,
		description,
		logoUrl,
		accentColor,
		themeColor: accentColor || metadata.themeColor,
		previewImageUrl,
		previewAlt:
			normalizeWebsiteCardOverride(properties.previewAlt || properties.imageAlt) ||
			metadata.previewAlt,
	};
};

export const createWebsiteCardNode = (metadata) =>
	h(
		"a",
		{
			class: [
				"card-website",
				"no-styling",
			]
				.filter(Boolean)
				.join(" "),
			href: metadata.url,
			target: "_blank",
			rel: "nofollow noopener noreferrer",
			title: metadata.title || metadata.displayUrl,
			"data-host": metadata.hostname,
			"data-logo-src": metadata.logoUrl,
			"data-logo-caption": `${metadata.siteName || metadata.hostname} logo`,
			"data-accent": metadata.accentColor,
			style: `--wc-accent: ${metadata.accentColor};`,
		},
		[
			h("span", { class: "wc-logo-shell" }, [
				h("img", {
					class: "wc-logo-image",
					src: metadata.logoUrl,
					alt: `${metadata.siteName || metadata.hostname} logo`,
					loading: "lazy",
					decoding: "async",
					referrerpolicy: "no-referrer",
				}),
			]),
			h("span", { class: "wc-body" }, [
				h("span", { class: "wc-content" }, [
					h("span", { class: "wc-meta" }, [
						h("span", { class: "wc-head" }, [
							h("span", { class: "wc-site-name" }, metadata.siteName),
							h("span", { class: "wc-domain-tag" }, metadata.displayHost),
						]),
						h("span", { class: "wc-description" }, metadata.description),
					]),
				]),
				h("span", { class: "wc-url" }, metadata.displayUrl),
			]),
		],
	);

export const rehypeSiteCard = (options = {}) => {
	const { fetchImpl, cache } = options;

	return async (tree) => {
		const targets = [];

		visit(tree, "element", (node, index, parent) => {
			if (
				index === undefined ||
				!parent ||
				!SUPPORTED_SITE_CARD_TAGS.has(node.tagName)
			) {
				return;
			}

			targets.push({ node, index, parent });
		});

		await Promise.all(
			targets.map(async ({ node, index, parent }) => {
				const rawUrl = node.properties?.url || node.properties?.href;

				if (typeof rawUrl !== "string" || !rawUrl.trim()) {
					parent.children[index] = createInvalidCardNode(
						'Invalid directive. ("site" directive must include a valid "url" attribute.)',
					);
					return;
				}

				const metadata = await resolveWebsiteCardMetadata(rawUrl, {
					fetchImpl,
					cache,
				});

				parent.children[index] = createWebsiteCardNode(
					applyWebsiteCardOverrides(metadata, node.properties),
				);
			}),
		);
	};
};
