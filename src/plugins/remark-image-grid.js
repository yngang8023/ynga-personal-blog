import { visit } from "unist-util-visit";

const GRID_START_RE = /^\s*\[grid([^\]]*)\]\s*/i;
const GRID_END_RE = /\s*\[\/grid\]\s*$/;
const BOOLEAN_TRUE_VALUES = new Set(["true", "1", "yes", "on"]);
const BOOLEAN_FALSE_VALUES = new Set(["false", "0", "no", "off"]);

const stripEmptyTextNodes = (children = []) =>
	children.filter((node) => node.type !== "text" || node.value.trim() !== "");

const countImages = (nodes = []) => {
	let count = 0;

	for (const node of nodes) {
		visit(node, (child) => {
			if (child.type === "image") {
				count += 1;
			}
		});
	}

	return count;
};

const normalizeColumns = (value, fallback, max = 4) => {
	const parsed = Number.parseInt(value || fallback || "1", 10) || 1;
	return String(Math.min(Math.max(parsed, 1), max));
};

const normalizeRows = (value) => {
	if (!value) {
		return null;
	}

	const parsed = Number.parseInt(value, 10) || 0;
	return parsed > 0 ? String(parsed) : null;
};

const normalizeGap = (value) => {
	if (!value) {
		return null;
	}

	const normalized = String(value).trim().toLowerCase();
	return ["sm", "md", "lg"].includes(normalized) ? normalized : null;
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

const parseOptionValue = (raw, name) => {
	const match = raw.match(
		new RegExp(`\\b${name}\\s*=\\s*([^\\s\\]]+)`, "i"),
	);

	if (!match?.[1]) {
		return null;
	}

	return String(match[1]).replace(/^["'“”‘’]|["'“”‘’]$/g, "");
};

const normalizeLayout = (value) => {
	if (!value) {
		return null;
	}

	const parts = String(value)
		.split(",")
		.map((part) => Number.parseInt(part.trim(), 10) || 0)
		.map((part) => Math.min(Math.max(part, 1), 4))
		.filter(Boolean);

	return parts.length > 0 ? parts.join(",") : null;
};

const parseGridOptions = (raw = "") => {
	const options = {
		columns: null,
		desktopVisible: null,
		mobileVisible: null,
		tabletVisible: null,
		mobileColumns: null,
		tabletColumns: null,
		rows: null,
		layout: null,
		gap: null,
	};

	const colsMatch = raw.match(/\bcols\s*=\s*(\d+)/i);
	const rowsMatch = raw.match(/\brows\s*=\s*(\d+)/i);
	const layoutMatch = raw.match(/\blayout\s*=\s*["'“”‘’]?([0-9,\s]+)["'“”‘’]?/i);
	const gapMatch = raw.match(/\bgap\s*=\s*(sm|md|lg)\b/i);
	const desktopValue = parseOptionValue(raw, "desktop");
	const tabletValue = parseOptionValue(raw, "tablet");
	const mobileValue = parseOptionValue(raw, "mobile");
	const tabletColsValue = parseOptionValue(raw, "tabletCols");
	const mobileColsValue = parseOptionValue(raw, "mobileCols");

	options.columns = colsMatch?.[1] || null;
	options.desktopVisible = parseBooleanish(desktopValue);
	options.tabletVisible = parseBooleanish(tabletValue);
	options.mobileVisible = parseBooleanish(mobileValue);
	options.tabletColumns =
		tabletColsValue ||
		(parseBooleanish(tabletValue) === null && tabletValue && /^\d+$/.test(tabletValue)
			? tabletValue
			: null);
	options.mobileColumns =
		mobileColsValue ||
		(parseBooleanish(mobileValue) === null && mobileValue && /^\d+$/.test(mobileValue)
			? mobileValue
			: null);
	options.rows = rowsMatch?.[1] || null;
	options.layout = layoutMatch?.[1] || null;
	options.gap = gapMatch?.[1] || null;

	return options;
};

const createGridDirective = (children, gridOptions = {}) => {
	const gridChildren = stripEmptyTextNodes(children);
	const imageCount = countImages(gridChildren);
	const layout = normalizeLayout(gridOptions.layout);
	const layoutFirstColumn = layout ? layout.split(",")[0] : null;
	const columns = normalizeColumns(
		gridOptions.columns || layoutFirstColumn,
		String(Math.min(Math.max(imageCount, 1), 4)),
		4,
	);
	const desktopVisible = gridOptions.desktopVisible ?? true;
	const tabletVisible = gridOptions.tabletVisible ?? true;
	const mobileVisible = gridOptions.mobileVisible ?? true;
	const tabletColumns = normalizeColumns(
		gridOptions.tabletColumns,
		String(Math.min(Math.max(Number.parseInt(columns, 10) || 1, 1), 3)),
		3,
	);
	const mobileColumns = normalizeColumns(
		gridOptions.mobileColumns,
		String(Math.min(Math.max(Number.parseInt(columns, 10) || 1, 1), 2)),
		2,
	);
	const rows = normalizeRows(gridOptions.rows);
	const gap = normalizeGap(gridOptions.gap);

	const attributes = {
		columns,
		"data-columns": columns,
		desktop: String(desktopVisible),
		"data-desktop-visible": String(desktopVisible),
		"data-tablet-visible": String(tabletVisible),
		"data-mobile-visible": String(mobileVisible),
		"data-tablet-columns": tabletColumns,
		"data-mobile-columns": mobileColumns,
		style: `--image-grid-tablet-columns: ${tabletColumns}; --image-grid-mobile-columns: ${mobileColumns};`,
	};
	if (rows) {
		attributes.rows = rows;
		attributes["data-rows"] = rows;
	}

	if (layout) {
		attributes.layout = layout;
		attributes["data-layout"] = layout;
	}

	if (gap) {
		attributes.gap = gap;
		attributes["data-gap"] = gap;
	}

	return {
		type: "containerDirective",
		name: "image-grid",
		attributes,
		children: gridChildren,
		data: {
			hName: "image-grid",
			hProperties: attributes,
		},
	};
};

export function remarkImageGrid() {
	return (tree) => {
		if (tree.type !== "root" || !Array.isArray(tree.children)) {
			return;
		}

		const newChildren = [];
		let inGrid = false;
		let gridChildren = [];
		let currentGridOptions = null;

		for (let index = 0; index < tree.children.length; index += 1) {
			const node = tree.children[index];

			if (node.type === "paragraph" && Array.isArray(node.children) && node.children.length > 0) {
				const first = node.children[0];
				const last = node.children[node.children.length - 1];

				const containsGridStart =
					first?.type === "text" && GRID_START_RE.test(first.value);
				const containsGridEnd =
					last?.type === "text" && GRID_END_RE.test(last.value);

				if (containsGridStart && containsGridEnd && !inGrid) {
					const startMatch = first.value.match(GRID_START_RE);
					const explicitOptions = parseGridOptions(startMatch?.[1] || "");
					first.value = first.value.replace(GRID_START_RE, "");
					last.value = last.value.replace(GRID_END_RE, "");
					newChildren.push(createGridDirective(node.children, explicitOptions));
					continue;
				}

				if (!inGrid && containsGridStart) {
					inGrid = true;
					const startMatch = first.value.match(GRID_START_RE);
					currentGridOptions = parseGridOptions(startMatch?.[1] || "");
					first.value = first.value.replace(GRID_START_RE, "");

					const cleanedChildren = stripEmptyTextNodes(node.children);
					if (cleanedChildren.length > 0) {
						gridChildren.push({
							...node,
							children: cleanedChildren,
						});
					}
					continue;
				}

				if (inGrid && containsGridEnd) {
					inGrid = false;
					last.value = last.value.replace(GRID_END_RE, "");

					const cleanedChildren = stripEmptyTextNodes(node.children);
					if (cleanedChildren.length > 0) {
						gridChildren.push({
							...node,
							children: cleanedChildren,
						});
					}

					newChildren.push(createGridDirective(gridChildren, currentGridOptions));
					gridChildren = [];
					currentGridOptions = null;
					continue;
				}
			}

			if (inGrid) {
				gridChildren.push(node);
			} else {
				newChildren.push(node);
			}
		}

		if (inGrid && gridChildren.length > 0) {
			newChildren.push(...gridChildren);
		}

		tree.children = newChildren;
	};
}
