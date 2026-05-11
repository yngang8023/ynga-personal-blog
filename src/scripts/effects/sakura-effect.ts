/**
 * Sakura 特效模块
 * 管理樱花飘落特效的初始化
 */

import type { SakuraConfig } from "../../types/config";
import { initSakura, stopSakura } from "../../utils/sakura-manager";

function normalizeRoutePath(pathname: string): string {
	const rawPath = pathname.split(/[?#]/)[0].trim().toLowerCase();
	if (!rawPath) {
		return "/";
	}

	let normalized = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
	normalized = normalized.replace(/\/{2,}/g, "/");
	if (normalized.length > 1) {
		normalized = normalized.replace(/\/+$/, "");
	}
	return normalized || "/";
}

function matchesRoutePattern(pattern: string, pathname: string): boolean {
	const normalizedPattern = normalizeRoutePath(pattern);
	const normalizedPath = normalizeRoutePath(pathname);

	if (normalizedPattern === "/") {
		return normalizedPath === "/";
	}

	if (normalizedPattern.endsWith("/**")) {
		const prefix = normalizedPattern.slice(0, -3);
		return (
			normalizedPath === prefix ||
			normalizedPath.startsWith(`${prefix}/`)
		);
	}

	if (normalizedPattern.endsWith("/*")) {
		const prefix = normalizedPattern.slice(0, -2);
		if (normalizedPath === prefix) {
			return true;
		}
		if (!normalizedPath.startsWith(`${prefix}/`)) {
			return false;
		}

		const rest = normalizedPath.slice(prefix.length + 1);
		return !rest.includes("/");
	}

	return (
		normalizedPath === normalizedPattern ||
		normalizedPath.startsWith(`${normalizedPattern}/`)
	);
}

/**
 * Sakura 特效处理器类
 * 负责樱花飘落特效的初始化和状态管理
 */
export class SakuraEffectHandler {
	private initialized = false;
	private config: SakuraConfig | null = null;

	private shouldEnableOnCurrentDevice(config: SakuraConfig): boolean {
		const desktopEnabled = config.devices?.desktop ?? true;
		const mobileEnabled = config.devices?.mobile ?? true;
		const isMobileViewport = window.matchMedia("(max-width: 767px)").matches;
		return isMobileViewport ? mobileEnabled : desktopEnabled;
	}

	private shouldEnableOnCurrentRoute(config: SakuraConfig): boolean {
		const pathname = window.location.pathname;
		const routeRules = config.routeRules;
		const explicitDisabledRoutes = routeRules?.disabled?.filter(Boolean) ?? [];
		const explicitEnabledRoutes = routeRules?.enabled?.filter(Boolean) ?? [];
		const hasExplicitRouteRules =
			explicitDisabledRoutes.length > 0 || explicitEnabledRoutes.length > 0;
		const fallbackDisabledRoutes =
			!hasExplicitRouteRules && config.disableOnArticle
				? ["/posts/**"]
				: [];
		const disabledRoutes = [
			...fallbackDisabledRoutes,
			...explicitDisabledRoutes,
		];

		if (
			disabledRoutes.some((pattern) =>
				matchesRoutePattern(pattern, pathname),
			)
		) {
			return false;
		}

		if (
			explicitEnabledRoutes.length > 0 &&
			!explicitEnabledRoutes.some((pattern) =>
				matchesRoutePattern(pattern, pathname),
			)
		) {
			return false;
		}

		return true;
	}

	/**
	 * 初始化 Sakura 特效
	 */
	init(widgetConfigs: any): void {
		const sakuraConfig = widgetConfigs?.sakura;
		if (!sakuraConfig || !sakuraConfig.enable) {
			stopSakura();
			this.initialized = false;
			this.config = null;
			(window as any).sakuraInitialized = false;
			return;
		}

		if (!this.shouldEnableOnCurrentDevice(sakuraConfig)) {
			stopSakura();
			this.initialized = false;
			this.config = null;
			(window as any).sakuraInitialized = false;
			return;
		}

		if (!this.shouldEnableOnCurrentRoute(sakuraConfig)) {
			stopSakura();
			this.initialized = false;
			this.config = null;
			(window as any).sakuraInitialized = false;
			return;
		}

		// 避免重复初始化
		if ((window as any).sakuraInitialized) {
			return;
		}

		this.config = sakuraConfig;
		initSakura(sakuraConfig);
		this.initialized = true;
		(window as any).sakuraInitialized = true;
	}

	/**
	 * 检查是否已初始化
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * 获取配置
	 */
	getConfig(): SakuraConfig | null {
		return this.config;
	}
}

// 创建全局实例
let globalSakuraEffectHandler: SakuraEffectHandler | null = null;

/**
 * 获取全局 Sakura 特效处理器实例
 */
export function getSakuraEffectHandler(): SakuraEffectHandler {
	if (!globalSakuraEffectHandler) {
		globalSakuraEffectHandler = new SakuraEffectHandler();
	}
	return globalSakuraEffectHandler;
}

/**
 * 初始化 Sakura 特效（便捷函数）
 */
export function setupSakura(widgetConfigs: any): void {
	const handler = getSakuraEffectHandler();
	handler.init(widgetConfigs);
}

/**
 * 设置 Sakura 特效初始化的 DOM 监听
 */
export function setupSakuraOnDOMReady(widgetConfigs: any): void {
	const handler = getSakuraEffectHandler();

	const init = () => {
		handler.init(widgetConfigs);
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}

	document.addEventListener("astro:page-load", init);

	if (window.swup?.hooks) {
		window.swup.hooks.on("page:view", init);
	} else {
		document.addEventListener("swup:contentReplaced", init);
	}
}
