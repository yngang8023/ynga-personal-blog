/**
 * Fancybox 处理器
 * 管理图片灯箱的初始化和清理
 */

import {
	FANCYBOX_SELECTORS,
	getDefaultFancyboxConfig,
} from "../core/swup-config";

// Fancybox 模块类型
type FancyboxType = any;

/**
 * Fancybox 处理器类
 * 负责图片灯箱的按需加载和管理
 */
export class FancyboxHandler {
	private Fancybox: FancyboxType | null = null;
	private boundSelectors: string[] = [];
	private initialized = false;
	private websiteCardLogoCleanup: (() => void) | null = null;
	private articleGalleryResizeCleanup: (() => void) | null = null;
	private articleGalleryResizeTimer: number | null = null;
	private readonly articleGallerySelector =
		'[data-fancybox="article-gallery"]';

	/**
	 * 初始化 Fancybox
	 * 按需加载 Fancybox 模块和样式
	 */
	async init(): Promise<void> {
		const hasImages = this.checkForImages();

		if (!hasImages) {
			return;
		}

		// 按需加载 Fancybox 模块
		if (!this.Fancybox) {
			await this.loadFancybox();
		}

		// 避免重复初始化
		if (this.boundSelectors.length > 0) {
			return;
		}

		this.bindArticleGallery();
		this.bindAlbumLinks();
		this.bindSingleFancybox();
		this.bindWebsiteCardLogoPreview();
		this.bindArticleGalleryResizeSync();
		this.initialized = true;
	}

	/**
	 * 检查页面是否有需要 Fancybox 的图片
	 */
	private checkForImages(): boolean {
		return (
			document.querySelector(FANCYBOX_SELECTORS.albumImages) !== null ||
			document.querySelector(FANCYBOX_SELECTORS.albumLinks) !== null ||
			document.querySelector(FANCYBOX_SELECTORS.singleFancybox) !== null ||
			document.querySelector(".card-website .wc-logo-shell") !== null
		);
	}

	/**
	 * 加载 Fancybox 模块和样式
	 */
	private async loadFancybox(): Promise<void> {
		const mod = await import("@fancyapps/ui");
		this.Fancybox = mod.Fancybox;
		await import("@fancyapps/ui/dist/fancybox/fancybox.css");
	}

	/**
	 * 绑定图片选择器
	 */
	private bindAlbumLinks(): void {
		if (!this.Fancybox) {
			return;
		}

		const commonConfig = getDefaultFancyboxConfig();

		// 绑定相册/文章图片
		this.Fancybox.bind(FANCYBOX_SELECTORS.albumImages, {
			...commonConfig,
			groupAll: true,
			Carousel: {
				transition: "slide",
				preload: 2,
			},
		});
		this.boundSelectors.push(FANCYBOX_SELECTORS.albumImages);

		// 绑定相册链接
		this.Fancybox.bind(FANCYBOX_SELECTORS.albumLinks, {
			...commonConfig,
			source: (el: any) => {
				return el.getAttribute("data-src") || el.getAttribute("href");
			},
		});
		this.boundSelectors.push(FANCYBOX_SELECTORS.albumLinks);
	}

	private bindSingleFancybox(): void {
		if (!this.Fancybox) {
			return;
		}

		const commonConfig = getDefaultFancyboxConfig();
		// 绑定单独的 fancybox 图片
		this.Fancybox.bind(FANCYBOX_SELECTORS.singleFancybox, commonConfig);
		this.boundSelectors.push(FANCYBOX_SELECTORS.singleFancybox);
	}

	private bindArticleGallery(): void {
		if (!this.Fancybox) {
			return;
		}

		this.syncArticleGalleryImages();

		const commonConfig = getDefaultFancyboxConfig();
		this.Fancybox.bind(this.articleGallerySelector, {
			...commonConfig,
			Carousel: {
				transition: "slide",
				preload: 2,
			},
		});
		this.boundSelectors.push(this.articleGallerySelector);
	}

	private bindArticleGalleryResizeSync(): void {
		if (this.articleGalleryResizeCleanup) {
			this.articleGalleryResizeCleanup();
		}

		const handleResize = () => {
			if (this.articleGalleryResizeTimer !== null) {
				window.clearTimeout(this.articleGalleryResizeTimer);
			}

			this.articleGalleryResizeTimer = window.setTimeout(() => {
				this.articleGalleryResizeTimer = null;
				this.refreshArticleGalleryBinding();
			}, 120);
		};

		window.addEventListener("resize", handleResize);
		this.articleGalleryResizeCleanup = () => {
			window.removeEventListener("resize", handleResize);
			this.articleGalleryResizeCleanup = null;
		};
	}

	private refreshArticleGalleryBinding(): void {
		if (!this.Fancybox) {
			return;
		}

		this.Fancybox.unbind(this.articleGallerySelector);
		this.syncArticleGalleryImages();
		this.Fancybox.bind(this.articleGallerySelector, {
			...getDefaultFancyboxConfig(),
			Carousel: {
				transition: "slide",
				preload: 2,
			},
		});
	}

	private isElementVisible(element: HTMLElement): boolean {
		if (!element.isConnected) {
			return false;
		}

		const rects = element.getClientRects();
		if (rects.length === 0) {
			return false;
		}

		const style = getComputedStyle(element);
		return style.display !== "none" && style.visibility !== "hidden";
	}

	private syncArticleGalleryImages(): void {
		const articleImages = Array.from(
			document.querySelectorAll<HTMLElement>(
				".custom-md img:not(.wc-logo-image), #post-cover img",
			),
		);

		for (const image of articleImages) {
			const currentFancybox = image.getAttribute("data-fancybox");
			const canJoinArticleGallery =
				currentFancybox === null || currentFancybox === "article-gallery";

			if (!canJoinArticleGallery) {
				continue;
			}

			if (this.isElementVisible(image)) {
				image.setAttribute("data-fancybox", "article-gallery");
				continue;
			}

			if (currentFancybox === "article-gallery") {
				image.removeAttribute("data-fancybox");
			}
		}
	}

	private bindWebsiteCardLogoPreview(): void {
		if (!this.Fancybox) {
			return;
		}

		this.websiteCardLogoCleanup?.();

		const handler = (event: Event) => {
			const target = event.target;
			if (!(target instanceof Element)) {
				return;
			}

			const logoShell = target.closest(".card-website .wc-logo-shell");
			if (!logoShell) {
				return;
			}

			const card = logoShell.closest<HTMLElement>(".card-website");
			const logoImage = card?.querySelector<HTMLImageElement>(".wc-logo-image");
			const logoSrc = card?.getAttribute("data-logo-src") || logoImage?.currentSrc || logoImage?.src || "";
			const logoCaption =
				card?.getAttribute("data-logo-caption") ||
				logoImage?.getAttribute("alt") ||
				"website logo";

			if (!logoSrc || !this.Fancybox?.show) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			this.Fancybox.show([
				{
					src: logoSrc,
					type: "image",
					caption: logoCaption,
				},
			]);
		};

		document.addEventListener("click", handler, true);

		this.websiteCardLogoCleanup = () => {
			document.removeEventListener("click", handler, true);
			this.websiteCardLogoCleanup = null;
		};
	}

	/**
	 * 清理 Fancybox 绑定
	 * 在页面切换前调用
	 */
	cleanup(): void {
		if (!this.Fancybox) {
			return;
		}

		this.boundSelectors.forEach((selector) => {
			this.Fancybox.unbind(selector);
		});
		this.boundSelectors = [];
		this.articleGalleryResizeCleanup?.();
		if (this.articleGalleryResizeTimer !== null) {
			window.clearTimeout(this.articleGalleryResizeTimer);
			this.articleGalleryResizeTimer = null;
		}
		this.websiteCardLogoCleanup?.();
	}

	/**
	 * 完全销毁 Fancybox
	 */
	destroy(): void {
		this.cleanup();
		this.Fancybox = null;
		this.initialized = false;
	}

	/**
	 * 获取初始化状态
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * 获取已绑定的选择器列表
	 */
	getBoundSelectors(): string[] {
		return [...this.boundSelectors];
	}
}

// 创建全局实例
let globalFancyboxHandler: FancyboxHandler | null = null;

/**
 * 获取全局 Fancybox 处理器实例
 */
export function getFancyboxHandler(): FancyboxHandler {
	if (!globalFancyboxHandler) {
		globalFancyboxHandler = new FancyboxHandler();
	}
	return globalFancyboxHandler;
}

/**
 * 初始化 Fancybox（便捷函数）
 */
export async function initFancybox(): Promise<void> {
	const handler = getFancyboxHandler();
	await handler.init();
}

/**
 * 清理 Fancybox（便捷函数）
 */
export function cleanupFancybox(): void {
	if (globalFancyboxHandler) {
		globalFancyboxHandler.cleanup();
	}
}
