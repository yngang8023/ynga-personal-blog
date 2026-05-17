import { jsonResponse, requireSyncAuth } from "../../_shared/blog-sync-auth";

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

const noStoreHeaders = {
	"Cache-Control": "private, no-store, max-age=0, must-revalidate",
};

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
		return jsonResponse({ error: "Expected GET." }, 405, noStoreHeaders);
	}

	const unauthorized = requireSyncAuth(ctx.request, ctx.env.RAG_SYNC_TOKEN);
	if (unauthorized) {
		return unauthorized;
	}

	const sessionId = String(ctx.params.sessionId || "").trim();
	if (!sessionId) {
		return jsonResponse({ error: "Missing sessionId." }, 400, noStoreHeaders);
	}

	const sessionDb = ctx.env.DB.withSession("first-primary");
	const session =
		(await sessionDb
			.prepare("select * from blog_sync_sessions where id = ? limit 1")
			.bind(sessionId)
			.first<Record<string, unknown>>()) || null;
	if (!session) {
		return jsonResponse({ error: "Session not found." }, 404, noStoreHeaders);
	}

	const sessionPosts = (
		await sessionDb
			.prepare(
				[
					"select",
					"  post_id as postId,",
					"  status,",
					"  stage,",
					"  attempt_count as attemptCount,",
					"  error_message as errorMessage,",
					"  timings_json as timingsJson,",
					"  stats_json as statsJson,",
					"  processing_started_at as processingStartedAt,",
					"  updated_at as updatedAt",
					"from blog_sync_session_posts",
					"where session_id = ?",
				].join(" "),
			)
			.bind(sessionId)
			.all<Record<string, unknown>>()
	).results;

	const sessionRecord = session as Record<string, unknown>;
	const sessionExpectedPostCount = Number(sessionRecord.expected_post_count || 0);
	const sessionUploadedPostCount = Number(sessionRecord.uploaded_post_count || 0);
	const sessionProcessedPostCount = Number(sessionRecord.processed_post_count || 0);
	const sessionSucceededPostCount = Number(sessionRecord.succeeded_post_count || 0);
	const sessionFailedPostCount = Number(sessionRecord.failed_post_count || 0);
	const sessionSkippedPostCount = Number(sessionRecord.skipped_post_count || 0);
	const sessionStatus = String(sessionRecord.status || "").trim() || "created";
	const nowMs = Date.now();
	const processingLeaseMs = 10 * 60 * 1000;

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
	let uploadedDerivedCount = 0;
	let processedDerivedCount = 0;
	let succeededDerivedCount = 0;
	let failedDerivedCount = 0;
	let skippedDerivedCount = 0;
	let pendingRecoveryCount = 0;
	const slowestPosts = sessionPosts
		.map((post) => {
			const postRecord = post as Record<string, unknown>;
			const timings = parseNumericRecord(String(postRecord.timingsJson || "{}"));
			const stats = parseNumericRecord(String(postRecord.statsJson || "{}"));
			sumInto(aggregateTimings, timings);
			sumInto(aggregateStats, stats);

			const status = String(postRecord.status || "");
			const stage = postRecord.stage == null ? null : String(postRecord.stage);
			const attemptCount = Number(postRecord.attemptCount || 0);
			const errorMessage = postRecord.errorMessage == null ? null : String(postRecord.errorMessage);
			const processingStartedAt = postRecord.processingStartedAt
				? Date.parse(String(postRecord.processingStartedAt))
				: Number.NaN;
			const staleQueuedState =
				(status === "uploaded" || status === "queued" || stage === "retry_pending") &&
				postRecord.updatedAt &&
				Number.isFinite(Date.parse(String(postRecord.updatedAt))) &&
				nowMs - Date.parse(String(postRecord.updatedAt)) >= processingLeaseMs;

			uploadedDerivedCount += 1;
			if (status === "completed") {
				processedDerivedCount += 1;
				succeededDerivedCount += 1;
			}
			if (status === "skipped") {
				processedDerivedCount += 1;
				skippedDerivedCount += 1;
			}
			if (status === "failed") {
				processedDerivedCount += 1;
				failedDerivedCount += 1;
			}
			if (
				(status === "processing" &&
					(!Number.isFinite(processingStartedAt) || nowMs - processingStartedAt >= processingLeaseMs)) ||
				staleQueuedState
			) {
				pendingRecoveryCount += 1;
			}

			if (status === "failed") {
				failedPosts.push({
					postId: String(postRecord.postId || ""),
					status,
					stage,
					attemptCount,
					errorMessage,
					timingsJson: String(postRecord.timingsJson || "{}"),
					statsJson: String(postRecord.statsJson || "{}"),
				});
			}

			const slowestStage = getSlowestStage(timings);
			return {
				postId: String(postRecord.postId || ""),
				status,
				stage,
				totalMs: timings.total_ms || 0,
				slowestStage: slowestStage.stage,
				slowestStageMs: slowestStage.ms,
			};
		})
		.sort((left, right) => right.totalMs - left.totalMs)
		.slice(0, 5);

	const expectedPostCount = Math.max(sessionExpectedPostCount, uploadedDerivedCount);
	const uploadedPostCount = Math.max(sessionUploadedPostCount, uploadedDerivedCount);
	const processedPostCount = Math.max(sessionProcessedPostCount, processedDerivedCount);
	const succeededPostCount = Math.max(sessionSucceededPostCount, succeededDerivedCount);
	const failedPostCount = Math.max(sessionFailedPostCount, failedDerivedCount);
	const skippedPostCount = Math.max(sessionSkippedPostCount, skippedDerivedCount);
	const derivedRunning =
		(sessionStatus === "finalized" || sessionStatus === "running") &&
		expectedPostCount > 0 &&
		(processedPostCount < expectedPostCount || pendingRecoveryCount > 0);
	const responseStatus = derivedRunning ? "running" : sessionStatus;

	return jsonResponse({
		ok: true,
		session: {
			id: String(sessionRecord.id || sessionId),
			status: responseStatus,
			workflowId: `blog-sync-session-${String(sessionRecord.id || sessionId)}`,
			expectedPostCount,
			uploadedPostCount,
			processedPostCount,
			succeededPostCount,
			failedPostCount,
			skippedPostCount,
			forceRebuild: Boolean(sessionRecord.force_rebuild),
			pruneMissing: sessionRecord.prune_missing !== 0,
			errorMessage: sessionRecord.error_message == null ? null : String(sessionRecord.error_message),
			metrics: {
				timings: aggregateTimings,
				stats: aggregateStats,
			},
			slowestPosts,
		},
		failedPosts,
	}, 200, noStoreHeaders);
};
