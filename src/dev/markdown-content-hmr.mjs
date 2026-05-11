import path from "node:path";

const MARKDOWN_CONTENT_TRIGGER_PATTERNS = [
	/^src\/content\//,
	/^src\/plugins\//,
	/^src\/content\.config\.(?:ts|js|mjs|mts|cts)$/,
];

const MARKDOWN_CONTENT_PIPELINE_PATTERNS = [
	/^src\/plugins\//,
	/^src\/content\.config\.(?:ts|js|mjs|mts|cts)$/,
];

const MARKDOWN_CONTENT_ENTRY_PATTERNS = [/^src\/content\//];

const normalizePath = (value) => value.replace(/\\/g, "/");

const toProjectRelativePath = (filePath, rootDir) => {
	const absoluteRoot = path.resolve(rootDir);
	const absoluteFilePath = path.resolve(filePath);
	const relativePath = path.relative(absoluteRoot, absoluteFilePath);

	if (!relativePath || relativePath.startsWith("..")) {
		return "";
	}

	return normalizePath(relativePath);
};

export const shouldInvalidateMarkdownContent = (filePath, rootDir) => {
	const relativePath = toProjectRelativePath(filePath, rootDir);

	if (!relativePath) {
		return false;
	}

	return MARKDOWN_CONTENT_TRIGGER_PATTERNS.some((pattern) =>
		pattern.test(relativePath),
	);
};

export const getMarkdownContentHotUpdateAction = (filePath, rootDir) => {
	const relativePath = toProjectRelativePath(filePath, rootDir);

	if (!relativePath) {
		return null;
	}

	if (
		MARKDOWN_CONTENT_PIPELINE_PATTERNS.some((pattern) =>
			pattern.test(relativePath),
		)
	) {
		return "restart";
	}

	if (
		MARKDOWN_CONTENT_ENTRY_PATTERNS.some((pattern) =>
			pattern.test(relativePath),
		)
	) {
		return "full-reload";
	}

	return null;
};

export const createMarkdownContentHmrPlugin = ({ rootDir }) => {
	const resolvedRootDir = path.resolve(rootDir);

	return {
		name: "markdown-content-hmr",
		apply: "serve",
		async handleHotUpdate(context) {
			const action = getMarkdownContentHotUpdateAction(
				context.file,
				resolvedRootDir,
			);

			if (!action) {
				return;
			}

			if (action === "restart") {
				context.server.restart();
				return [];
			}

			context.server.ws.send({ type: "full-reload", path: "*" });
			return [];
		},
	};
};
