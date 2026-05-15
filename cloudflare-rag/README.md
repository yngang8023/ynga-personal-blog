# HiYnga Blog Cloudflare RAG

This is the Cloudflare-side RAG service for the Mizuki personal blog.

The Astro blog stays on EdgeOne Pages. This project is deployed independently to Cloudflare Pages/Workers and provides:

- `/embed` iframe chat UI for the blog floating AI assistant.
- `/api/stream` Server-Sent Events chat endpoint.
- `/api/sync-posts` protected incremental blog post sync endpoint.
- `/api/assets/posts/...` public asset proxy for raw article images stored in R2.
- R2 raw post bundle archive for `content/posts/**` markdown and images.
- Cloudflare-side Markdown parsing, image OCR/description, D1 full-text search, and Vectorize semantic search.
- Tutorial-oriented retrieval enhancements: semantic routing, conversational query rewriting, rerank confidence gating, metadata-aware retrieval, and parent-child chunking.
- KV based per-IP rate limiting for `/api/stream`.
- Workers AI chat and multilingual embeddings.

## Cloudflare Resources

Install dependencies:

```sh
npm install
```

Use the project-local Wrangler for this repository:

```sh
pnpm exec wrangler ...
```

Do not prefer a globally installed Wrangler here. In this repo, the local pinned Wrangler version is more reliable for remote D1 operations.

Create Cloudflare primitives manually:

```sh
pnpm exec wrangler vectorize create cloudflare-rag-index --dimensions=1024 --metric=cosine
pnpm exec wrangler vectorize create-metadata-index cloudflare-rag-index --property-name=corpusId --type=string
pnpm exec wrangler vectorize create-metadata-index cloudflare-rag-index --property-name=postId --type=string
pnpm exec wrangler d1 create cloudflare-rag
pnpm exec wrangler kv namespace create rate-limiter
pnpm exec wrangler r2 bucket create cloudflare-rag-post-assets
```

Then update `wrangler.toml`:

- `d1_databases.database_id`
- `kv_namespaces.id`
- `r2_buckets.bucket_name` if you use a different bucket name

Current production resources:

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudflare-rag"
database_id = "95e371b9-de4e-4a7e-a38d-2805d7152122"

[[kv_namespaces]]
binding = "rate_limiter"
id = "356e2c01849247b6a80458ab0e8f705f"

[[r2_buckets]]
binding = "POST_ASSETS"
bucket_name = "cloudflare-rag-post-assets"
```

The Vectorize index is expected to be:

- name: `cloudflare-rag-index`
- dimensions: `1024`
- metric: `cosine`
- metadata indexes: `corpusId`, `postId`

Runtime model and corpus settings are configured in `wrangler.toml`:

```toml
[vars]
BLOG_CORPUS_ID = "mizuki-blog"
EMBEDDING_MODEL = "@cf/baai/bge-m3"
CHAT_MODEL = "@cf/qwen/qwen3-30b-a3b-fp8"
RERANK_MODEL = "@cf/baai/bge-reranker-base"
```

Notes:

- `@cf/baai/bge-m3` stays aligned with the current `1024`-dimension Vectorize index.
- `@cf/baai/bge-reranker-base` is used after hybrid recall to re-order candidate blog chunks before generation.
- `CHAT_MODEL` can be swapped without rebuilding the vector index.
- If you change `EMBEDDING_MODEL` to another `1024`-dimension embedding model, re-run post sync so all vectors are regenerated.
- After the blog intelligence upgrade, run a forced full sync once so new metadata, section records, parent text, and code/image flags are rebuilt.

## Environment

Create `.dev.vars` for local development:

```sh
RAG_SYNC_TOKEN=replace-with-a-long-random-secret
RAG_EMBED_SHARED_SECRET=replace-with-a-long-random-secret
```

Set production secrets:

```sh
pnpm exec wrangler pages secret put RAG_SYNC_TOKEN --project-name cloudflare-rag
pnpm exec wrangler pages secret put RAG_EMBED_SHARED_SECRET --project-name cloudflare-rag
```

Generate a long random token in PowerShell before you set it:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

## D1 Migration

Apply migrations locally:

```sh
pnpm exec wrangler d1 migrations apply cloudflare-rag --local
```

Apply migrations remotely:

```sh
pnpm exec wrangler d1 migrations apply cloudflare-rag --remote
```

If the remote migration fails with an authentication error while `wrangler whoami` still shows correct `d1 (write)` permissions, use the project-local Wrangler exactly as above and avoid the global `wrangler 4.x` binary for this repository.

## Deploy

Create the Pages project once:

```sh
pnpm exec wrangler pages project create cloudflare-rag --production-branch main
```

Build and deploy:

```sh
npm run build
pnpm exec wrangler pages deploy ./build/client --project-name cloudflare-rag
```

If the working tree is dirty and Wrangler asks for confirmation, use:

```sh
pnpm exec wrangler pages deploy ./build/client --project-name cloudflare-rag --commit-dirty=true
```

Production embed URL:

```txt
https://rag.ynga.kingcola-icg.cn/embed
```

Pages preview deployments still use commit-specific `pages.dev` URLs such as:

```txt
https://56395e26.cloudflare-rag-1mw.pages.dev/embed
```

## Sync Blog Post Bundles

`POST /api/sync-posts` accepts either an array or `{ "siteURL": "...", "posts": [...] }`.

Each post is a raw source bundle generated from one `src/content/posts/<slug>/` directory:

```json
{
  "id": "edgeone-pages-deploy/index.md",
  "slug": "edgeone-pages-deploy",
  "entryPath": "index.md",
  "url": "https://ynga.kingcola-icg.cn/posts/edgeone-pages-deploy/",
  "metadata": {
    "title": "EdgeOne Pages 部署博客"
  },
  "files": [
    {
      "path": "index.md",
      "contentType": "text/markdown; charset=utf-8",
      "encoding": "utf8",
      "content": "---\\ntitle: ...\\n---\\n\\nMarkdown source",
      "hash": "sha256",
      "size": 1234
    },
    {
      "path": "images/1.png",
      "contentType": "image/png",
      "encoding": "base64",
      "content": "iVBORw0KGgo...",
      "hash": "sha256",
      "size": 45678
    }
  ],
  "contentHash": "optional-sha256"
}
```

Authorization:

```txt
Authorization: Bearer <RAG_SYNC_TOKEN>
```

Sync is incremental:

- unchanged `contentHash` posts are skipped
- changed posts have their old R2 files, D1 rows, and Vectorize vectors replaced
- removed posts are deleted from R2, D1, and Vectorize

Cloudflare RAG owns parsing and indexing:

- stores raw markdown and images in R2 under `posts/<slug>/...`
- exposes uploaded article assets through `https://<your-rag-domain>/api/assets/posts/<slug>/<file>`
- parses frontmatter and Markdown on Cloudflare
- resolves local relative image paths such as `./images/1.png`
- supports images anywhere inside the article directory, not only `images/`
- runs Workers AI `toMarkdown()` for image OCR/description when available
- chunks by Markdown sections and keeps `heading`, `anchor`, and `imageRefs`
- writes article/chunk/image metadata to D1 and embeddings to Vectorize
- returns Cloudflare asset URLs in chat sources so the embed UI does not depend on the blog build output file names

Draft, encrypted, and password-protected posts should be filtered by the blog-side sync script before calling this endpoint.
