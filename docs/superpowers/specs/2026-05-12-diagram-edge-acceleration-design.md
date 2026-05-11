# Diagram Edge Acceleration Design

## 背景

当前博客里的 Mermaid 和 PlantUML 都依赖远端请求：

- Mermaid 通过浏览器动态加载 `mermaid.min.js`
- PlantUML 通过远端 `svg` 地址返回图像

现有前端已经做了懒加载、渲染缓存和主题切换优化，但首个网络入口仍然是性能瓶颈。  
目标是把两类请求收敛到同域的 Edge Functions，再由边缘节点负责回源和缓存。

## 目标

- Mermaid 只走同域入口 `/diagram/mermaid.js`
- PlantUML 只走同域入口 `/diagram/plantuml/...`
- 仅保留单一上游，不做 CDN 兜底回退
- 使用边缘缓存降低重复回源
- 不破坏现有主题切换、懒加载、全屏预览和源码面板逻辑

## 非目标

- 不改 Markdown 语法
- 不把 Mermaid 改成本地依赖包
- 不重写 PlantUML 的编码和渲染流程
- 不引入新的图表库

## 方案

### Mermaid

- 新增 Edge Function 处理 `/diagram/mermaid.js`
- Function 只回源 `https://unpkg.com/mermaid@11.12.0/dist/mermaid.min.js`
- 返回时清理上游不安全头，并写入可缓存响应头
- 前端脚本只加载这个同域地址

### PlantUML

- 新增 Edge Function 处理 `/diagram/plantuml/*`
- Function 只回源 `https://www.plantuml.com/plantuml/*`
- 通过路径和查询字符串保持原始图像参数
- 对 `GET` 的 SVG 响应启用边缘缓存
- 前端 `plantumlConfig.servers` 只保留同域代理地址

## 关键约束

- 不保留第二个 CDN 备用源
- Mermaid 失败时直接报错，不自动切换其他脚本源
- PlantUML 保持现有主题切换逻辑，缓存键需包含完整请求路径

## 验证

- 页面首次打开时，Mermaid/PlantUML 请求都应落到同域路径
- 切换主题时，PlantUML 仍可正常切换浅色/深色图
- 重复刷新后，浏览器应命中边缘缓存或浏览器缓存
- 文章页不应出现新增的渲染抖动或回退行为

