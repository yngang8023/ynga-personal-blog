import assert from "node:assert/strict";
import test from "node:test";

import {
	createWalineDeleteConfirmBridge,
	getWalineCommentMutationDelta,
	refreshWalineStats,
	resolveWalineCommentCount,
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

test("getWalineCommentMutationDelta only tracks single comment insertions and removals", () => {
	const makeNode = (className) => ({
		classList: {
			contains(name) {
				return name === className;
			},
		},
	});
	const cardsTarget = makeNode("wl-cards");
	const quoteTarget = makeNode("wl-quote");
	const rootCard = makeNode("wl-card-item");
	const nestedCard = makeNode("wl-card-item");

	assert.equal(
		getWalineCommentMutationDelta([
			{
				type: "childList",
				target: cardsTarget,
				addedNodes: [rootCard],
				removedNodes: [],
			},
		]),
		1,
	);

	assert.equal(
		getWalineCommentMutationDelta([
			{
				type: "childList",
				target: cardsTarget,
				addedNodes: [],
				removedNodes: [rootCard],
			},
		]),
		-1,
	);

	assert.equal(
		getWalineCommentMutationDelta([
			{
				type: "childList",
				target: quoteTarget,
				addedNodes: [nestedCard],
				removedNodes: [],
			},
		]),
		1,
	);

	assert.equal(
		getWalineCommentMutationDelta([
			{
				type: "childList",
				target: cardsTarget,
				addedNodes: [rootCard, rootCard],
				removedNodes: [],
			},
		]),
		0,
	);

	assert.equal(
		getWalineCommentMutationDelta([
			{
				type: "childList",
				target: cardsTarget,
				addedNodes: [rootCard],
				removedNodes: [rootCard],
			},
		]),
		0,
	);
});

test("resolveWalineCommentCount falls back to the observed root delta when Waline keeps the stale total", () => {
	assert.equal(
		resolveWalineCommentCount({
			displayedCount: 1,
			lastKnownCount: 1,
			pendingRootDelta: -1,
		}),
		0,
	);

	assert.equal(
		resolveWalineCommentCount({
			displayedCount: 0,
			lastKnownCount: 0,
			pendingRootDelta: 1,
		}),
		1,
	);

	assert.equal(
		resolveWalineCommentCount({
			displayedCount: 8,
			lastKnownCount: 7,
			pendingRootDelta: 1,
		}),
		8,
	);

	assert.equal(
		resolveWalineCommentCount({
			displayedCount: 1,
			lastKnownCount: 0,
			pendingRootDelta: 0,
		}),
		0,
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
