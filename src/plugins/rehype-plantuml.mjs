import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { h } from "hastscript";
import { visit } from "unist-util-visit";

const plantumlRenderScript = readFileSync(
	new URL("./plantuml-render-script.js", import.meta.url),
	"utf8",
);
const PLANTUML_PLACEHOLDER_SVG =
	"data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3C/svg%3E";

function extractText(node) {
	if (node.type === "text") {
		return node.value || "";
	}

	if (node.children) {
		return node.children.map(extractText).join("");
	}

	return "";
}

function generateId() {
	const rand = Math.random().toString(36).slice(2, 8);
	return `plantuml-${rand}`;
}

const scriptInjectedTrees = new WeakSet();

export function rehypePlantuml() {
	return (tree) => {
		let foundAny = false;

		visit(tree, "element", (node) => {
			if (node.tagName !== "div" || !node.properties) {
				return;
			}

			const classProp = node.properties.className;
			const hasMarker = Array.isArray(classProp)
				? classProp.includes("plantuml-container")
				: typeof classProp === "string"
					? classProp.split(/\s+/).includes("plantuml-container")
					: false;

			if (!hasMarker) {
				return;
			}

			const lightSrc =
				node.properties["data-plantuml-light"] ||
				node.properties.dataPlantumlLight ||
				"";
			const darkSrc =
				node.properties["data-plantuml-dark"] ||
				node.properties.dataPlantumlDark ||
				lightSrc;
			const lightSources =
				node.properties["data-plantuml-light-sources"] ||
				node.properties.dataPlantumlLightSources ||
				JSON.stringify([lightSrc].filter(Boolean));
			const darkSources =
				node.properties["data-plantuml-dark-sources"] ||
				node.properties.dataPlantumlDarkSources ||
				JSON.stringify([darkSrc].filter(Boolean));
			let altText =
				node.properties["data-plantuml-alt"] ||
				node.properties.dataPlantumlAlt ||
				"";

			if (!altText) {
				altText = extractText(node).trim().slice(0, 200);
			}

			if (!lightSrc) {
				return;
			}

			const wrapper = h(
				"div",
				{
					class: "plantuml-wrapper",
					id: generateId(),
					"data-loading": "true",
					"data-source-base64": Buffer.from(extractText(node), "utf8").toString(
						"base64",
					),
				},
				[
					h(
						"div",
						{
							class: "plantuml-loading",
						},
						"PlantUML 图表加载中...",
					),
					h("img", {
						class: "plantuml-image plantuml-image-light",
						alt: altText || "PlantUML diagram",
						src: PLANTUML_PLACEHOLDER_SVG,
						"data-light-src": lightSrc,
						"data-dark-src": darkSrc,
						"data-light-sources": lightSources,
						"data-dark-sources": darkSources,
						"data-plantuml-theme": "light",
						loading: "lazy",
						decoding: "async",
					}),
					h("img", {
						class: "plantuml-image plantuml-image-dark",
						alt: altText || "PlantUML diagram",
						src: PLANTUML_PLACEHOLDER_SVG,
						"data-light-src": lightSrc,
						"data-dark-src": darkSrc,
						"data-light-sources": lightSources,
						"data-dark-sources": darkSources,
						"data-plantuml-theme": "dark",
						hidden: true,
						loading: "lazy",
						decoding: "async",
					}),
				],
			);

			node.tagName = "div";
			node.properties = { class: "plantuml-diagram-container" };
			node.children = [wrapper];
			foundAny = true;
		});

		if (foundAny && !scriptInjectedTrees.has(tree)) {
			scriptInjectedTrees.add(tree);
			tree.children = [
				...(tree.children || []),
				h("script", { type: "text/javascript" }, plantumlRenderScript),
			];
		}
	};
}
