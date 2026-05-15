import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const modulePath = pathToFileURL(
	path.resolve("src/scripts/core/page-shell-layout.js"),
).href;

function createElement(attributes = {}) {
	const values = new Map(Object.entries(attributes));
	return {
		getAttribute(name) {
			return values.has(name) ? values.get(name) : null;
		},
		setAttribute(name, value) {
			values.set(name, String(value));
		},
		removeAttribute(name) {
			values.delete(name);
		},
	};
}

test("page shell layout helpers read sidebarless markers from the active page content", async () => {
	const {
		DEFAULT_PAGE_SHELL_LAYOUT,
		SIDEBARLESS_PAGE_SHELL_LAYOUT,
		readPageShellLayout,
	} = await import(modulePath);

	const source = createElement({
		"data-page-shell-layout": SIDEBARLESS_PAGE_SHELL_LAYOUT,
	});
	const root = {
		querySelector(selector) {
			return selector === "[data-page-shell-layout-source]" ? source : null;
		},
	};

	assert.equal(readPageShellLayout(root), SIDEBARLESS_PAGE_SHELL_LAYOUT);
	assert.equal(readPageShellLayout({ querySelector: () => null }), DEFAULT_PAGE_SHELL_LAYOUT);
});

test("page shell layout helpers sync the persistent main grid state", async () => {
	const {
		DEFAULT_PAGE_SHELL_LAYOUT,
		PAGE_SHELL_LAYOUT_ATTRIBUTE,
		SIDEBARLESS_PAGE_SHELL_LAYOUT,
		applyPageShellLayout,
		syncPageShellLayout,
	} = await import(modulePath);

	const mainGrid = createElement();
	const source = createElement({
		"data-page-shell-layout": SIDEBARLESS_PAGE_SHELL_LAYOUT,
	});
	const doc = {
		getElementById(id) {
			return id === "main-grid" ? mainGrid : null;
		},
		querySelector(selector) {
			return selector === "[data-page-shell-layout-source]" ? source : null;
		},
	};

	assert.equal(applyPageShellLayout(doc, SIDEBARLESS_PAGE_SHELL_LAYOUT), SIDEBARLESS_PAGE_SHELL_LAYOUT);
	assert.equal(mainGrid.getAttribute(PAGE_SHELL_LAYOUT_ATTRIBUTE), SIDEBARLESS_PAGE_SHELL_LAYOUT);

	source.setAttribute("data-page-shell-layout", DEFAULT_PAGE_SHELL_LAYOUT);
	assert.equal(syncPageShellLayout(doc), DEFAULT_PAGE_SHELL_LAYOUT);
	assert.equal(mainGrid.getAttribute(PAGE_SHELL_LAYOUT_ATTRIBUTE), DEFAULT_PAGE_SHELL_LAYOUT);
});
