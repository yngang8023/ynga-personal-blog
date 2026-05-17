ALTER TABLE `blog_post_revisions` ADD COLUMN `asset_content_hashes_json` text DEFAULT '[]' NOT NULL;
ALTER TABLE `blog_sync_session_posts` ADD COLUMN `processing_started_at` text;
ALTER TABLE `blog_image_assets` ADD COLUMN `asset_ref_count` integer DEFAULT 0 NOT NULL;

CREATE INDEX `idx_blog_sync_session_posts_processing_started_at`
  ON `blog_sync_session_posts` (`session_id`, `status`, `processing_started_at`);
CREATE INDEX `idx_blog_image_assets_ref_count`
  ON `blog_image_assets` (`asset_ref_count`, `updated_at`);
