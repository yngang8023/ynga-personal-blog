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
		servers: ["https://example.com/diagram/plantuml"],
		darkTheme: "cyborg",
	})(tree);

	const [node] = tree.children;
	assert.equal(node.type, "plantuml");
	assert.equal(node.data.hName, "div");
	assert.deepEqual(node.data.hProperties.className, ["plantuml-container"]);
	assert.match(
		node.data.hProperties["data-plantuml-light"],
		/^https:\/\/example\.com\/diagram\/plantuml\/svg\//,
	);
	assert.match(
		node.data.hProperties["data-plantuml-dark"],
		/^https:\/\/example\.com\/diagram\/plantuml\/svg\//,
	);
	assert.notEqual(
		node.data.hProperties["data-plantuml-light"],
		node.data.hProperties["data-plantuml-dark"],
	);
	assert.deepEqual(
		JSON.parse(node.data.hProperties["data-plantuml-light-sources"]),
		[node.data.hProperties["data-plantuml-light"]],
	);
	assert.deepEqual(
		JSON.parse(node.data.hProperties["data-plantuml-dark-sources"]),
		[node.data.hProperties["data-plantuml-dark"]],
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

test("remarkPlantuml rewrites remote C4-PlantUML GitHub includes to PlantUML stdlib includes", () => {
	const tree = {
		type: "root",
		children: [
			{
				type: "code",
				lang: "plantuml",
				value: [
					"@startuml",
					"!includeurl https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml",
					"Person(user, \"User\")",
					"@enduml",
				].join("\n"),
			},
		],
	};

	remarkPlantuml({
		servers: ["https://example.com/diagram/plantuml"],
	})(tree);

	const [node] = tree.children;
	assert.equal(node.type, "plantuml");
	assert.match(node.data.hChildren[0].value, /!include <C4\/C4_Container>/);
	assert.doesNotMatch(node.data.hChildren[0].value, /raw\.githubusercontent\.com/);
	assert.doesNotMatch(node.data.hChildren[0].value, /!includeurl/);
});
