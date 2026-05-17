import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import path from "node:path";
import test from "node:test";

const rootDir = path.resolve(".");

test("sync blog rag uploads posts through session protocol and finalizes with active post ids", async () => {
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
				url: url.pathname,
				method: req.method,
				headers: req.headers,
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
				res.end(JSON.stringify({
					ok: true,
					session: {
						id: "session-test-1",
						status: pollCount > 1 ? "completed" : "running",
						expectedPostCount: 6,
						processedPostCount: pollCount > 1 ? 6 : 3,
						succeededPostCount: pollCount > 1 ? 6 : 3,
						failedPostCount: 0,
						skippedPostCount: 0,
					},
				}));
				return;
			}

			res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
			res.end(JSON.stringify({ ok: true }));
		});
	});

	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	assert.ok(address && typeof address === "object");
	const endpoint = `http://127.0.0.1:${address.port}/api/sync-sessions`;

	try {
		const child = spawn(
			process.execPath,
			["scripts/sync-blog-rag.mjs"],
			{
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
			},
		);

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
		assert.equal(requests[0].url, "/api/sync-sessions");
		assert.ok(requests.some((request) => request.url === "/api/sync-sessions/session-test-1/finalize"));
		assert.ok(requests.some((request) => request.url === "/api/sync-sessions/session-test-1"));

		const finalizeRequest = requests.find((request) => request.url === "/api/sync-sessions/session-test-1/finalize");
		const activeIds = finalizeRequest.payload.activePostIds;
		assert.equal(activeIds.length, 6);
		const authorizationHeader = requests[0].headers.authorization;
		assert.match(authorizationHeader, /^Bearer\s+\S+/);

		const uploadRequests = requests.filter((request) =>
			/\/api\/sync-sessions\/session-test-1\/posts\/.+/.test(request.url)
		);
		assert.equal(uploadRequests.length, 6);
		for (const request of uploadRequests) {
			assert.equal(request.method, "POST");
			assert.equal(request.headers.authorization, authorizationHeader);
			assert.ok(request.payload.post.id);
		}

		assert.equal(finalizeRequest.payload.forceRebuild, false);
		assert.equal(finalizeRequest.payload.pruneMissing, true);
		assert.doesNotMatch(stdout, /batchSize/i);
	} finally {
		await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	}
});
