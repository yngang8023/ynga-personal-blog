import assert from "node:assert/strict";
import test from "node:test";

import { FANCYBOX_SELECTORS } from "../../../src/scripts/core/swup-config.ts";

test("excludes website card images from the global article image lightbox selector", () => {
	assert.match(
		FANCYBOX_SELECTORS.albumImages,
		/:not\(\.wc-logo-image\)/,
	);

	assert.doesNotMatch(
		FANCYBOX_SELECTORS.singleFancybox,
		/card-website-shell|wc-logo-link/,
	);
});
