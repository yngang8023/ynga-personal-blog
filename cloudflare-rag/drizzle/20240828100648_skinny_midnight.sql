CREATE TABLE `blog_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`url` text NOT NULL,
	`published` text,
	`updated` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`category` text,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

--> statement-breakpoint
CREATE TABLE `blog_post_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `blog_posts`(`id`) ON UPDATE no action ON DELETE CASCADE
);

--> statement-breakpoint
CREATE VIRTUAL TABLE blog_post_chunks_fts USING fts5(
	id UNINDEXED,
	post_id UNINDEXED,
	title,
	url UNINDEXED,
	text
);

--> statement-breakpoint
CREATE TRIGGER blog_post_chunks_ai
AFTER INSERT ON blog_post_chunks
BEGIN
	INSERT INTO blog_post_chunks_fts(id, post_id, title, url, text)
	VALUES (new.id, new.post_id, new.title, new.url, new.text);
END;

--> statement-breakpoint
CREATE TRIGGER blog_post_chunks_ad
AFTER DELETE ON blog_post_chunks
BEGIN
	DELETE FROM blog_post_chunks_fts WHERE id = old.id;
END;
