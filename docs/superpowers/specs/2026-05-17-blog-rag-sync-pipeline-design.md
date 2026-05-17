# Blog RAG Sync Pipeline Design

## 背景

当前博客文章同步链路把整篇文章 bundle 直接通过 `/api/sync-posts` 发给 Cloudflare Pages Function，
再在一次 HTTP 请求内串行完成：

- R2 上传
- 图片 OCR
- D1 写入
- 向量生成
- Vectorize upsert

这条链路已经暴露出几个结构性问题：

- 请求路径过重，容易触发 `524`、连接中断和不可恢复的半成品状态
- 文章更新时采用“先删后建”，失败会造成旧索引消失、新索引未完成
- 跳过同步逻辑只看 `contentHash + hasChunks`，无法识别“D1 成功但向量不完整”的损坏状态
- 客户端和服务端都一次性缓冲全量 bundle，图片 base64 内联，内存和请求体放大明显
- section/chunk ID 依赖顺序号，文章前部插入内容会导致后续向量大面积失效
- 图片 OCR 没有内容缓存，目录内未引用图片也会进入 OCR 流程
- 全量重建和增量重建共用一套粗粒度 whole-post 逻辑，无法复用已稳定的派生结果

这次改造的目标不是继续给旧 HTTP 直连链路打补丁，而是把文章同步升级成可恢复、可观测、可增量、可全量重建、可长期演进的完整会话化异步架构。

## 目标

- 把重操作从 HTTP 请求中完全移出，避免同步入口直接执行 OCR、embedding、Vectorize upsert
- 让整次同步具备明确 session 状态，可轮询、可重试、可回放、可审计
- 更新文章时不再先删旧索引，而是通过 revision 构建新版本并在成功后原子切换
- 全量重建和增量重建共用同一条 pipeline，但能够复用资源上传、OCR、向量等稳定派生结果
- 让 `pruneMissing` 只在整次 session 成功收敛后执行，避免中途删库
- 引入稳定 chunk identity，减少文章局部修改导致的向量全量 churn
- 建立完整的阶段级状态、错误信息、耗时指标和资源缓存，为后续继续压性能提供依据

## 非目标

- 不改变博客文章的 Markdown/MDX 书写格式
- 不把 RAG 召回、重排、问答逻辑纳入本次改造范围
- 不一次性实现“跨文章级语义去重”这种高风险优化
- 不要求旧 `/api/sync-posts` 协议继续保留兼容；允许前后端一起升级

## 总体方案

### 1. 同步改成 Session 驱动

博客端的 `pnpm sync-rag` 不再把整批文章 bundle 直接提交给旧同步接口，而是改为：

1. `POST /api/sync-sessions`
   - 创建一次同步会话
   - 返回 `sessionId`
2. `POST /api/sync-sessions/:sessionId/posts/:postId`
   - 按文章上传 bundle
   - 服务端只做鉴权、schema 校验、写入 R2 staging、登记会话文章状态
3. `POST /api/sync-sessions/:sessionId/finalize`
   - 提交 `activePostIds`、`forceRebuild`、`pruneMissing`
   - 触发 Workflow 开始整次同步编排
4. `GET /api/sync-sessions/:sessionId`
   - 轮询状态、进度、失败文章和阶段统计

### 2. Workflow 负责“整次同步”

Workflow 负责：

- 校验 session 是否已 finalize
- 读取 session manifest 和已上传文章清单
- 对每篇文章做 skip 判定或投递 queue
- 等待 queue 处理结果全部收敛
- 全部成功后再执行 `pruneMissing`
- 标记 session 最终状态为 `completed / failed / completed_with_warnings`
- 触发旧 revision、旧 vector、旧 staging 资源的异步清理

当前实现补充约束：

- queue consumer 只负责写单篇 `blog_sync_session_posts` 终态，不直接累加 session 汇总计数
- workflow 每轮通过 D1 实时重算 `processed / succeeded / skipped / failed`，避免重复消费导致双计数
- post 失败时允许应用层重投，超过最大尝试次数后再进入 session 失败收敛
- cleanup 现在至少覆盖 staging bundle 删除、`pending_delete` 标记、旧 revision/vector 清理收口

Workflow 只编排，不承载单篇文章的重 CPU/重 I/O 逻辑。
由于当前 `cloudflare-rag` 部署形态是 Pages Functions，Workflow 本体需要部署在独立 Worker 中，
再由 Pages 同步 API 通过 service binding 或内部调用方式触发。

### 3. Queue Consumer 负责“单篇文章”

Queue consumer 负责单篇文章的完整处理：

- 读取 R2 staging bundle
- 解析 frontmatter、正文、图片引用、metadata
- 计算 revision 和细粒度 diff
- 去重上传文章资源到正式 R2 bucket
- 命中或生成图片 OCR
- 命中或生成 chunk embedding
- 批量写 D1 revision / sections / chunks / images
- 向 Vectorize upsert 新 revision 的有效 chunk
- 验证成功后切换 `current_revision_id`
- 把结果写回 `blog_sync_session_posts`

Queue 任务必须幂等。相同的 `sessionId + postId + revisionId` 重试时，不允许重复污染当前状态。

## Cloudflare 资源

本方案允许新增以下 Cloudflare 资源：

- `Queue`
  - 处理单篇文章同步任务
- `Workflow`
  - 编排整次 session 生命周期
- `Standalone Worker`
  - 承载 Workflow definition 和 Queue consumer
- `D1 migrations`
  - 新增 session / revision / cache / status / index 相关表
- `R2`
  - 新增 staging 前缀，用于暂存客户端上传 bundle
- `KV`
  - 仅保留轻量 session 锁、幂等 key 或轮询加速缓存，不作为最终事实来源

最终事实来源统一放在 D1，避免状态散落在多个系统里无法审计。

## 数据模型

### 1. 文章实体与 revision 分离

保留 `blog_posts` 作为稳定文章实体表，但它不再直接代表某次构建产物。

`blog_posts` 新职责：

- `id / slug / canonical url` 等稳定标识
- `current_revision_id`
- `last_completed_revision_id`
- `sync_status`
- `vector_status`
- `last_error`
- `last_session_id`

新增 `blog_post_revisions`：

- `id`
- `post_id`
- `session_id`
- `content_hash`
- `status`
- `vector_status`
- `source_prefix`
- `bundle_r2_key`
- `published / updated / title / description / tags / category / topic / series`
- `section_count / image_count / chunk_count`
- `has_images / has_code_blocks`
- `error_message`
- `created_at / updated_at / completed_at`

`blog_post_sections / blog_post_chunks / blog_post_images` 从“直接挂 `post_id`”改成“挂 `revision_id`”。

### 2. Session 模型

新增 `blog_sync_sessions`：

- `id`
- `status`：`created / uploading / finalized / running / pruning / completed / failed / cancelled`
- `site_url`
- `force_rebuild`
- `prune_missing`
- `active_post_ids_json`
- `expected_post_count`
- `uploaded_post_count`
- `processed_post_count`
- `succeeded_post_count`
- `failed_post_count`
- `skipped_post_count`
- `error_message`
- `created_at / updated_at / finalized_at / completed_at`

新增 `blog_sync_session_posts`：

- `id`
- `session_id`
- `post_id`
- `bundle_r2_key`
- `content_hash`
- `status`：`uploaded / queued / skipped / processing / completed / failed`
- `revision_id`
- `attempt_count`
- `stage`
- `error_message`
- `timings_json`
- `stats_json`
- `created_at / updated_at / completed_at`

### 3. 资源缓存

新增 `blog_image_assets`：

- `content_hash`
- `r2_key`
- `content_type`
- `byte_size`
- `first_seen_post_id`
- `created_at / updated_at`

新增 `blog_image_ocr_cache`：

- `content_hash`
- `ocr_text`
- `ocr_status`
- `model`
- `error_message`
- `created_at / updated_at`

可选新增 `blog_chunk_embeddings`：

- `chunk_hash`
- `embedding_model`
- `vector_values_json`
- `created_at / updated_at`

如果向量缓存落地成本过高，可以先跳过该表，但接口设计要预留，不要让 embedding 逻辑和 revision 写入逻辑耦死。

### 4. 索引

必须补齐二级索引：

- `blog_post_revisions(post_id, status, created_at)`
- `blog_post_sections(revision_id, section_key)`
- `blog_post_chunks(revision_id, chunk_key)`
- `blog_post_images(revision_id, content_hash)`
- `blog_sync_session_posts(session_id, status, post_id)`
- `blog_sync_sessions(status, created_at)`
- `blog_image_assets(content_hash)`
- `blog_image_ocr_cache(content_hash)`

如果仍然保留 `post_id` 在 section/chunk/image 表中，也必须同时建立 `post_id` 索引用于管理查询。

## 标识与内容寻址

### 1. 文章 revision

`revision_id` 应由以下稳定输入构成：

- `post_id`
- `content_hash`
- `normalization_version`

这样同一文章内容在不同 session 中可复用同一 revision 语义，但出于审计和幂等考虑，仍然保留 `session_id` 记录“是谁构建的”。

### 2. 资源 R2 key

正式资源不再仅按 `posts/<slug>/<path>` 写入。

推荐格式：

- `assets/posts/by-hash/<contentHash>`

这样：

- 同一图片在不同文章或不同 revision 中可复用
- 全量重建不会重复上传完全相同的图片
- 旧 revision 清理时不会误删共享资源

如果需要保留可读性路径，可在 metadata 中记录 `original_post_id / original_relative_path`。

### 3. section/chunk 稳定 key

section 和 chunk 不再使用 `sectionIndex` 或 `chunks.length` 参与主标识。

推荐：

- `section_key = sha256(post_id + heading/anchor + normalized_section_text)`
- `chunk_key = sha256(post_id + section_key + normalized_chunk_text)`

允许保留 `sectionIndex / chunkIndex` 作为展示和排序字段，但它们不能再决定 identity。

## 客户端协议与执行方式

### 1. 客户端上传模式

博客端脚本要改成懒加载、逐篇上传：

- 枚举文章时只先读取 metadata 和文件列表
- 不一次性把所有 bundle 放入内存
- 每次构造单篇 bundle 后立即上传
- 上传完成后释放该 bundle 内存

### 2. 并发

客户端支持可配置并发：

- `session create/finalize/status poll` 串行
- `post upload` 有界并发，默认 2 到 4

并发上传不是为了追求极限吞吐，而是为了控制：

- 本地内存
- Cloudflare 请求体压力
- 单次失败重试成本

### 3. 轮询

`pnpm sync-rag` 在 finalize 后轮询 session 状态：

- `completed` 返回成功
- `failed` 输出失败文章和阶段
- `completed_with_warnings` 输出 warning 但仍返回成功

轮询输出必须包含：

- 总文章数
- 已处理/成功/失败/跳过数
- 当前阶段
- 失败文章 ID

## 服务端 API 设计

### `POST /api/sync-sessions`

职责：

- Bearer token 鉴权
- 创建 session
- 记录 site URL、客户端版本、请求时间
- 返回 `sessionId`

不做：

- 文章处理
- prune
- OCR
- embedding

### `POST /api/sync-sessions/:sessionId/posts/:postId`

职责：

- 校验 session 状态允许上传
- 校验 bundle schema
- 将 bundle 原样写入 staging R2
- 记录 `blog_sync_session_posts`

不做：

- 解析 bundle
- R2 正式资源上传
- OCR / embedding / Vectorize

### `POST /api/sync-sessions/:sessionId/finalize`

职责：

- 校验所有 active post 是否已上传
- 写入 `activePostIds / forceRebuild / pruneMissing`
- 状态改为 `finalized`
- 启动 Workflow

### `GET /api/sync-sessions/:sessionId`

职责：

- 返回 session 状态、阶段计数、失败列表、统计摘要

### 旧 `/api/sync-posts`

迁移期内可以保留，但行为改成：

- 返回 `410 Gone` 或明确迁移错误
- 指向新协议

不要继续偷偷兼容旧实现，否则会维持两套同步语义，后续维护会失控。

## 单篇文章处理流程

Queue consumer 的推荐流程如下：

1. 从 `blog_sync_session_posts` 读取任务元数据
2. 校验任务是否已完成；已完成直接幂等返回
3. 从 staging R2 读取 bundle
4. 生成 `candidate_revision_id`
5. 查询当前文章状态
6. 做 skip 判定：
   - 仅当 `current_revision.status = completed`
   - 且 `vector_status = completed`
   - 且 `content_hash` 相同
   - 且 `forceRebuild = false`
   才允许整篇跳过
7. 解析 markdown sections、frontmatter、图片引用
8. 只对引用图片进行正式资源处理
9. 对每张图片：
   - 先查 `blog_image_assets`
   - 未命中再写正式 R2
   - 先查 `blog_image_ocr_cache`
   - 未命中再调用 OCR 并回写缓存
10. 生成 section/chunk
11. 对 chunk 做稳定 key 和 `chunk_hash`
12. 可选命中 embedding cache
13. 批量写 revision、sections、chunks、images
14. 批量向 Vectorize upsert
15. 验证本 revision 的 chunk/vector 计数完整
16. 在事务内更新：
   - `blog_posts.current_revision_id`
   - `blog_posts.last_completed_revision_id`
   - `blog_posts.sync_status`
   - `blog_posts.vector_status`
17. 更新 session post 状态为 `completed`

如果任一阶段失败：

- 不切换 `current_revision_id`
- 保留旧 revision 继续对外服务
- 更新 `blog_sync_session_posts.status = failed`
- 记录明确 `stage + error_message`
- 允许 queue 重试

## `pruneMissing` 行为

`pruneMissing` 必须只在 Workflow 收到“所有目标文章完成或跳过，且没有失败”后执行。

执行方式：

1. 取出本次 `activePostIds`
2. 找出 `blog_posts` 中不在 active list 的文章
3. 将这些文章标记为 `pending_delete`
4. 删除其 current revision 指针
5. 异步安排清理旧 revision / vectors / staging / shared asset 引用计数

如果任何文章失败，则整次 session 不执行 prune。

## 全量重建与增量重建

### 增量重建

默认模式下：

- content hash 相同且 current revision 完整健康的文章直接 skip
- 内容有改动的文章生成新 revision
- 图片、OCR、embedding 尽量走缓存

### 全量重建

`forceRebuild = true` 时：

- 不允许 whole-post skip
- 但允许命中：
  - 正式 R2 资源缓存
  - OCR 缓存
  - embedding 缓存

也就是说，全量重建是“重新验证并重建索引”，不是“重新做所有派生计算”。

## 可观测性

必须记录每篇文章和整次 session 的阶段指标：

- `bundle_download_ms`
- `bundle_decode_ms`
- `asset_upload_ms`
- `ocr_ms`
- `chunk_build_ms`
- `embedding_ms`
- `vectorize_ms`
- `db_write_ms`
- `finalize_ms`

同时记录计数：

- `file_count`
- `referenced_image_count`
- `ocr_image_count`
- `section_count`
- `chunk_count`
- `vector_count`
- `reused_asset_count`
- `reused_ocr_count`
- `reused_embedding_count`

错误日志必须至少包含：

- `session_id`
- `post_id`
- `revision_id`
- `stage`
- `attempt`
- `error_summary`

## 清理策略

清理不是主链路的一部分，统一后置：

- session 完成后清理 staging bundle
- old revision 在新 revision 稳定后异步清理
- vector 删除也走异步批处理
- 正式 R2 资源只有在引用计数为零时才允许删

不要在主链路里同步删旧 R2 前缀，否则会再次引入“删得快、建得慢”的中断窗口。

## 迁移计划

### 阶段 1：会话与异步骨架

- 新增 session API
- 新增 staging R2 写入
- 新增 Queue / Workflow 配置
- 新增 `blog_sync_sessions / blog_sync_session_posts`
- 客户端升级到 session 协议

阶段 1 完成后，即使单篇文章处理逻辑暂时仍复用旧 bundle 解析代码，也已经把重任务从 HTTP 请求中拿掉。

### 阶段 2：revision 化与原子切换

- 新增 `blog_post_revisions`
- `sections/chunks/images` 绑定 `revision_id`
- `blog_posts` 改成 current revision pointer
- 单篇文章改成“先建新 revision，成功后切换”
- `pruneMissing` 收口到 Workflow

阶段 2 完成后，正确性问题基本解决：不再先删后建，也不再误把残缺索引视为健康。

### 阶段 3：缓存、稳定 ID 与精细增量

- R2 资源内容寻址
- OCR cache
- 稳定 section/chunk key
- 细粒度统计
- 可选 embedding cache
- 异步清理

阶段 3 完成后，性能和重建成本会显著下降，尤其是文章局部修改和全量重建场景。

## 验证

### 功能验证

- 创建 session、逐篇上传、finalize、轮询成功
- 单篇文章失败后 session 标记失败，旧 revision 仍可查询
- 全部文章成功后才执行 prune
- `forceRebuild` 能重新构建 revision，但资源/OCR 缓存命中正常

### 回归验证

- 原有公开文章全量同步成功
- 修改单篇文章顶部内容后，不应导致无关图片重复 OCR
- 修改单篇文章后，旧 revision 在新 revision 完成前仍可查询
- 删除文章时，只有在 session 成功完成后才会从 current corpus 中消失

### 性能验证

- 相同数据二次同步应显著缩短
- 全量重建相较完全重算应显著减少 OCR 和资源上传次数
- 大文章同步不再依赖单次 HTTP 请求持续存活

## 风险与约束

- 这次改造会引入新的 D1 migration、Queue、Workflow 和 API 协议，属于中大型迁移
- 迁移期间需要一次性更新博客端脚本和 Cloudflare 服务端
- 旧表和旧逻辑不能长期并存，否则会形成两套事实来源
- Workflow 和 Queue 的幂等与状态机必须先设计清楚，再写实现，否则容易出现重复消费和双写

## 决策

本次实现采用以下最终决策：

- 采用 `session + queue + workflow` 的异步会话化架构
- 采用 `revision` 模型替代先删后建
- 采用 `content-addressed asset + OCR cache` 降低全量和增量重建成本
- 采用稳定 `section/chunk` identity 减少局部修改引起的向量 churn
- 采用 `session-level finalize + prune` 防止中途删除文章索引
