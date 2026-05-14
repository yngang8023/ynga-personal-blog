# Mizuki-ynga-blog Development Guide

本文件是这个仓库自己的开发提示词与实现约束。

## 项目目标

- 这是一个基于 Astro 的个人博客项目。
- 内容展示、Markdown 扩展、页面体验和移动端细节都属于高优先级。
- 修改时优先保持已有视觉风格和交互习惯，不要为了“重构”去破坏现有可用效果。

## 基本命令

- 开发：`pnpm dev`
- 类型与 Astro 校验：`pnpm check`
- 单元测试：`pnpm test`
- 构建：`pnpm build`

## 测试约定

- 所有测试文件统一放在 `tests/` 目录下。
- 不要再把 `.test.*` 文件直接放回 `src/`。
- 测试目录按功能分组，尽量和源码模块语义对应，例如：
  - `tests/plugins/`
  - `tests/scripts/`
  - `tests/styles/`
  - `tests/components/`
- 只要改动了可验证逻辑，就同步补测试或更新测试。

## Markdown 与内容渲染约定

- `src/content/`、`src/plugins/`、`src/content.config.ts` 会影响文章渲染结果。
- 开发环境下，这些文件的改动通过 `src/dev/markdown-content-hmr.mjs` 触发 Astro 内容缓存清理和整页刷新。
- 这个热更新逻辑只能作用于开发环境，不能污染生产构建。
- 修改 Markdown 扩展、内容示例页或相关插件时，优先同步补对应的 `tests/`，不要只改源码不补回归。
- 涉及文章示例页、Markdown 语法、图片画廊、图表渲染这类内容时，优先做定向测试，再做页面验证，避免一上来跑全量流程。
- 新增一种 Markdown 语法或展示方式时，建议同时补一段最小示例和一条断言，方便后续维护。
- 如果新增 Markdown 扩展能力，优先考虑：
  1. 编译期结构由 remark / rehype 负责
  2. 交互脚本尽量走正常的客户端模块，而不是把大量运行时代码直接塞进文章 HTML

## 前端实现约定

- 优先修真实用户体验问题，不做空泛优化。
- 保持桌面端和移动端都可用，移动端布局需要单独检查。
- 对已有样式体系做增量修改，不要无故推翻当前 UI。
- 部署地址、第三方服务地址、接口端点、iframe 嵌入地址这类可变配置必须集中放在 `src/config.ts` 中统一管理；组件、脚本和 workflow 不要各自硬编码同一类 URL。
- GitHub Actions 中需要暴露给 workflow 的非敏感配置优先使用 Actions Variables，敏感值继续使用 Secrets。
- 如果是文章页、评论区、友链页、Markdown 渲染区这类高频页面，修改后要做实际页面验证。
- 先跑最相关的测试和浏览器验证，再决定是否需要 `pnpm test` / `pnpm check` 全量检查，减少无效等待。

## 内容与文章约定

- 文章 frontmatter 统一使用已有字段体系，例如：
  - `title`
  - `published`
  - `updated`
  - `description`
  - `image`
  - `tags`
  - `category`
  - `author`
- 文章封面字段使用 `image`，不是 `cover`。
- 如果某篇文章被当作长期示例页或回归检查页，修改时要保持结构稳定、方便后续继续追加内容。

## 修改原则

- 不要为了“看起来更整洁”去删掉用户正在依赖的功能。
- 不要引入只在本地可用、部署后有风险的开发态特判。
- 开发态增强必须明确限制在 dev 范围内，例如使用 `apply: "serve"`。
- 涉及缓存、HMR、内容渲染链的修改时，要同时考虑：
  - 开发环境是否能及时看到变更
  - 生产构建是否保持稳定

## 验证要求

- 改完逻辑后先跑最相关的测试；如果是公共逻辑或影响面较大，再补 `pnpm test` / `pnpm check`。
- 如果改的是页面交互或渲染效果，除了命令校验，还要做一次实际页面验证。
- 涉及 `src/dev/markdown-content-hmr.mjs` 相关开发态行为时，必须确认只影响 dev，不要把额外缓存方案带进生产构建。
