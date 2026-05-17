const cacheControlHeader = "public, max-age=31536000, immutable";

function extractObjectKey(request: Request): string | null {
  const pathname = new URL(request.url).pathname.replace(/^\/api\/assets\/+/, "");
  if (!pathname) {
    return null;
  }

  try {
    const key = pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join("/");

    if (
      !key ||
      (!key.startsWith("posts/") && !key.startsWith("assets/posts/by-hash/")) ||
      key.split("/").some((segment) => segment === "." || segment === "..")
    ) {
      return null;
    }

    return key;
  } catch {
    return null;
  }
}

export const onRequest: PagesFunction<Env> = async (ctx) => {
  if (ctx.request.method !== "GET" && ctx.request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
      },
    });
  }

  const objectKey = extractObjectKey(ctx.request);
  if (!objectKey) {
    return new Response("Invalid asset path.", { status: 400 });
  }

  const object = await ctx.env.POST_ASSETS.get(objectKey);
  if (!object) {
    return new Response("Asset not found.", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", cacheControlHeader);
  headers.set("ETag", object.httpEtag);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");

  return new Response(ctx.request.method === "HEAD" ? null : object.body, {
    headers,
  });
};
