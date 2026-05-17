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
  sectionId: string;
  chunkKey: string;
  chunkHash: string;
  chunkIndex: number;
  sectionIndex: number;
  title: string;
  url: string;
  heading: string | null;
  anchor: string | null;
  category: string | null;
  tags: string[];
  topic: string | null;
  series: string | null;
  published: string | null;
  updated: string | null;
  hasImages: boolean;
  hasCodeBlocks: boolean;
  imageRefs: string[];
  parentText: string;
  text: string;
}

export interface SectionIndexRecord {
  id: string;
  sectionKey: string;
  sectionIndex: number;
  title: string;
  url: string;
  heading: string | null;
  anchor: string | null;
  summary: string;
  text: string;
  hasImages: boolean;
  hasCodeBlocks: boolean;
  imageRefs: string[];
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
    topic: string | null;
    series: string | null;
    hasImages: boolean;
    hasCodeBlocks: boolean;
    sectionCount: number;
    imageCount: number;
    contentHash: string;
    sourcePrefix: string;
  };
  files: StoredBundleFile[];
  images: ImageIndexRecord[];
  sections: SectionIndexRecord[];
  chunks: ChunkIndexRecord[];
  metrics: PreparePostBundleMetrics;
}

export interface PreparePostBundleMetrics {
  timings: {
    asset_upload_ms: number;
    ocr_ms: number;
    chunk_build_ms: number;
  };
  stats: {
    file_count: number;
    referenced_image_count: number;
    ocr_image_count: number;
    section_count: number;
    chunk_count: number;
    reused_asset_count: number;
    reused_ocr_count: number;
  };
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
  codeBlocks: string[];
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

export const BLOG_POST_BUNDLE_NORMALIZATION_VERSION = "v2";

export interface PreparePostBundleOptions {
  resolveExistingAssetKey?: (file: StoredBundleFile) => Promise<string | null | undefined>;
  resolveCachedImageOcrText?: (file: StoredBundleFile) => Promise<string | null | undefined>;
  includeUnreferencedImages?: boolean;
}

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

function inferTopic(data: Record<string, unknown>, tags: string[], category: string | null, title: string): string | null {
  const explicit = normalizeString(data.topic, "");
  if (explicit) {
    return explicit;
  }
  if (tags.length > 0) {
    return tags[0];
  }
  if (category) {
    return category;
  }
  const cleaned = cleanMarkdownInline(title);
  return cleaned || null;
}

function inferSeries(data: Record<string, unknown>): string | null {
  const explicit = normalizeString(data.series, "");
  return explicit || null;
}

function summarizeSectionText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
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
  const digestInput = new Uint8Array(input.byteLength);
  digestInput.set(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
  const digest = await crypto.subtle.digest("SHA-256", digestInput.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildContentAddressedAssetKey(contentHash: string): string {
  return `assets/posts/by-hash/${contentHash}`;
}

function normalizeIdentityText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildPostRevisionId(
  postId: string,
  contentHash: string,
  normalizationVersion = BLOG_POST_BUNDLE_NORMALIZATION_VERSION,
): string {
  return `${postId}::${contentHash}::${normalizationVersion}`;
}

async function buildRevisionScopedId(
  revisionId: string,
  recordType: "image" | "section" | "chunk",
  stableKey: string,
): Promise<string> {
  return sha256(`${revisionId}\n${recordType}\n${stableKey}`);
}

async function buildStableSectionKey(
  postId: string,
  section: MarkdownSection,
  sectionText: string,
): Promise<string> {
  return sha256(
    [
      postId,
      "section",
      section.anchor || "",
      section.heading || "",
      normalizeIdentityText(sectionText),
    ].join("\n"),
  );
}

async function buildStableChunkKey(
  postId: string,
  sectionKey: string,
  chunkText: string,
): Promise<{ chunkKey: string; chunkHash: string }> {
  const chunkHash = await sha256(normalizeIdentityText(chunkText));
  return {
    chunkKey: await sha256([postId, "chunk", sectionKey, chunkHash].join("\n")),
    chunkHash,
  };
}

async function decodeBundleFile(
  post: BlogPostBundleInput,
  file: BlogPostBundleInput["files"][number],
): Promise<StoredBundleFile> {
  const relativePath = normalizeFilePath(file.path);
  const bytes =
    file.encoding === "utf8"
      ? new TextEncoder().encode(file.content)
      : Uint8Array.from(atob(file.content), (char) => char.charCodeAt(0));
  const hash = file.hash || await sha256(bytes);

  return {
    path: relativePath,
    r2Key: buildContentAddressedAssetKey(hash),
    contentType: file.contentType || "application/octet-stream",
    bytes,
    hash,
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
  const sections: MarkdownSection[] = [{ heading: null, anchor: null, lines: [], images: [], codeBlocks: [] }];
  let current = sections[0];
  let inFence = false;
  let fenceBuffer: string[] = [];

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (/^(```|~~~)/.test(line.trim())) {
      if (inFence && fenceBuffer.length > 0) {
        const codeText = fenceBuffer.join("\n").trim();
        if (codeText) {
          current.codeBlocks.push(codeText);
          current.lines.push(`[代码块]\n${codeText}`);
        }
        fenceBuffer = [];
      }
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      fenceBuffer.push(line);
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
        codeBlocks: [],
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
    const blobBytes = new Uint8Array(file.bytes.byteLength);
    blobBytes.set(new Uint8Array(file.bytes.buffer, file.bytes.byteOffset, file.bytes.byteLength));
    const blob = new Blob([blobBytes.buffer], { type: file.contentType });
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
  revisionId: string,
  postUrl: string,
  filesByPath: Map<string, StoredBundleFile>,
  sections: MarkdownSection[],
  frontmatterImages: SectionImageRef[],
  options: PreparePostBundleOptions = {},
): Promise<{
  images: ImageIndexRecord[];
  metrics: {
    ocr_ms: number;
    referenced_image_count: number;
    ocr_image_count: number;
    reused_ocr_count: number;
  };
}> {
  const imagesByPath = new Map<string, ImageIndexRecord>();
  let ocrMs = 0;
  let ocrImageCount = 0;
  let reusedOcrCount = 0;
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
    ...(options.includeUnreferencedImages
      ? [...filesByPath.values()]
          .filter((file) => imageExtensionPattern.test(file.path))
          .map((file) => ({
            relativePath: file.path,
            alt: "",
            title: "",
            heading: null,
            anchor: null,
            surroundingText: "",
          }))
      : []),
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

    const imageKey = await sha256(`${ref.relativePath}\n${file.hash}`);
    const cachedOcrText = await options.resolveCachedImageOcrText?.(file);
    let ocrText = cachedOcrText ?? "";
    if (cachedOcrText) {
      reusedOcrCount += 1;
    } else {
      const ocrStartedAt = Date.now();
      ocrText = await runImageOcr(env, file);
      ocrMs += Date.now() - ocrStartedAt;
      ocrImageCount += 1;
    }
    imagesByPath.set(ref.relativePath, {
      id: await buildRevisionScopedId(revisionId, "image", imageKey),
      relativePath: ref.relativePath,
      r2Key: file.r2Key,
      url: getAssetProxyUrl(file.r2Key),
      alt: ref.alt,
      title: ref.title,
      heading: ref.heading,
      anchor: ref.anchor,
      surroundingText: ref.surroundingText,
      ocrText,
      contentType: file.contentType,
      contentHash: file.hash,
    });
  }

  return {
    images: [...imagesByPath.values()],
    metrics: {
      ocr_ms: ocrMs,
      referenced_image_count: imagesByPath.size,
      ocr_image_count: ocrImageCount,
      reused_ocr_count: reusedOcrCount,
    },
  };
}

async function buildSectionsAndChunks(
  post: PreparedPostBundle["post"],
  revisionId: string,
  sections: MarkdownSection[],
  images: ImageIndexRecord[],
): Promise<{ sections: SectionIndexRecord[]; chunks: ChunkIndexRecord[] }> {
  const sectionRecords: SectionIndexRecord[] = [];
  const chunks: ChunkIndexRecord[] = [];
  const referencedImagePaths = new Set<string>();
  const sectionKeyCounts = new Map<string, number>();
  const chunkKeyCounts = new Map<string, number>();

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

    const sectionIndex = sectionRecords.length;
    const baseSectionKey = await buildStableSectionKey(post.id, section, sectionText);
    const sectionDuplicateCount = sectionKeyCounts.get(baseSectionKey) || 0;
    sectionKeyCounts.set(baseSectionKey, sectionDuplicateCount + 1);
    const sectionKey =
      sectionDuplicateCount === 0
        ? baseSectionKey
        : await sha256(`${baseSectionKey}\nduplicate\n${sectionDuplicateCount}`);
    const sectionId = await buildRevisionScopedId(revisionId, "section", sectionKey);
    sectionRecords.push({
      id: sectionId,
      sectionKey,
      sectionIndex,
      title: post.title,
      url: section.anchor ? `${post.url}#${section.anchor}` : post.url,
      heading: section.heading,
      anchor: section.anchor,
      summary: summarizeSectionText(sectionText),
      text: sectionText,
      hasImages: sectionImages.length > 0,
      hasCodeBlocks: section.codeBlocks.length > 0,
      imageRefs: sectionImages.map((image) => image.relativePath),
    });

    const pieces = await splitTextIntoChunks(sectionText);
    for (const piece of pieces) {
      const { chunkKey: baseChunkKey, chunkHash } = await buildStableChunkKey(post.id, sectionKey, piece);
      const chunkDuplicateCount = chunkKeyCounts.get(baseChunkKey) || 0;
      chunkKeyCounts.set(baseChunkKey, chunkDuplicateCount + 1);
      const chunkKey =
        chunkDuplicateCount === 0
          ? baseChunkKey
          : await sha256(`${baseChunkKey}\nduplicate\n${chunkDuplicateCount}`);
      chunks.push({
        id: await buildRevisionScopedId(revisionId, "chunk", chunkKey),
        sectionId,
        chunkKey,
        chunkHash,
        chunkIndex: chunks.length,
        sectionIndex,
        title: post.title,
        url: section.anchor ? `${post.url}#${section.anchor}` : post.url,
        heading: section.heading,
        anchor: section.anchor,
        category: post.category,
        tags: post.tags,
        topic: post.topic,
        series: post.series,
        published: post.published,
        updated: post.updated,
        hasImages: sectionImages.length > 0,
        hasCodeBlocks: section.codeBlocks.length > 0,
        imageRefs: sectionImages.map((image) => image.relativePath),
        parentText: sectionText,
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

    const sectionIndex = sectionRecords.length;
    const syntheticSection: MarkdownSection = {
      heading: image.heading || `图片资源：${image.alt || image.relativePath}`,
      anchor: image.anchor,
      lines: [imageChunkText],
      images: [{ relativePath: image.relativePath, alt: image.alt, title: image.title }],
      codeBlocks: [],
    };
    const baseSectionKey = await buildStableSectionKey(post.id, syntheticSection, imageChunkText);
    const sectionDuplicateCount = sectionKeyCounts.get(baseSectionKey) || 0;
    sectionKeyCounts.set(baseSectionKey, sectionDuplicateCount + 1);
    const sectionKey =
      sectionDuplicateCount === 0
        ? baseSectionKey
        : await sha256(`${baseSectionKey}\nduplicate\n${sectionDuplicateCount}`);
    const sectionId = await buildRevisionScopedId(revisionId, "section", sectionKey);
    sectionRecords.push({
      id: sectionId,
      sectionKey,
      sectionIndex,
      title: post.title,
      url: image.anchor ? `${post.url}#${image.anchor}` : post.url,
      heading: image.heading || `图片资源：${image.alt || image.relativePath}`,
      anchor: image.anchor,
      summary: summarizeSectionText(imageChunkText),
      text: imageChunkText,
      hasImages: true,
      hasCodeBlocks: false,
      imageRefs: [image.relativePath],
    });

    const { chunkKey: baseChunkKey, chunkHash } = await buildStableChunkKey(post.id, sectionKey, imageChunkText);
    const chunkDuplicateCount = chunkKeyCounts.get(baseChunkKey) || 0;
    chunkKeyCounts.set(baseChunkKey, chunkDuplicateCount + 1);
    const chunkKey =
      chunkDuplicateCount === 0
        ? baseChunkKey
        : await sha256(`${baseChunkKey}\nduplicate\n${chunkDuplicateCount}`);
    chunks.push({
      id: await buildRevisionScopedId(revisionId, "chunk", chunkKey),
      sectionId,
      chunkKey,
      chunkHash,
      chunkIndex: chunks.length,
      sectionIndex,
      title: post.title,
      url: image.anchor ? `${post.url}#${image.anchor}` : post.url,
      heading: image.heading || `图片资源：${image.alt || image.relativePath}`,
      anchor: image.anchor,
      category: post.category,
      tags: post.tags,
      topic: post.topic,
      series: post.series,
      published: post.published,
      updated: post.updated,
      hasImages: true,
      hasCodeBlocks: false,
      imageRefs: [image.relativePath],
      parentText: imageChunkText,
      text: imageChunkText,
    });
  }

  return { sections: sectionRecords, chunks };
}

export async function preparePostBundle(
  env: Env,
  bundle: BlogPostBundleInput,
  siteURL?: string,
  options: PreparePostBundleOptions = {},
): Promise<PreparedPostBundle> {
  const files = await Promise.all(bundle.files.map((file) => decodeBundleFile(bundle, file)));
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
  const tags = normalizeTags(data.tags).length ? normalizeTags(data.tags) : bundle.metadata?.tags || [];
  const category = normalizeString(data.category, bundle.metadata?.category || "") || null;
  const topic = inferTopic(data, tags, category, title);
  const series = inferSeries(data) || bundle.metadata?.series || null;
  const post = {
    id: bundle.id,
    slug: bundle.slug || bundle.id,
    title,
    description: normalizeString(data.description, bundle.metadata?.description || ""),
    url: postUrl,
    published: normalizeDate(data.published) || bundle.metadata?.published || null,
    updated: normalizeDate(data.updated) || bundle.metadata?.updated || null,
    tags,
    category,
    topic,
    series,
    hasImages: false,
    hasCodeBlocks: false,
    sectionCount: 0,
    imageCount: 0,
    contentHash: bundle.contentHash || await sha256(files.map((file) => `${file.path}:${file.hash}`).join("\n")),
    sourcePrefix: "assets/posts/by-hash/",
  };
  const revisionId = buildPostRevisionId(post.id, post.contentHash);
  const uploadedAssetKeys = new Set<string>();
  let assetUploadMs = 0;
  let reusedAssetCount = 0;

  for (const file of files) {
    const existingAssetKey = await options.resolveExistingAssetKey?.(file);
    if (existingAssetKey) {
      file.r2Key = existingAssetKey;
      reusedAssetCount += 1;
      continue;
    }

    if (uploadedAssetKeys.has(file.r2Key)) {
      continue;
    }

    const assetUploadStartedAt = Date.now();
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
    assetUploadMs += Date.now() - assetUploadStartedAt;
    uploadedAssetKeys.add(file.r2Key);
  }

  const sections = parseMarkdownSections(markdown, entryPath);
  const frontmatterImages = collectFrontmatterImages(data, entryPath);
  const imageBuildStartedAt = Date.now();
  const imageBuildResult = await buildImageRecords(
    env,
    revisionId,
    post.url,
    filesByPath,
    sections,
    frontmatterImages,
    options,
  );
  const { images, metrics: imageMetrics } = imageBuildResult;
  const { sections: sectionRecords, chunks } = await buildSectionsAndChunks(post, revisionId, sections, images);
  const chunkBuildMs = Date.now() - imageBuildStartedAt;
  post.hasImages = images.length > 0;
  post.hasCodeBlocks = sections.some((section) => section.codeBlocks.length > 0);
  post.sectionCount = sectionRecords.length;
  post.imageCount = images.length;

  return {
    post,
    files,
    images,
    sections: sectionRecords,
    chunks,
    metrics: {
      timings: {
        asset_upload_ms: assetUploadMs,
        ocr_ms: imageMetrics.ocr_ms,
        chunk_build_ms: chunkBuildMs,
      },
      stats: {
        file_count: files.length,
        referenced_image_count: imageMetrics.referenced_image_count,
        ocr_image_count: imageMetrics.ocr_image_count,
        section_count: sectionRecords.length,
        chunk_count: chunks.length,
        reused_asset_count: reusedAssetCount,
        reused_ocr_count: imageMetrics.reused_ocr_count,
      },
    },
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
