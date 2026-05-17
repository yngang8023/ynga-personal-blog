import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const blogPosts = sqliteTable("blog_posts", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  url: text("url").notNull(),
  published: text("published"),
  updated: text("updated"),
  tags: text("tags").notNull().default("[]"),
  category: text("category"),
  topic: text("topic"),
  series: text("series"),
  hasImages: integer("has_images", { mode: "boolean" }).notNull().default(false),
  hasCodeBlocks: integer("has_code_blocks", { mode: "boolean" }).notNull().default(false),
  sectionCount: integer("section_count").notNull().default(0),
  imageCount: integer("image_count").notNull().default(0),
  contentHash: text("content_hash").notNull(),
  sourcePrefix: text("source_prefix").notNull().default(""),
  currentRevisionId: text("current_revision_id"),
  lastCompletedRevisionId: text("last_completed_revision_id"),
  syncStatus: text("sync_status").notNull().default("completed"),
  vectorStatus: text("vector_status").notNull().default("completed"),
  lastError: text("last_error"),
  lastSessionId: text("last_session_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const blogPostRevisions = sqliteTable("blog_post_revisions", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => blogPosts.id, { onDelete: "cascade" }),
  sessionId: text("session_id"),
  contentHash: text("content_hash").notNull(),
  status: text("status").notNull().default("pending"),
  vectorStatus: text("vector_status").notNull().default("pending"),
  sourcePrefix: text("source_prefix").notNull().default(""),
  bundleR2Key: text("bundle_r2_key").notNull().default(""),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  url: text("url").notNull().default(""),
  published: text("published"),
  updated: text("updated"),
  tags: text("tags").notNull().default("[]"),
  category: text("category"),
  topic: text("topic"),
  series: text("series"),
  sectionCount: integer("section_count").notNull().default(0),
  imageCount: integer("image_count").notNull().default(0),
  chunkCount: integer("chunk_count").notNull().default(0),
  hasImages: integer("has_images", { mode: "boolean" }).notNull().default(false),
  hasCodeBlocks: integer("has_code_blocks", { mode: "boolean" }).notNull().default(false),
  assetContentHashesJson: text("asset_content_hashes_json").notNull().default("[]"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
});

export const blogPostSections = sqliteTable("blog_post_sections", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => blogPosts.id, { onDelete: "cascade" }),
  revisionId: text("revision_id").references(() => blogPostRevisions.id, { onDelete: "cascade" }),
  sectionKey: text("section_key"),
  sectionIndex: integer("section_index").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  heading: text("heading"),
  anchor: text("anchor"),
  summary: text("summary").notNull().default(""),
  text: text("text").notNull(),
  hasImages: integer("has_images", { mode: "boolean" }).notNull().default(false),
  hasCodeBlocks: integer("has_code_blocks", { mode: "boolean" }).notNull().default(false),
  imageRefs: text("image_refs").notNull().default("[]"),
});

export const blogPostChunks = sqliteTable("blog_post_chunks", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => blogPosts.id, { onDelete: "cascade" }),
  revisionId: text("revision_id").references(() => blogPostRevisions.id, { onDelete: "cascade" }),
  sectionId: text("section_id")
    .notNull()
    .references(() => blogPostSections.id, { onDelete: "cascade" }),
  chunkKey: text("chunk_key"),
  chunkHash: text("chunk_hash"),
  chunkIndex: integer("chunk_index").notNull(),
  sectionIndex: integer("section_index").notNull().default(0),
  title: text("title").notNull(),
  url: text("url").notNull(),
  heading: text("heading"),
  anchor: text("anchor"),
  category: text("category"),
  tags: text("tags").notNull().default("[]"),
  topic: text("topic"),
  series: text("series"),
  published: text("published"),
  updated: text("updated"),
  hasImages: integer("has_images", { mode: "boolean" }).notNull().default(false),
  hasCodeBlocks: integer("has_code_blocks", { mode: "boolean" }).notNull().default(false),
  imageRefs: text("image_refs").notNull().default("[]"),
  parentText: text("parent_text").notNull().default(""),
  text: text("text").notNull(),
});

export const blogPostImages = sqliteTable("blog_post_images", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => blogPosts.id, { onDelete: "cascade" }),
  revisionId: text("revision_id").references(() => blogPostRevisions.id, { onDelete: "cascade" }),
  relativePath: text("relative_path").notNull(),
  r2Key: text("r2_key").notNull(),
  url: text("url").notNull(),
  alt: text("alt").notNull().default(""),
  title: text("title").notNull().default(""),
  heading: text("heading"),
  anchor: text("anchor"),
  surroundingText: text("surrounding_text").notNull().default(""),
  ocrText: text("ocr_text").notNull().default(""),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  contentHash: text("content_hash").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const blogSyncSessions = sqliteTable("blog_sync_sessions", {
  id: text("id").primaryKey(),
  status: text("status").notNull().default("created"),
  siteUrl: text("site_url").notNull().default(""),
  client: text("client"),
  forceRebuild: integer("force_rebuild", { mode: "boolean" }).notNull().default(false),
  pruneMissing: integer("prune_missing", { mode: "boolean" }).notNull().default(true),
  activePostIdsJson: text("active_post_ids_json").notNull().default("[]"),
  expectedPostCount: integer("expected_post_count").notNull().default(0),
  uploadedPostCount: integer("uploaded_post_count").notNull().default(0),
  processedPostCount: integer("processed_post_count").notNull().default(0),
  succeededPostCount: integer("succeeded_post_count").notNull().default(0),
  failedPostCount: integer("failed_post_count").notNull().default(0),
  skippedPostCount: integer("skipped_post_count").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  finalizedAt: text("finalized_at"),
  completedAt: text("completed_at"),
});

export const blogSyncSessionPosts = sqliteTable("blog_sync_session_posts", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => blogSyncSessions.id, { onDelete: "cascade" }),
  postId: text("post_id").notNull(),
  bundleR2Key: text("bundle_r2_key").notNull().default(""),
  contentHash: text("content_hash").notNull().default(""),
  status: text("status").notNull().default("uploaded"),
  revisionId: text("revision_id"),
  attemptCount: integer("attempt_count").notNull().default(0),
  stage: text("stage"),
  errorMessage: text("error_message"),
  timingsJson: text("timings_json").notNull().default("{}"),
  statsJson: text("stats_json").notNull().default("{}"),
  processingStartedAt: text("processing_started_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
});

export const blogImageAssets = sqliteTable("blog_image_assets", {
  contentHash: text("content_hash").primaryKey(),
  r2Key: text("r2_key").notNull(),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  byteSize: integer("byte_size").notNull().default(0),
  assetRefCount: integer("asset_ref_count").notNull().default(0),
  firstSeenPostId: text("first_seen_post_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const blogImageOcrCache = sqliteTable("blog_image_ocr_cache", {
  contentHash: text("content_hash").primaryKey(),
  ocrText: text("ocr_text").notNull().default(""),
  ocrStatus: text("ocr_status").notNull().default("pending"),
  model: text("model").notNull().default(""),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
