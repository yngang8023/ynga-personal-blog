export {};

declare global {
	interface HTMLElementTagNameMap {
		"table-of-contents": HTMLElement & {
			init?: () => void;
			regenerateTOC?: () => void;
		};
	}

	/**
	 * Swup hooks interface for type-safe swup access
	 */
	interface Swup {
		hooks: {
			on: (event: string, handler: (...args: unknown[]) => void) => void;
			off: (event: string, handler: (...args: unknown[]) => void) => void;
		};
		navigate?: (url: string, options?: { history?: boolean }) => void;
		preload?: (url: string) => Promise<void>;
	}

	/**
	 * Site config TOC section interface
	 */
	interface SiteConfigTOC {
		enable?: boolean;
		mode?: "float" | "sidebar";
		depth?: number;
		useJapaneseBadge?: boolean;
	}

	/**
	 * Site config interface for type-safe global siteConfig access
	 */
	interface SiteConfigWindow {
		lang?: string;
		toc?: SiteConfigTOC;
		wallpaperMode?: {
			defaultMode?: "banner" | "fullscreen" | "none";
		};
	}

	interface Window {
		swup: Swup | undefined;
		closeAnnouncement: () => void;
		oddmisc?: {
			getStats: (path?: string) => Promise<{
				pageviews: number;
				visitors: number;
				visits: number;
			}>;
			getSiteStats: () => Promise<{
				pageviews: number;
				visitors: number;
				visits: number;
			}>;
			getPageStats: (path?: string) => Promise<{
				pageviews: number;
				visitors: number;
				visits: number;
			}>;
			clearCache: () => void;
			umami?: {
				clearCache: () => void;
			};
		};
		pagefind: {
			search: (query: string) => Promise<{
				results: {
					data: () => Promise<SearchResult>;
				}[];
			}>;
		};

		loadPagefind?: () => Promise<void>;
		toggleFloatingTOC?: () => void;
		mobileTOCInit?: () => void;
		initSemifullScrollDetection?: () => void;
		iconifyLoaded?: boolean;

		// CardTOC manager
		CardTOC?: {
			manager: {
				init?: () => void;
				cleanup?: () => void;
			} | null;
		};

		// TOC internal navigation flag
		tocInternalNavigation?: boolean;
		__iconifyLoader?: {
			load: () => Promise<void>;
			addToPreloadQueue: (icons: string[]) => void;
			onLoad: (callback: () => void) => void;
			isLoaded: boolean;
		};
		siteConfig: SiteConfigWindow;
		hljs?: {
			highlightElement: (block: HTMLElement) => void;
		};
		renderMermaidDiagrams?: () => void;

		// Sidebar manager window properties
		__mizukiSidebarResizeHandler?: () => void;
		__mizukiSidebarSwupHooked?: boolean;
		__mizukiSidebarManagerInitialized?: boolean;
		__mizukiRightSidebarResizeHandler?: () => void;
		__mizukiRightSidebarSwupHooked?: boolean;
		__mizukiRightSidebarManagerInitialized?: boolean;
		__siteStatsFetching?: boolean;
		__mizukiUmamiRuntimeReady?: boolean;
		__mizukiFooterSiteStatsState?: {
			fetching: boolean;
			lastValues: {
				pageviews: number;
				visitors: number;
				visits: number;
			} | null;
			render: ((values: {
				pageviews: number;
				visitors: number;
				visits: number;
			} | null) => void) | null;
			refresh?: () => Promise<void>;
		};
		__mizukiPageViewsManager?: {
			fetching: boolean;
			refresh: (attempt?: number) => Promise<void>;
		};
		__mizukiArticlePageViewsCardManager?: {
			fetching: boolean;
			refresh: (attempt?: number) => Promise<void>;
		};
		__mizukiWalineConfig?: {
			serverURL: string;
			lang?: string;
			meta?: ("nick" | "mail" | "link")[];
			requiredMeta?: ("nick" | "mail" | "link")[];
			wordLimit?: number | [number, number];
			pageSize?: number;
			commentSorting?: "latest" | "oldest" | "hottest";
			dark?: string | boolean;
			login?: "enable" | "disable" | "force";
			noCopyright?: boolean;
			noRss?: boolean;
			reaction?: string[] | boolean;
			emoji?:
				| boolean
				| (`//${string}` | `http://${string}` | `https://${string}`)[];
			search?: boolean;
			imageUploader?: boolean;
			pageview?: boolean | string;
			comment?: boolean | string;
			recaptchaV3Key?: string;
			turnstileKey?: string;
			locale?: Record<string, string>;
		};
		__mizukiWalineRuntime?: {
			instance: {
				destroy: () => void;
			} | null;
			mountedContainer: HTMLElement | null;
			observer: IntersectionObserver | null;
			previewObserver: MutationObserver | null;
			initialized: boolean;
			loading: boolean;
			initAttemptedPath: string;
			previewTimer: number | null;
			bound: boolean;
			schedulePreviewEnable: () => void;
			observePreviewDefaults: () => void;
			mount: () => Promise<void>;
			destroy: () => void;
			setupLazyLoad: () => void;
			refresh: () => void;
		};
	}

	interface Fancybox {
		unbind: (selector: string) => void;
		bind: (selector: string, options: object) => void;
		show: (items: Array<Record<string, unknown>>, options?: object) => void;
	}

	var Fancybox: Fancybox | undefined;
}

interface SearchResult {
	url: string;
	meta: {
		title: string;
	};
	excerpt: string;
	content?: string;
	word_count?: number;
	filters?: Record<string, unknown>;
	anchors?: {
		element: string;
		id: string;
		text: string;
		location: number;
	}[];
	weighted_locations?: {
		weight: number;
		balanced_score: number;
		location: number;
	}[];
	locations?: number[];
	raw_content?: string;
	raw_url?: string;
	sub_results?: SearchResult[];
}

export { SearchResult };
