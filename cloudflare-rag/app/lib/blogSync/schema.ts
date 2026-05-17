import { z } from "zod";

import { blogPostBundleInputSchema } from "../blogRag";
import {
  BlogPostRevisionStatuses,
  BlogSyncSessionPostStatuses,
  BlogSyncSessionStatuses,
  VectorSyncStatuses,
} from "./types";

export const createSessionPayloadSchema = z.object({
  siteURL: z.string().trim().url().optional(),
  client: z.string().trim().min(1).optional(),
});

export const uploadSessionPostPayloadSchema = z.object({
  post: blogPostBundleInputSchema,
});

export const finalizeSessionPayloadSchema = z.object({
  activePostIds: z.array(z.string().trim().min(1)).min(1),
  forceRebuild: z.boolean().optional().default(false),
  pruneMissing: z.boolean().optional().default(true),
});

export const syncSessionStatusResponseSchema = z.object({
  ok: z.literal(true),
  session: z.object({
    id: z.string().trim().min(1),
    status: z.enum(BlogSyncSessionStatuses),
    workflowId: z.string().trim().min(1).nullable().optional().default(null),
    expectedPostCount: z.number().int().nonnegative().optional().default(0),
    uploadedPostCount: z.number().int().nonnegative().optional().default(0),
    processedPostCount: z.number().int().nonnegative().optional().default(0),
    succeededPostCount: z.number().int().nonnegative().optional().default(0),
    failedPostCount: z.number().int().nonnegative().optional().default(0),
    skippedPostCount: z.number().int().nonnegative().optional().default(0),
    forceRebuild: z.boolean().optional().default(false),
    pruneMissing: z.boolean().optional().default(true),
    errorMessage: z.string().nullable().optional().default(null),
    metrics: z
      .object({
        timings: z.record(z.string(), z.number()).optional().default({}),
        stats: z.record(z.string(), z.number()).optional().default({}),
      })
      .optional()
      .default({ timings: {}, stats: {} }),
    slowestPosts: z
      .array(
        z.object({
          postId: z.string().trim().min(1),
          status: z.string().trim().min(1),
          stage: z.string().nullable().optional().default(null),
          totalMs: z.number().nonnegative().optional().default(0),
          slowestStage: z.string().nullable().optional().default(null),
          slowestStageMs: z.number().nonnegative().optional().default(0),
        }),
      )
      .optional()
      .default([]),
  }),
  failedPosts: z
    .array(
      z.object({
        postId: z.string().trim().min(1),
        status: z.enum(BlogSyncSessionPostStatuses),
        stage: z.string().nullable().optional().default(null),
        attemptCount: z.number().int().nonnegative().optional().default(0),
        errorMessage: z.string().nullable().optional().default(null),
        timingsJson: z.string().optional().default("{}"),
        statsJson: z.string().optional().default("{}"),
      }),
    )
    .optional()
    .default([]),
});

export const queueSessionPostMessageSchema = z.object({
  sessionId: z.string().trim().min(1),
  postId: z.string().trim().min(1),
  revisionId: z.string().trim().min(1).optional(),
  forceRebuild: z.boolean().optional().default(false),
});

export const blogPostRevisionStatusSchema = z.enum(BlogPostRevisionStatuses);
export const vectorSyncStatusSchema = z.enum(VectorSyncStatuses);
