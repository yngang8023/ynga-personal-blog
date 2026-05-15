ALTER TABLE `blog_posts` ADD COLUMN `topic` text;
--> statement-breakpoint
ALTER TABLE `blog_posts` ADD COLUMN `series` text;
--> statement-breakpoint
ALTER TABLE `blog_posts` ADD COLUMN `has_images` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_posts` ADD COLUMN `has_code_blocks` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_posts` ADD COLUMN `section_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_posts` ADD COLUMN `image_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `blog_post_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`section_index` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`heading` text,
	`anchor` text,
	`summary` text DEFAULT '' NOT NULL,
	`text` text NOT NULL,
	`has_images` integer DEFAULT false NOT NULL,
	`has_code_blocks` integer DEFAULT false NOT NULL,
	`image_refs` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `blog_posts`(`id`) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `section_id` text REFERENCES `blog_post_sections`(`id`) ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `section_index` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `category` text;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `tags` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `topic` text;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `series` text;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `published` text;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `updated` text;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `has_images` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `has_code_blocks` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `blog_post_chunks` ADD COLUMN `parent_text` text DEFAULT '' NOT NULL;
