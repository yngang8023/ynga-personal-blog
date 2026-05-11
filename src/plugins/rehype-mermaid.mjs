import { readFileSync } from "node:fs";
import { h } from "hastscript";
import { visit } from "unist-util-visit";

const mermaidRenderScript = readFileSync(
	new URL("./mermaid-render-script.js", import.meta.url),
	"utf8",
);

const scriptInjectedTrees = new WeakSet();

function hasMermaidMarker(node) {
	if (node.tagName !== "div" || !node.properties) {
		return false;
	}

	const classProp = node.properties.className;
	if (Array.isArray(classProp)) {
		return classProp.includes("mermaid-container");
	}

	if (typeof classProp === "string") {
		return classProp.split(/\s+/).includes("mermaid-container");
	}

	return false;
}

export function rehypeMermaid() {
	return (tree) => {
		let foundAny = false;

		visit(tree, "element", (node) => {
			if (!hasMermaidMarker(node)) {
				return;
			}

			const mermaidCode =
				node.properties["data-mermaid-code"] ||
				node.properties.dataMermaidCode ||
				"";

			const mermaidId = `mermaid-${Math.random().toString(36).slice(2, 8)}`;

			const mermaidHost = h(
				"div",
				{
					class: "mermaid",
					"data-mermaid-code": mermaidCode,
					"data-mermaid-state": "idle",
				},
				[
					h(
						"div",
						{
							class: "mermaid-loading",
						},
						"Mermaid 图表加载中...",
					),
				],
			);

			const wrapper = h(
				"div",
				{
					class: "mermaid-wrapper",
					id: mermaidId,
				},
				[mermaidHost],
			);

			node.tagName = "div";
			node.properties = {
				class: "mermaid-diagram-container",
				"data-mermaid-ready": "false",
			};
			node.children = [wrapper];
			foundAny = true;
		});

		if (foundAny && !scriptInjectedTrees.has(tree)) {
			scriptInjectedTrees.add(tree);
			tree.children = [
				...(tree.children || []),
				h("script", { type: "text/javascript" }, mermaidRenderScript),
			];
		}
	};
}
