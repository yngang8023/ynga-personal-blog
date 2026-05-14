#! /bin/bash
set -e

cp .env.template .dev.vars

# bge-m3 returns 1024-dimensional embeddings.
npx wrangler vectorize create cloudflare-rag-index --dimensions=1024 --metric=cosine
npx wrangler vectorize create-metadata-index cloudflare-rag-index --property-name=corpusId --type=string
npx wrangler vectorize create-metadata-index cloudflare-rag-index --property-name=postId --type=string

# After running this, you'll need to replace the database_id in wrangler.toml
npx wrangler d1 create cloudflare-rag

# After running this, you'll need to replace the id in wrangler.toml
npx wrangler kv namespace create rate-limiter

# Stores raw Mizuki post bundles: markdown plus local images.
npx wrangler r2 bucket create cloudflare-rag-post-assets
