/// <reference types="mdast" />
import { h } from "hastscript";

const invalidDirectiveNode = (message) =>
	h("div", { class: "hidden" }, [message]);

const normalizeChildren = (children) =>
	Array.isArray(children) ? children.filter(Boolean) : [];

const toHastNode = (node) => {
	if (typeof node === "string") {
		return {
			type: "text",
			value: node,
		};
	}

	if (!node || typeof node !== "object") {
		return {
			type: "text",
			value: "",
		};
	}

	if (node.type === "text" || node.type === "element") {
		return node;
	}

	if (typeof node.value === "string") {
		return {
			type: "text",
			value: node.value,
		};
	}

	if (node.tagName) {
		return {
			type: "element",
			tagName: node.tagName,
			properties: node.properties || {},
			children: normalizeChildren(node.children).map(toHastNode),
		};
	}

	return {
		type: "text",
		value: "",
	};
};

const extractDirectiveLabel = (properties, children) => {
	const normalizedChildren = normalizeChildren(children);

	if (
		!properties?.["has-directive-label"] ||
		normalizedChildren.length === 0
	) {
		return {
			label: null,
			bodyChildren: normalizedChildren.map(toHastNode),
		};
	}

	const labelNode = normalizedChildren[0];
	const label = toHastNode({
		...labelNode,
		tagName: "div",
	});

	return {
		label,
		bodyChildren: normalizedChildren.slice(1).map(toHastNode),
	};
};

const createMathBlock = (className, properties, children) => {
	const { label, bodyChildren } = extractDirectiveLabel(properties, children);

	if (bodyChildren.length === 0) {
		return invalidDirectiveNode(
			`Invalid directive. ("${className}" requires block content)`,
		);
	}

	const sectionChildren = [];

	if (label) {
		sectionChildren.push(
			h("div", { class: "paper-math-head" }, [label]),
		);
	}

	sectionChildren.push(
		h("div", { class: "paper-math-body" }, bodyChildren),
	);

	return h("section", { class: `paper-math-block ${className}` }, sectionChildren);
};

/**
 * Creates a compact paper-style math block.
 *
 * @param {Object} properties
 * @param {import('mdast').RootContent[]} children
 * @returns {import('mdast').Parent}
 */
export function MathCompactComponent(properties, children) {
	return createMathBlock("paper-math-compact", properties, children);
}

/**
 * Creates a long-formula scroll block.
 *
 * @param {Object} properties
 * @param {import('mdast').RootContent[]} children
 * @returns {import('mdast').Parent}
 */
export function MathLongComponent(properties, children) {
	return createMathBlock("paper-math-long", properties, children);
}

/**
 * Creates a math column block used inside a responsive column layout.
 *
 * @param {Object} properties
 * @param {import('mdast').RootContent[]} children
 * @returns {import('mdast').Parent}
 */
export function MathColComponent(properties, children) {
	const { label, bodyChildren } = extractDirectiveLabel(properties, children);

	if (bodyChildren.length === 0) {
		return invalidDirectiveNode(
			'Invalid directive. ("math-col" requires block content)',
		);
	}

	const columnChildren = [];

	if (label) {
		columnChildren.push(
			h("div", { class: "paper-math-head" }, [label]),
		);
	}

	columnChildren.push(
		h("div", { class: "paper-math-body" }, bodyChildren),
	);

	return h("div", { class: "paper-math-col" }, columnChildren);
}

/**
 * Creates a responsive two-column math layout.
 *
 * @param {Object} properties
 * @param {import('mdast').RootContent[]} children
 * @returns {import('mdast').Parent}
 */
export function MathColsComponent(properties, children) {
	const { label, bodyChildren } = extractDirectiveLabel(properties, children);

	if (bodyChildren.length === 0) {
		return invalidDirectiveNode(
			'Invalid directive. ("math-cols" requires one or more "math-col" children)',
		);
	}

	const sectionChildren = [];

	if (label) {
		sectionChildren.push(
			h("div", { class: "paper-math-head" }, [label]),
		);
	}

	sectionChildren.push(...bodyChildren);

	return h("section", { class: "paper-math-cols" }, sectionChildren);
}

/**
 * Creates a theorem/lemma statement block.
 *
 * @param {Object} properties
 * @param {import('mdast').RootContent[]} children
 * @param {"theorem"|"lemma"} type
 * @returns {import('mdast').Parent}
 */
export function MathStatementComponent(properties, children, type) {
	const { label, bodyChildren } = extractDirectiveLabel(properties, children);

	if (bodyChildren.length === 0) {
		return invalidDirectiveNode(
			`Invalid directive. ("${type}" requires block content)`,
		);
	}

	const titleChildren = [
		h("span", {
			class: "math-statement-kind",
			"aria-label": type,
		}),
	];

	if (label) {
		titleChildren.push(
			h("span", { class: "math-statement-title" }, label.children || [label]),
		);
	}

	return h(
		"section",
		{ class: `paper-statement paper-${type}` },
		[
			h("div", { class: "math-statement-head" }, titleChildren),
			h("div", { class: "math-statement-body" }, bodyChildren),
		],
	);
}
