import { processSessionPostMessage } from "./queue";
import { getInternalSessionStatus } from "./sessionStatus";
import { startSessionOrchestration } from "./sessionOrchestrator";
import { BlogSyncWorkflow } from "./workflow";
import type { IngestionEnv } from "./env";

export { BlogSyncWorkflow };

function logIngestionEvent(event: string, fields: Record<string, unknown> = {}) {
  console.info(JSON.stringify({
    scope: "blog-sync-ingestion",
    event,
    ...fields,
  }));
}

const worker = {
  async fetch(request: Request, env: IngestionEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/start-session") {
      const payload = (await request.json().catch(() => ({}))) as { sessionId?: string };
      logIngestionEvent("start_session_request", {
        sessionId: payload.sessionId || "",
      });
      const result = await startSessionOrchestration(env, payload.sessionId || "");
      logIngestionEvent("start_session_result", result);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/session-status") {
      const sessionId = url.searchParams.get("sessionId")?.trim() || "";
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "Missing sessionId." }), {
          status: 400,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        });
      }

      const result = await getInternalSessionStatus(env, sessionId);
      logIngestionEvent("session_status_result", {
        sessionId,
        workflowId: result.workflowId,
        sessionStatus: result.sessionStatus,
        workflowStatus: result.workflowStatus,
        effectiveStatus: result.effectiveStatus,
        processedPostCount: result.summary.processedPostCount,
        expectedPostCount: result.summary.expectedPostCount,
        failedPostCount: result.summary.failedPostCount,
      });
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Not found." }), {
      status: 404,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  },
  async queue(batch: MessageBatch<unknown>, env: IngestionEnv): Promise<void> {
    for (const message of batch.messages) {
      const result = await processSessionPostMessage(message.body, env);
      if (result === "retry") {
        message.retry({ delaySeconds: 5 });
        continue;
      }
      message.ack();
    }
  },
};

export default worker;
