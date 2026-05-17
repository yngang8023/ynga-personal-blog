const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

export const onRequest: PagesFunction<Env> = async () =>
  jsonResponse(
    {
      error: "The /api/sync-posts endpoint has been deprecated. Use /api/sync-sessions instead.",
      migration: "/api/sync-sessions",
    },
    410,
  );
