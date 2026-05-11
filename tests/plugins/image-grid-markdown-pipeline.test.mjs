import assert from "node:assert/strict";
import test from "node:test";

import rehypeComponents from "rehype-components";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import remarkSectionize from "remark-sectionize";

import remarkParse from "../../node_modules/.pnpm/remark-parse@11.0.0/node_modules/remark-parse/index.js";
import remarkRehype from "../../node_modules/.pnpm/remark-rehype@11.1.2/node_modules/remark-rehype/index.js";
import { unified } from "../../node_modules/.pnpm/unified@11.0.5/node_modules/unified/index.js";

import { ImageGridComponent } from "../../src/plugins/rehype-component-image-grid.mjs";
import { parseDirectiveNode } from "../../src/plugins/remark-directive-rehype.js";
import { remarkImageGrid } from "../../src/plugins/remark-image-grid.js";

const hasClassName = (node, className) => {
	const value = node?.properties?.className;

	if (Array.isArray(value)) {
		return value.includes(className);
	}

	if (typeof value === "string") {
		return value.split(/\s+/).includes(className);
	}

	return false;
};

const markdown = `
[grid layout="4,3"]
![图一](./1.webp "图一")
![图二](./2.webp "图二")
![图三](./3.webp "图三")
![图四](./4.webp "图四")
![图五](./1.webp "图五")
![图六](./2.webp "图六")
![图七](./3.webp "图七")
[/grid]
`;

test("markdown pipeline keeps image-grid layout metadata through mdast-to-hast conversion", async () => {
	const file = await unified()
		.use(remarkParse)
		.use(remarkDirective)
		.use(remarkImageGrid)
		.use(remarkSectionize)
		.use(parseDirectiveNode)
		.use(remarkRehype)
		.run(unified().use(remarkParse).parse(markdown));

	let imageGrid = null;

	visit(file, (node) => {
		if (node.type === "element" && node.tagName === "image-grid") {
			imageGrid = node;
		}
	});

	assert.ok(imageGrid);
	assert.equal(imageGrid.properties.columns, "4");
	assert.equal(imageGrid.properties["data-columns"], "4");
	assert.equal(imageGrid.properties.layout, "4,3");
	assert.equal(imageGrid.properties["data-layout"], "4,3");
	assert.equal(imageGrid.properties["data-gap"], undefined);
});

test("rehype image-grid component receives layout metadata from real markdown input", async () => {
	let capturedProperties = null;
	let capturedOutput = null;

	const tree = await unified()
		.use(remarkParse)
		.use(remarkDirective)
		.use(remarkImageGrid)
		.use(remarkSectionize)
		.use(parseDirectiveNode)
		.use(remarkRehype)
		.use(rehypeComponents, {
			components: {
				"image-grid": (properties, children, context) => {
					capturedProperties = properties;
					const rendered = ImageGridComponent(properties, children, context);
					capturedOutput = rendered;
					return rendered;
				},
			},
		})
		.run(unified().use(remarkParse).parse(markdown));

	assert.ok(tree);
	assert.ok(capturedProperties);
	assert.ok(capturedOutput);
	assert.equal(capturedProperties.columns, "4");
	assert.equal(
		capturedProperties["data-layout"] ?? capturedProperties.dataLayout ?? capturedProperties.layout,
		"4,3",
	);

	assert.equal(
		capturedOutput.properties["data-layout"] ?? capturedOutput.properties.dataLayout,
		"4,3",
		JSON.stringify(
			{
				capturedProperties,
				capturedOutput,
			},
			null,
			2,
		),
	);

	let outputGrid = null;

	visit(tree, (node) => {
		if (
			node.type === "element" &&
			node.tagName === "div" &&
			hasClassName(node, "image-grid")
		) {
			outputGrid = node;
		}
	});

	assert.ok(outputGrid);
	assert.equal(
		outputGrid.properties["data-layout"] ?? outputGrid.properties.dataLayout,
		"4,3",
		JSON.stringify(
			{
				capturedProperties,
				capturedOutput,
				outputGrid,
			},
			null,
			2,
		),
	);

	const rows = outputGrid.children.filter(
		(node) =>
			node.type === "element" &&
			node.tagName === "div" &&
			hasClassName(node, "image-grid-row"),
	);

	assert.equal(rows.length, 2);
	assert.equal(rows[0].properties["data-columns"] ?? rows[0].properties.dataColumns, "4");
	assert.equal(rows[1].properties["data-columns"] ?? rows[1].properties.dataColumns, "3");
});
