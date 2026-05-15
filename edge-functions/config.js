// 生产博客正式域名：Edge Functions 只信任这个来源作为站内同源访问入口。
export const ALLOWED_BLOG_ORIGIN = "https://ynga.kingcola-icg.cn";

// 站点允许来源白名单：当前默认只放正式博客域，后续如果需要追加域名可从这里统一维护。
export const DEFAULT_ALLOWED_SITE_ORIGINS = Object.freeze([
	ALLOWED_BLOG_ORIGIN,
]);

// 通用代理请求头清理：避免把 hop-by-hop 或已失效的编码元数据继续传递给上游/下游。
export const EDGE_HOP_BY_HOP_REQUEST_HEADERS = Object.freeze([
	"host",
	"content-length",
]);
export const EDGE_UNSAFE_RESPONSE_HEADERS = Object.freeze([
	"content-encoding",
	"content-length",
	"transfer-encoding",
]);

// 通用拦截响应头：本地直接拒绝时统一使用 no-store 和 edge guard 标记。
export const EDGE_BLOCKED_RESPONSE_HEADERS = Object.freeze({
	"cache-control": "no-store, no-transform",
	"content-type": "text/plain; charset=utf-8",
	"x-edge-guard": "blocked",
});

// Diagram 代理配置：Mermaid 走固定版本 unpkg，PlantUML 走官方渲染服务。
export const MERMAID_ROUTE = "/diagram/mermaid.js";
export const MERMAID_UPSTREAM =
	"https://unpkg.com/mermaid@11.12.0/dist/mermaid.min.js";
export const PLANTUML_ROUTE_PREFIX = "/diagram/plantuml";
export const PLANTUML_UPSTREAM = "https://www.plantuml.com/plantuml/";
export const DIAGRAM_CACHE_CONTROL_BY_ROUTE = Object.freeze({
	mermaid:
		"public, max-age=3600, s-maxage=2592000, stale-while-revalidate=604800, no-transform",
	plantuml:
		"public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800, no-transform",
});

// RAG / Umami / Waline 上游默认入口：环境变量未覆盖时统一从这里读取。
export const DEFAULT_UMAMI_API_BASE =
	"https://cloud.umami.is/analytics/us/api";
export const DEFAULT_WALINE_ORIGIN = "https://waline.kingcola-icg.cn";
export const DEFAULT_WALINE_ASSETS_ORIGIN = "https://unpkg.com";

// Umami 代理缓存策略：share 可稍长缓存，实时 stats/metrics 走短缓存。
export const UMAMI_CACHE_CONTROL_BY_ROUTE = Object.freeze({
	share: "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400, no-transform",
	stats: "public, max-age=5, s-maxage=5, stale-while-revalidate=15, no-transform",
	metricsExpanded:
		"public, max-age=5, s-maxage=5, stale-while-revalidate=15, no-transform",
});

// Waline 代理方法与资源缓存配置。
export const WALINE_READ_METHODS = Object.freeze(["GET", "HEAD"]);
export const WALINE_WRITE_METHODS = Object.freeze([
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
]);
export const WALINE_ASSET_CACHE_CONTROL =
	"public, max-age=31536000, s-maxage=31536000, immutable, no-transform";
