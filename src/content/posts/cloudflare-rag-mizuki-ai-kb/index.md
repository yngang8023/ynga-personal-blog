---
title: 用 Cloudflare-RAG 给我的博客补一个 AI 知识库
published: 2026-05-13
description: 记录一下我把 Mizuki + Astro 静态博客接到 Cloudflare-RAG 的思路。前端继续保留原来的 Markdown 内容体系，AI 对话和知识库能力单独放到 Cloudflare 侧，整体起步成本也比我预想中低很多。
tags: [Cloudflare, RAG, Workers AI, Vectorize]
category: AI
draft: false
image: "./cover.webp"
author: HiYnga
---

这篇主要想记一下我最近在折腾的一件事。

我这个博客本身是 **Astro + Mizuki**，内容一直都是老老实实用 Markdown 在维护。  
这种方式我其实挺喜欢，结构简单，改起来也顺手。

不过静态博客有一个问题一直在。

文章写多以后，内容虽然都在站里，但并不好问。  
如果有人想知道，我之前有没有写过 EdgeOne Pages 的部署过程，或者 Waline 那篇到底是怎么做同域代理的，最直接的办法还是自己翻文章。

所以我一直想补一个围绕博客内容工作的 AI 助手。

需求并不复杂：

- 前端不想推倒重来
- Markdown 还是原来的唯一内容来源
- AI 对话最好单独挂出去
- 如果成本能压低一点，就尽量别做成一个长期负担

后来看了一圈，我把注意力放到了这个项目上：

::github{repo="RafalWilinski/cloudflare-rag"}

我会注意到它，主要不是因为界面，而是因为它的思路比较合适。

它不是那种要求你把整站内容系统一起迁移过去的方案。  
更像是在 Cloudflare 上先给你搭一个 RAG 底座，然后再决定怎么把自己的内容喂进去，最后通过 `embed` 页面或者流式接口挂回原来的站。

这一点对我很重要。

因为我真正想保留的，其实不是某个 UI，而是我现在这套博客内容结构。  
- 文章还是在本地写。  
- 仓库还是原来的仓库。  
- 静态博客继续负责展示。  
- AI 这一层单独拆出去。

如果把我这几天围着 `Cloudflare-RAG` 写的几篇记录连起来看，这篇其实更像第一篇。  
主要是在讲两件事：

- 我为什么最后会选这条路
- 这套东西放到个人博客上，成本和边界大概是什么样

后面两篇分别是：

- [把 Cloudflare-RAG 真正接进 Mizuki 博客](/posts/cloudflare-rag-mizuki-integration-detail/)，偏具体实现
- [用阿里云 ESA 给 Cloudflare-RAG 聊天页做一次国内加速](/posts/aliyun-esa-cloudflare-rag-acceleration/)，偏入口加速和回源链路

## 先说一下这里的边界

这篇里提到的很多“博客知识库链路”，并不是 `RafalWilinski/cloudflare-rag` 上游仓库原封不动就有的能力。

我现在博客里这套：

```text
content/posts 
-> 原始 bundle
-> Cloudflare 侧解析
-> R2 / D1 / Vectorize
-> embed
```

本质上是我在原项目基础上，结合自己这个 **Mizuki + Astro** 博客结构做过一轮适配之后的结果。

更准确一点说，`cloudflare-rag` 原本更像是一套运行在 Cloudflare 上的全栈 RAG 示例。  
它原始方向偏通用文档 / 文件问答，重点在于把向量检索、流式回答、边缘部署这些关键能力串起来。

我后来之所以能继续往博客方向改，就是因为这套底座本身已经比较完整了。

它至少把几个关键部分都准备好了：

- Workers 负责请求入口和流式接口
- Pages 负责页面和部署
- D1 负责结构化数据和全文检索
- KV 可以拿来做限流
- Vectorize 负责语义检索
- R2 负责对象存储
- AI Gateway 负责观测和网关层能力
- Workers AI 负责模型调用和 Embedding

所以我对这个项目的判断，不是“它开箱就是博客 AI 插件”。  
而是“它给了我一个足够顺手的 Cloudflare RAG 底板”。

这两者差别其实挺大的。

## 我为什么最后会用这条路

我自己不太想为了一个 AI 助手，再额外维护一套很重的内容系统。

很多类似需求，最后都会走到一个问题上：

你到底是在维护博客，还是在维护另一套知识库后台。

如果为了做问答，要先把文章导成另一份格式，再单独上传，再手动同步，再去管一堆和原仓库脱开的内容源，那我大概率不会长期用。

我更能接受的方式是：

- Markdown 还是唯一真实来源
- 博客照常写、照常发
- AI 侧只负责消费内容、建索引、对话回答

从这个角度看，我觉得 `cloudflare-rag` 的方向是对的。  
它比较适合继续改，而不是那种看起来很完整、实际上很难嵌进自己现有博客体系里的东西。

## 成本这件事，比我一开始想的轻

我一开始其实最担心的是成本。

因为一提到知识库、向量检索、对象存储、模型调用，第一反应通常都不是“这个便宜”，而是“这玩意后面会不会一直烧钱”。

后来把 Cloudflare 官方文档翻了一遍，我的感受反而比预期轻很多。

至少在个人博客这个体量下，它确实有机会做到一个比较低成本的起步状态。

截至 **2026 年 5 月**，我比较在意的几项额度大概是这样。

Cloudflare Workers 免费计划，官方写的是 **每天 100,000 次请求**，每次调用 **10ms CPU**。  
静态资源请求本身又是免费且不受限的，Pages Functions 也是按 Workers 的逻辑在算。

Cloudflare Pages 免费计划，官方给的是 **每月 500 次构建**，**每次最多 20 分钟**，单项目 **100 个自定义域名**，单站 **20,000 个文件**。  
对个人博客来说，这个额度已经很宽了。

Cloudflare D1 免费计划，官方给的是 **每天 5,000,000 行读取**、**100,000 行写入**、**5 GB 存储**。  
如果只是放博客文章的元数据、分块信息和一些辅助检索数据，起步阶段基本够用。

Cloudflare KV 免费计划，官方给的是 **每天 100,000 次读取**、**1,000 次写入**、**1,000 次删除**、**1,000 次 list**，还有 **1 GB 存储**。  
我现在主要把它看成限流和一些轻量状态存储的工具，这个量级也够了。

Cloudflare Vectorize 这一块，Workers Free 下面，官方给的是 **每月 30,000,000 queried vector dimensions**，以及 **5,000,000 stored vector dimensions**。  
如果文章量还在个人博客这个规模，完全可以先跑起来再观察。

AI Gateway 我自己也比较看重。  
它不只是转发模型请求，还顺手把观测和网关这一层能力带上了。  
官方价格页提到，免费计划有 **100,000 条持久日志总额度**，拿来盯请求和排查问题已经很方便。

真正需要更认真看账单的地方，主要还是 **Workers AI** 和 **R2**。

Workers AI 目前官方写的是按 **Neurons** 计费，基准价格是 **$0.011 / 1,000 Neurons**。  
这一块没法说它免费，但好处是计费逻辑足够清楚，后面可以根据模型和回答长度自己控制。

R2 则比我预期友好一些。

它最核心的优势我觉得还是 **没有公网 egress 费用**。  
另外它本身也带免费额度，官方现在给的是：

- **每月 10 GB 存储**
- **100 万次 Class A 操作**
- **1000 万次 Class B 操作**

如果只是个人博客这类体量，拿来放文章相关资源和知识库辅助文件，通常已经能用很久。

所以我最后的判断不是“这套东西完全不花钱”。  
而是“这套东西起步足够轻，轻到值得先做起来”。

这对个人站点已经很重要了。

## 我最后接到博客里的方式

![](./1.png)

我的前端基本没动大骨架。

博客还是 **Mizuki**。  
站点还是 **Astro**。  
文章还是本地 Markdown。

AI 这部分，我是单独拆出去的。

不过这里还是要再说一次，下面这条链路已经是我自己针对博客项目做过适配之后的版本，不是上游仓库默认就长这样。

```text
Mizuki / Astro 静态博客
  ↓
把 src/content/posts 里的文章目录整理成原始内容 bundle
  ↓
同步到 Cloudflare-RAG
  ↓
Cloudflare 侧解析 Markdown、切块、建 D1 全文索引、建 Vectorize 向量索引、把博客相关原始资源放进 R2
  ↓
前端通过 /embed 或 /api/stream 把 AI 助手挂回来
```

我比较喜欢这个结构的地方，是它没有动到内容源的定义。

博客里真正的内容，还是仓库里的 Markdown。  
Cloudflare 侧做的是消费、整理、索引和回答，不是替代原有内容系统。

这一点对我来说比“聊天框能不能马上跑起来”更重要。

因为只要内容源还是统一的，后面无论继续做文章同步、增强检索，还是补一个独立的问答页，整体都比较顺。

真正跑起来之后，我平时的使用方式反而比想象中简单很多。

现在基本就是正常写文章、正常提交、正常 `git push`。  
只要推到仓库里，后面的同步链路会自己往下走。

不过这些更偏工程实现的部分，单放在这篇里会有点太重。  
所以我后来又单独拆了一篇实现记录：

[把 Cloudflare-RAG 真正接进 Mizuki 博客](/posts/cloudflare-rag-mizuki-integration-detail/)

那篇会单独写这些东西：

- 博客侧怎么把文章目录打成 bundle
- `git push -> GitHub Actions -> /api/sync-posts` 这条自动同步链路
- R2 / D1 / Vectorize 这几层现在分别在干什么
- `/api/stream` 这一层怎么做全文检索、向量检索、重排和兜底
- 指定域名内嵌认证怎么做，为什么不能直接公开 `/embed`

### 最后落到前端这边，其实就是两个入口

我后来也确实这么做了。

既然已经有 `embed` 页面，那就不只保留右下角的悬浮入口。  
我又给博客单独做了一个完整的 `ask-y` 页面，用来放更沉浸一点的对话入口。

这样用户既可以在读文章时随手问一句，也可以直接进单独的问答页，把它当作一个围绕博客内容运转的小助手来用。

这套东西真正让我觉得有意思的地方，也在这里。

它不是简单给博客套了一个通用聊天框。  
而是让原来那些只是“被展示”的文章，多了一层可以被问、被找、被重新组织的能力。

## 这套方案更适合什么情况

如果你现在的状态和我比较接近，我觉得这条路是值得看的。

- 已经有自己的博客
- 已经有一批稳定维护的文章
- 不想迁移前端框架
- 想继续保留 Markdown 写作
- 想让 AI 回答围绕自己的内容展开
- 又不太想把这件事做成长期的高成本负担

这种情况下，`cloudflare-rag` 这种“先给一个底座，再自己适配内容系统”的思路，反而比一体化更适合折腾。

至少对我来说，它解决的不是“怎么做一个聊天框”，而是“怎么在不破坏原博客内容体系的前提下，把它慢慢变成一个可以对话的知识库”。

这个方向我自己还是挺喜欢的。

后面如果继续做，我大概率也还是沿着这条路往前补，而不是重新换一套完全不同的内容系统。

如果你准备顺着继续看，建议直接接这两篇：

- [把 Cloudflare-RAG 真正接进 Mizuki 博客](/posts/cloudflare-rag-mizuki-integration-detail/)
- [用阿里云 ESA 给 Cloudflare-RAG 聊天页做一次国内加速](/posts/aliyun-esa-cloudflare-rag-acceleration/)

最后把这次写文章时翻过的几条 Cloudflare 官方文档也顺手贴一下。  
后面如果你准备自己算额度，或者想核对具体限制，直接看官方页会更稳。

- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [Cloudflare Vectorize Pricing](https://developers.cloudflare.com/vectorize/platform/pricing/)
- [Cloudflare AI Gateway Pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/)
- [Cloudflare Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
