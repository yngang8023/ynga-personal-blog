ALTER TABLE `blog_posts` ADD COLUMN `current_revision_id` text;
ALTER TABLE `blog_posts` ADD COLUMN `last_completed_revision_id` text;
ALTER TABLE `blog_posts` ADD COLUMN `sync_status` text DEFAULT 'completed' NOT NULL;
ALTER TABLE `blog_posts` ADD COLUMN `vector_status` text DEFAULT 'completed' NOT NULL;
ALTER TABLE `blog_posts` ADD COLUMN `last_error` text;
ALTER TABLE `blog_posts` ADD COLUMN `last_session_id` text;

ALTER TABLE `blog_post_sections` ADD COLUMN `revision_id` text REFERENCES `blog_post_revisions`(`id`) ON DELETE CASCADE;
ALTER TABLE `blog_post_sections` ADD COLUMN `section_key` text;
ALTER TABLE `blog_post_chunks` ADD COLUMN `revision_id` text REFERENCES `blog_post_revisions`(`id`) ON DELETE CASCADE;
ALTER TABLE `blog_post_chunks` ADD COLUMN `chunk_key` text;
ALTER TABLE `blog_post_chunks` ADD COLUMN `chunk_hash` text;
ALTER TABLE `blog_post_images` ADD COLUMN `revision_id` text REFERENCES `blog_post_revisions`(`id`) ON DELETE CASCADE;

CREATE TABLE `blog_sync_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `status` text DEFAULT 'created' NOT NULL,
  `site_url` text DEFAULT '' NOT NULL,
  `client` text,
  `force_rebuild` integer DEFAULT 0 NOT NULL,
  `prune_missing` integer DEFAULT 1 NOT NULL,
  `active_post_ids_json` text DEFAULT '[]' NOT NULL,
  `expected_post_count` integer DEFAULT 0 NOT NULL,
  `uploaded_post_count` integer DEFAULT 0 NOT NULL,
  `processed_post_count` integer DEFAULT 0 NOT NULL,
  `succeeded_post_count` integer DEFAULT 0 NOT NULL,
  `failed_post_count` integer DEFAULT 0 NOT NULL,
  `skipped_post_count` integer DEFAULT 0 NOT NULL,
  `error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `finalized_at` text,
  `completed_at` text
);

CREATE TABLE `blog_sync_session_posts` (
  `id` text PRIMARY KEY NOT NULL,
  `session_id` text NOT NULL,
  `post_id` text NOT NULL,
  `bundle_r2_key` text DEFAULT '' NOT NULL,
  `content_hash` text DEFAULT '' NOT NULL,
  `status` text DEFAULT 'uploaded' NOT NULL,
  `revision_id` text,
  `attempt_count` integer DEFAULT 0 NOT NULL,
  `stage` text,
  `error_message` text,
  `timings_json` text DEFAULT '{}' NOT NULL,
  `stats_json` text DEFAULT '{}' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`session_id`) REFERENCES `blog_sync_sessions`(`id`) ON DELETE CASCADE
);

CREATE TABLE `blog_post_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `post_id` text NOT NULL,
  `session_id` text,
  `content_hash` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `vector_status` text DEFAULT 'pending' NOT NULL,
  `source_prefix` text DEFAULT '' NOT NULL,
  `bundle_r2_key` text DEFAULT '' NOT NULL,
  `title` text DEFAULT '' NOT NULL,
  `description` text DEFAULT '' NOT NULL,
  `url` text DEFAULT '' NOT NULL,
  `published` text,
  `updated` text,
  `tags` text DEFAULT '[]' NOT NULL,
  `category` text,
  `topic` text,
  `series` text,
  `section_count` integer DEFAULT 0 NOT NULL,
  `image_count` integer DEFAULT 0 NOT NULL,
  `chunk_count` integer DEFAULT 0 NOT NULL,
  `has_images` integer DEFAULT 0 NOT NULL,
  `has_code_blocks` integer DEFAULT 0 NOT NULL,
  `error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`post_id`) REFERENCES `blog_posts`(`id`) ON DELETE CASCADE
);

CREATE TABLE `blog_image_assets` (
  `content_hash` text PRIMARY KEY NOT NULL,
  `r2_key` text NOT NULL,
  `content_type` text DEFAULT 'application/octet-stream' NOT NULL,
  `byte_size` integer DEFAULT 0 NOT NULL,
  `first_seen_post_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE TABLE `blog_image_ocr_cache` (
  `content_hash` text PRIMARY KEY NOT NULL,
  `ocr_text` text DEFAULT '' NOT NULL,
  `ocr_status` text DEFAULT 'pending' NOT NULL,
  `model` text DEFAULT '' NOT NULL,
  `error_message` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE INDEX `idx_blog_sync_session_posts_session_status`
  ON `blog_sync_session_posts` (`session_id`, `status`, `post_id`);
CREATE INDEX `idx_blog_post_revisions_post_status`
  ON `blog_post_revisions` (`post_id`, `status`, `created_at`);
CREATE INDEX `idx_blog_post_chunks_revision_id`
  ON `blog_post_chunks` (`revision_id`);
CREATE INDEX `idx_blog_post_sections_revision_id`
  ON `blog_post_sections` (`revision_id`);
CREATE INDEX `idx_blog_post_images_revision_id`
  ON `blog_post_images` (`revision_id`);
CREATE INDEX `idx_blog_sync_sessions_status_created_at`
  ON `blog_sync_sessions` (`status`, `created_at`);
CREATE INDEX `idx_blog_image_assets_content_hash`
  ON `blog_image_assets` (`content_hash`);
CREATE INDEX `idx_blog_image_ocr_cache_content_hash`
  ON `blog_image_ocr_cache` (`content_hash`);
