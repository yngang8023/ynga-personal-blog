import assert from "node:assert/strict";
import test from "node:test";

import {
	createWalineDeleteConfirmBridge,
	applyWalineCommentCountDelta,
	refreshWalineStats,
	resolveWalineBaseCommentCount,
	syncWalineCommentCountDisplay,
	teardownWalineInstance,
} from "../../../src/layouts/partials/waline-runtime-utils.js";

test("teardownWalineInstance skips destroy when the mounted container is detached", () => {
	let destroyCalls = 0;

	const result = teardownWalineInstance(
		{
			destroy() {
				destroyCalls += 1;
				throw new Error("should not be called for detached containers");
			},
		},
		{ isConnected: false },
	);

	assert.equal(destroyCalls, 0);
	assert.deepEqual(result, {
		destroyed: false,
		reason: "detached-container",
	});
});

test("teardownWalineInstance destroys the live instance when the container is still connected", () => {
	let destroyCalls = 0;

	const result = teardownWalineInstance(
		{
			destroy() {
				destroyCalls += 1;
			},
		},
		{ isConnected: true },
	);

	assert.equal(destroyCalls, 1);
	assert.deepEqual(result, {
		destroyed: true,
		reason: "destroyed",
	});
});

test("refreshWalineStats uses Waline official counters and keeps pageview refresh read-only", () => {
	const calls = [];

	const result = refreshWalineStats({
		serverURL: "https://example.com/waline/",
		path: "/posts/demo/",
		lang: "zh-CN",
		commentCount: (options) => {
			calls.push({
				type: "comment",
				options,
			});

			return () => {};
		},
		pageviewCount: (options) => {
			calls.push({
				type: "pageview",
				options,
			});

			return () => {};
		},
	});

	assert.equal(typeof result.abortCommentCount, "function");
	assert.equal(typeof result.abortPageviewCount, "function");
	assert.deepEqual(calls, [
		{
			type: "comment",
			options: {
				serverURL: "https://example.com/waline/",
				path: "/posts/demo/",
				lang: "zh-CN",
				selector: ".waline-comment-count",
			},
		},
		{
			type: "pageview",
			options: {
				serverURL: "https://example.com/waline/",
				path: "/posts/demo/",
				lang: "zh-CN",
				selector: ".waline-pageview-count",
				update: false,
			},
		},
	]);
});

test("refreshWalineStats can skip remote comment counter refresh while preserving pageview sync", () => {
	const calls = [];

	const result = refreshWalineStats({
		serverURL: "https://example.com/waline/",
		path: "/posts/demo/",
		lang: "zh-CN",
		refreshCommentCount: false,
		commentCount: (options) => {
			calls.push({
				type: "comment",
				options,
			});

			return () => {};
		},
		pageviewCount: (options) => {
			calls.push({
				type: "pageview",
				options,
			});

			return () => {};
		},
	});

	assert.equal(result.abortCommentCount, null);
	assert.equal(typeof result.abortPageviewCount, "function");
	assert.deepEqual(calls, [
		{
			type: "pageview",
			options: {
				serverURL: "https://example.com/waline/",
				path: "/posts/demo/",
				lang: "zh-CN",
				selector: ".waline-pageview-count",
				update: false,
			},
		},
	]);
});

test("resolveWalineBaseCommentCount prefers the freshest visible count", () => {
	assert.equal(
		resolveWalineBaseCommentCount({
			displayedCount: 1,
			lastKnownCount: 1,
			badgeCount: 0,
		}),
		1,
	);

	assert.equal(
		resolveWalineBaseCommentCount({
			displayedCount: 0,
			lastKnownCount: 3,
			badgeCount: 4,
		}),
		0,
	);

	assert.equal(
		resolveWalineBaseCommentCount({
			displayedCount: Number.NaN,
			lastKnownCount: 7,
			badgeCount: 8,
		}),
		8,
	);

	assert.equal(
		resolveWalineBaseCommentCount({
			displayedCount: Number.NaN,
			lastKnownCount: Number.NaN,
			badgeCount: Number.NaN,
		}),
		0,
	);
});

test("applyWalineCommentCountDelta applies additive updates from a stable base", () => {
	assert.equal(
		applyWalineCommentCountDelta({
			displayedCount: 2,
			lastKnownCount: 2,
			badgeCount: 2,
			delta: 1,
		}),
		3,
	);
	assert.equal(
		applyWalineCommentCountDelta({
			displayedCount: 2,
			lastKnownCount: 2,
			badgeCount: 2,
			delta: -1,
		}),
		1,
	);
});

test("syncWalineCommentCountDisplay updates the badge and removes Waline internal count when total reaches zero", () => {
	const badge = { textContent: "--" };
	let removed = 0;
	const countElement = {
		textContent: "1",
		remove() {
			removed += 1;
		},
	};
	const walineCountContainer = {
		querySelector(selector) {
			return selector === ".wl-num" ? countElement : null;
		},
		prepend() {
			throw new Error("should not prepend when an existing count node exists");
		},
	};

	const result = syncWalineCommentCountDisplay({
		count: 0,
		badgeElement: badge,
		walineCountContainer,
	});

	assert.equal(result, 0);
	assert.equal(badge.textContent, "0");
	assert.equal(removed, 1);
});

test("syncWalineCommentCountDisplay creates Waline internal count when comments grow from zero", () => {
	const badge = { textContent: "0" };
	const created = { textContent: "", className: "", remove() {} };
	let prependedNode = null;
	const walineCountContainer = {
		querySelector() {
			return null;
		},
		prepend(node) {
			prependedNode = node;
		},
	};

	const result = syncWalineCommentCountDisplay({
		count: 1,
		badgeElement: badge,
		walineCountContainer,
		createCountElement: () => created,
	});

	assert.equal(result, 1);
	assert.equal(badge.textContent, "1");
	assert.equal(created.textContent, "1");
	assert.equal(prependedNode, created);
});

test("syncWalineCommentCountDisplay updates the existing Waline count node in place", () => {
	const badge = { textContent: "1" };
	const countElement = {
		textContent: "1",
		remove() {},
	};
	const walineCountContainer = {
		querySelector(selector) {
			return selector === ".wl-num" ? countElement : null;
		},
		prepend() {
			throw new Error("should not prepend when an existing count node exists");
		},
	};

	const result = syncWalineCommentCountDisplay({
		count: 2,
		badgeElement: badge,
		walineCountContainer,
	});

	assert.equal(result, 2);
	assert.equal(badge.textContent, "2");
	assert.equal(countElement.textContent, "2");
});

test("syncWalineCommentCountDisplay deduplicates repeated Waline count nodes after a delete", () => {
	const badge = { textContent: "4" };
	let removed = 0;

	const primaryCountElement = {
		textContent: "4",
		remove() {
			throw new Error("should keep the first count node");
		},
	};

	const duplicateCountElement = {
		textContent: "3",
		remove() {
			removed += 1;
		},
	};

	const walineCountContainer = {
		querySelectorAll(selector) {
			return selector === ".wl-num"
				? [primaryCountElement, duplicateCountElement]
				: [];
		},
		prepend() {
			throw new Error("should not prepend when a count node already exists");
		},
	};

	const result = syncWalineCommentCountDisplay({
		count: 3,
		badgeElement: badge,
		walineCountContainer,
	});

	assert.equal(result, 3);
	assert.equal(badge.textContent, "3");
	assert.equal(primaryCountElement.textContent, "3");
	assert.equal(removed, 1);
});

test("syncWalineCommentCountDisplay removes all repeated Waline count nodes when total reaches zero", () => {
	const badge = { textContent: "2" };
	let removed = 0;

	const firstCountElement = {
		textContent: "2",
		remove() {
			removed += 1;
		},
	};

	const secondCountElement = {
		textContent: "1",
		remove() {
			removed += 1;
		},
	};

	const walineCountContainer = {
		querySelectorAll(selector) {
			return selector === ".wl-num"
				? [firstCountElement, secondCountElement]
				: [];
		},
		prepend() {
			throw new Error("should not prepend when removing stale nodes");
		},
	};

	const result = syncWalineCommentCountDisplay({
		count: 0,
		badgeElement: badge,
		walineCountContainer,
	});

	assert.equal(result, 0);
	assert.equal(badge.textContent, "0");
	assert.equal(removed, 2);
});

test("createWalineDeleteConfirmBridge replays an approved delete click and bypasses native confirm once", async () => {
	let nativeConfirmCalls = 0;
	let replayedConfirmResult = null;
	let replayClicks = 0;
	let promptOptions = null;
	let bridge = null;

	const button = {
		click() {
			replayClicks += 1;
			replayedConfirmResult = bridge.confirm("delete confirmation");
		},
	};

	bridge = createWalineDeleteConfirmBridge({
		nativeConfirm: () => {
			nativeConfirmCalls += 1;
			return false;
		},
		resolveConfirm: () => async (options) => {
			promptOptions = options;
			return true;
		},
		matchDeleteButton: (target) => (target === button ? button : null),
	});

	let prevented = 0;
	let immediateStopped = 0;
	let stopped = 0;

	bridge.handleDeleteClick({
		target: button,
		preventDefault() {
			prevented += 1;
		},
		stopImmediatePropagation() {
			immediateStopped += 1;
		},
		stopPropagation() {
			stopped += 1;
		},
	});

	await new Promise((resolve) => setImmediate(resolve));

	assert.equal(prevented, 1);
	assert.equal(immediateStopped, 1);
	assert.equal(stopped, 1);
	assert.equal(replayClicks, 1);
	assert.equal(replayedConfirmResult, true);
	assert.equal(nativeConfirmCalls, 0);
	assert.match(promptOptions.title, /删除/);
	assert.equal(bridge.confirm("fallback confirm"), false);
	assert.equal(nativeConfirmCalls, 1);
});

test("createWalineDeleteConfirmBridge leaves delete clicks untouched when the custom dialog is unavailable", () => {
	const button = {};
	const bridge = createWalineDeleteConfirmBridge({
		nativeConfirm: () => true,
		resolveConfirm: () => null,
		matchDeleteButton: (target) => (target === button ? button : null),
	});

	let prevented = 0;

	bridge.handleDeleteClick({
		target: button,
		preventDefault() {
			prevented += 1;
		},
		stopImmediatePropagation() {},
		stopPropagation() {},
	});

	assert.equal(prevented, 0);
});
