import assert from "node:assert/strict";
import test from "node:test";

import { teardownWalineInstance } from "../../../src/layouts/partials/waline-runtime-utils.js";

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
