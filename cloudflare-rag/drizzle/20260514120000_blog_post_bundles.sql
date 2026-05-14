ALTER TABLE `blog_posts` ADD COLUMN `source_prefix` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `heading` text;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `anchor` text;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `image_refs` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
CREATE TABLE `blog_post_images` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`relative_path` text NOT NULL,
	`r2_key` text NOT NULL,
	`url` text NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`heading` text,
	`anchor` text,
	`surrounding_text` text DEFAULT '' NOT NULL,
	`ocr_text` text DEFAULT '' NOT NULL,
	`content_type` text DEFAULT 'application/octet-stream' NOT NULL,
	`content_hash` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `blog_posts`(`id`) ON UPDATE no action ON DELETE CASCADE
);
