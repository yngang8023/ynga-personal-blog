import assert from "node:assert/strict";
import test from "node:test";
import remarkSmartypants from "../../node_modules/.pnpm/remark-smartypants@3.0.2/node_modules/remark-smartypants/dist/plugin.js";
import remarkParse from "../../node_modules/.pnpm/remark-parse@11.0.0/node_modules/remark-parse/index.js";
import { unified } from "../../node_modules/.pnpm/unified@11.0.5/node_modules/unified/index.js";

import { remarkImageGrid } from "../../src/plugins/remark-image-grid.js";

test("remarkImageGrid wraps multi-paragraph [grid] image groups into a responsive gallery container", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "paragraph",
				children: [{ type: "text", value: "[grid]" }],
			},
			{
				type: "paragraph",
				children: [
					{
						type: "image",
						url: "./1.webp",
						alt: "示例图片一",
						title: "图一说明",
					},
				],
			},
			{
				type: "paragraph",
				children: [
					{
						type: "image",
						url: "./2.webp",
						alt: "示例图片二",
						title: "图二说明",
					},
				],
			},
			{
				type: "paragraph",
				children: [{ type: "text", value: "[/grid]" }],
			},
		],
	};

	remarkImageGrid()(tree);

	assert.equal(tree.children.length, 1);

	const grid = tree.children[0];
	assert.equal(grid.type, "containerDirective");
	assert.equal(grid.name, "image-grid");
	assert.equal(grid.attributes.columns, "2");
	assert.equal(grid.children.length, 2);
});

test("remarkImageGrid supports [grid] and [/grid] markers in the same paragraph", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "paragraph",
				children: [
					{ type: "text", value: "[grid] " },
					{
						type: "image",
						url: "./1.webp",
						alt: "图一",
						title: "说明一",
					},
					{ type: "text", value: " " },
					{
						type: "image",
						url: "./2.webp",
						alt: "图二",
						title: "说明二",
					},
					{ type: "text", value: " [/grid]" },
				],
			},
		],
	};

	remarkImageGrid()(tree);

	assert.equal(tree.children.length, 1);
	assert.equal(tree.children[0].type, "containerDirective");
	assert.equal(tree.children[0].name, "image-grid");
	assert.equal(tree.children[0].attributes.columns, "2");
});

test("remarkImageGrid supports explicit column counts for multi-row gallery layouts", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "paragraph",
				children: [{ type: "text", value: "[grid cols=2]" }],
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
				children: [{ type: "text", value: "[/grid]" }],
			},
		],
	};

	remarkImageGrid()(tree);

	assert.equal(tree.children.length, 1);
	assert.equal(tree.children[0].name, "image-grid");
	assert.equal(tree.children[0].attributes.columns, "2");
});

test("remarkImageGrid stores rows and columns metadata when both are explicitly provided", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "paragraph",
				children: [{ type: "text", value: "[grid rows=2 cols=3]" }],
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
				children: [{ type: "text", value: "[/grid]" }],
			},
		],
	};

	remarkImageGrid()(tree);

	assert.equal(tree.children.length, 1);
	assert.equal(tree.children[0].attributes.columns, "3");
	assert.equal(tree.children[0].attributes.rows, "2");
});

test("remarkImageGrid supports explicit row layout definitions", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "paragraph",
				children: [{ type: "text", value: "[grid layout=\"4,3\"]" }],
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

	assert.equal(tree.children.length, 1);
	assert.equal(tree.children[0].attributes.layout, "4,3");
	assert.equal(tree.children[0].attributes.columns, "4");
});

test("remarkImageGrid keeps layout metadata after smart quotes transform layout delimiters", () => {
	const markdown = `[grid layout="4,3"]
![图一](./1.webp "图一")
![图二](./2.webp "图二")
![图三](./3.webp "图三")
![图四](./4.webp "图四")
![图五](./1.webp "图五")
![图六](./2.webp "图六")
![图七](./3.webp "图七")
[/grid]`;

	const tree = unified()
		.use(remarkParse)
		.use(remarkSmartypants)
		.use(remarkImageGrid)
		.runSync(unified().use(remarkParse).parse(markdown));

	assert.equal(tree.children.length, 1);
	assert.equal(tree.children[0].name, "image-grid");
	assert.equal(tree.children[0].attributes.layout, "4,3");
	assert.equal(tree.children[0].attributes.columns, "4");
});

test("remarkImageGrid supports gap presets for gallery spacing", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "paragraph",
				children: [{ type: "text", value: "[grid cols=3 gap=lg]" }],
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
				children: [{ type: "text", value: "[/grid]" }],
			},
		],
	};

	remarkImageGrid()(tree);

	assert.equal(tree.children.length, 1);
	assert.equal(tree.children[0].attributes.columns, "3");
	assert.equal(tree.children[0].attributes.gap, "lg");
});

test("remarkImageGrid stores responsive mobile and tablet column metadata", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "paragraph",
				children: [{ type: "text", value: "[grid cols=4 mobile=2 tablet=3]" }],
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
				children: [{ type: "text", value: "[/grid]" }],
			},
		],
	};

	remarkImageGrid()(tree);

	assert.equal(tree.children.length, 1);
	assert.equal(tree.children[0].attributes.columns, "4");
	assert.equal(tree.children[0].attributes["data-desktop-visible"], "true");
	assert.equal(tree.children[0].attributes["data-tablet-visible"], "true");
	assert.equal(tree.children[0].attributes["data-mobile-visible"], "true");
	assert.equal(tree.children[0].attributes["data-tablet-columns"], "3");
	assert.equal(tree.children[0].attributes["data-mobile-columns"], "2");
});

test("remarkImageGrid supports device visibility toggles with explicit tablet and mobile column settings", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "paragraph",
				children: [
					{
						type: "text",
						value:
							"[grid cols=4 desktop=true tablet=false mobile=false tabletCols=3 mobileCols=2]",
					},
				],
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
				children: [{ type: "text", value: "[/grid]" }],
			},
		],
	};

	remarkImageGrid()(tree);

	assert.equal(tree.children.length, 1);
	assert.equal(tree.children[0].attributes.columns, "4");
	assert.equal(tree.children[0].attributes["data-desktop-visible"], "true");
	assert.equal(tree.children[0].attributes["data-tablet-visible"], "false");
	assert.equal(tree.children[0].attributes["data-mobile-visible"], "false");
	assert.equal(tree.children[0].attributes["data-tablet-columns"], "3");
	assert.equal(tree.children[0].attributes["data-mobile-columns"], "2");
});
