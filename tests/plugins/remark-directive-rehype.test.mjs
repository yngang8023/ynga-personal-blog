import assert from "node:assert/strict";
import test from "node:test";

import { parseDirectiveNode } from "../../src/plugins/remark-directive-rehype.js";
import { remarkImageGrid } from "../../src/plugins/remark-image-grid.js";

test("parseDirectiveNode preserves custom image-grid layout metadata", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "paragraph",
				children: [{ type: "text", value: "[grid layout=\"4,3\" gap=lg]" }],
			},
			{
				type: "paragraph",
				children: [{ type: "image", url: "./1.webp", alt: "图一" }],
			},
			{
				type: "paragraph",
				children: [{ type: "image", url: "./2.webp", alt: "图二" }],
			},
			{
				type: "paragraph",
				children: [{ type: "image", url: "./3.webp", alt: "图三" }],
			},
			{
				type: "paragraph",
				children: [{ type: "image", url: "./4.webp", alt: "图四" }],
			},
			{
				type: "paragraph",
				children: [{ type: "image", url: "./1.webp", alt: "图五" }],
			},
			{
				type: "paragraph",
				children: [{ type: "image", url: "./2.webp", alt: "图六" }],
			},
			{
				type: "paragraph",
				children: [{ type: "image", url: "./3.webp", alt: "图七" }],
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "[/grid]" }],
			},
		],
	};

	remarkImageGrid()(tree);
	parseDirectiveNode()(tree, { _data: {} });

	const grid = tree.children[0];

	assert.equal(grid.data.hName, "image-grid");
	assert.equal(grid.data.hProperties.columns, "4");
	assert.equal(grid.data.hProperties["data-columns"], "4");
	assert.equal(grid.data.hProperties.layout, "4,3");
	assert.equal(grid.data.hProperties["data-layout"], "4,3");
	assert.equal(grid.data.hProperties.gap, "lg");
	assert.equal(grid.data.hProperties["data-gap"], "lg");
});
