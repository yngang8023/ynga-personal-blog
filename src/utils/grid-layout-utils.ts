/**
 * 网格布局工具函数
 * 提供 MainGridLayout 使用的服务端布局计算逻辑
 */
import fs from "node:fs/promises";
import path from "node:path";

import type {
	AutoScanPublicDirConfig,
	ResponsiveImageSource,
	SiteConfig,
} from "../types/config";
import type { widgetManager } from "./widget-manager";

/**
 * Banner 图片配置
 */
export interface BannerImages {
	desktop: string[];
	mobile: string[];
}

/**
 * 布局配置接口
 */
export interface GridLayoutConfig {
	siteConfig: SiteConfig;
	widgetManager: typeof widgetManager;
}

/**
 * 侧边栏存在性配置
 */
export interface SidebarPresence {
	hasLeftSidebarComponents: boolean;
	hasRightSidebarComponents: boolean;
	hasMobileDrawerComponents: boolean;
	hasTabletLeftSidebarComponents: boolean;
}

/**
 * 网格布局计算结果
 */
export interface GridLayoutResult {
	gridCols: string;
	sidebarClass: string;
	rightSidebarClass: string;
	mainContentClass: string;
	sidebarPresence: SidebarPresence;
	mobileShowSidebar: boolean;
	tabletShowSidebar: boolean;
	desktopShowSidebar: boolean;
	desktopShowLeftSidebar: boolean;
	desktopShowRightSidebar: boolean;
	tabletShowLeftSidebar: boolean;
	tabletShowRightSidebar: boolean;
	tabletAnySidebar: boolean;
	initialRightSidebarHidden: boolean;
	desktopMainPos: string;
}

function naturalSort(a: string, b: string): number {
	return a.localeCompare(b, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

export async function scanPublicImages(
	dirFromPublic: string | undefined,
	pattern = "*.webp",
): Promise<string[]> {
	if (!dirFromPublic) {
		return [];
	}

	const normalizedDir = dirFromPublic.replace(/^\/+|\/+$/g, "");
	const publicDir = path.resolve(process.cwd(), "public", normalizedDir);
	const expectedExt = pattern.startsWith("*.") ? pattern.slice(1) : ".webp";

	try {
		const entries = await fs.readdir(publicDir, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile())
			.map((entry) => entry.name)
			.filter((name) => name.toLowerCase().endsWith(expectedExt.toLowerCase()))
			.sort(naturalSort)
			.map((name) => `/${normalizedDir}/${name}`);
	} catch (error) {
		console.warn(`Failed to scan image directory: ${normalizedDir}`, error);
		return [];
	}
}

function toImageArray(
	images: string | string[] | undefined,
): string[] {
	if (Array.isArray(images)) {
		return images.filter(Boolean);
	}

	return typeof images === "string" && images ? [images] : [];
}

export function normalizeResponsiveImageSource(
	src: ResponsiveImageSource,
): BannerImages {
	if (
		typeof src === "object" &&
		src !== null &&
		!Array.isArray(src) &&
		("desktop" in src || "mobile" in src)
	) {
		return {
			desktop: toImageArray(src.desktop ?? src.mobile),
			mobile: toImageArray(src.mobile ?? src.desktop),
		};
	}

	const allImages = toImageArray(src);

	return {
		desktop: allImages,
		mobile: allImages,
	};
}

export async function resolveResponsiveImageSource(options: {
	src: ResponsiveImageSource;
	autoScanPublicDir?: AutoScanPublicDirConfig;
	imageApi?: SiteConfig["banner"]["imageApi"];
}): Promise<BannerImages> {
	let resolvedSrc = options.src;

	if (options.autoScanPublicDir?.enable) {
		const [desktopImages, mobileImages] = await Promise.all([
			scanPublicImages(
				options.autoScanPublicDir.desktopDir,
				options.autoScanPublicDir.pattern,
			),
			scanPublicImages(
				options.autoScanPublicDir.mobileDir,
				options.autoScanPublicDir.pattern,
			),
		]);

		if (desktopImages.length > 0 || mobileImages.length > 0) {
			const fallbackImages = normalizeResponsiveImageSource(resolvedSrc);
			resolvedSrc = {
				desktop:
					desktopImages.length > 0
						? desktopImages
						: mobileImages.length > 0
							? mobileImages
							: fallbackImages.desktop,
				mobile:
					mobileImages.length > 0
						? mobileImages
						: desktopImages.length > 0
							? desktopImages
							: fallbackImages.mobile,
			};
		}
	}

	if (options.imageApi?.enable && options.imageApi?.url) {
		try {
			const response = await fetch(options.imageApi.url);
			const text = await response.text();
			const apiImages = text.split("\n").filter((line) => line.trim());

			if (apiImages.length > 0) {
				resolvedSrc = apiImages;
			}
		} catch (error) {
			console.warn("Failed to fetch images from API:", error);
		}
	}

	return normalizeResponsiveImageSource(resolvedSrc);
}

/**
 * 获取侧边栏组件存在性
 */
export function getSidebarPresence(wm: typeof widgetManager): SidebarPresence {
	const hasLeftSidebarComponents =
		wm.getComponentsByPosition("top", "left", "desktop").length > 0 ||
		wm.getComponentsByPosition("sticky", "left", "desktop").length > 0;

	const hasRightSidebarComponents =
		wm.getComponentsByPosition("top", "right", "desktop").length > 0 ||
		wm.getComponentsByPosition("sticky", "right", "desktop").length > 0;

	const hasMobileDrawerComponents =
		wm.getComponentsByPosition("top", "drawer", "mobile").length > 0 ||
		wm.getComponentsByPosition("sticky", "drawer", "mobile").length > 0;

	const hasTabletLeftSidebarComponents =
		wm.getComponentsByPosition("top", "left", "tablet").length > 0 ||
		wm.getComponentsByPosition("sticky", "left", "tablet").length > 0;

	return {
		hasLeftSidebarComponents,
		hasRightSidebarComponents,
		hasMobileDrawerComponents,
		hasTabletLeftSidebarComponents,
	};
}

/**
 * 计算网格布局
 */
export function calculateGridLayout(
	config: GridLayoutConfig,
): GridLayoutResult {
	const { siteConfig, widgetManager: wm } = config;
	const presence = getSidebarPresence(wm);

	const {
		hasLeftSidebarComponents,
		hasRightSidebarComponents,
		hasMobileDrawerComponents,
		hasTabletLeftSidebarComponents,
	} = presence;

	// 检查侧边栏是否启用，动态调整网格布局
	const mobileShowSidebar = hasMobileDrawerComponents;
	const tabletShowSidebar = hasTabletLeftSidebarComponents;
	const desktopShowSidebar =
		hasLeftSidebarComponents || hasRightSidebarComponents;

	// 桌面端侧边栏最终显示状态（考虑是否有组件）
	const desktopShowLeftSidebar = hasLeftSidebarComponents;
	const desktopShowRightSidebar = hasRightSidebarComponents;

	// 平板端侧边栏最终显示状态
	const tabletShowLeftSidebar = hasTabletLeftSidebarComponents;
	// 平板端不再有独立的右侧栏，如果右移左了，它就在 tabletShowLeftSidebar 中显示
	const tabletShowRightSidebar = false;
	const tabletAnySidebar = tabletShowLeftSidebar;

	// 检查默认布局模式，如果是 grid 模式，右侧边栏初始就应该隐藏
	const defaultPostListLayout =
		siteConfig.postListLayout?.defaultMode || "list";
	const initialRightSidebarHidden = defaultPostListLayout === "grid";

	// 动态网格布局类名 - 根据侧边栏模式和是否有组件调整列宽
	let desktopGridCols = "lg:grid-cols-1";
	if (desktopShowLeftSidebar && desktopShowRightSidebar) {
		desktopGridCols = "lg:grid-cols-[17.5rem_1fr_17.5rem]";
	} else if (desktopShowLeftSidebar) {
		desktopGridCols = "lg:grid-cols-[17.5rem_1fr]";
	} else if (desktopShowRightSidebar) {
		desktopGridCols = "lg:grid-cols-[1fr_17.5rem]";
	}

	const gridCols = `
		${mobileShowSidebar ? "grid-cols-1" : "grid-cols-1"}
		${tabletAnySidebar ? "md:grid-cols-[17.5rem_1fr]" : "md:grid-cols-1"}
		${desktopGridCols}
	`
		.trim()
		.replace(/\s+/g, " ");

	// 侧边栏容器类名 - 始终在左侧
	const sidebarClass = `
		onload-animation
		${mobileShowSidebar && hasMobileDrawerComponents ? "block" : "hidden"}
		${tabletShowLeftSidebar ? "md:block md:mb-4 md:max-w-[17.5rem]" : "md:hidden"}
		${desktopShowLeftSidebar ? "lg:block lg:mb-4 lg:row-start-1 lg:row-end-2 lg:max-w-[17.5rem] lg:col-start-1 lg:col-end-2" : "lg:hidden"}
	`
		.trim()
		.replace(/\s+/g, " ");

	// 右侧边栏容器类名
	const rightSidebarClass = `
		onload-animation
		hidden
		${tabletShowRightSidebar ? "md:block md:mb-4 md:max-w-[17.5rem]" : "md:hidden"}
		${desktopShowRightSidebar ? `lg:block lg:self-start lg:h-fit lg:mb-4 lg:max-w-[17.5rem] ${desktopShowLeftSidebar ? "lg:col-start-3 lg:col-end-4" : "lg:col-start-2 lg:col-end-3"} lg:col-span-1` : "lg:hidden"}
		${initialRightSidebarHidden ? "hidden-in-grid-mode" : ""}
	`
		.trim()
		.replace(/\s+/g, " ");

	// 主内容区域类名 - 根据侧边栏模式调整grid-column
	let desktopMainPos = "lg:col-span-1";
	if (desktopShowLeftSidebar && desktopShowRightSidebar) {
		desktopMainPos = "lg:col-start-2 lg:col-end-3";
	} else if (desktopShowLeftSidebar) {
		desktopMainPos = "lg:col-start-2 lg:col-end-3";
	} else if (desktopShowRightSidebar) {
		desktopMainPos = "lg:col-start-1 lg:col-end-2";
	}

	const mainContentClass = `
		transition-swup-fade overflow-hidden w-full
		col-span-1 row-start-1 row-end-2
		${tabletAnySidebar ? "md:col-start-2 md:col-end-3" : "md:col-start-1 md:col-end-2"}
		${desktopShowSidebar ? desktopMainPos : "lg:col-span-1"}
	`
		.trim()
		.replace(/\s+/g, " ");

	return {
		gridCols,
		sidebarClass,
		rightSidebarClass,
		mainContentClass,
		sidebarPresence: presence,
		mobileShowSidebar,
		tabletShowSidebar,
		desktopShowSidebar,
		desktopShowLeftSidebar,
		desktopShowRightSidebar,
		tabletShowLeftSidebar,
		tabletShowRightSidebar,
		tabletAnySidebar,
		initialRightSidebarHidden,
		desktopMainPos,
	};
}

/**
 * 获取 Banner 图片
 */
export async function getBannerImages(
	siteConfig: SiteConfig,
): Promise<BannerImages> {
	return resolveResponsiveImageSource({
		src: siteConfig.banner.src,
		autoScanPublicDir: siteConfig.banner.autoScanPublicDir,
		imageApi: siteConfig.banner.imageApi,
	});
}

/**
 * 检查是否应该启用半透明效果
 */
export function shouldEnableTransparency(
	defaultWallpaperMode: string,
): boolean {
	return defaultWallpaperMode === "fullscreen";
}

/**
 * 获取半透明效果 CSS 类名
 */
export function getTransparencyClass(shouldEnable: boolean): string {
	return shouldEnable ? "wallpaper-transparent" : "";
}

/**
 * 计算主内容区域顶部位置
 */
export function getMainPanelTop(
	defaultWallpaperMode: string,
	bannerHeightVh: number,
): string {
	return defaultWallpaperMode === "banner" ? `${bannerHeightVh}vh` : "5.5rem";
}
