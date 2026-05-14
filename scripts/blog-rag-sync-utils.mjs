import crypto from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const POSTS_DIR = path.join("src", "content", "posts");

function parseScalar(value) {
	const trimmed = value.trim();
	if (trimmed === "true") {
		return true;
	}
	if (trimmed === "false") {
		return false;
	}
	if (trimmed === "null") {
		return null;
	}
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}
	if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
		return trimmed
			.slice(1, -1)
			.split(",")
			.map((item) => parseScalar(item))
			.filter((item) => item !== "");
	}
	return trimmed;
}

export function parseFrontmatter(markdown) {
	if (!markdown.startsWith("---")) {
		return { data: {}, body: markdown };
	}

	const end = markdown.indexOf("\n---", 3);
	if (end === -1) {
		return { data: {}, body: markdown };
	}

	const raw = markdown.slice(3, end).replace(/^\r?\n/, "");
	const body = markdown.slice(end).replace(/^\r?\n---\r?\n?/, "");
	const data = {};
	const lines = raw.split(/\r?\n/);

	for (let i = 0; i < lines.length; i += 1) {
		const line = lines[i];
		if (!line.trim() || line.trim().startsWith("#")) {
			continue;
		}

		const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!match) {
			continue;
		}

		const [, key, value] = match;
		if (value === "") {
			const list = [];
			while (i + 1 < lines.length) {
				const next = lines[i + 1];
				const listMatch = next.match(/^\s*-\s*(.*)$/);
				if (!listMatch) {
					break;
				}
				list.push(parseScalar(listMatch[1]));
				i += 1;
			}
			data[key] = list;
			continue;
		}

		data[key] = parseScalar(value);
	}

	return { data, body };
}

export function shouldSyncPost(data) {
	return data.draft !== true && data.encrypted !== true && !data.password;
}

function removeFileExtension(id) {
	return id.replace(/\.(md|mdx|markdown)$/i, "");
}

function defaultSlugFromId(id) {
	const withoutExt = removeFileExtension(id).replace(/\\/g, "/");
	return withoutExt.endsWith("/index")
		? withoutExt.slice(0, -"/index".length)
		: withoutExt;
}

function joinUrl(base, pathname) {
	return new URL(pathname.replace(/^\/+/, ""), base.endsWith("/") ? base : `${base}/`).toString();
}

export function buildPostUrl({ siteURL, id, data }) {
	if (data.permalink) {
		const permalink = String(data.permalink).replace(/^\/+/, "").replace(/\/+$/, "");
		return joinUrl(siteURL, `${permalink}/`);
	}

	if (data.alias) {
		const alias = String(data.alias)
			.replace(/^\/+/, "")
			.replace(/\/+$/, "")
			.replace(/^posts\//, "");
		return joinUrl(siteURL, `posts/${alias}/`);
	}

	return joinUrl(siteURL, `posts/${defaultSlugFromId(id)}/`);
}

function normalizeTags(tags) {
	if (Array.isArray(tags)) {
		return tags.map((tag) => String(tag)).filter(Boolean);
	}
	if (typeof tags === "string" && tags.trim()) {
		return [tags.trim()];
	}
	return [];
}

function normalizeDate(value) {
	if (value === undefined || value === null || value === "") {
		return null;
	}
	return String(value);
}

async function listFiles(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFiles(fullPath)));
		} else if (entry.isFile()) {
			files.push(fullPath);
		}
	}

	return files.sort();
}

async function listMarkdownFiles(dir) {
	const files = await listFiles(dir);
	return files.filter((file) => /\.mdx?$/i.test(file));
}

function isTextFile(filePath) {
	return /\.(md|mdx|markdown|txt|json|yaml|yml|csv|svg)$/i.test(filePath);
}

function getContentType(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	const contentTypes = {
		".avif": "image/avif",
		".gif": "image/gif",
		".jpeg": "image/jpeg",
		".jpg": "image/jpeg",
		".json": "application/json",
		".md": "text/markdown; charset=utf-8",
		".mdx": "text/markdown; charset=utf-8",
		".png": "image/png",
		".svg": "image/svg+xml; charset=utf-8",
		".txt": "text/plain; charset=utf-8",
		".webp": "image/webp",
		".yaml": "application/yaml; charset=utf-8",
		".yml": "application/yaml; charset=utf-8",
	};

	return contentTypes[ext] || "application/octet-stream";
}

function hashBuffer(buffer) {
	return crypto.createHash("sha256").update(buffer).digest("hex");
}

function hashBundle(files) {
	return crypto
		.createHash("sha256")
		.update(JSON.stringify(files.map((file) => ({
			path: file.path,
			hash: file.hash,
			size: file.size,
		}))))
		.digest("hex");
}

async function collectPostFiles(postDir) {
	const files = await listFiles(postDir);
	const payloadFiles = [];

	for (const file of files) {
		const relativePath = path.relative(postDir, file).replace(/\\/g, "/");
		const buffer = await readFile(file);
		const text = isTextFile(file) ? buffer.toString("utf8") : null;

		payloadFiles.push({
			path: relativePath,
			contentType: getContentType(file),
			encoding: text === null ? "base64" : "utf8",
			content: text === null ? buffer.toString("base64") : text,
			hash: hashBuffer(buffer),
			size: buffer.byteLength,
		});
	}

	return payloadFiles;
}

export async function collectBlogRagPosts({ rootDir = process.cwd(), siteURL }) {
	if (!siteURL) {
		throw new Error("siteURL is required.");
	}

	const postsDir = path.join(rootDir, POSTS_DIR);
	const postsDirStat = await stat(postsDir).catch(() => null);
	if (!postsDirStat?.isDirectory()) {
		return [];
	}

	const files = await listMarkdownFiles(postsDir);
	const posts = [];

	for (const file of files) {
		const raw = await readFile(file, "utf8");
		const { data } = parseFrontmatter(raw);
		if (!shouldSyncPost(data)) {
			continue;
		}

		const id = path.relative(postsDir, file).replace(/\\/g, "/");
		const postDir = path.dirname(file);
		const entryPath = path.relative(postDir, file).replace(/\\/g, "/");
		const bundleFiles = await collectPostFiles(postDir);
		const post = {
			id,
			slug: defaultSlugFromId(id),
			entryPath,
			url: buildPostUrl({ siteURL, id, data }),
			metadata: {
				title: String(data.title || defaultSlugFromId(id)),
				description: String(data.description || ""),
				published: normalizeDate(data.published),
				updated: normalizeDate(data.updated),
				tags: normalizeTags(data.tags),
				category: data.category ? String(data.category) : null,
			},
			files: bundleFiles,
		};

		posts.push({
			...post,
			contentHash: hashBundle(bundleFiles),
		});
	}

	return posts;
}
