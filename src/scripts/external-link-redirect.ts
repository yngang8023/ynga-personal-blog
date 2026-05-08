import { siteConfig } from "../config";

declare global {
	interface Window {
		__hiyngaExternalRedirectInitialized?: boolean;
		__hiyngaExternalRedirectObserver?: MutationObserver;
		__hiyngaExternalRedirectSwupHooksBound?: boolean;
	}
}

interface ExternalLinkPayload {
	url: string;
	hostname: string;
	title?: string;
}

const BYPASS_ATTR = "data-bypass-external-redirect";
const EXTERNAL_LINK_MODAL_ENABLED = siteConfig.externalLink?.enable !== false;

function createExternalLinkRedirect() {
	if (typeof window === "undefined" || window.__hiyngaExternalRedirectInitialized) {
		return;
	}

	window.__hiyngaExternalRedirectInitialized = true;

	const internalHosts = new Set<string>([window.location.host]);

	try {
		internalHosts.add(new URL(siteConfig.siteURL).host);
	} catch {
		// Ignore invalid configured site URLs and fall back to current host only.
	}

	const resolveExternalHref = (
		anchor: HTMLAnchorElement,
	): string | null => {
		if (
			anchor.hasAttribute(BYPASS_ATTR) ||
			anchor.closest(`[${BYPASS_ATTR}]`) ||
			anchor.hasAttribute("download")
		) {
			return null;
		}

		const rawHref = anchor.getAttribute("href");
		if (!rawHref || rawHref.startsWith("#")) {
			return null;
		}

		let resolvedUrl: URL;
		try {
			resolvedUrl = new URL(rawHref, window.location.href);
		} catch {
			return null;
		}

		if (!/^https?:$/.test(resolvedUrl.protocol)) {
			return null;
		}

		if (internalHosts.has(resolvedUrl.host)) {
			return null;
		}

		return resolvedUrl.toString();
	};

	const annotateAnchor = (anchor: HTMLAnchorElement) => {
		const externalHref = resolveExternalHref(anchor);
		if (!externalHref) {
			return;
		}

		anchor.setAttribute("target", "_blank");

		const currentRel = (anchor.getAttribute("rel") || "")
			.split(/\s+/)
			.filter(Boolean);
		const nextRel = Array.from(
			new Set([...currentRel, "noopener", "noreferrer"]),
		).join(" ");
		anchor.setAttribute("rel", nextRel);

		anchor.dataset.externalOriginalHref = externalHref;
	};

	const annotateExternalLinks = (root: ParentNode | HTMLAnchorElement) => {
		if (root instanceof HTMLAnchorElement) {
			annotateAnchor(root);
			return;
		}

		root.querySelectorAll("a[href]").forEach((anchor) => {
			if (anchor instanceof HTMLAnchorElement) {
				annotateAnchor(anchor);
			}
		});
	};

	let scheduled = false;
	const scheduleAnnotation = () => {
		if (scheduled) {
			return;
		}

		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			annotateExternalLinks(document);
		});
	};

	const bindSwupHooks = () => {
		if (
			window.__hiyngaExternalRedirectSwupHooksBound ||
			!window.swup?.hooks
		) {
			return;
		}

		window.__hiyngaExternalRedirectSwupHooksBound = true;
		window.swup.hooks.on("content:replace", scheduleAnnotation);
		window.swup.hooks.on("page:view", scheduleAnnotation);
	};

	const dispatchModal = (payload: ExternalLinkPayload) => {
		document.dispatchEvent(
			new CustomEvent<ExternalLinkPayload>("external-link:open-modal", {
				detail: payload,
			}),
		);
	};

	const handleModalClick = (event: MouseEvent) => {
		if (
			!EXTERNAL_LINK_MODAL_ENABLED ||
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}

		const target = event.target;
		if (!(target instanceof Element)) {
			return;
		}

		const anchor = target.closest("a[href]");
		if (!(anchor instanceof HTMLAnchorElement)) {
			return;
		}

		const externalHref =
			anchor.dataset.externalOriginalHref || resolveExternalHref(anchor);
		if (!externalHref) {
			return;
		}

		event.preventDefault();

		let hostname = externalHref;
		try {
			hostname = new URL(externalHref).hostname;
		} catch {
			// Keep raw external href when parsing fails unexpectedly.
		}

		dispatchModal({
			url: externalHref,
			hostname,
			title: anchor.textContent?.trim() || undefined,
		});
	};

	const init = () => {
		annotateExternalLinks(document);

		if (!window.__hiyngaExternalRedirectObserver && document.body) {
			window.__hiyngaExternalRedirectObserver = new MutationObserver(
				(mutations) => {
					for (const mutation of mutations) {
						if (mutation.type === "childList") {
							mutation.addedNodes.forEach((node) => {
								if (node instanceof HTMLAnchorElement) {
									annotateExternalLinks(node);
								} else if (node instanceof HTMLElement) {
									annotateExternalLinks(node);
								}
							});
						} else if (
							mutation.type === "attributes" &&
							mutation.target instanceof HTMLAnchorElement
						) {
							annotateExternalLinks(mutation.target);
						}
					}
				},
			);

			window.__hiyngaExternalRedirectObserver.observe(document.body, {
				subtree: true,
				childList: true,
				attributes: true,
				attributeFilter: ["href"],
			});
		}

		bindSwupHooks();
		document.addEventListener("swup:enable", bindSwupHooks, { once: true });

		if (EXTERNAL_LINK_MODAL_ENABLED) {
			document.addEventListener("click", handleModalClick, true);
		}
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
}

createExternalLinkRedirect();
