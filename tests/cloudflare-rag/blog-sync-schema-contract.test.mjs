import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const schemaPath = path.resolve("cloudflare-rag/schema.ts");

test("blog sync schema adds session, revision, and cache tables", async () => {
	const migrationsDir = path.resolve("cloudflare-rag/drizzle");
	const [schemaSource, migrationFiles] = await Promise.all([
		readFile(schemaPath, "utf8"),
		readdir(migrationsDir),
	]);
	const migrationSource = (
		await Promise.all(
			migrationFiles
				.filter((file) => file.endsWith(".sql"))
				.map((file) => readFile(path.join(migrationsDir, file), "utf8")),
		)
	).join("\n");

	assert.match(schemaSource, /blogSyncSessions/);
	assert.match(schemaSource, /blogSyncSessionPosts/);
	assert.match(schemaSource, /blogPostRevisions/);
	assert.match(schemaSource, /blogImageAssets/);
	assert.match(schemaSource, /blogImageOcrCache/);
	assert.match(schemaSource, /currentRevisionId/);
	assert.match(schemaSource, /lastCompletedRevisionId/);
	assert.match(schemaSource, /syncStatus/);
	assert.match(schemaSource, /vectorStatus/);
	assert.match(schemaSource, /revisionId/);
	assert.match(schemaSource, /assetRefCount|asset_ref_count/);
	assert.match(schemaSource, /assetContentHashesJson|asset_content_hashes_json/);
	assert.match(schemaSource, /processingStartedAt|processing_started_at/);

	assert.match(migrationSource, /CREATE TABLE `blog_sync_sessions`/);
	assert.match(migrationSource, /CREATE TABLE `blog_sync_session_posts`/);
	assert.match(migrationSource, /CREATE TABLE `blog_post_revisions`/);
	assert.match(migrationSource, /CREATE TABLE `blog_image_assets`/);
	assert.match(migrationSource, /CREATE TABLE `blog_image_ocr_cache`/);
	assert.match(migrationSource, /CREATE INDEX `idx_blog_sync_session_posts_session_status`/);
	assert.match(migrationSource, /CREATE INDEX `idx_blog_post_revisions_post_status`/);
	assert.match(migrationSource, /CREATE INDEX `idx_blog_post_chunks_revision_id`/);
	assert.match(migrationSource, /asset_ref_count/);
	assert.match(migrationSource, /asset_content_hashes_json/);
	assert.match(migrationSource, /processing_started_at/);
});

test("blog sync migrations apply in dependency-safe order", async () => {
	const migrationsDir = path.resolve("cloudflare-rag/drizzle");
	const migrationFiles = (await readdir(migrationsDir))
		.filter((file) => file.endsWith(".sql"))
		.sort();

	const intelligenceMigration = "20260514143000_blog_rag_intelligence.sql";
	const sessionsMigration = "20260514150000_blog_sync_sessions_and_revisions.sql";
	const hardeningMigration = "20260518130000_blog_sync_hardening.sql";

	const intelligenceIndex = migrationFiles.indexOf(intelligenceMigration);
	const sessionsIndex = migrationFiles.indexOf(sessionsMigration);
	const hardeningIndex = migrationFiles.indexOf(hardeningMigration);

	assert.notEqual(intelligenceIndex, -1);
	assert.notEqual(sessionsIndex, -1);
	assert.notEqual(hardeningIndex, -1);
	assert.ok(
		intelligenceIndex < sessionsIndex,
		`Expected ${intelligenceMigration} before ${sessionsMigration}, got ${migrationFiles.join(", ")}`,
	);
	assert.ok(
		sessionsIndex < hardeningIndex,
		`Expected ${sessionsMigration} before ${hardeningMigration}, got ${migrationFiles.join(", ")}`,
	);
});
