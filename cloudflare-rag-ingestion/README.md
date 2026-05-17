# Cloudflare RAG Ingestion Worker

`cloudflare-rag-ingestion` 是博客知识库同步链路里的独立 ingestion worker。

它不直接对外提供聊天或检索接口，主要负责把 `cloudflare-rag` Pages 项目里创建好的同步会话，异步推进到真正完成入库：

- 从 `BLOG_SYNC_STAGING` 读取文章 bundle
- 上传/复用文章文件到 `POST_ASSETS`
- 图片 OCR
- D1 写入 revision / section / chunk / image 记录
- 生成 embedding
- Vectorize upsert
- 旧 revision / 旧向量 / 旧遗留 R2 对象清理
- 会话级状态汇总、重试、收敛和 finalize

## 架构边界

这个 worker 和 `cloudflare-rag` 的职责是分开的：

- `cloudflare-rag`
  - 对外提供 `/embed`、`/api/stream`
  - 提供同步会话 API：`/api/sync-sessions`
  - 负责接收博客端上传的 bundle，并写入 `BLOG_SYNC_STAGING`
  - 在 `finalize` 时通过 service binding 调用本 worker

- `cloudflare-rag-ingestion`
  - 提供内部入口 `POST /start-session`
  - 创建 workflow 实例
  - 通过 Queue 消费每篇文章
  - 做真正的 Cloudflare 侧入库和清理

## 运行链路

完整同步流程如下：

1. 博客端脚本调用 `POST /api/sync-sessions`
2. 博客端逐篇调用 `POST /api/sync-sessions/:sessionId/posts/:postId`
3. `cloudflare-rag` 把 bundle JSON 暂存到 `BLOG_SYNC_STAGING`
4. 博客端调用 `POST /api/sync-sessions/:sessionId/finalize`
5. `cloudflare-rag` 通过 `BLOG_SYNC_INGESTION` service binding 调用本 worker 的 `/start-session`
6. 本 worker 创建 `blog-sync-workflow`
7. workflow 把 session 里的文章分发到 `BLOG_SYNC_QUEUE`
8. queue consumer 逐篇处理文章
9. workflow 周期性 reconcile，会恢复 stale `processing / uploaded / queued / retry_pending`
10. 全部文章完成后，workflow 做 prune、cleanup、session 完结

## Cloudflare 资源

当前项目绑定了这些 Cloudflare 资源：

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudflare-rag"

[[r2_buckets]]
binding = "POST_ASSETS"
bucket_name = "cloudflare-rag-post-assets"

[[r2_buckets]]
binding = "BLOG_SYNC_STAGING"
bucket_name = "cloudflare-rag-sync-staging"

[[vectorize]]
binding = "VECTORIZE_INDEX"
index_name = "cloudflare-rag-index"

[ai]
binding = "AI"

[[queues.producers]]
binding = "BLOG_SYNC_QUEUE"
queue = "cloudflare-rag-sync-queue"

[[queues.consumers]]
queue = "cloudflare-rag-sync-queue"

[[workflows]]
name = "blog-sync-workflow"
binding = "BLOG_SYNC_WORKFLOW"
class_name = "BlogSyncWorkflow"
```

## R2 职责分工

### `BLOG_SYNC_STAGING`

对应 bucket：

```toml
bucket_name = "cloudflare-rag-sync-staging"
```

职责：

- 临时存放会话上传的文章 bundle JSON
- key 形如：`sync-staging/<sessionId>/<postId>.json`
- queue consumer 处理完成后会删除
- 这里不是长期知识库资产库

### `POST_ASSETS`

对应 bucket：

```toml
bucket_name = "cloudflare-rag-post-assets"
```

职责：

- 长期存放文章文件资产
- 现在主路径是内容寻址模式：

```txt
assets/posts/by-hash/<contentHash>
```

- 同内容文件会复用同一个 R2 对象
- `posts/<slug>/...` 属于旧路径遗留，会逐步迁移和清理

## `assets/posts/by-hash/` 会不会影响 AI 准确性

不会。

知识库检索和回答依赖的是：

- D1 里的 post / revision / section / chunk / image 元数据
- Vectorize 里的 chunk embedding
- `blog_post_images.url` 指向的 `/api/assets/...` 代理地址

R2 里对象究竟挂在：

- `posts/<slug>/...`
- 或 `assets/posts/by-hash/<contentHash>`

这只是存储 key 策略，不影响正文切片、图片 OCR、向量召回或回答结果。

只要数据库里当前 revision 指向的是正确的 `r2Key`，AI 问答仍然会准确引用对应内容和图片。

## 旧 R2 遗留对象清理策略

当前已经做了两层清理：

1. 新同步优先迁到 `assets/posts/by-hash/`
   - 如果数据库里命中的历史资产 `r2Key` 仍是 `posts/<slug>/...`
   - 本次重建不会继续强行沿用旧 key
   - 会重新落到 `assets/posts/by-hash/<contentHash>`

2. 安全清理 legacy `posts/<slug>/...`
   - 在旧 revision 清理和 `pending_delete` 清理后
   - worker 会扫描对应的 legacy prefix
   - 只删除已经没有数据库引用的旧对象
   - 不会粗暴删除仍被当前 revision 使用的对象

这意味着：

- 老目录不会一次性全没
- 但随着文章重建和 revision 切换，旧对象会逐步收干净

## 全量重建与增量重建

### 增量重建

默认行为。

- 如果 `contentHash` 没变，且当前 revision 健康，会直接跳过
- 如果文章内容变化，会创建新 revision，成功后再切换当前 revision

### 全量重建

当博客端传入：

```txt
BLOG_RAG_FORCE_REBUILD=true
```

时：

- 已入库文章也会全部重新处理
- 不是“先删旧数据再建新数据”
- 而是“先建新 revision，成功后切换，再清旧 revision”

这保证了重建过程中不会因为中途失败把线上可用数据先删掉。

## 稳定性设计

当前 ingestion worker 主要稳定性机制：

- session + workflow + queue 解耦，避免长请求超时
- per-post attempt count 和 retry
- stale `processing` 自动恢复
- stale `uploaded / queued / retry_pending` 自动恢复
- session 轮询窗口可配置
- 分阶段指标：
  - `asset_upload_ms`
  - `ocr_ms`
  - `chunk_build_ms`
  - `db_write_ms`
  - `embedding_ms`
  - `vectorize_ms`
  - `finalize_ms`
- session 级汇总和最慢文章统计
- 旧向量删除按 `100` 分批，避免 Cloudflare Vectorize `deleteByIds()` payload 上限报错

## 会话观测与排障

现在同步会话已经支持按 `session` 级别聚合统计，便于直接定位瓶颈。

### `GET /api/sync-sessions/:sessionId`

这个接口会返回：

- 会话总进度
- 各阶段累计耗时
- 最慢文章列表
- 单篇文章当前状态和失败原因

排障时优先看这三个地方：

1. `blog_sync_session_posts` 里单篇文章的 `stage` / `error_message`
2. `GET /api/sync-sessions/:sessionId` 的聚合统计
3. GitHub Actions 里的终态总结块

### GitHub Actions 日志

博客端 `scripts/sync-blog-rag.mjs` 现在会：

- 轮询时只打印状态变化或心跳
- 避免同一行日志刷屏
- 在会话结束时输出一次完整总结

这样 CI 里能直接看到：

- 本次慢在 `OCR`、`embedding` 还是 `vectorize`
- 哪几篇文章最慢
- 是否存在失败或卡住的文章

## 本地开发

安装依赖：

```sh
pnpm install
```

类型检查：

```sh
pnpm typecheck
```

本地开发：

```sh
pnpm dev
```

## 部署

首次部署前，先确保 Queue 已创建：

```sh
pnpm exec wrangler queues create cloudflare-rag-sync-queue
```

部署 ingestion worker：

```sh
pnpm exec wrangler deploy
```

如果 `cloudflare-rag` 还没绑定这个 service，也要确认它的 `wrangler.toml` 里存在：

```toml
[[services]]
binding = "BLOG_SYNC_INGESTION"
service = "cloudflare-rag-ingestion"
```

## 部署顺序

推荐顺序：

1. 部署 `cloudflare-rag-ingestion`
2. 部署 `cloudflare-rag`
3. 再触发博客端 `pnpm sync-rag`

如果这次改动只发生在 ingestion 逻辑里，通常只重新部署 `cloudflare-rag-ingestion` 就够了。

## 配置项

当前支持的关键运行参数：

```toml
[vars]
BLOG_SYNC_WORKFLOW_POLL_INTERVAL_MS = "5000"
BLOG_SYNC_WORKFLOW_TIMEOUT_MS = "900000"
```

另外还支持环境变量：

- `BLOG_SYNC_POST_MAX_ATTEMPTS`
- `BLOG_SYNC_PROCESSING_LEASE_MS`

默认目标是：

- 避免 queue / workflow 过早判超时
- 给 OCR / embedding / vectorize 足够收敛窗口

## 常见问题

### `VECTOR_DELETE_ERROR (code = 40007): too many ids in payload`

原因：

- Vectorize 单次 `deleteByIds()` 最多允许 `100` 个 id

当前项目已修复：

- 旧向量清理统一按 `100` 分批删除

如果仍出现，通常说明线上跑的还是旧版本 ingestion worker，重新 `wrangler deploy` 即可。

### GitHub Actions 一直刷同一条 session 日志

当前脚本已经改成：

- 只有状态或统计变化时才打印
- 终态再输出一次完整总结

如果仍看到老行为，说明博客侧仓库还没部署到包含新脚本的版本。

### Workflow UI 在推进，但状态接口看起来没动

当前状态接口已经做了：

- `Cache-Control: private, no-store`
- D1 `withSession("first-primary")` 主库锚定读取

如果还看到明显旧状态，优先确认 `cloudflare-rag` Pages 项目是否已部署到最新版本。
