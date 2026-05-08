# 怎么写博客文章

## 文章放哪

把新文章放到 `src/content/posts/`。

## 最小模板

```md
---
title: 我的第一篇文章
published: 2026-05-07
description: 简单介绍这篇文章讲什么。
tags: [生活, 随笔]
category: 随笔
draft: false
---

正文从这里开始。
```

## 常用字段

- `title`: 标题
- `published`: 发布日期
- `description`: 简介
- `tags`: 标签
- `category`: 分类
- `draft`: `true` 就不发布
- `pinned`: 置顶
- `image`: 封面图
- `comment`: 是否开启评论

## 写作建议

- 一篇文章只讲一个主题
- 开头先说结论
- 中间用小标题分段
- 代码用 ``` 包起来
- 图片放 `public/` 或文章同目录

## 新建文章

```bash
pnpm new-post 文章名
```

这个命令会在 `src/content/posts/` 下生成新文章文件。
