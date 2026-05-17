export interface IngestionEnv {
  DB: D1Database;
  POST_ASSETS: R2Bucket;
  BLOG_SYNC_STAGING: R2Bucket;
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Ai;
  BLOG_SYNC_QUEUE: Queue;
  BLOG_SYNC_WORKFLOW: Workflow;
  BLOG_SYNC_POST_MAX_ATTEMPTS?: string;
  BLOG_SYNC_PROCESSING_LEASE_MS?: string;
}
