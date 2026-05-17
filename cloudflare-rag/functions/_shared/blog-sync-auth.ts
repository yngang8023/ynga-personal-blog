import { getBearerToken } from "~/lib/blogRag";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      ...(extraHeaders || {}),
    },
  });
}

export function requireSyncAuth(request: Request, token: string | undefined): Response | null {
  const bearerToken = getBearerToken(request.headers.get("authorization"));
  if (!token || bearerToken !== token) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  return null;
}
