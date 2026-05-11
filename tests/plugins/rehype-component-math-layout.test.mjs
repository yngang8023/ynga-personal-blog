import assert from "node:assert/strict";
import test from "node:test";

import {
	MathColComponent,
	MathColsComponent,
	MathCompactComponent,
	MathLongComponent,
	MathStatementComponent,
} from "../../src/plugins/rehype-component-math-layout.mjs";

test("MathCompactComponent renders a compact paper-style math block with optional label", () => {
	const block = MathCompactComponent(
		{
			"has-directive-label": true,
		},
		[
			{
				tagName: "p",
				properties: {},
				children: [{ type: "text", value: "单行紧凑公式" }],
			},
			{
				tagName: "p",
				properties: {},
				children: [{ type: "text", value: "body" }],
			},
		],
	);

	assert.equal(block.tagName, "section");
	assert.ok(block.properties.className.includes("paper-math-compact"));
	assert.equal(block.children[0].properties.className[0], "paper-math-head");
	assert.equal(block.children[1].properties.className[0], "paper-math-body");
	assert.equal(block.children[0].children[0].children[0].value, "单行紧凑公式");
});

test("MathColsComponent and MathColComponent create a responsive two-column layout shell", () => {
	const leftCol = MathColComponent(
		{
			"has-directive-label": true,
		},
		[
			{
				tagName: "p",
				properties: {},
				children: [{ type: "text", value: "左栏" }],
			},
			{
				tagName: "p",
				properties: {},
				children: [{ type: "text", value: "left-body" }],
			},
		],
	);
	const rightCol = MathColComponent({}, [
		{
			tagName: "p",
			properties: {},
			children: [{ type: "text", value: "right-body" }],
		},
	]);
	const layout = MathColsComponent({}, [leftCol, rightCol]);

	assert.equal(layout.tagName, "section");
	assert.ok(layout.properties.className.includes("paper-math-cols"));
	assert.equal(layout.children.length, 2);
	assert.ok(leftCol.properties.className.includes("paper-math-col"));
	assert.equal(leftCol.children[0].properties.className[0], "paper-math-head");
	assert.equal(leftCol.children[1].properties.className[0], "paper-math-body");
	assert.ok(rightCol.properties.className.includes("paper-math-col"));
});

test("MathStatementComponent creates theorem and lemma shells with generated numbering hooks", () => {
	const theorem = MathStatementComponent(
		{
			"has-directive-label": true,
		},
		[
			{
				tagName: "p",
				properties: {},
				children: [{ type: "text", value: "一阶最优性条件" }],
			},
			{
				tagName: "p",
				properties: {},
				children: [{ type: "text", value: "theorem-body" }],
			},
		],
		"theorem",
	);
	const lemma = MathStatementComponent({}, [
		{
			tagName: "p",
			properties: {},
			children: [{ type: "text", value: "lemma-body" }],
		},
	], "lemma");

	assert.equal(theorem.tagName, "section");
	assert.ok(theorem.properties.className.includes("paper-statement"));
	assert.ok(theorem.properties.className.includes("paper-theorem"));
	assert.equal(theorem.children[0].properties.className[0], "math-statement-head");
	assert.equal(theorem.children[1].properties.className[0], "math-statement-body");
	assert.equal(theorem.children[0].children[1].children[0].value, "一阶最优性条件");

	assert.equal(lemma.tagName, "section");
	assert.ok(lemma.properties.className.includes("paper-lemma"));
	assert.equal(lemma.children[0].children[0].properties.className[0], "math-statement-kind");
});

test("MathLongComponent keeps long-formula blocks inside a dedicated shell", () => {
	const block = MathLongComponent(
		{
			"has-directive-label": true,
		},
		[
			{
				tagName: "p",
				properties: {},
				children: [{ type: "text", value: "长公式单行滚动" }],
			},
			{
				tagName: "p",
				properties: {},
				children: [{ type: "text", value: "long-body" }],
			},
		],
	);

	assert.equal(block.tagName, "section");
	assert.ok(block.properties.className.includes("paper-math-long"));
	assert.equal(block.children[0].properties.className[0], "paper-math-head");
	assert.equal(block.children[1].properties.className[0], "paper-math-body");
});
