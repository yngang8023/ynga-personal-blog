import {
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
	// WALLPAPER_BANNER,
} from "@constants/constants";

import { siteConfig } from "@/config";
import type { LIGHT_DARK_MODE, WALLPAPER_MODE } from "@/types/config";

const THEME_TRANSITION_VEIL_ID = "theme-transition-veil";
const THEME_SWITCH_TRANSITION_MS = 220;
const THEME_VEIL_SETTLE_DELAY_MS = 44;
const THEME_VEIL_SETTLE_MS = 72;
const THEME_SWITCH_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const THEME_VEIL_MAX_OPACITY = 0.18;
const THEME_VEIL_SETTLE_OPACITY = 0.08;
const THEME_SWITCH_FALLBACK_ORIGIN = {
	x: "calc(100vw - 3rem)",
	y: "3rem",
};

type ThemeTransitionMode = "theme-veil";

type ThemeSwitchTrigger =
	| HTMLElement
	| {
			x: number;
			y: number;
	  };

export interface ThemeSwitchOptions {
	trigger?: ThemeSwitchTrigger | null;
}

let themeTransitionCleanupTimer: number | null = null;

export function getDefaultHue(): number {
	const fallback = "250";
	const configCarrier = document.getElementById("config-carrier");
	// 在Swup页面切换时，config-carrier可能不存在，使用默认值
	if (!configCarrier) {
		return Number.parseInt(fallback);
	}
	return Number.parseInt(configCarrier.dataset.hue || fallback);
}

export function getHue(): number {
	const stored = localStorage.getItem("hue");
	return stored ? Number.parseInt(stored) : getDefaultHue();
}

export function setHue(hue: number): void {
	localStorage.setItem("hue", String(hue));
	const r = document.querySelector(":root") as HTMLElement;
	if (!r) {
		return;
	}
	r.style.setProperty("--hue", String(hue));
}

function clearThemeTransitionTimer(): void {
	if (themeTransitionCleanupTimer !== null) {
		window.clearTimeout(themeTransitionCleanupTimer);
		themeTransitionCleanupTimer = null;
	}
}

function cleanupThemeTransitionState(
	root: HTMLElement = document.documentElement,
): void {
	clearThemeTransitionTimer();
	root.classList.remove("is-theme-transitioning", "use-theme-veil");
}

function resolveThemeTransitionOrigin(
	trigger?: ThemeSwitchTrigger | null,
): { x: string; y: string } {
	if (trigger instanceof HTMLElement) {
		const rect = trigger.getBoundingClientRect();
		return {
			x: `${Math.round(rect.left + rect.width / 2)}px`,
			y: `${Math.round(rect.top + rect.height / 2)}px`,
		};
	}

	if (
		trigger &&
		typeof trigger === "object" &&
		"x" in trigger &&
		"y" in trigger &&
		Number.isFinite(trigger.x) &&
		Number.isFinite(trigger.y)
	) {
		return {
			x: `${Math.round(trigger.x)}px`,
			y: `${Math.round(trigger.y)}px`,
		};
	}

	return THEME_SWITCH_FALLBACK_ORIGIN;
}

function updateThemeTransitionOrigin(
	options: ThemeSwitchOptions = {},
	root: HTMLElement = document.documentElement,
): void {
	const { x, y } = resolveThemeTransitionOrigin(options.trigger);
	root.style.setProperty("--theme-switch-origin-x", x);
	root.style.setProperty("--theme-switch-origin-y", y);
}

function getThemeVeilSpotlight(nextTheme: LIGHT_DARK_MODE): string {
	return nextTheme === DARK_MODE
		? "rgba(15, 23, 42, 0.14)"
		: "rgba(255, 255, 255, 0.12)";
}

function ensureThemeTransitionVeil(): HTMLDivElement {
	let veil = document.getElementById(
		THEME_TRANSITION_VEIL_ID,
	) as HTMLDivElement | null;

	if (veil) {
		return veil;
	}

	veil = document.createElement("div");
	veil.id = THEME_TRANSITION_VEIL_ID;
	veil.setAttribute("aria-hidden", "true");
	document.body.appendChild(veil);
	return veil;
}

function dispatchThemeSwitchEvent(
	type: "start" | "end",
	nextTheme: LIGHT_DARK_MODE,
): void {
	const mode: ThemeTransitionMode = "theme-veil";
	window.dispatchEvent(
		new CustomEvent(`theme-switch:${type}`, {
			detail: {
				mode,
				nextTheme,
				duration: THEME_SWITCH_TRANSITION_MS,
			},
		}),
	);
}

function beginThemeTransition(
	nextTheme: LIGHT_DARK_MODE,
	options: ThemeSwitchOptions = {},
): HTMLElement {
	const root = document.documentElement;
	cleanupThemeTransitionState(root);
	updateThemeTransitionOrigin(options, root);
	root.style.setProperty(
		"--theme-switch-duration",
		`${THEME_SWITCH_TRANSITION_MS}ms`,
	);
	root.style.setProperty("--theme-switch-easing", THEME_SWITCH_EASING);
	root.style.setProperty("--theme-veil-spotlight", getThemeVeilSpotlight(nextTheme));
	root.classList.add("is-theme-transitioning", "use-theme-veil");
	dispatchThemeSwitchEvent("start", nextTheme);
	return root;
}

function finalizeThemeTransition(
	root: HTMLElement,
	nextTheme: LIGHT_DARK_MODE,
): void {
	cleanupThemeTransitionState(root);
	dispatchThemeSwitchEvent("end", nextTheme);
}

function scheduleMaskedThemeCleanup(
	root: HTMLElement,
	nextTheme: LIGHT_DARK_MODE,
): Promise<void> {
	return new Promise((resolve) => {
		themeTransitionCleanupTimer = window.setTimeout(() => {
			finalizeThemeTransition(root, nextTheme);
			resolve();
		}, THEME_SWITCH_TRANSITION_MS + THEME_VEIL_SETTLE_DELAY_MS + THEME_VEIL_SETTLE_MS);
	});
}

function cleanupThemeTransitionVeil(veil: HTMLDivElement): void {
	veil.style.setProperty("opacity", "0", "important");
	veil.style.setProperty("visibility", "hidden", "important");
	veil.style.setProperty("transition", "none", "important");
	veil.style.setProperty("background-color", "transparent", "important");
}

async function runMaskedThemeSwitch(
	performThemeChange: () => void,
	nextTheme: LIGHT_DARK_MODE,
	options: ThemeSwitchOptions = {},
): Promise<void> {
	const root = beginThemeTransition(nextTheme, options);
	const veil = ensureThemeTransitionVeil();

	clearThemeTransitionTimer();
	veil.style.setProperty("transition", "none", "important");
	veil.style.setProperty("visibility", "visible", "important");
	veil.style.setProperty(
		"opacity",
		String(THEME_VEIL_MAX_OPACITY),
		"important",
	);

	performThemeChange();

	requestAnimationFrame(() => {
		veil.style.setProperty(
			"transition",
			`opacity ${THEME_SWITCH_TRANSITION_MS}ms ${THEME_SWITCH_EASING}`,
			"important",
		);
		veil.style.setProperty(
			"opacity",
			String(THEME_VEIL_SETTLE_OPACITY),
			"important",
		);

		window.setTimeout(() => {
			veil.style.setProperty("opacity", "0", "important");
		}, THEME_VEIL_SETTLE_DELAY_MS);
	});

	try {
		await scheduleMaskedThemeCleanup(root, nextTheme);
	} finally {
		cleanupThemeTransitionVeil(veil);
	}
}

export async function applyThemeToDocument(
	theme: LIGHT_DARK_MODE,
	options: ThemeSwitchOptions = {},
): Promise<void> {
	// 获取当前主题状态的完整信息
	const currentIsDark = document.documentElement.classList.contains("dark");
	const currentTheme = document.documentElement.getAttribute("data-theme");

	// 计算目标主题状态
	let targetIsDark = false; // 初始化默认值
	switch (theme) {
		case LIGHT_MODE:
			targetIsDark = false;
			break;
		case DARK_MODE:
			targetIsDark = true;
			break;
		default:
			// 处理默认情况，使用当前主题状态
			targetIsDark = currentIsDark;
			break;
	}

	// 检测是否真的需要主题切换：
	// 1. dark类状态是否改变
	// 2. expressiveCode主题是否需要更新
	const needsThemeChange = currentIsDark !== targetIsDark;
	const expectedTheme = targetIsDark ? "github-dark" : "github-light";
	const needsCodeThemeUpdate = currentTheme !== expectedTheme;

	// 如果既不需要主题切换也不需要代码主题更新，直接返回
	if (!needsThemeChange && !needsCodeThemeUpdate) {
		return Promise.resolve();
	}

	// 定义实际执行主题切换的函数
	const performThemeChange = () => {
		// 应用主题变化
		if (needsThemeChange) {
			if (targetIsDark) {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		}

		// Set the theme for Expressive Code based on current mode
		// 只在必要时更新 data-theme 属性以减少重绘
		if (needsCodeThemeUpdate) {
			const expressiveTheme = targetIsDark
				? "github-dark"
				: "github-light";
			document.documentElement.setAttribute(
				"data-theme",
				expressiveTheme,
			);
		}
	};

	if (needsThemeChange) {
		return runMaskedThemeSwitch(performThemeChange, theme, options);
	}

	performThemeChange();
	return Promise.resolve();
}

export function setTheme(
	theme: LIGHT_DARK_MODE,
	options: ThemeSwitchOptions = {},
): Promise<void> {
	localStorage.setItem("theme", theme);
	return applyThemeToDocument(theme, options);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	return (localStorage.getItem("theme") as LIGHT_DARK_MODE) || DEFAULT_THEME;
}

export function getStoredWallpaperMode(): WALLPAPER_MODE {
	return (
		(localStorage.getItem("wallpaperMode") as WALLPAPER_MODE) ||
		siteConfig.wallpaperMode.defaultMode
	);
}

export function setWallpaperMode(mode: WALLPAPER_MODE): void {
	localStorage.setItem("wallpaperMode", mode);
	// 触发自定义事件通知其他组件壁纸模式已改变
	window.dispatchEvent(
		new CustomEvent("wallpaper-mode-change", { detail: { mode } }),
	);
}
