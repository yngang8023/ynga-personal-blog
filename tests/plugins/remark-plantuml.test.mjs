import assert from "node:assert/strict";
import test from "node:test";

import { remarkPlantuml } from "../../src/plugins/remark-plantuml.js";

test("remarkPlantuml converts plantuml code fences into diagram container nodes", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "code",
				lang: "plantuml",
				value: "@startuml\nAlice -> Bob: Hello\n@enduml",
			},
		],
	};

	remarkPlantuml({
		servers: [
			"https://example.com/plantuml",
			"https://backup.example.com/plantuml",
		],
		darkTheme: "cyborg",
	})(tree);

	const [node] = tree.children;
	assert.equal(node.type, "plantuml");
	assert.equal(node.data.hName, "div");
	assert.deepEqual(node.data.hProperties.className, ["plantuml-container"]);
	assert.match(
		node.data.hProperties["data-plantuml-light"],
		/^https:\/\/example\.com\/plantuml\/svg\//,
	);
	assert.match(
		node.data.hProperties["data-plantuml-dark"],
		/^https:\/\/example\.com\/plantuml\/svg\//,
	);
	assert.notEqual(
		node.data.hProperties["data-plantuml-light"],
		node.data.hProperties["data-plantuml-dark"],
	);
	assert.deepEqual(
		JSON.parse(node.data.hProperties["data-plantuml-light-sources"]),
		[
			node.data.hProperties["data-plantuml-light"],
			node.data.hProperties["data-plantuml-light"].replace(
				"https://example.com/plantuml/",
				"https://backup.example.com/plantuml/",
			),
		],
	);
	assert.deepEqual(
		JSON.parse(node.data.hProperties["data-plantuml-dark-sources"]),
		[
			node.data.hProperties["data-plantuml-dark"],
			node.data.hProperties["data-plantuml-dark"].replace(
				"https://example.com/plantuml/",
				"https://backup.example.com/plantuml/",
			),
		],
	);
	assert.equal(
		node.data.hChildren[0].value,
		"@startuml\nAlice -> Bob: Hello\n@enduml",
	);
});

test("remarkPlantuml leaves non-plantuml code fences untouched", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "code",
				lang: "ts",
				value: "console.log('hello');",
			},
		],
	};

	remarkPlantuml()(tree);

	const [node] = tree.children;
	assert.equal(node.type, "code");
	assert.equal(node.lang, "ts");
	assert.equal(node.value, "console.log('hello');");
});

test("remarkPlantuml also accepts puml and uml aliases", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "code",
				lang: "puml",
				value: "@startuml\nA -> B\n@enduml",
			},
		],
	};

	remarkPlantuml()(tree);

	assert.equal(tree.children[0].type, "plantuml");

	const otherTree = {
		type: "root",
		children: [
			{
				type: "code",
				lang: "uml",
				value: "@startuml\nB -> C\n@enduml",
			},
		],
	};

	remarkPlantuml()(otherTree);

	assert.equal(otherTree.children[0].type, "plantuml");
});
