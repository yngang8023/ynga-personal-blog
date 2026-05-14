import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { BlogPostBundleInput } from "./blogRag";

interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

export interface StoredBundleFile {
  path: string;
  r2Key: string;
  contentType: string;
  bytes: Uint8Array;
  hash: string;
  size: number;
}

export interface ImageIndexRecord {
  id: string;
  relativePath: string;
  r2Key: string;
  url: string;
  alt: string;
  title: string;
  heading: string | null;
  anchor: string | null;
  surroundingText: string;
  ocrText: string;
  contentType: string;
  contentHash: string;
}

export interface ChunkIndexRecord {
  id: string;
  chunkIndex: number;
  title: string;
  url: string;
  heading: string | null;
  anchor: string | null;
  imageRefs: string[];
  text: string;
}

export interface PreparedPostBundle {
  post: {
    id: string;
    slug: string;
    title: string;
    description: string;
    url: string;
    published: string | null;
    updated: string | null;
    tags: string[];
    category: string | null;
    contentHash: string;
    sourcePrefix: string;
  };
  files: StoredBundleFile[];
  images: ImageIndexRecord[];
  chunks: ChunkIndexRecord[];
}

interface SectionImageRef {
  relativePath: string;
  alt: string;
  title: string;
}

interface MarkdownSection {
  heading: string | null;
  anchor: string | null;
  lines: string[];
  images: SectionImageRef[];
}

const textDecoder = new TextDecoder();
const imageExtensionPattern = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const blogRagChunkSeparators = [
  "\n## ",
  "\n### ",
  "\n#### ",
  "\n##### ",
  "\n###### ",
  "```\n\n",
  "\n\n***\n\n",
  "\n\n---\n\n",
  "\n\n___\n\n",
  "\n\n",
  "\n",
  "。",
  "！",
  "？",
  "；",
  ";",
  "，",
  ",",
  ".",
  "!",
  "?",
  " ",
  "",
];
const blogRagTextSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 900,
  chunkOverlap: 160,
  keepSeparator: true,
  separators: blogRagChunkSeparators,
});

function parseScalar(value: string): unknown {
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

export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  if (!markdown.startsWith("---")) {
    return { data: {}, body: markdown };
  }

  const end = markdown.indexOf("\n---", 3);
  if (end === -1) {
    return { data: {}, body: markdown };
  }

  const raw = markdown.slice(3, end).replace(/^\r?\n/, "");
  const body = markdown.slice(end).replace(/^\r?\n---\r?\n?/, "");
  const data: Record<string, unknown> = {};
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
      const list: unknown[] = [];
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

function normalizeFilePath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === ".." || part === ".")) {
    throw new Error(`Unsafe bundle file path: ${filePath}`);
  }
  return parts.join("/");
}

function dirname(filePath: string): string {
  const normalized = normalizeFilePath(filePath);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function joinPath(...parts: string[]): string {
  const result: string[] = [];
  for (const part of parts.join("/").replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      result.pop();
      continue;
    }
    result.push(part);
  }
  return result.join("/");
}

function isExternalUrl(value: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(value);
}

function resolveMarkdownAssetPath(entryPath: string, rawTarget: string): string | null {
  const target = rawTarget.trim().replace(/^<|>$/g, "").split(/[?#]/)[0];
  if (!target || isExternalUrl(target)) {
    return null;
  }

  return normalizeFilePath(joinPath(dirname(entryPath), target));
}

function slugifyHeading(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[`*_~[\](){}<>:"'，。！？、；：]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanMarkdownInline(value: string): string {
  return value
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_~]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function normalizeDate(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return String(value);
}

function normalizeString(value: unknown, fallback = ""): string {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return String(value);
}

function buildPostUrl(siteURL: string | undefined, post: BlogPostBundleInput, data: Record<string, unknown>): string {
  if (post.url && !siteURL) {
    return post.url;
  }

  if (!siteURL) {
    throw new Error("siteURL is required when post.url is not provided.");
  }

  const base = siteURL.endsWith("/") ? siteURL : `${siteURL}/`;
  if (post.url) {
    try {
      const incoming = new URL(post.url);
      const expected = new URL(base);
      if (incoming.origin === expected.origin && !incoming.pathname.startsWith("/embed/")) {
        return incoming.toString();
      }
    } catch {
      // Fall through and rebuild from siteURL.
    }
  }

  if (data.permalink) {
    return new URL(`${String(data.permalink).replace(/^\/+/, "").replace(/\/+$/, "")}/`, base).toString();
  }

  if (data.alias) {
    const alias = String(data.alias)
      .replace(/^\/+/, "")
      .replace(/\/+$/, "")
      .replace(/^posts\//, "");
    return new URL(`posts/${alias}/`, base).toString();
  }

  return new URL(`posts/${post.slug}/`, base).toString();
}

async function sha256(bytes: Uint8Array | string): Promise<string> {
  const input = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  const digest = await crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeBundleFile(post: BlogPostBundleInput, file: BlogPostBundleInput["files"][number]): StoredBundleFile {
  const relativePath = normalizeFilePath(file.path);
  const bytes =
    file.encoding === "utf8"
      ? new TextEncoder().encode(file.content)
      : Uint8Array.from(atob(file.content), (char) => char.charCodeAt(0));

  return {
    path: relativePath,
    r2Key: `posts/${post.slug}/${relativePath}`,
    contentType: file.contentType || "application/octet-stream",
    bytes,
    hash: file.hash || "",
    size: file.size || bytes.byteLength,
  };
}

function getMarkdownImageRefs(line: string): Array<{ alt: string; target: string; title: string }> {
  const refs: Array<{ alt: string; target: string; title: string }> = [];
  const pattern = /!\[([^\]]*)]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line))) {
    refs.push({
      alt: match[1] || "",
      target: match[2] || "",
      title: match[3] || "",
    });
  }

  return refs;
}

function parseMarkdownSections(markdown: string, entryPath: string): MarkdownSection[] {
  const { body } = parseFrontmatter(markdown);
  const sections: MarkdownSection[] = [{ heading: null, anchor: null, lines: [], images: [] }];
  let current = sections[0];
  let inFence = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (/^(```|~~~)/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const heading = cleanMarkdownInline(headingMatch[2]);
      current = {
        heading,
        anchor: slugifyHeading(heading),
        lines: [],
        images: [],
      };
      sections.push(current);
      continue;
    }

    const imageRefs = getMarkdownImageRefs(line);
    for (const ref of imageRefs) {
      const relativePath = resolveMarkdownAssetPath(entryPath, ref.target);
      if (!relativePath) {
        continue;
      }
      current.images.push({
        relativePath,
        alt: ref.alt,
        title: ref.title,
      });
    }

    const cleaned = cleanMarkdownInline(line)
      .replace(/^:::\w*.*$/, "")
      .replace(/^:::$/, "")
      .replace(/^[\s>*+-]+/, "")
      .trim();

    if (cleaned) {
      current.lines.push(cleaned);
    }
  }

  return sections.filter((section) => section.heading || section.lines.length || section.images.length);
}

function collectFrontmatterImages(data: Record<string, unknown>, entryPath: string): SectionImageRef[] {
  const image = typeof data.image === "string" ? data.image : "";
  const relativePath = image ? resolveMarkdownAssetPath(entryPath, image) : null;
  return relativePath
    ? [{ relativePath, alt: "文章封面图", title: "" }]
    : [];
}

function encodePathSegments(value: string): string {
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getAssetProxyUrl(r2Key: string): string {
  return `/api/assets/${encodePathSegments(r2Key)}`;
}

async function splitTextIntoChunks(value: string): Promise<string[]> {
  const text = value.trim();
  if (!text) {
    return [];
  }

  return (await blogRagTextSplitter.splitText(text))
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

async function runImageOcr(env: Env, file: StoredBundleFile): Promise<string> {
  const ai = env.AI as unknown as {
    toMarkdown?: (files: unknown, options?: unknown) => Promise<unknown>;
  };

  if (!ai.toMarkdown || !file.contentType.startsWith("image/")) {
    return "";
  }

  try {
    const blob = new Blob([file.bytes], { type: file.contentType });
    const result = await ai.toMarkdown([{ name: file.path, blob }], {
      descriptionLanguage: "zh",
    });
    return extractMarkdownTextFromConversion(result).slice(0, 2000);
  } catch {
    return "";
  }
}

function extractMarkdownTextFromConversion(value: unknown): string {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map(extractMarkdownTextFromConversion).filter(Boolean).join("\n\n");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["text", "markdown", "content", "result", "description"]) {
      if (typeof record[key] === "string") {
        return String(record[key]).trim();
      }
    }
    for (const key of ["data", "results", "documents"]) {
      if (record[key]) {
        return extractMarkdownTextFromConversion(record[key]);
      }
    }
  }
  return "";
}

async function buildImageRecords(
  env: Env,
  postUrl: string,
  filesByPath: Map<string, StoredBundleFile>,
  sections: MarkdownSection[],
  frontmatterImages: SectionImageRef[],
): Promise<ImageIndexRecord[]> {
  const imagesByPath = new Map<string, ImageIndexRecord>();
  const allRefs = [
    ...frontmatterImages.map((image) => ({ ...image, heading: "文章封面", anchor: null, surroundingText: "" })),
    ...sections.flatMap((section) =>
      section.images.map((image) => ({
        ...image,
        heading: section.heading,
        anchor: section.anchor,
        surroundingText: section.lines.join("\n").slice(0, 600),
      })),
    ),
    ...[...filesByPath.values()]
      .filter((file) => imageExtensionPattern.test(file.path))
      .map((file) => ({
        relativePath: file.path,
        alt: "",
        title: "",
        heading: null,
        anchor: null,
        surroundingText: "",
      })),
  ];

  for (const ref of allRefs) {
    const file = filesByPath.get(ref.relativePath);
    if (!file || !imageExtensionPattern.test(ref.relativePath)) {
      continue;
    }

    const existing = imagesByPath.get(ref.relativePath);
    if (existing) {
      imagesByPath.set(ref.relativePath, {
        ...existing,
        alt: existing.alt || ref.alt,
        title: existing.title || ref.title,
        heading: existing.heading || ref.heading || null,
        anchor: existing.anchor || ref.anchor || null,
        surroundingText: existing.surroundingText || ref.surroundingText,
      });
      continue;
    }

    imagesByPath.set(ref.relativePath, {
      id: await sha256(`${postUrl}\n${ref.relativePath}`),
      relativePath: ref.relativePath,
      r2Key: file.r2Key,
      url: getAssetProxyUrl(file.r2Key),
      alt: ref.alt,
      title: ref.title,
      heading: ref.heading,
      anchor: ref.anchor,
      surroundingText: ref.surroundingText,
      ocrText: await runImageOcr(env, file),
      contentType: file.contentType,
      contentHash: file.hash || await sha256(file.bytes),
    });
  }

  return [...imagesByPath.values()];
}

async function buildChunks(
  post: PreparedPostBundle["post"],
  sections: MarkdownSection[],
  images: ImageIndexRecord[],
): Promise<ChunkIndexRecord[]> {
  const chunks: ChunkIndexRecord[] = [];
  const referencedImagePaths = new Set<string>();

  for (const section of sections) {
    const sectionImages = images.filter((image) =>
      section.images.some((ref) => ref.relativePath === image.relativePath),
    );
    for (const image of sectionImages) {
      referencedImagePaths.add(image.relativePath);
    }
    const imageText = sectionImages
      .map((image) =>
        [
          `图片：${image.alt || image.title || image.relativePath}`,
          `图片地址：${image.url}`,
          image.ocrText ? `图片识别内容：${image.ocrText}` : "",
        ].filter(Boolean).join("\n"),
      )
      .join("\n\n");

    const sectionText = [
      section.heading ? `## ${section.heading}` : "",
      section.lines.join("\n"),
      imageText,
    ].filter(Boolean).join("\n\n").trim();

    if (!sectionText) {
      continue;
    }

    const pieces = await splitTextIntoChunks(sectionText);
    for (const piece of pieces) {
      chunks.push({
        id: await sha256(`${post.id}\n${chunks.length}\n${piece}`),
        chunkIndex: chunks.length,
        title: post.title,
        url: section.anchor ? `${post.url}#${section.anchor}` : post.url,
        heading: section.heading,
        anchor: section.anchor,
        imageRefs: sectionImages.map((image) => image.relativePath),
        text: piece,
      });
    }
  }

  for (const image of images) {
    if (referencedImagePaths.has(image.relativePath)) {
      continue;
    }

    const imageChunkText = [
      `图片资源：${image.alt || image.title || image.relativePath}`,
      `图片链接：${image.url}`,
      image.ocrText ? `图片识别内容：${image.ocrText}` : "",
      image.surroundingText ? `关联正文：${image.surroundingText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (!imageChunkText) {
      continue;
    }

    chunks.push({
      id: await sha256(`${post.id}\nimage\n${image.relativePath}\n${imageChunkText}`),
      chunkIndex: chunks.length,
      title: post.title,
      url: image.anchor ? `${post.url}#${image.anchor}` : post.url,
      heading: image.heading || `图片资源：${image.alt || image.relativePath}`,
      anchor: image.anchor,
      imageRefs: [image.relativePath],
      text: imageChunkText,
    });
  }

  return chunks;
}

export async function preparePostBundle(
  env: Env,
  bundle: BlogPostBundleInput,
  siteURL?: string,
): Promise<PreparedPostBundle> {
  const files = bundle.files.map((file) => decodeBundleFile(bundle, file));
  const filesByPath = new Map(files.map((file) => [file.path, file]));
  const entryPath = normalizeFilePath(bundle.entryPath);
  const entryFile = filesByPath.get(entryPath);
  if (!entryFile) {
    throw new Error(`Post ${bundle.id} is missing entry file ${entryPath}.`);
  }

  const markdown = textDecoder.decode(entryFile.bytes);
  const { data } = parseFrontmatter(markdown);
  const postUrl = buildPostUrl(siteURL, bundle, data);
  const title = normalizeString(data.title, bundle.metadata?.title || bundle.slug || bundle.id);
  const sourcePrefix = `posts/${bundle.slug}/`;
  const post = {
    id: bundle.id,
    slug: bundle.slug || bundle.id,
    title,
    description: normalizeString(data.description, bundle.metadata?.description || ""),
    url: postUrl,
    published: normalizeDate(data.published) || bundle.metadata?.published || null,
    updated: normalizeDate(data.updated) || bundle.metadata?.updated || null,
    tags: normalizeTags(data.tags).length ? normalizeTags(data.tags) : bundle.metadata?.tags || [],
    category: normalizeString(data.category, bundle.metadata?.category || "") || null,
    contentHash: bundle.contentHash || await sha256(files.map((file) => `${file.path}:${file.hash}`).join("\n")),
    sourcePrefix,
  };

  for (const file of files) {
    await env.POST_ASSETS.put(file.r2Key, file.bytes, {
      httpMetadata: {
        contentType: file.contentType,
      },
      customMetadata: {
        postId: post.id,
        slug: post.slug,
        path: file.path,
        hash: file.hash,
      },
    });
  }

  const sections = parseMarkdownSections(markdown, entryPath);
  const frontmatterImages = collectFrontmatterImages(data, entryPath);
  const images = await buildImageRecords(env, post.url, filesByPath, sections, frontmatterImages);
  const chunks = await buildChunks(post, sections, images);

  return {
    post,
    files,
    images,
    chunks,
  };
}

export async function deleteR2Prefix(bucket: R2Bucket, prefix: string): Promise<number> {
  let cursor: string | undefined;
  let deleted = 0;

  do {
    const listed = await bucket.list({ prefix, cursor });
    const keys = listed.objects.map((object) => object.key);
    if (keys.length > 0) {
      await bucket.delete(keys);
      deleted += keys.length;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return deleted;
}
