import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { blogSyncSessions } from "../../cloudflare-rag/schema";
import { collectSessionPostSummary } from "./cleanup";
import type { IngestionEnv } from "./env";

const terminalSessionStatuses = new Set([
  "completed",
  "completed_with_warnings",
  "failed",
  "cancelled",
]);

const completedWorkflowStatuses = new Set([
  "complete",
  "completed",
  "success",
  "succeeded",
]);

const failedWorkflowStatuses = new Set([
  "error",
  "errored",
  "failed",
  "terminated",
  "cancelled",
  "canceled",
]);

export type InternalWorkflowStatus = "running" | "completed" | "failed" | "unknown";

function normalizeWorkflowStatus(value: unknown): InternalWorkflowStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }
  if (completedWorkflowStatuses.has(normalized)) {
    return "completed";
  }
  if (failedWorkflowStatuses.has(normalized)) {
    return "failed";
  }
  return "running";
}

function getTerminalWorkflowStatusLabel(status: string | null | undefined): string | null {
  switch (String(status || "").trim().toLowerCase()) {
    case "completed":
    case "completed_with_warnings":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return null;
  }
}

function alignTerminalWorkflowStatus({
  workflowStatus,
  normalizedWorkflowStatus,
  sessionStatus,
  effectiveStatus,
}: {
  workflowStatus: string | null;
  normalizedWorkflowStatus: InternalWorkflowStatus;
  sessionStatus: string;
  effectiveStatus: string;
}): string | null {
  const terminalStatus =
    getTerminalWorkflowStatusLabel(effectiveStatus) ||
    getTerminalWorkflowStatusLabel(sessionStatus);

  if (terminalStatus) {
    return terminalStatus;
  }

  if (normalizedWorkflowStatus === "completed") {
    return "completed";
  }

  if (normalizedWorkflowStatus === "failed") {
    return getTerminalWorkflowStatusLabel(workflowStatus) || "failed";
  }

  return workflowStatus;
}

async function readWorkflowStatus(
  env: IngestionEnv,
  workflowId: string,
): Promise<{ rawStatus: string | null; normalizedStatus: InternalWorkflowStatus }> {
  try {
    const instance = await env.BLOG_SYNC_WORKFLOW.get(workflowId);
    const statusResult = await instance.status();
    const rawStatus =
      typeof statusResult === "string"
        ? statusResult
        : statusResult && typeof statusResult === "object" && "status" in statusResult
          ? String(statusResult.status || "")
          : "";

    return {
      rawStatus: rawStatus || null,
      normalizedStatus: normalizeWorkflowStatus(rawStatus),
    };
  } catch {
    return {
      rawStatus: null,
      normalizedStatus: "unknown",
    };
  }
}

function deriveEffectiveSessionStatus(
  sessionStatus: string,
  workflowStatus: InternalWorkflowStatus,
  summary: Awaited<ReturnType<typeof collectSessionPostSummary>>,
): string {
  if (terminalSessionStatuses.has(sessionStatus)) {
    return sessionStatus;
  }

  if (workflowStatus === "failed") {
    return "failed";
  }

  if (workflowStatus === "completed" && summary.allProcessed && summary.pendingRecoveryCount === 0) {
    return summary.hasFailures ? "failed" : "completed";
  }

  if (summary.hasFailures && summary.allProcessed && summary.pendingRecoveryCount === 0) {
    return "failed";
  }

  return sessionStatus || "created";
}

export async function getInternalSessionStatus(env: IngestionEnv, sessionId: string) {
  const db = drizzle(env.DB);
  const session =
    (await db.select().from(blogSyncSessions).where(eq(blogSyncSessions.id, sessionId)).limit(1))[0] || null;
  const summary = await collectSessionPostSummary(env, sessionId);
  const workflowId = `blog-sync-session-${sessionId}`;
  const workflow = await readWorkflowStatus(env, workflowId);
  const sessionStatus = session?.status || "created";
  const effectiveStatus = deriveEffectiveSessionStatus(sessionStatus, workflow.normalizedStatus, summary);
  const alignedWorkflowStatus = alignTerminalWorkflowStatus({
    workflowStatus: workflow.rawStatus,
    normalizedWorkflowStatus: workflow.normalizedStatus,
    sessionStatus,
    effectiveStatus,
  });

  if (
    session &&
    effectiveStatus !== sessionStatus &&
    (workflow.normalizedStatus === "completed" || workflow.normalizedStatus === "failed")
  ) {
    const now = new Date().toISOString();
    await db
      .update(blogSyncSessions)
      .set({
        status: effectiveStatus,
        expectedPostCount: summary.expectedPostCount,
        uploadedPostCount: summary.uploadedPostCount,
        processedPostCount: summary.processedPostCount,
        succeededPostCount: summary.succeededPostCount,
        failedPostCount: summary.failedPostCount,
        skippedPostCount: summary.skippedPostCount,
        updatedAt: now,
        completedAt: terminalSessionStatuses.has(effectiveStatus) ? session.completedAt || now : session.completedAt,
      })
      .where(eq(blogSyncSessions.id, sessionId));
  }

  return {
    sessionId,
    workflowId,
    sessionStatus,
    workflowStatus: alignedWorkflowStatus,
    workflowObservedStatus: workflow.rawStatus,
    normalizedWorkflowStatus: normalizeWorkflowStatus(alignedWorkflowStatus || workflow.rawStatus),
    effectiveStatus,
    summary,
  };
}
