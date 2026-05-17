import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";

const rootDir = path.resolve(".");

test("sync blog rag uses session protocol with upload, finalize, and polling", async () => {
	const requests = [];
	let pollCount = 0;
	const server = createServer((req, res) => {
		const chunks = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => {
			const url = new URL(req.url, "http://127.0.0.1");
			const raw = Buffer.concat(chunks).toString("utf8");
			const payload = raw ? JSON.parse(raw) : null;
			requests.push({
				method: req.method,
				pathname: url.pathname,
				payload,
			});

			if (req.method === "POST" && url.pathname === "/api/sync-sessions") {
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: true, sessionId: "session-test-1", status: "created" }));
				return;
			}

			if (req.method === "POST" && /\/api\/sync-sessions\/session-test-1\/posts\/.+/.test(url.pathname)) {
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: true, status: "uploaded" }));
				return;
			}

			if (req.method === "POST" && url.pathname === "/api/sync-sessions/session-test-1/finalize") {
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: true, status: "running" }));
				return;
			}

			if (req.method === "GET" && url.pathname === "/api/sync-sessions/session-test-1") {
				pollCount += 1;
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(
					JSON.stringify(
						pollCount < 2
							? {
									ok: true,
									session: {
										id: "session-test-1",
										status: "running",
										expectedPostCount: 6,
										processedPostCount: 2,
										succeededPostCount: 2,
										failedPostCount: 0,
										skippedPostCount: 0,
										metrics: {
											timings: {
												asset_upload_ms: 100,
												ocr_ms: 1200,
												chunk_build_ms: 80,
												db_write_ms: 300,
												embedding_ms: 900,
												vectorize_ms: 450,
												finalize_ms: 40,
												total_ms: 3070,
											},
											stats: {
												file_count: 10,
												referenced_image_count: 3,
												ocr_image_count: 2,
												section_count: 7,
												chunk_count: 12,
												vector_count: 12,
											},
										},
										slowestPosts: [
											{
												postId: "post-a/index.md",
												status: "processing",
												stage: "indexing",
												totalMs: 1800,
												slowestStage: "ocr_ms",
												slowestStageMs: 900,
											},
										],
									},
								}
							: {
									ok: true,
									session: {
										id: "session-test-1",
										status: "completed",
										expectedPostCount: 6,
										processedPostCount: 6,
										succeededPostCount: 6,
										failedPostCount: 0,
										skippedPostCount: 0,
										metrics: {
											timings: {
												asset_upload_ms: 200,
												ocr_ms: 1500,
												chunk_build_ms: 120,
												db_write_ms: 600,
												embedding_ms: 1300,
												vectorize_ms: 700,
												finalize_ms: 90,
												total_ms: 4510,
											},
											stats: {
												file_count: 24,
												referenced_image_count: 8,
												ocr_image_count: 5,
												section_count: 22,
												chunk_count: 30,
												vector_count: 30,
											},
										},
										slowestPosts: [
											{
												postId: "post-b/index.md",
												status: "completed",
												stage: "done",
												totalMs: 2300,
												slowestStage: "embedding_ms",
												slowestStageMs: 1100,
											},
										],
									},
								},
					),
				);
				return;
			}

			res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
			res.end(JSON.stringify({ error: "not found" }));
		});
	});

	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	assert.ok(address && typeof address === "object");
	const endpoint = `http://127.0.0.1:${address.port}/api/sync-sessions`;

	try {
		const child = spawn(process.execPath, ["scripts/sync-blog-rag.mjs"], {
			cwd: rootDir,
			env: {
				...process.env,
				BLOG_RAG_SYNC_TOKEN: "test-token",
				BLOG_RAG_SYNC_ENDPOINT: endpoint,
				BLOG_RAG_SITE_URL: "https://ynga.kingcola-icg.cn/",
				BLOG_RAG_SYNC_BATCH_SIZE: "2",
				BLOG_RAG_SYNC_UPLOAD_CONCURRENCY: "2",
				BLOG_RAG_SYNC_POLL_INTERVAL_MS: "10",
			},
		});

		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});

		const [exitCode] = await once(child, "close");

		assert.equal(exitCode, 0, stderr || stdout);
		assert.equal(requests[0].pathname, "/api/sync-sessions");
		assert.ok(requests.some((request) => request.pathname === "/api/sync-sessions/session-test-1/finalize"));
		assert.ok(requests.some((request) => request.pathname === "/api/sync-sessions/session-test-1"));
		assert.ok(requests.some((request) => /\/api\/sync-sessions\/session-test-1\/posts\/.+/.test(request.pathname)));
		assert.match(stdout, /聚合瓶颈/);
		assert.match(stdout, /ocr_ms|embedding_ms|vectorize_ms/);
		assert.match(stdout, /最慢文章/);
		assert.match(stdout, /post-b\/index\.md/);
		assert.match(stdout, /同步终态总结/);
		assert.match(stdout, /总计 chunk|总计 vector|总计 OCR 图片/);
		assert.match(stdout, /最终瓶颈/);
		assert.match(stdout, /bundle_download_ms|bundle_decode_ms|asset_upload_ms|embedding_ms/);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	}
});
