export const BlogSyncSessionStatuses = [
  "created",
  "uploading",
  "finalized",
  "running",
  "pruning",
  "completed",
  "completed_with_warnings",
  "failed",
  "cancelled",
] as const;

export type BlogSyncSessionStatus = (typeof BlogSyncSessionStatuses)[number];

export const BlogSyncSessionPostStatuses = [
  "uploaded",
  "queued",
  "skipped",
  "processing",
  "completed",
  "failed",
] as const;

export type BlogSyncSessionPostStatus = (typeof BlogSyncSessionPostStatuses)[number];

export const BlogPostRevisionStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export type BlogPostRevisionStatus = (typeof BlogPostRevisionStatuses)[number];

export const VectorSyncStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;

export type VectorSyncStatus = (typeof VectorSyncStatuses)[number];
