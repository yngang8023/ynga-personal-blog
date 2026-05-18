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
				headers: req.headers,
				method: req.method,
				pathname: url.pathname,
				searchParams: new URLSearchParams(url.search),
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
		const statusRequests = requests.filter((request) => request.pathname === "/api/sync-sessions/session-test-1");
		assert.ok(statusRequests.length > 0);
		assert.ok(statusRequests.every((request) => request.searchParams.has("_ts")));
		assert.ok(statusRequests.every((request) => request.headers["cache-control"] === "no-cache"));
		assert.ok(statusRequests.every((request) => request.headers.pragma === "no-cache"));
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

test("sync blog rag suppresses duplicate polling spam and prints a terminal summary once", async () => {
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
				headers: req.headers,
				method: req.method,
				pathname: url.pathname,
				searchParams: new URLSearchParams(url.search),
				payload,
			});

			if (req.method === "POST" && url.pathname === "/api/sync-sessions") {
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: true, sessionId: "session-test-2", status: "created" }));
				return;
			}

			if (req.method === "POST" && /\/api\/sync-sessions\/session-test-2\/posts\/.+/.test(url.pathname)) {
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: true, status: "uploaded" }));
				return;
			}

			if (req.method === "POST" && url.pathname === "/api/sync-sessions/session-test-2/finalize") {
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: true, status: "running" }));
				return;
			}

			if (req.method === "GET" && url.pathname === "/api/sync-sessions/session-test-2") {
				pollCount += 1;
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(
					JSON.stringify(
						pollCount < 3
							? {
									ok: true,
									session: {
										id: "session-test-2",
										status: "running",
										expectedPostCount: 2,
										processedPostCount: 1,
										succeededPostCount: 1,
										failedPostCount: 0,
										skippedPostCount: 0,
										metrics: {},
										slowestPosts: [],
									},
							  }
							: {
									ok: true,
									session: {
										id: "session-test-2",
										status: "completed",
										expectedPostCount: 2,
										processedPostCount: 2,
										succeededPostCount: 2,
										failedPostCount: 0,
										skippedPostCount: 0,
										metrics: {},
										slowestPosts: [
											{
												postId: "post-c/index.md",
												status: "completed",
												stage: "done",
												totalMs: 500,
												slowestStage: "embedding_ms",
												slowestStageMs: 300,
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
				BLOG_RAG_SYNC_UPLOAD_CONCURRENCY: "1",
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
		assert.ok((stdout.match(/同步会话 session-test-2 状态：/g) || []).length <= 2);
		assert.equal((stdout.match(/同步会话 session-test-2 状态：/g) || []).length, 2);
		assert.equal((stdout.match(/同步终态总结/g) || []).length, 1);
		assert.equal((stdout.match(/最慢文章：/g) || []).length, 1);
		assert.equal((stdout.match(/聚合瓶颈：/g) || []).length, 0);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	}
});

test("sync blog rag exits when session counts converge even if session status writeback lags", async () => {
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
				headers: req.headers,
				method: req.method,
				pathname: url.pathname,
				searchParams: new URLSearchParams(url.search),
				payload,
			});

			if (req.method === "POST" && url.pathname === "/api/sync-sessions") {
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: true, sessionId: "session-test-3", status: "created" }));
				return;
			}

			if (req.method === "POST" && /\/api\/sync-sessions\/session-test-3\/posts\/.+/.test(url.pathname)) {
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: true, status: "uploaded" }));
				return;
			}

			if (req.method === "POST" && url.pathname === "/api/sync-sessions/session-test-3/finalize") {
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: true, status: "running" }));
				return;
			}

			if (req.method === "GET" && url.pathname === "/api/sync-sessions/session-test-3") {
				pollCount += 1;
				res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				res.end(
					JSON.stringify({
						ok: true,
						session: {
							id: "session-test-3",
							status: "running",
							workflowStatus: null,
							effectiveStatus: "running",
							statusSource: "session_db",
							convergenceStatus: "converged_success",
							expectedPostCount: 6,
							uploadedPostCount: 6,
							processedPostCount: 6,
							succeededPostCount: 5,
							failedPostCount: 0,
							skippedPostCount: 1,
							allProcessed: true,
							hasFailures: false,
							pendingRecoveryCount: 0,
							metrics: {
								timings: {
									asset_upload_ms: 200,
									ocr_ms: 500,
									chunk_build_ms: 100,
									db_write_ms: 300,
									embedding_ms: 900,
									vectorize_ms: 400,
									finalize_ms: 100,
									total_ms: 2500,
								},
								stats: {
									file_count: 18,
									referenced_image_count: 4,
									ocr_image_count: 3,
									section_count: 11,
									chunk_count: 22,
									vector_count: 22,
								},
							},
							slowestPosts: [
								{
									postId: "post-d/index.md",
									status: "completed",
									stage: "done",
									totalMs: 1200,
									slowestStage: "embedding_ms",
									slowestStageMs: 600,
								},
							],
						},
					}),
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
				BLOG_RAG_SYNC_UPLOAD_CONCURRENCY: "1",
				BLOG_RAG_SYNC_POLL_INTERVAL_MS: "10",
				BLOG_RAG_SYNC_CONVERGENCE_POLLS: "2",
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
		assert.ok(pollCount <= 3, `expected convergence fallback to stop quickly, got ${pollCount} polls`);
		assert.match(stdout, /收敛|converged|稳定/i);
		assert.match(stdout, /同步终态总结/);
		assert.match(stdout, /session-test-3/);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	}
});
