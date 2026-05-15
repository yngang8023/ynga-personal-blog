export const PAGE_SHELL_LAYOUT_ATTRIBUTE = "data-page-shell-layout";
export const PAGE_SHELL_LAYOUT_SOURCE_ATTRIBUTE =
	"data-page-shell-layout-source";
export const DEFAULT_PAGE_SHELL_LAYOUT = "default";
export const SIDEBARLESS_PAGE_SHELL_LAYOUT = "no-sidebars";

const PAGE_SHELL_LAYOUT_VALUES = new Set([
	DEFAULT_PAGE_SHELL_LAYOUT,
	SIDEBARLESS_PAGE_SHELL_LAYOUT,
]);

export function normalizePageShellLayout(value) {
	return PAGE_SHELL_LAYOUT_VALUES.has(value)
		? value
		: DEFAULT_PAGE_SHELL_LAYOUT;
}

export function readPageShellLayout(root = document) {
	const source = root?.querySelector?.(
		`[${PAGE_SHELL_LAYOUT_SOURCE_ATTRIBUTE}]`,
	);
	const value = source?.getAttribute?.(PAGE_SHELL_LAYOUT_ATTRIBUTE);
	return normalizePageShellLayout(value);
}

export function applyPageShellLayout(doc = document, layout) {
	const normalizedLayout = normalizePageShellLayout(layout);
	const mainGrid = doc?.getElementById?.("main-grid");
	const tocWrapper = doc?.getElementById?.("toc-wrapper");

	if (mainGrid) {
		mainGrid.setAttribute(PAGE_SHELL_LAYOUT_ATTRIBUTE, normalizedLayout);
	}

	if (tocWrapper) {
		tocWrapper.setAttribute(PAGE_SHELL_LAYOUT_ATTRIBUTE, normalizedLayout);
	}

	return normalizedLayout;
}

export function syncPageShellLayout(doc = document) {
	return applyPageShellLayout(doc, readPageShellLayout(doc));
}

const pageShellLayoutApi = {
	PAGE_SHELL_LAYOUT_ATTRIBUTE,
	PAGE_SHELL_LAYOUT_SOURCE_ATTRIBUTE,
	DEFAULT_PAGE_SHELL_LAYOUT,
	SIDEBARLESS_PAGE_SHELL_LAYOUT,
	normalizePageShellLayout,
	readPageShellLayout,
	applyPageShellLayout,
	syncPageShellLayout,
};

if (typeof window !== "undefined") {
	window.__mizukiPageShellLayout = pageShellLayoutApi;
}
