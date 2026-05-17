#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { collectBlogRagPostManifests } from "./blog-rag-sync-utils.mjs";
import { loadEnv } from "./load-env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const configPath = path.resolve(rootDir, "src/config.ts");

loadEnv();

function readExportedStringConstant(sourceFile, constantName) {
	const declarations = new Map();

	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) {
			continue;
		}

		for (const declaration of statement.declarationList.declarations) {
			if (ts.isIdentifier(declaration.name) && declaration.initializer) {
				declarations.set(declaration.name.text, declaration.initializer);
			}
		}
	}

	function resolveStringExpression(expression, seen = new Set()) {
		if (
			ts.isStringLiteral(expression) ||
			ts.isNoSubstitutionTemplateLiteral(expression)
		) {
			return expression.text;
		}

		if (ts.isTemplateExpression(expression)) {
			return expression.head.text + expression.templateSpans.map((span) => {
				const value = resolveStringExpression(span.expression, seen);
				return value + span.literal.text;
			}).join("");
		}

		if (ts.isParenthesizedExpression(expression)) {
			return resolveStringExpression(expression.expression, seen);
		}

		if (
			ts.isBinaryExpression(expression) &&
			expression.operatorToken.kind === ts.SyntaxKind.PlusToken
		) {
			return (
				resolveStringExpression(expression.left, seen) +
				resolveStringExpression(expression.right, seen)
			);
		}

		if (ts.isIdentifier(expression)) {
			if (seen.has(expression.text)) {
				throw new Error(
					`Circular string constant reference ${expression.text} in src/config.ts`,
				);
			}

			const referencedInitializer = declarations.get(expression.text);
			if (!referencedInitializer) {
				throw new Error(
					`Missing referenced string constant ${expression.text} in src/config.ts`,
				);
			}

			const nextSeen = new Set(seen);
			nextSeen.add(expression.text);
			return resolveStringExpression(referencedInitializer, nextSeen);
		}

		throw new Error(
			`Unsupported string expression for ${constantName} in src/config.ts`,
		);
	}

	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) {
			continue;
		}

		const isExported = statement.modifiers?.some(
			(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
		);
		if (!isExported) {
			continue;
		}

		for (const declaration of statement.declarationList.declarations) {
			if (
				!ts.isIdentifier(declaration.name) ||
				declaration.name.text !== constantName
			) {
				continue;
			}

			if (declaration.initializer) {
				return resolveStringExpression(declaration.initializer);
			}
		}
	}

	throw new Error(`Missing exported string constant ${constantName} in src/config.ts`);
}

function readBlogRagDefaults() {
	const configSource = readFileSync(configPath, "utf8");
	const sourceFile = ts.createSourceFile(
		configPath,
		configSource,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);

	return {
		endpoint: readExportedStringConstant(sourceFile, "BLOG_RAG_SYNC_ENDPOINT"),
		siteURL: readExportedStringConstant(sourceFile, "BLOG_RAG_SITE_URL"),
	};
}

function hasFlag(name) {
	return process.argv.includes(name);
}

function readPositiveInteger(value, fallback) {
	const parsed = Number.parseInt(value || "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function chunkItems(items, chunkSize) {
	const chunks = [];
	for (let index = 0; index < items.length; index += chunkSize) {
		chunks.push(items.slice(index, index + chunkSize));
	}
	return chunks;
}

function readConfig() {
	const defaults = readBlogRagDefaults();
	const endpoint = process.env.BLOG_RAG_SYNC_ENDPOINT || defaults.endpoint;
	const token = process.env.BLOG_RAG_SYNC_TOKEN || process.env.RAG_SYNC_TOKEN || "";
	const siteURL = process.env.BLOG_RAG_SITE_URL || defaults.siteURL;
	const uploadConcurrency = readPositiveInteger(
		process.env.BLOG_RAG_SYNC_UPLOAD_CONCURRENCY,
		2,
	);
	const pollIntervalMs = readPositiveInteger(
		process.env.BLOG_RAG_SYNC_POLL_INTERVAL_MS,
		3000,
	);
	const dryRun = hasFlag("--dry-run");
	const forceRebuild =
		hasFlag("--force") ||
		process.env.BLOG_RAG_FORCE_REBUILD === "true" ||
		process.env.BLOG_RAG_FORCE_REBUILD === "1";

	return {
		endpoint,
		token,
		siteURL,
		uploadConcurrency,
		pollIntervalMs,
		dryRun,
		forceRebuild,
	};
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryResponseStatus(status) {
	return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function computeRetryBackoffMs(attempt) {
	return Math.min(5000, 400 * Math.pow(2, attempt - 1));
}

async function parseJsonResponse(response) {
	const text = await response.text();
	try {
		return text ? JSON.parse(text) : {};
	} catch {
		return { raw: text };
	}
}

async function requestJson(url, init, options = {}) {
	const maxAttempts = options.maxAttempts || 4;
	let lastError = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const response = await fetch(url, init);
			const payload = await parseJsonResponse(response);

			if (!response.ok) {
				const error = new Error(
					`RAG sync failed with HTTP ${response.status}: ${JSON.stringify(payload)}`,
				);
				if (attempt < maxAttempts && shouldRetryResponseStatus(response.status)) {
					lastError = error;
					await sleep(computeRetryBackoffMs(attempt));
					continue;
				}
				throw error;
			}

			return payload;
		} catch (error) {
			lastError = error;
			if (attempt >= maxAttempts) {
				break;
			}
			await sleep(computeRetryBackoffMs(attempt));
		}
	}

	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function createSyncSession({
	endpoint,
	token,
	siteURL,
}) {
	if (!token) {
		throw new Error(
			"Missing BLOG_RAG_SYNC_TOKEN or RAG_SYNC_TOKEN. Put it in .env or CI secrets.",
		);
	}

	return requestJson(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			siteURL,
			client: "sync-blog-rag-script",
		}),
	});
}

async function uploadSessionPost({
	endpoint,
	token,
	sessionId,
	post,
}) {
	return requestJson(
		`${endpoint}/${encodeURIComponent(sessionId)}/posts/${encodeURIComponent(post.id)}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ post }),
		},
	);
}

async function finalizeSyncSession({
	endpoint,
	token,
	sessionId,
	activePostIds,
	forceRebuild,
}) {
	return requestJson(`${endpoint}/${encodeURIComponent(sessionId)}/finalize`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			activePostIds,
			forceRebuild,
			pruneMissing: true,
		}),
	});
}

async function getSyncSessionStatus({ endpoint, token, sessionId }) {
	return requestJson(`${endpoint}/${encodeURIComponent(sessionId)}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}

async function mapLimit(items, limit, iteratee) {
	const results = new Array(items.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < items.length) {
			const currentIndex = nextIndex;
			nextIndex += 1;
			results[currentIndex] = await iteratee(items[currentIndex], currentIndex);
		}
	}

	await Promise.all(
		Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, () =>
			worker(),
		),
	);

	return results;
}

function isTerminalSessionStatus(status) {
	return [
		"completed",
		"completed_with_warnings",
		"failed",
		"cancelled",
	].includes(status);
}

function getSlowestTiming(metrics) {
	const timings = metrics?.timings || {};
	let slowestKey = null;
	let slowestValue = 0;

	for (const [key, value] of Object.entries(timings)) {
		if (key === "total_ms" || typeof value !== "number") {
			continue;
		}
		if (value > slowestValue) {
			slowestKey = key;
			slowestValue = value;
		}
	}

	return {
		key: slowestKey,
		value: slowestValue,
	};
}

function formatSlowestPosts(slowestPosts) {
	if (!Array.isArray(slowestPosts) || slowestPosts.length === 0) {
		return "";
	}

	return slowestPosts
		.slice(0, 3)
		.map((post) => {
			const postId = post?.postId || "unknown";
			const slowestStage = post?.slowestStage || "unknown";
			const slowestStageMs = Number(post?.slowestStageMs || 0);
			const totalMs = Number(post?.totalMs || 0);
			return `${postId} (${slowestStage}=${slowestStageMs}ms, total=${totalMs}ms)`;
		})
		.join("；");
}

function formatNumber(value) {
	return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatTimingSummaryLine(timings = {}) {
	return `bundle_download=${formatNumber(timings.bundle_download_ms)}ms，bundle_decode=${formatNumber(timings.bundle_decode_ms)}ms，asset=${formatNumber(timings.asset_upload_ms)}ms，ocr=${formatNumber(timings.ocr_ms)}ms，chunk=${formatNumber(timings.chunk_build_ms)}ms，db=${formatNumber(timings.db_write_ms)}ms，embedding=${formatNumber(timings.embedding_ms)}ms，vectorize=${formatNumber(timings.vectorize_ms)}ms，finalize=${formatNumber(timings.finalize_ms)}ms。`;
}

function formatFailedPostsLine(failedPosts) {
	if (!Array.isArray(failedPosts) || failedPosts.length === 0) {
		return "";
	}

	return failedPosts
		.slice(0, 3)
		.map((post) => {
			const postId = post?.postId || "unknown";
			const stage = post?.stage || "unknown";
			const attemptCount = formatNumber(post?.attemptCount);
			const errorMessage = post?.errorMessage || "unknown error";
			return `${postId} [${stage}, attempt=${attemptCount}] ${errorMessage}`;
		})
		.join("；");
}

function buildPollSnapshot(payload) {
	const session = payload?.session || {};
	const slowestTiming = getSlowestTiming(session.metrics);
	const metricsReady = Object.values(session.metrics?.timings || {}).some((value) => Number(value) > 0);
	const slowestPostsLine = metricsReady ? formatSlowestPosts(session.slowestPosts) : "";
	const failedPostsLine = formatFailedPostsLine(payload?.failedPosts);

	return {
		status: session.status || "unknown",
		processed: formatNumber(session.processedPostCount),
		expected: formatNumber(session.expectedPostCount),
		succeeded: formatNumber(session.succeededPostCount),
		failed: formatNumber(session.failedPostCount),
		skipped: formatNumber(session.skippedPostCount),
		slowestKey: slowestTiming.key || "",
		slowestValue: formatNumber(slowestTiming.value),
		metricsReady,
		slowestPostsLine,
		failedPostsLine,
		timingsSignature: JSON.stringify(session.metrics?.timings || {}),
		statsSignature: JSON.stringify(session.metrics?.stats || {}),
	};
}

function shouldLogPollSnapshot(previous, next, pollCount) {
	if (!previous) {
		return true;
	}

	if (
		previous.status !== next.status ||
		previous.processed !== next.processed ||
		previous.expected !== next.expected ||
		previous.succeeded !== next.succeeded ||
		previous.failed !== next.failed ||
		previous.skipped !== next.skipped ||
		previous.slowestKey !== next.slowestKey ||
		previous.slowestValue !== next.slowestValue ||
		previous.slowestPostsLine !== next.slowestPostsLine ||
		previous.failedPostsLine !== next.failedPostsLine ||
		previous.timingsSignature !== next.timingsSignature ||
		previous.statsSignature !== next.statsSignature
	) {
		return true;
	}

	return pollCount % 10 === 0;
}

function printFinalSessionSummary(sessionId, session) {
	const slowestTiming = getSlowestTiming(session.metrics);
	const stats = session.metrics?.stats || {};
	const timings = session.metrics?.timings || {};
	const slowestPostsLine = formatSlowestPosts(session.slowestPosts);

	console.log("\n同步终态总结");
	console.log(
		`会话 ${sessionId}：${session.status}，处理 ${formatNumber(session.processedPostCount)}/${formatNumber(session.expectedPostCount)}，成功 ${formatNumber(session.succeededPostCount)}，失败 ${formatNumber(session.failedPostCount)}，跳过 ${formatNumber(session.skippedPostCount)}。`,
	);
	console.log(
		`总计 chunk=${formatNumber(stats.chunk_count)}，总计 vector=${formatNumber(stats.vector_count)}，总计 OCR 图片=${formatNumber(stats.ocr_image_count)}，总文件=${formatNumber(stats.file_count)}。`,
	);
	if (slowestTiming.key) {
		console.log(`最终瓶颈：${slowestTiming.key}=${formatNumber(slowestTiming.value)}ms。`);
	}
	console.log(`阶段耗时汇总：${formatTimingSummaryLine(timings)}`);
	if (slowestPostsLine) {
		console.log(`最慢文章：${slowestPostsLine}`);
	}
}

async function pollSyncSession({
	endpoint,
	token,
	sessionId,
	pollIntervalMs,
}) {
	let previousSnapshot = null;
	let pollCount = 0;

	while (true) {
		const payload = await getSyncSessionStatus({ endpoint, token, sessionId });
		const session = payload?.session || {};
		pollCount += 1;
		const snapshot = buildPollSnapshot(payload);

		if (shouldLogPollSnapshot(previousSnapshot, snapshot, pollCount)) {
			console.log(
				`同步会话 ${sessionId} 状态：${snapshot.status}，已处理 ${snapshot.processed}/${snapshot.expected}，成功 ${snapshot.succeeded}，失败 ${snapshot.failed}。`,
			);
			if (snapshot.metricsReady && snapshot.slowestKey) {
				console.log(
					`聚合瓶颈：${snapshot.slowestKey}=${snapshot.slowestValue}ms，chunk=${session.metrics?.stats?.chunk_count || 0}，vector=${session.metrics?.stats?.vector_count || 0}，ocr图片=${session.metrics?.stats?.ocr_image_count || 0}。`,
				);
				console.log(`阶段耗时：${formatTimingSummaryLine(session.metrics?.timings || {})}`);
			}
			if (snapshot.slowestPostsLine) {
				console.log(`最慢文章：${snapshot.slowestPostsLine}`);
			}
			if (snapshot.failedPostsLine) {
				console.log(`失败文章：${snapshot.failedPostsLine}`);
			}
		}
		previousSnapshot = snapshot;

		if (isTerminalSessionStatus(session.status)) {
			return payload;
		}

		await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
	}
}

async function main() {
	const config = readConfig();
	const manifests = await collectBlogRagPostManifests({
		rootDir,
		siteURL: config.siteURL,
	});

	console.log(`准备同步 ${manifests.length} 篇公开博客文章目录到 RAG 知识库。`);
	console.log(`同步地址：${config.endpoint}`);
	console.log(`并发上传：${config.uploadConcurrency} 篇/并发槽位。`);
	if (config.forceRebuild) {
		console.log("强制重建模式：服务端会忽略 contentHash 跳过逻辑，重新写入所有文章。");
	}

	if (config.dryRun) {
		console.log("\nDry run 模式，不会发送请求。");
		console.log(
			JSON.stringify(
				{
					count: manifests.length,
					forceRebuild: config.forceRebuild,
					posts: manifests.map((post) => ({
						id: post.id,
						url: post.url,
						entryPath: post.entryPath,
						fileCount: post.files.length,
						imageCount: post.files.filter((file) =>
							file.contentType.startsWith("image/"),
						).length,
						contentHash: post.contentHash,
					})),
				},
				null,
				2,
			),
		);
		return;
	}

	const activePostIds = manifests.map((post) => post.id);
	const session = await createSyncSession({
		endpoint: config.endpoint,
		token: config.token,
		siteURL: config.siteURL,
	});
	const sessionId = session.sessionId;
	if (!sessionId) {
		throw new Error(`Session create response missing sessionId: ${JSON.stringify(session)}`);
	}

	console.log(`已创建同步会话：${sessionId}`);

	await mapLimit(manifests, config.uploadConcurrency, async (manifest, index) => {
		console.log(`正在上传文章 ${index + 1}/${manifests.length}：${manifest.id}`);
		const post = await manifest.createBundle();
		return uploadSessionPost({
			endpoint: config.endpoint,
			token: config.token,
			sessionId,
			post,
		});
	});

	console.log(`文章上传完成，开始 finalize 会话：${sessionId}`);
	await finalizeSyncSession({
		endpoint: config.endpoint,
		token: config.token,
		sessionId,
		activePostIds,
		forceRebuild: config.forceRebuild,
	});

	const finalStatus = await pollSyncSession({
		endpoint: config.endpoint,
		token: config.token,
		sessionId,
		pollIntervalMs: config.pollIntervalMs,
	});
	const sessionStatus = finalStatus?.session?.status;
	if (sessionStatus !== "completed" && sessionStatus !== "completed_with_warnings") {
		throw new Error(
			`RAG sync session ${sessionId} finished with status ${sessionStatus}: ${JSON.stringify(finalStatus)}`,
		);
	}

	printFinalSessionSummary(sessionId, finalStatus?.session || {});
	console.log("RAG 知识库同步完成：");
	console.log(JSON.stringify(finalStatus, null, 2));
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
