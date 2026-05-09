---
title: 通过 EdgeOne Pages 给 Vercel 上的 Waline 做访问加速
published: 2026-05-09
updated: 2026-05-10T00:36:38+08:00
description: 记录一种不额外购买 EdgeOne 站点套餐的做法：把部署在 Vercel 上的 Waline 通过 EdgeOne Pages 同域代理到博客下面，顺手改善国内访问体验。
image: "./cover.webp"
tags: [Waline, Vercel, EdgeOne Pages]
category: 网站搭建
draft: false
author: HiYnga
---

这两天我一直在折腾博客评论区的访问速度。

我现在这个博客是基于 **Mizuki** 搭起来的。  
Mizuki 本身并不是默认就把 [Waline](https://waline.js.org/) 这套评论系统完整接进来的，所以我前面也顺手做了一些评论区接入和扩展，最后把评论服务放到了 [Waline](https://waline.js.org/) 上。

主站已经跑在 **EdgeOne Pages** 上，国内访问主站本身没有太大问题，但评论系统 [Waline](https://waline.js.org/) 还挂在 **Vercel**，而且前端直接请求的是：

```text
https://ynga-blog-waline.vercel.app/
```

结果就是主站打开还行，一滚到评论区，体感立刻不一样了。  
尤其是国内网络环境下，评论区初始化、读取评论、登录面板这些动作，总会比主站慢半拍。

我一开始的思路其实很直接：  
既然主站在 EdgeOne 上，那我是不是再给 `Waline` 单独套一层 EdgeOne 加速就行了？

然后我打开控制台，看到了套餐页。

这个时候我就冷静下来了。  
如果只是为了一个评论服务，再单独买一套站点加速，我自己是觉得不太划算的。

后来把路径理顺以后，我发现这件事其实有一个更省钱的做法：

> 既然我的博客本来就部署在 EdgeOne Pages 上，那我完全可以让博客自己代收 `/waline/*` 这一段请求，再由 EdgeOne Pages 的函数把请求转发给 Vercel 上的 [Waline](https://waline.js.org/)。

这样做有两个很直接的好处：

- 不用再单独给 `waline.kingcola-icg.cn` 买 EdgeOne 站点套餐
- 评论请求先落到 EdgeOne Pages，再回源到 Waline，自定义域名和访问入口也更顺

这篇就把我最后采用的方案完整记一下。

:::tip[这篇文章适合什么情况]
- 你的博客已经部署在 EdgeOne Pages
- 你的 Waline 还部署在 Vercel
- 你想改善评论区访问体验，但不想为了评论服务再单独买一层 CDN 套餐
:::

## 先说最后的结构

我最后把访问链路改成了这样：

```text
博客页面：
https://ynga.kingcola-icg.cn/

评论代理入口：
https://ynga.kingcola-icg.cn/waline/

Waline 实际源站：
https://waline.kingcola-icg.cn/
```

也就是说，前端不再直接请求 `vercel.app`，而是统一去访问博客域名下面的 `/waline/` 路径。  
这一层路径由 EdgeOne Pages 的 **Edge Function** 接住，然后再转发给 `waline.kingcola-icg.cn`。

所以关键思路只有一句话：

> 不是给 [Waline](https://waline.js.org/) 再买一层站点加速，而是把它借到已经在用的 EdgeOne Pages 下面。

## 我为什么不用 `vercel.app` 继续直连

原因其实很现实。

`Vercel` 本身没问题，部署也很方便，但 `vercel.app` 对国内访问来说，经常不是“不能用”，而是“能用，但不够顺”。  
这种感觉在评论系统上会特别明显，因为评论区不是只请求一次，它会连续发起多次接口访问。

比如：

- 读取当前页面评论
- 获取评论数和浏览量
- 拉起登录状态
- 提交评论

如果这些请求都直接打到海外入口，体感就容易变慢。

而我的博客主站已经在 EdgeOne Pages 下面，所以我更愿意把评论接口也统一收进同一个域名里，让浏览器和边缘节点先把这段链路跑顺。

## 真正省钱的点在哪里

一开始我也以为，要给 `waline.kingcola-icg.cn` 单独做加速，就必须再买 EdgeOne 站点套餐。

但后来我发现，我的需求其实不是“给一个独立站点再买完整安全加速能力”，而只是：

- 提供一个国内更顺的访问入口
- 用现有博客域名承接评论请求
- 再把请求转发到 Waline 源站

这类事情，**EdgeOne Pages 自带的函数能力就够了**。

也就是说，只要你的博客已经跑在 Pages 上，就不一定非得再去买“网站安全加速”的独立套餐。  
对我这种个人博客场景来说，这样反而更贴合实际。

## 我实际是怎么做的

### 1. 先给 Vercel 上的 Waline 配一个自定义域名

这一步我先在 Vercel 的 Waline 项目里加了一个自定义域名：

```text
https://waline.kingcola-icg.cn/
```

严格来说，这一步**不是绝对必须**。  
如果只是为了让 `/waline/*` 反代到 Waline 服务端，其实也可以直接回源到：

```text
https://ynga-blog-waline.vercel.app/
```

我之所以还是给它单独配了一个域名，更多是出于几个比较实际的考虑：

- 回源地址更稳定，不和平台默认分配域名绑死
- 后面排查问题时，可以直接单独访问源站
- 如果要进入管理后台，或者以后调整代理策略，自定义域名会更顺手

所以这里更准确的说法应该是：

- **想省步骤**：可以直接代理到 `vercel.app`
- **想让后续维护更清晰**：可以像我一样先给 Waline 单独绑一个域名

最终我先确认这一条地址本身是能直接打开的。  
如果这个自定义域名自己都不通，那后面的代理也无从谈起。

## 2. 在博客仓库里增加 Edge Function

我在博客仓库里加了这样两个文件：

```text
edge-functions/waline/index.js
edge-functions/waline/[[default]].js
```

它们做的事情很简单：

- 接住 `/waline/*` 的请求
- 去掉前缀 `/waline`
- 保留原来的方法、查询参数、请求头
- 转发到 `https://waline.kingcola-icg.cn/*`

核心逻辑大概就是这样：

```js
const DEFAULT_WALINE_ORIGIN = "https://waline.kingcola-icg.cn";

export function onRequest(context) {
  const { request, env } = context;
  const incomingUrl = new URL(request.url);
  const upstreamPath =
    incomingUrl.pathname.replace(/^\/waline(?=\/|$)/, "") || "/";

  const targetUrl = new URL(
    upstreamPath + incomingUrl.search,
    (env?.WALINE_ORIGIN || DEFAULT_WALINE_ORIGIN).replace(/\/+$/, ""),
  );

  const headers = new Headers(request.headers);
  headers.delete("host");

  return fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    redirect: "manual",
  });
}
```

我这里还顺手保留了一个 `WALINE_ORIGIN` 环境变量入口。  
如果以后源站地址要换，就不一定非得改代码。

## 3. 把前端 `serverURL` 改成同域路径

之前我的配置是：

```ts
serverURL: "https://ynga-blog-waline.vercel.app/"
```

后来我改成了：

```ts
serverURL: "https://ynga.kingcola-icg.cn/waline/"
```

也就是从“直接访问评论服务”，变成“先访问博客同域路径，再由 Pages 转发”。

这一点改完以后，博客里的 Waline 初始化入口就跟主站统一到了一个域名下面。

## 4. 推送代码，交给 EdgeOne Pages 自动部署

因为我的博客项目本来就是 GitHub 连到 EdgeOne Pages 的，所以这一步反而最省心。

我只需要把代码推到正式分支，Pages 就会自动重新构建部署：

```bash
git add "src/config.ts" "edge-functions/waline/index.js" "edge-functions/waline/[[default]].js"
git commit -m "feat: proxy Waline through EdgeOne Pages"
git push origin main
```

部署成功后，我原本以为直接访问这个地址就能看到完整的 Waline 页面：

```text
https://ynga.kingcola-icg.cn/waline/
```

但我后面实际测试时发现，这个地址虽然已经被代理接住了，**直接打开时仍然可能白屏**。  
原因并不是代理没生效，而是 Waline 的独立页面在子路径代理场景下，静态资源路径仍然更偏向按根路径去找。

换句话说：

- **文章页里的评论区能正常变快**，说明 `/waline/*` 这层 API 代理已经在工作
- **直接打开 `/waline/` 白屏**，不代表评论区代理失败

所以更稳妥的验证方法其实是两种：

1. 打开博客文章页，看评论区是否正常加载、提交和登录
2. 打开浏览器开发者工具，看评论请求是不是已经变成了：

```text
https://ynga.kingcola-icg.cn/waline/...
```

而不是原来的：

```text
https://ynga-blog-waline.vercel.app/...
```

如果你需要进入 Waline 的独立页面或管理后台，我更建议直接访问源站域名，例如：

```text
https://waline.kingcola-icg.cn/
https://waline.kingcola-icg.cn/ui/
```

## 这样做之后，实际改善了什么

先说结论：  
这种方式带来的提升，更多是“入口和链路体验更顺”，而不是把 Waline 一夜之间变成国内本地服务。

我自己的感受是，下面这些会更明显一些：

- 评论区初始化更利索
- 读取评论时卡顿感少一点
- 访问入口统一到博客域名之后，整体体验更连贯

但也要把预期放对：

- 最终 Waline 还是部署在 Vercel 上
- 动态接口最终还是要回源
- 如果数据库本身也离国内比较远，那提交评论这类动作不可能完全变成“本地站点速度”

所以这不是魔法，只是把“最前面那一段链路”先优化掉。

对我这种个人博客来说，这就已经很值了。  
因为我原本最不想做的事情，就是为了评论区再额外买一套加速套餐。

## 这个方法我觉得最适合哪类人

如果你跟我差不多，是下面这种情况，那这条路我觉得挺值得一试：

- 主站已经在 EdgeOne Pages
- 评论系统在 Vercel
- 你已经有自己的域名
- 你想尽量少花钱，优先复用现有架构

反过来说，如果你的博客本身就不在 EdgeOne Pages，这个方法的意义就会小很多。  
因为它成立的前提，本来就是“我已经有一个在 EdgeOne 边缘网络上的主站”。

## 我这次顺手记下的两个注意点

### 1. 先确认上游域名自己能打开

如果你用了自定义域名回源，那 `https://waline.kingcola-icg.cn/` 这条地址本身一定要先通。  
我这次也是先把它在 Vercel 上配好，确认能访问之后，才继续往下做代理。

### 2. 图片上传这类能力要额外留意限制

这次我的主要诉求是评论、读取、登录这些接口。  
如果你还准备在 Waline 里长期使用大文件上传，那就最好顺手再看看 Pages 函数对请求体大小的限制。

我这次没有把“大图片上传”作为核心场景，所以当前方案对我来说是成立的。

## 最后

这次折腾下来，我自己最满意的地方，不是“又接了一个平台”，而是把已经有的东西重新用顺了。

博客本来就在 EdgeOne Pages，Waline 本来就在 Vercel。  
以前我会下意识觉得，两边既然是两个平台，那就应该让它们各自独立跑。

但实际用下来，评论系统这种非常依赖访问体感的东西，挂在博客同域下面，确实会更自然一些。

更重要的是，这一套做完之后，我没有再额外为 Waline 单独买一层套餐。  
对个人博客来说，这一点我是真的挺满意。

如果你也刚好是“主站在 EdgeOne，Waline 在 Vercel”，不妨试试这条路。  
它不算复杂，但还挺实用。

## 相关链接

- [Waline 官方网站](https://waline.js.org/)
- [Waline 官方文档：部署到 Vercel](https://waline.js.org/guide/deploy/vercel.html)
- [EdgeOne Pages 官方文档：Edge Functions](https://pages.edgeone.ai/zh/document/edge-functions)
