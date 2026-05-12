import assert from "node:assert/strict";
import test from "node:test";

import {
	createWalineDeleteConfirmBridge,
	refreshWalineStats,
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
