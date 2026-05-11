import assert from "node:assert/strict";
import test from "node:test";

import { rehypeMermaid } from "../../src/plugins/rehype-mermaid.mjs";

test("rehypeMermaid rewrites placeholders into loading-first diagram containers", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "element",
				tagName: "div",
				properties: {
					className: ["mermaid-container"],
					"data-mermaid-code": "graph TD\nA-->B",
				},
				children: [{ type: "text", value: "graph TD\nA-->B" }],
			},
		],
	};

	rehypeMermaid()(tree);

	const [diagramNode, scriptNode] = tree.children;
	assert.equal(diagramNode.properties.class, "mermaid-diagram-container");

	const wrapper = diagramNode.children[0];
	assert.equal(
		wrapper.properties.class || wrapper.properties.className?.[0],
		"mermaid-wrapper",
	);

	const host = wrapper.children[0];
	assert.equal(host.tagName, "div");
	assert.deepEqual(host.properties.className, ["mermaid"]);
	assert.equal(
		host.properties["data-mermaid-code"] || host.properties.dataMermaidCode,
		"graph TD\nA-->B",
	);

	const placeholder = host.children[0];
	assert.equal(placeholder.tagName, "div");
	assert.deepEqual(placeholder.properties.className, ["mermaid-loading"]);

	assert.equal(scriptNode.tagName, "script");
	assert.match(scriptNode.children[0].value, /window\.mermaidInitialized/);
});
