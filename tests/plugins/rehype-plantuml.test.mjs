import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";

import { rehypePlantuml } from "../../src/plugins/rehype-plantuml.mjs";

test("rehypePlantuml rewrites plantuml placeholders into interactive resident-theme image containers", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "element",
				tagName: "div",
				properties: {
					className: ["plantuml-container"],
					"data-plantuml-light": "https://example.com/light.svg",
					"data-plantuml-dark": "https://example.com/dark.svg",
					"data-plantuml-light-sources": JSON.stringify([
						"https://example.com/light.svg",
						"https://backup.example.com/light.svg",
					]),
					"data-plantuml-dark-sources": JSON.stringify([
						"https://example.com/dark.svg",
						"https://backup.example.com/dark.svg",
					]),
					"data-plantuml-alt": "Alice to Bob",
				},
				children: [{ type: "text", value: "@startuml\nAlice -> Bob\n@enduml" }],
			},
			{
				type: "element",
				tagName: "div",
				properties: {
					className: ["plantuml-container"],
					"data-plantuml-light": "https://example.com/light-2.svg",
					"data-plantuml-dark": "https://example.com/dark-2.svg",
					"data-plantuml-light-sources": JSON.stringify([
						"https://example.com/light-2.svg",
						"https://backup.example.com/light-2.svg",
					]),
					"data-plantuml-dark-sources": JSON.stringify([
						"https://example.com/dark-2.svg",
						"https://backup.example.com/dark-2.svg",
					]),
					"data-plantuml-alt": "Second diagram",
				},
				children: [{ type: "text", value: "@startuml\nBob -> Alice\n@enduml" }],
			},
		],
	};

	rehypePlantuml()(tree);

	const [firstNode, secondNode, scriptNode] = tree.children;
	const firstWrapper = firstNode.children[0];

	assert.equal(firstNode.properties.class, "plantuml-diagram-container");
	assert.equal(secondNode.properties.class, "plantuml-diagram-container");

	const placeholder = firstWrapper.children[0];
	const firstLightImage = firstWrapper.children[1];
	const firstDarkImage = firstWrapper.children[2];
	assert.equal(placeholder.tagName, "div");
	assert.deepEqual(placeholder.properties.className, ["plantuml-loading"]);
	assert.equal(placeholder.children[0].value, "PlantUML 图表加载中...");

	assert.equal(firstLightImage.tagName, "img");
	assert.deepEqual(firstLightImage.properties.className, [
		"plantuml-image",
		"plantuml-image-light",
	]);
	assert.match(firstLightImage.properties.src, /^data:image\/svg\+xml/);
	assert.equal(
		firstLightImage.properties["data-light-src"] ||
			firstLightImage.properties.dataLightSrc,
		"https://example.com/light.svg",
	);
	assert.equal(
		firstLightImage.properties["data-dark-src"] ||
			firstLightImage.properties.dataDarkSrc,
		"https://example.com/dark.svg",
	);
	assert.equal(
		firstLightImage.properties["data-light-sources"] ||
			firstLightImage.properties.dataLightSources,
		JSON.stringify([
			"https://example.com/light.svg",
			"https://backup.example.com/light.svg",
		]),
	);
	assert.equal(
		firstLightImage.properties["data-dark-sources"] ||
			firstLightImage.properties.dataDarkSources,
		JSON.stringify([
			"https://example.com/dark.svg",
			"https://backup.example.com/dark.svg",
		]),
	);
	assert.equal(firstLightImage.properties.alt, "Alice to Bob");
	assert.equal(
		firstLightImage.properties["data-plantuml-theme"] ||
			firstLightImage.properties.dataPlantumlTheme,
		"light",
	);
	assert.equal(
		firstLightImage.properties.hidden,
		undefined,
	);

	assert.equal(firstDarkImage.tagName, "img");
	assert.deepEqual(firstDarkImage.properties.className, [
		"plantuml-image",
		"plantuml-image-dark",
	]);
	assert.match(firstDarkImage.properties.src, /^data:image\/svg\+xml/);
	assert.equal(
		firstDarkImage.properties["data-plantuml-theme"] ||
			firstDarkImage.properties.dataPlantumlTheme,
		"dark",
	);
	assert.equal(firstDarkImage.properties.hidden, true);

	const sourceBase64 =
		firstWrapper.properties["data-source-base64"] ||
		firstWrapper.properties.dataSourceBase64;
	assert.equal(typeof sourceBase64, "string");
	assert.equal(
		Buffer.from(sourceBase64, "base64").toString("utf8"),
		"@startuml\nAlice -> Bob\n@enduml",
	);
	assert.equal(firstWrapper.properties["data-loading"] || firstWrapper.properties.dataLoading, "true");
	assert.equal(firstWrapper.children.length, 3);

	assert.equal(scriptNode.tagName, "script");
	assert.match(scriptNode.children[0].value, /window\.plantumlInitialized/);
});
