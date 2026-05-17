import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve("cloudflare-rag/app/lib/blogSync");

test("blog sync shared domain modules exist", async () => {
	await Promise.all([
		access(path.join(root, "types.ts")),
		access(path.join(root, "schema.ts")),
		access(path.join(root, "constants.ts")),
		access(path.join(root, "sessionState.ts")),
	]);
});

test("blog sync domain defines session and revision state helpers", async () => {
	const [typesSource, stateSource, constantsSource, schemaSource] = await Promise.all([
		readFile(path.join(root, "types.ts"), "utf8"),
		readFile(path.join(root, "sessionState.ts"), "utf8"),
		readFile(path.join(root, "constants.ts"), "utf8"),
		readFile(path.join(root, "schema.ts"), "utf8"),
	]);

	assert.match(typesSource, /BlogSyncSessionStatus/);
	assert.match(typesSource, /BlogSyncSessionPostStatus/);
	assert.match(typesSource, /BlogPostRevisionStatus/);
	assert.match(typesSource, /VectorSyncStatus/);
	assert.match(stateSource, /isTerminalSessionStatus/);
	assert.match(stateSource, /canUploadToSession/);
	assert.match(constantsSource, /BLOG_SYNC_STAGING_PREFIX/);
	assert.match(constantsSource, /BLOG_SYNC_STATUS_POLL_INTERVAL_MS/);
	assert.match(schemaSource, /createSessionPayloadSchema/);
	assert.match(schemaSource, /uploadSessionPostPayloadSchema/);
	assert.match(schemaSource, /finalizeSessionPayloadSchema/);
	assert.match(schemaSource, /syncSessionStatusResponseSchema/);
});
