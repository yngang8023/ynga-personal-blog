export const onRequest: PagesFunction = async () => {
  return new Response(
    JSON.stringify({
      error:
        "PDF upload is disabled. This service is configured as a Mizuki blog RAG assistant; use /api/sync-posts to sync raw post bundles into R2, D1, and Vectorize.",
    }),
    {
      status: 410,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    }
  );
};
