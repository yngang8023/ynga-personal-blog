/// <reference types="mdast" />
import { h } from "hastscript";

const invalidDirectiveNode = (message) =>
	h("div", { class: "hidden" }, [message]);
const BOOLEAN_TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const BOOLEAN_FALSE_VALUES = new Set(["false", "0", "no", "off"]);

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

const collectGridItems = (nodes) => {
	const items = [];

	for (const node of normalizeChildren(nodes)) {
		const hastNode = toHastNode(node);
		if (hastNode.type !== "element") {
			continue;
		}

		if (hastNode.tagName === "p") {
			items.push(...normalizeChildren(hastNode.children));
			continue;
		}

		items.push(hastNode);
	}

	return items.filter(
		(node) =>
			!(node.type === "text" && typeof node.value === "string" && node.value.trim() === ""),
	);
};

const isImageFigure = (node) =>
	node?.type === "element" &&
	node.tagName === "figure" &&
	Array.isArray(node.children) &&
	node.children.some(
		(child) => child.type === "element" && child.tagName === "img",
	);

const createFallbackFigure = (node) =>
	h("figure", { class: "image-grid-figure" }, [node]);

const normalizeColumnCount = (value, fallback = 1) =>
	String(Math.min(Math.max(Number.parseInt(value || String(fallback), 10) || fallback, 1), 4));

const normalizePropertyName = (value) =>
	typeof value === "string"
		? value
			.replace(/^data[A-Z]/, (match) => `data-${match.slice(4).toLowerCase()}`)
			.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
			.toLowerCase()
		: "";

const parseLayout = (value) => {
	if (!value) {
		return [];
	}

	return String(value)
		.split(",")
		.map((part) => normalizeColumnCount(part, 1))
		.map((part) => Number.parseInt(part, 10))
		.filter(Boolean);
};

const splitRowsByLayout = (items, layout, fallbackColumns) => {
	if (!layout || layout.length === 0) {
		return [
			{
				columns: fallbackColumns,
				items,
			},
		];
	}

	const rows = [];
	let currentIndex = 0;

	for (const count of layout) {
		const rowItems = items.slice(currentIndex, currentIndex + count);
		if (rowItems.length === 0) {
			break;
		}

		rows.push({
			columns: String(count),
			items: rowItems,
		});

		currentIndex += count;
	}

	if (currentIndex < items.length) {
		rows.push({
			columns: fallbackColumns,
			items: items.slice(currentIndex),
		});
	}

	return rows;
};

const parseBooleanish = (value) => {
	if (value == null) {
		return null;
	}

	const normalized = String(value).trim().toLowerCase();

	if (BOOLEAN_TRUE_VALUES.has(normalized)) {
		return true;
	}

	if (BOOLEAN_FALSE_VALUES.has(normalized)) {
		return false;
	}

	return null;
};

const parseResponsiveColumns = (value, fallback, max) =>
	String(
		Math.min(
			Math.max(
				Number.parseInt(value || String(fallback), 10) || fallback,
				1,
			),
			max,
		),
	);

export function ImageGridComponent(properties, children) {
	const items = collectGridItems(children);

	if (items.length === 0) {
		return invalidDirectiveNode(
			'Invalid directive. ("image-grid" requires one or more markdown images)',
		);
	}

	const normalizedProperties = new Map();

	for (const [key, value] of Object.entries(properties || {})) {
		normalizedProperties.set(key, value);
		const normalizedKey = normalizePropertyName(key);
		if (normalizedKey) {
			normalizedProperties.set(normalizedKey, value);
		}
	}

	const prop = (name) =>
		normalizedProperties.get(name) ??
		normalizedProperties.get(
			name.replace(/-([a-z])/g, (_, char) => char.toUpperCase()),
		);

	const columns = String(
		Math.min(
			Math.max(Number.parseInt(prop("columns") || prop("data-columns") || "1", 10) || 1, 1),
			4,
		),
	);
	const legacyTablet = prop("data-tablet") || prop("tablet");
	const legacyMobile = prop("data-mobile") || prop("mobile");
	const desktopVisible =
		parseBooleanish(
			prop("data-desktop-visible") || prop("desktop-visible") || prop("desktop"),
		) ?? true;
	const tabletVisible =
		parseBooleanish(
			prop("data-tablet-visible") || prop("tablet-visible") || legacyTablet,
		) ?? true;
	const mobileVisible =
		parseBooleanish(
			prop("data-mobile-visible") || prop("mobile-visible") || legacyMobile,
		) ?? true;
	const mobile = parseResponsiveColumns(
		prop("data-mobile-columns") ||
			prop("mobile-columns") ||
			prop("mobile-cols") ||
			(/^\d+$/.test(String(legacyMobile || "")) ? legacyMobile : null),
		Math.min(Number.parseInt(columns, 10) || 1, 2),
		2,
	);
	const tablet = parseResponsiveColumns(
		prop("data-tablet-columns") ||
			prop("tablet-columns") ||
			prop("tablet-cols") ||
			(/^\d+$/.test(String(legacyTablet || "")) ? legacyTablet : null),
		Math.min(Number.parseInt(columns, 10) || 1, 3),
		3,
	);
	const gridStyle = [
		`--image-grid-tablet-columns: ${tablet};`,
		`--image-grid-mobile-columns: ${mobile};`,
	].join(" ");
	const layout = parseLayout(prop("layout") || prop("data-layout"));
	const gap =
		typeof (prop("gap") || prop("data-gap")) === "string" &&
		["sm", "md", "lg"].includes(prop("gap") || prop("data-gap"))
			? (prop("gap") || prop("data-gap"))
			: "md";

	const figureNodes = items.map((item) =>
		isImageFigure(item) ? item : createFallbackFigure(item),
	);

	const normalizedFigures = figureNodes.map((figure) => {
		const normalizedFigure = toHastNode(figure);
		const originalClass = normalizedFigure.properties?.className;
		const classNames = Array.isArray(originalClass)
			? originalClass
			: typeof originalClass === "string"
				? originalClass.split(/\s+/)
				: [];

		normalizedFigure.properties = {
			...normalizedFigure.properties,
			className: [...classNames, "image-grid-figure"],
		};

		for (const child of normalizedFigure.children || []) {
			if (child.type !== "element") {
				continue;
			}

			if (child.tagName === "img") {
				const childClass = child.properties?.className;
				const childClasses = Array.isArray(childClass)
					? childClass
					: typeof childClass === "string"
						? childClass.split(/\s+/)
						: [];

				child.properties = {
					...child.properties,
					className: [...childClasses, "image-grid-image"],
					"data-fancybox": "article-gallery",
					"data-caption":
						child.properties?.title ||
						child.properties?.alt ||
						"",
				};
			}

			if (child.tagName === "figcaption") {
				const childClass = child.properties?.className;
				const childClasses = Array.isArray(childClass)
					? childClass
					: typeof childClass === "string"
						? childClass.split(/\s+/)
						: [];

				child.properties = {
					...child.properties,
					className: [...childClasses, "image-grid-caption"],
				};
			}
		}

		return normalizedFigure;
	});

	const rows = splitRowsByLayout(normalizedFigures, layout, columns);

	return h(
		"div",
		{
			class: "image-grid",
			"data-columns": columns,
			"data-desktop-visible": String(desktopVisible),
			"data-tablet-visible": String(tabletVisible),
			"data-mobile-visible": String(mobileVisible),
			"data-tablet-columns": tablet,
			"data-mobile-columns": mobile,
			"data-gap": gap,
			style: gridStyle,
			...(layout.length > 0
				? {
					"data-layout": layout.join(","),
				}
				: {}),
		},
		rows.map((row, index) =>
			h(
				"div",
				{
					class: "image-grid-row",
					"data-columns": row.columns,
					"data-row-index": String(index),
					style: `--image-grid-columns: ${row.columns};`,
				},
				row.items,
			),
		),
	);
}
