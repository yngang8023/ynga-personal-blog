import assert from "node:assert/strict";
import test from "node:test";

import { ImageGridComponent } from "../../src/plugins/rehype-component-image-grid.mjs";

const createFigure = (src, alt, caption = alt) => ({
	type: "element",
	tagName: "figure",
	properties: {},
	children: [
		{
			type: "element",
			tagName: "img",
			properties: {
				src,
				alt,
				title: caption,
			},
			children: [],
		},
		{
			type: "element",
			tagName: "figcaption",
			properties: {},
			children: [{ type: "text", value: caption }],
		},
	],
});

test("ImageGridComponent renders row-specific layout metadata so each row can fill its own width", () => {
	const grid = ImageGridComponent(
		{
			columns: "4",
			layout: "4,3",
			gap: "sm",
		},
		[
			createFigure("./1.webp", "图一"),
			createFigure("./2.webp", "图二"),
			createFigure("./3.webp", "图三"),
			createFigure("./4.webp", "图四"),
			createFigure("./1.webp", "图五"),
			createFigure("./2.webp", "图六"),
			createFigure("./3.webp", "图七"),
		],
	);

	assert.equal(grid.tagName, "div");
	assert.equal(grid.properties["data-columns"] || grid.properties.dataColumns, "4");
	assert.equal(grid.properties["data-layout"] || grid.properties.dataLayout, "4,3");
	assert.equal(grid.properties["data-gap"] || grid.properties.dataGap, "sm");
	assert.equal(grid.children.length, 2);

	const firstRow = grid.children[0];
	const secondRow = grid.children[1];

	assert.equal(firstRow.properties["data-columns"] || firstRow.properties.dataColumns, "4");
	assert.match(firstRow.properties.style, /--image-grid-columns:\s*4/);
	assert.equal(firstRow.children.length, 4);

	assert.equal(secondRow.properties["data-columns"] || secondRow.properties.dataColumns, "3");
	assert.match(secondRow.properties.style, /--image-grid-columns:\s*3/);
	assert.equal(secondRow.children.length, 3);
});

test("ImageGridComponent exposes responsive mobile and tablet column metadata", () => {
	const grid = ImageGridComponent(
		{
			columns: "4",
			"data-desktop-visible": "true",
			"data-tablet-visible": "true",
			"data-mobile-visible": "true",
			"data-tablet-columns": "3",
			"data-mobile-columns": "2",
		},
		[
			createFigure("./1.webp", "图一"),
			createFigure("./2.webp", "图二"),
			createFigure("./3.webp", "图三"),
			createFigure("./4.webp", "图四"),
		],
	);

	assert.equal(grid.properties["data-columns"] || grid.properties.dataColumns, "4");
	assert.equal(grid.properties["data-desktop-visible"] || grid.properties.dataDesktopVisible, "true");
	assert.equal(grid.properties["data-tablet-visible"] || grid.properties.dataTabletVisible, "true");
	assert.equal(grid.properties["data-mobile-visible"] || grid.properties.dataMobileVisible, "true");
	assert.equal(grid.properties["data-tablet-columns"] || grid.properties.dataTabletColumns, "3");
	assert.equal(grid.properties["data-mobile-columns"] || grid.properties.dataMobileColumns, "2");
	assert.match(grid.properties.style, /--image-grid-tablet-columns:\s*3/);
	assert.match(grid.properties.style, /--image-grid-mobile-columns:\s*2/);
});

test("ImageGridComponent carries device visibility flags into the rendered gallery", () => {
	const grid = ImageGridComponent(
		{
			columns: "4",
			"data-desktop-visible": "true",
			"data-tablet-visible": "false",
			"data-mobile-visible": "false",
			"data-tablet-columns": "3",
			"data-mobile-columns": "2",
		},
		[
			createFigure("./1.webp", "图一"),
			createFigure("./2.webp", "图二"),
			createFigure("./3.webp", "图三"),
			createFigure("./4.webp", "图四"),
		],
	);

	assert.equal(grid.properties["data-desktop-visible"] || grid.properties.dataDesktopVisible, "true");
	assert.equal(grid.properties["data-tablet-visible"] || grid.properties.dataTabletVisible, "false");
	assert.equal(grid.properties["data-mobile-visible"] || grid.properties.dataMobileVisible, "false");
	assert.match(grid.properties.style, /--image-grid-tablet-columns:\s*3/);
	assert.match(grid.properties.style, /--image-grid-mobile-columns:\s*2/);
});
