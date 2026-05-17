import { processSessionPostMessage } from "./queue";
import { startSessionOrchestration } from "./sessionOrchestrator";
import { BlogSyncWorkflow } from "./workflow";
import type { IngestionEnv } from "./env";

export { BlogSyncWorkflow };

const worker = {
  async fetch(request: Request, env: IngestionEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/start-session") {
      const payload = (await request.json().catch(() => ({}))) as { sessionId?: string };
      const result = await startSessionOrchestration(env, payload.sessionId || "");
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
