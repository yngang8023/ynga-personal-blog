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
  contentHash: text("content_hash").notNull(),
  sourcePrefix: text("source_prefix").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const blogPostChunks = sqliteTable("blog_post_chunks", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => blogPosts.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  heading: text("heading"),
  anchor: text("anchor"),
  imageRefs: text("image_refs").notNull().default("[]"),
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
