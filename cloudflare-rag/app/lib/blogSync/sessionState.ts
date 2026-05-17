import {
  type BlogSyncSessionStatus,
  BlogSyncSessionStatuses,
} from "./types";

const terminalStatuses = new Set<BlogSyncSessionStatus>([
  "completed",
  "completed_with_warnings",
  "failed",
  "cancelled",
]);

const uploadableStatuses = new Set<BlogSyncSessionStatus>(["created", "uploading"]);

export function isTerminalSessionStatus(status: BlogSyncSessionStatus): boolean {
  return terminalStatuses.has(status);
}

export function canUploadToSession(status: BlogSyncSessionStatus): boolean {
  return uploadableStatuses.has(status);
}

export function assertSessionStatus(status: string): asserts status is BlogSyncSessionStatus {
  if (!BlogSyncSessionStatuses.includes(status as BlogSyncSessionStatus)) {
    throw new Error(`Unsupported blog sync session status: ${status}`);
  }
}
