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
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const blogPostSections = sqliteTable("blog_post_sections", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => blogPosts.id, { onDelete: "cascade" }),
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
  sectionId: text("section_id")
    .notNull()
    .references(() => blogPostSections.id, { onDelete: "cascade" }),
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
