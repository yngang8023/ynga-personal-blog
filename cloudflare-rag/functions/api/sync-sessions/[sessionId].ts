import { eq } from "drizzle-orm";
import { blogSyncSessionPosts, blogSyncSessions } from "schema";

import { jsonResponse, requireSyncAuth } from "../../_shared/blog-sync-auth";
import { getBlogSyncDb } from "../../_shared/blog-sync-db";

interface NumericRecord {
	[key: string]: number;
}

const sessionMetricTimingKeys = [
	"bundle_download_ms",
	"bundle_decode_ms",
	"asset_upload_ms",
	"ocr_ms",
	"chunk_build_ms",
	"db_write_ms",
	"embedding_ms",
	"vectorize_ms",
	"finalize_ms",
	"total_ms",
] as const;

const sessionMetricStatKeys = [
	"file_count",
	"referenced_image_count",
	"ocr_image_count",
	"section_count",
	"chunk_count",
	"vector_count",
	"reused_asset_count",
	"reused_ocr_count",
	"reused_embedding_count",
] as const;

function parseNumericRecord(value: string | null | undefined): NumericRecord {
	if (!value) {
		return {};
	}

	try {
		const parsed = JSON.parse(value);
		if (!parsed || typeof parsed !== "object") {
			return {};
		}

		const result: NumericRecord = {};
		for (const [key, entry] of Object.entries(parsed)) {
			if (typeof entry === "number" && Number.isFinite(entry)) {
				result[key] = entry;
			}
		}
		return result;
	} catch {
		return {};
	}
}

function sumInto(target: NumericRecord, source: NumericRecord) {
	for (const [key, value] of Object.entries(source)) {
		target[key] = (target[key] || 0) + value;
	}
}

function getSlowestStage(timings: NumericRecord): { stage: string | null; ms: number } {
	let slowestStage: string | null = null;
	let slowestMs = 0;

	for (const [key, value] of Object.entries(timings)) {
		if (key === "total_ms") {
			continue;
		}
		if (value > slowestMs) {
			slowestStage = key;
			slowestMs = value;
		}
	}

	return {
		stage: slowestStage,
		ms: slowestMs,
	};
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
	if (ctx.request.method !== "GET") {
		return jsonResponse({ error: "Expected GET." }, 405);
	}

	const unauthorized = requireSyncAuth(ctx.request, ctx.env.RAG_SYNC_TOKEN);
	if (unauthorized) {
		return unauthorized;
	}

	const sessionId = String(ctx.params.sessionId || "").trim();
	if (!sessionId) {
		return jsonResponse({ error: "Missing sessionId." }, 400);
	}

	const db = getBlogSyncDb(ctx.env);
	const session =
		(await db.select().from(blogSyncSessions).where(eq(blogSyncSessions.id, sessionId)).limit(1))[0] || null;
	if (!session) {
		return jsonResponse({ error: "Session not found." }, 404);
	}

	const sessionPosts = await db
		.select({
			postId: blogSyncSessionPosts.postId,
			status: blogSyncSessionPosts.status,
			stage: blogSyncSessionPosts.stage,
			attemptCount: blogSyncSessionPosts.attemptCount,
			errorMessage: blogSyncSessionPosts.errorMessage,
			timingsJson: blogSyncSessionPosts.timingsJson,
			statsJson: blogSyncSessionPosts.statsJson,
		})
		.from(blogSyncSessionPosts)
		.where(eq(blogSyncSessionPosts.sessionId, sessionId));

	const aggregateTimings: NumericRecord = Object.fromEntries(
		sessionMetricTimingKeys.map((key) => [key, 0]),
	);
	const aggregateStats: NumericRecord = Object.fromEntries(
		sessionMetricStatKeys.map((key) => [key, 0]),
	);
	const failedPosts: Array<{
		postId: string;
		status: string;
		stage: string | null;
		attemptCount: number;
		errorMessage: string | null;
		timingsJson: string;
		statsJson: string;
	}> = [];
	const slowestPosts = sessionPosts
		.map((post) => {
			const timings = parseNumericRecord(post.timingsJson);
			const stats = parseNumericRecord(post.statsJson);
			sumInto(aggregateTimings, timings);
			sumInto(aggregateStats, stats);

			if (post.status === "failed") {
				failedPosts.push({
					postId: post.postId,
					status: post.status,
					stage: post.stage,
					attemptCount: post.attemptCount,
					errorMessage: post.errorMessage,
					timingsJson: post.timingsJson,
					statsJson: post.statsJson,
				});
			}

			const slowestStage = getSlowestStage(timings);
			return {
				postId: post.postId,
				status: post.status,
				stage: post.stage,
				totalMs: timings.total_ms || 0,
				slowestStage: slowestStage.stage,
				slowestStageMs: slowestStage.ms,
			};
		})
		.sort((left, right) => right.totalMs - left.totalMs)
		.slice(0, 5);

	return jsonResponse({
		ok: true,
		session: {
			id: session.id,
			status: session.status,
			workflowId: `blog-sync-session-${session.id}`,
			expectedPostCount: session.expectedPostCount,
			uploadedPostCount: session.uploadedPostCount,
			processedPostCount: session.processedPostCount,
			succeededPostCount: session.succeededPostCount,
			failedPostCount: session.failedPostCount,
			skippedPostCount: session.skippedPostCount,
			forceRebuild: session.forceRebuild,
			pruneMissing: session.pruneMissing,
			errorMessage: session.errorMessage,
			metrics: {
				timings: aggregateTimings,
				stats: aggregateStats,
			},
			slowestPosts,
		},
		failedPosts,
	});
};
