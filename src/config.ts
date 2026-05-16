import type {
	AnnouncementConfig,
	CommentConfig,
	ExpressiveCodeConfig,
	FooterConfig,
	FullscreenWallpaperConfig,
	LicenseConfig,
	MusicPlayerConfig,
	NavBarConfig,
	PermalinkConfig,
	ProfileConfig,
	RandomPostsConfig,
	RelatedPostsConfig,
	SakuraConfig,
	ShareConfig,
	SidebarLayoutConfig,
	SiteConfig,
} from "./types/config";
import {
	MESSAGE_PAGE_PATH,
	MESSAGE_PAGE_TITLE,
} from "./constants/message-page";
import {
	ASK_Y_PAGE_PATH,
	ASK_Y_PAGE_TITLE,
} from "./constants/ask-y-page";
import { LinkPreset } from "./types/config";

// 移除i18n导入以避免循环依赖

// 定义站点语言
const SITE_LANG = "zh_CN"; // 语言代码，例如：'en', 'zh_CN', 'ja' 等。
const SITE_TIMEZONE = 8; //设置你的网站时区 from -12 to 12 default in UTC+8

// Cloudflare RAG 同步接口：本地同步脚本和 GitHub Actions 默认会读取这个地址，可用 BLOG_RAG_SYNC_ENDPOINT 临时覆盖。
export const BLOG_RAG_SERVICE_ORIGIN = "https://rag.ynga.kingcola-icg.cn";
export const BLOG_RAG_SITE_ORIGIN = "https://ynga.kingcola-icg.cn";
export const BLOG_RAG_SYNC_ENDPOINT =
	`${BLOG_RAG_SERVICE_ORIGIN}/api/sync-posts`;
// Cloudflare RAG 悬浮聊天窗口地址：右下角 AI 助手 iframe 会嵌入这个 /embed 页面。
export const BLOG_RAG_EMBED_URL = `${BLOG_RAG_SERVICE_ORIGIN}/embed`;
// 博客同源临时 token 下发接口：AI 助手首次打开时先请求这里，再用 token 启动受保护的 RAG iframe。
export const BLOG_RAG_TOKEN_ENDPOINT = "/rag-embed-token";
// 博客正式站点地址：同步文章到 RAG 时用于生成“参考来源”的文章 URL。
export const BLOG_RAG_SITE_URL = `${BLOG_RAG_SITE_ORIGIN}/`;

// Markdown 图表运行时配置：
// - local：开发环境直连在线 Mermaid / PlantUML 服务，便于本地立即预览并发现语法问题
// - online：部署环境走站内 /diagram/* 同源代理，由 EdgeOne Functions 统一转发与缓存
export const DIAGRAM_LOCAL_MODE = "local";
export const DIAGRAM_ONLINE_MODE = "online";
export const BLOG_DIAGRAM_MODE =
	process.env.NODE_ENV === "production"
		? DIAGRAM_ONLINE_MODE
		: DIAGRAM_LOCAL_MODE;
export const MERMAID_PROXY_PATH = "/diagram/mermaid.js";
export const MERMAID_ONLINE_SCRIPT_URL =
	"https://unpkg.com/mermaid@11.12.0/dist/mermaid.min.js";
export const PLANTUML_PROXY_PATH = "/diagram/plantuml";
export const PLANTUML_ONLINE_SERVER_URL =
	"https://www.plantuml.com/plantuml";

const resolveDiagramRuntimeValue = (
	mode: typeof DIAGRAM_LOCAL_MODE | typeof DIAGRAM_ONLINE_MODE,
	localValue: string,
	onlineValue: string,
) => (mode === DIAGRAM_LOCAL_MODE ? localValue : onlineValue);

export const blogDiagramConfig = {
	mode: BLOG_DIAGRAM_MODE,
	mermaidScriptUrl: resolveDiagramRuntimeValue(
		BLOG_DIAGRAM_MODE,
		MERMAID_ONLINE_SCRIPT_URL,
		MERMAID_PROXY_PATH,
	),
	plantumlServerUrl: resolveDiagramRuntimeValue(
		BLOG_DIAGRAM_MODE,
		PLANTUML_ONLINE_SERVER_URL,
		PLANTUML_PROXY_PATH,
	),
} as const;

// 博客 RAG 集成配置统一入口，后续更换 RAG 服务域名或站点域名时优先改这里。
export const blogRagConfig = {
	serviceOrigin: BLOG_RAG_SERVICE_ORIGIN,
	syncEndpoint: BLOG_RAG_SYNC_ENDPOINT,
	embedUrl: BLOG_RAG_EMBED_URL,
	siteOrigin: BLOG_RAG_SITE_ORIGIN,
	tokenEndpoint: BLOG_RAG_TOKEN_ENDPOINT,
	siteUrl: BLOG_RAG_SITE_URL,
} as const;

export const umamiConfig = {
	enable: true,
	trackInDev: false, // 是否在开发环境下启用统计
	shareUrl: "https://cloud.umami.is/analytics/us/share/VXfzKN9KrGekRNdd",
	scriptUrl: "https://cloud.umami.is/script.js",
	websiteId: "c32f806f-e719-4b51-89e7-64b7cd3085cb",
	proxyBasePath: "/umami",
	statsCacheTtlMs: 3000,
};

export const DEFAULT_UMAMI_PROXY_BASE_PATH = "/umami";
export const DEFAULT_UMAMI_STATS_CACHE_TTL_MS = 3000;

export const siteConfig: SiteConfig = {
	title: "HiYngaの随✏️记",
	subtitle:
		"把路过的风景🎐、零碎的心事🌸慢慢收集起来，写成属于自己的小记📖🌷",
	siteURL: BLOG_RAG_SITE_URL, // 请替换为你的站点URL，以斜杠结尾
	siteStartDate: "2026-05-07", // 站点开始运行日期，用于站点统计组件计算运行天数

	timeZone: SITE_TIMEZONE,

	lang: SITE_LANG,

	themeColor: {
		hue: 60, // 主题色的默认色相，范围从 0 到 360。例如：红色：0，青色：200，蓝绿色：250，粉色：345
		fixed: false, // 对访问者隐藏主题色选择器
	},

	// 特色页面开关配置（关闭未使用的页面有助于提升 SEO，关闭后请记得在 navbarConfig 中移除对应链接）
	featurePages: {
		anime: false, // 番剧页面开关
		diary: true, // 日记页面开关
		friends: true, // 友链页面开关
		message: true, // 留言页面开关
		projects: true, // 项目页面开关
		skills: true, // 技能页面开关
		timeline: false, // 时间线页面开关
		albums: true, // 相册页面开关
		devices: true, // 设备页面开关
	},

	// 顶栏标题配置
	navbarTitle: {
		// 显示模式："text-icon" 显示图标+文本，"logo" 仅显示Logo
		mode: "text-icon",
		// 顶栏标题文本
		text: "HiYngaの随✏️记",
		// 顶栏标题图标路径，默认使用 public/assets/home/home.webp
		icon: "/assets/home/home.webp",
		// 网站Logo图片路径
		logo: "/assets/home/home.webp",
	},

	// 外链访问确认弹窗配置
	externalLink: {
		enable: true, // 是否启用外链访问确认弹窗；关闭后外链将直接在新标签页打开
		logo: "/assets/home/home.webp", // 弹窗中使用的站点 Logo，可替换为你自己的品牌图标
	},

	// 页面自动缩放配置
	pageScaling: {
		enable: true, // 是否开启自动缩放
		targetWidth: 2000, // 目标宽度，低于此宽度时开始缩放
	},

	bangumi: {
		userId: "your-bangumi-id", // 在此处设置你的Bangumi用户ID，可以设置为 "sai" 测试
		fetchOnDev: false, // 是否在开发环境下获取 Bangumi 数据（默认 false），获取前先执行 pnpm build 构建 json 文件
	},

	bilibili: {
		vmid: "3494359783704684", // 在此处设置你的Bilibili用户ID (uid)，例如 "1129280784"
		fetchOnDev: false, // 是否在开发环境下获取 Bilibili 数据（默认 false）
		coverMirror: "https://images.weserv.nl/?url=", // 封面图片镜像源（可选，如果需要使用镜像源，例如 "https://images.weserv.nl/?url="）
		useWebp: true, // 是否使用WebP格式（默认 true）

		// bilibili 观看进度配置说明(可选，如需配置仔细阅读):
		// 1. 本地开发：请在 .env 文件中填写 BILI_SESSDATA=your_SESSDATA
		// 2. 远程构建：请在 GitHub 仓库 Settings -> Secrets 中添加 BILI_SESSDATA
		// 注意：SESSDATA 为账号凭证，为防止泄露，切记不可使用硬编码。
		// 安全提示：如 SESSDATA 已泄露，请打开 B站手机端 —— 我的 —— 设置 —— 安全隐私 —— 登陆设备管理 —— 一键退登，销毁已泄露的账号凭证
	},

	anime: {
		mode: "local", // 番剧页面模式："bangumi" 使用Bangumi API，"local" 使用本地配置，"bilibili" 使用Bilibili API
	},

	// 文章列表布局配置
	postListLayout: {
		// 默认布局模式："list" 列表模式（单列布局），"grid" 网格模式（双列布局）
		// 注意：如果侧边栏配置启用了"both"双侧边栏，则无法使用文章列表"grid"网格（双列）布局
		defaultMode: "list",
		// 是否允许用户切换布局
		allowSwitch: true,
		// 文章列表页分类导航条配置
		categoryBar: {
			enable: true, // 是否在文章列表页显示分类导航条
		},
	},

	// 标签样式配置
	tagStyle: {
		// 是否使用新样式（悬停高亮样式）还是旧样式（外框常亮样式）
		useNewStyle: false,
	},

	// 壁纸模式配置
	wallpaperMode: {
		// 默认壁纸模式：banner=顶部横幅，fullscreen=全屏壁纸，none=无壁纸
		defaultMode: "banner",
		// 整体布局方案切换按钮显示设置（默认："desktop"）
		// "off" = 不显示
		// "mobile" = 仅在移动端显示
		// "desktop" = 仅在桌面端显示
		// "both" = 在所有设备上显示
		showModeSwitchOnMobile: "desktop",
	},

	banner: {
		// 保留兜底图片，正常情况下会优先自动扫描 public/assets/... 目录
		src: {
			desktop: "/assets/desktop-banner/1.webp",
			mobile: "/assets/mobile-banner/1.webp",
		},

		autoScanPublicDir: {
			enable: true,
			desktopDir: "assets/desktop-banner",
			mobileDir: "assets/mobile-banner",
			pattern: "*.webp",
		},

		position: "center", // 等同于 object-position，仅支持 'top', 'center', 'bottom'。默认为 'center'

		carousel: {
			enable: true, // 为 true 时：为多张图片启用轮播。为 false 时：从数组中随机显示一张图片
			interval: 5, // 轮播间隔时间（秒）
		},

		waves: {
			enable: true, // 是否启用水波纹效果（注意：此功能性能开销较大）
			performanceMode: false, // 性能模式：减少动画复杂度(性能提升40%)
			mobileDisable: false, // 移动端禁用
		},

		// PicFlow API支持(智能图片API)
		imageApi: {
			enable: false, // 启用图片API
			url: "http://domain.com/api_v2.php?format=text&count=4", // API地址，返回每行一个图片链接的文本
		},
		// 这里需要使用PicFlow API的Text返回类型,所以我们需要format=text参数
		// 项目地址:https://github.com/matsuzaka-yuki/PicFlow-API
		// 请自行搭建API

		homeText: {
			enable: true, // 在主页显示自定义文本
			title: "Yngaの随记", // 主页横幅主标题

			subtitle: [
				"记录日常、灵感和那些想认真留下来的瞬间",
				"这里放着生活碎片，也放着慢慢成长的痕迹",
				"有空就来浏览，看看最近写下了什么",
				"把喜欢的事、走过的路和想到的话随时记录",
				"愿每一篇小文章，都能替当下留下一点温度",
			],
			typewriter: {
				enable: true, // 启用副标题打字机效果

				speed: 100, // 打字速度（毫秒）
				deleteSpeed: 50, // 删除速度（毫秒）
				pauseTime: 2000, // 完全显示后的暂停时间（毫秒）
			},
		},

		credit: {
			enable: false, // 显示横幅图片来源文本

			text: "Describe", // 要显示的来源文本
			url: "", // （可选）原始艺术品或艺术家页面的 URL 链接
		},

		navbar: {
			transparentMode: "semifull", // 导航栏透明模式："semi" 半透明加圆角，"full" 完全透明，"semifull" 动态透明
		},
	},
	toc: {
		enable: true, // 总开关，启用目录功能
		mobileTop: true, // 手机端顶部 TOC 按钮
		desktopSidebar: true, // 电脑端右侧边栏 TOC
		floating: true, // 悬浮 TOC 按钮
		depth: 2, // 目录深度，1-6，1 表示只显示 h1 标题，2 表示显示 h1 和 h2 标题，依此类推
		useJapaneseBadge: false, // 关闭日语假名标记，目录使用默认数字序号
	},
	showCoverInContent: true, // 在文章内容页显示文章封面
	generateOgImages: false, // 启用生成OpenGraph图片功能,注意开启后要渲染很长时间，不建议本地调试的时候开启
	favicon: [
		// 留空以使用默认 favicon
		// {
		//   src: '/favicon/icon.png',    // 图标文件路径
		//   theme: 'light',              // 可选，指定主题 'light' | 'dark'
		//   sizes: '32x32',              // 可选，图标大小
		// }
	],

	// 字体配置
	font: {
		// 注意：自定义字体需要在 src/styles/main.css 中引入字体文件
		// 注意：字体子集优化功能目前仅支持 TTF 格式字体,开启后需要在生产环境才能看到效果,在Dev环境下显示的是浏览器默认字体!
		asciiFont: {
			// 英文字体 - 优先级最高
			// 指定为英文字体则无论字体包含多大范围，都只会保留 ASCII 字符子集
			//fontFamily: "ZenMaruGothic-Medium",
			fontFamily: "LXGWWenKai-Regular",
			fontWeight: "400",
			localFonts: ["LXGWWenKai-Regular.woff2"],
			enableCompress: false, // 关闭子集优化，避免正文偶发缺字/回退
		},
		cjkFont: {
			// 中日韩字体 - 作为回退字体
			//fontFamily: "萝莉体 第二版",
			fontFamily: "LXGWWenKai-Regular",
			fontWeight: "500",
			localFonts: ["LXGWWenKai-Regular.woff2"],
			enableCompress: false, // 关闭子集优化，保证正文字体稳定一致
		},
	},
	showLastModified: true, // 控制"上次编辑"卡片显示的开关
	pageProgressBar: {
		enable: true, // 启用页面顶部进度条
		height: 3, // 进度条高度 3px
		duration: 6000, // 动画时长 6s
	},

	thirdPartyAnalytics: {
		enable: false, // 是否启用第三方统计（Microsoft Clarity），默认关闭，启用可能影响 Lighthouse 评分
		clarityId: "", // Clarity 项目 ID
	},
};
export const fullscreenWallpaperConfig: FullscreenWallpaperConfig = {
	// 保留兜底图片，正常情况下会优先自动扫描 public/assets/... 目录并按目录内图片数量轮播
	// 如果你只想手动限制全屏壁纸使用的图片数量，可以关闭 autoScanPublicDir 后仅在这里填写想用的图片
	src: {
		desktop: "/assets/desktop-banner/1.webp",
		mobile: "/assets/mobile-banner/1.webp",
	},
	autoScanPublicDir: {
		enable: true,
		desktopDir: "assets/desktop-banner",
		mobileDir: "assets/mobile-banner",
		pattern: "*.webp",
	},
	position: "center", // 壁纸位置，等同于 object-position
	carousel: {
		enable: true, // 启用轮播
		interval: 8, // 轮播间隔时间（秒）
	},
	zIndex: -1, // 层级，确保壁纸在背景层
	opacity: 0.8, // 壁纸透明度
	blur: 1, // 背景模糊程度
};

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		{
			name: MESSAGE_PAGE_TITLE,
			url: MESSAGE_PAGE_PATH,
			icon: "material-symbols:chat-rounded",
		},
		// 支持自定义导航栏链接，支持多级菜单
		{
			name: "Links",
			url: "/links/",
			icon: "material-symbols:link",
			children: [
				{
					name: "GitHub",
					url: "https://github.com/yngang8023",
					external: true,
					icon: "fa7-brands:github",
				},
				{
					name: "Gitee",
					url: "https://gitee.com/yngang",
					external: true,
					icon: "simple-icons:gitee",
				},
				{
					name: "数据统计",
					url: umamiConfig.shareUrl,
					external: true,
					icon: "material-symbols:query-stats",
				},
			],
		},
		{
			name: "My",
			url: "/content/",
			icon: "material-symbols:person",
			children: [
				// {
				// 	name: "Anime",
				// 	url: "/anime/",
				// 	icon: "material-symbols:movie",
				// },
				{
					name: "Diary",
					url: "/diary/",
					icon: "material-symbols:book",
				},
				{
					name: "Gallery",
					url: "/albums/",
					icon: "material-symbols:photo-library",
				},
				{
					name: ASK_Y_PAGE_TITLE,
					url: ASK_Y_PAGE_PATH,
					fullPage: true,
					icon: "material-symbols:smart-toy-outline-rounded",
				},
				// {
				// 	name: "Devices",
				// 	url: "/devices/",
				// 	icon: "material-symbols:devices",
				// 	external: false,
				// },
			],
		},
		{
			name: "About",
			url: "/content/",
			icon: "material-symbols:info",
			children: [
				{
					name: "About",
					url: "/about/",
					icon: "material-symbols:person",
				},
				{
					name: "Friends",
					url: "/friends/",
					icon: "material-symbols:group",
				},
			],
		},
		{
			name: "Others",
			url: "#",
			icon: "material-symbols:more-horiz",
			children: [
				{
					name: "Projects",
					url: "/projects/",
					icon: "material-symbols:work",
				},
				{
					name: "Skills",
					url: "/skills/",
					icon: "material-symbols:psychology",
				},
				// {
				// 	name: "Timeline",
				// 	url: "/timeline/",
				// 	icon: "material-symbols:timeline",
				// },
			],
		},
	],
};

export const profileConfig: ProfileConfig = {
	avatar: "assets/images/avatar.webp", // 相对于 /src 目录。如果以 '/' 开头，则相对于 /public 目录
	name: "HiYnga",
	bio: "记录技术、折腾灵感，也认真收藏总结每一次失败的经验。",
	typewriter: {
		enable: true, // 启用个人简介打字机效果
		speed: 80, // 打字速度（毫秒）
	},
	links: [
		{
			name: "Bilibili",
			icon: "fa7-brands:bilibili",
			url: "https://space.bilibili.com/3494359783704684",
		},
		{
			name: "Gitee",
			icon: "simple-icons:gitee",
			url: "https://gitee.com/yngang",
		},
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/yngang8023",
		},
		{
			name: "RSS",
			icon: "material-symbols:rss-feed-rounded",
			url: "/rss/",
		},
	],
};

export const licenseConfig: LicenseConfig = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

// Permalink 固定链接配置
export const permalinkConfig: PermalinkConfig = {
	enable: false, // 是否启用全局 permalink 功能，关闭时使用默认的文件名作为链接
	/**
	 * permalink 格式模板
	 * 支持的占位符：
	 * - %year% : 4位年份 (2024)
	 * - %monthnum% : 2位月份 (01-12)
	 * - %day% : 2位日期 (01-31)
	 * - %hour% : 2位小时 (00-23)
	 * - %minute% : 2位分钟 (00-59)
	 * - %second% : 2位秒数 (00-59)
	 * - %post_id% : 文章序号（按发布时间升序排列，最早的文章为1）
	 * - %postname% : 文章文件名（slug，通常为全小写）
	 * - %raw_postname% : 文章原始文件名（保留大小写）
	 * - %category% : 分类名（无分类时为 "uncategorized"）
	 *
	 * 示例：
	 * - "%year%-%monthnum%-%postname%" => "/2024-12-my-post/"
	 * - "%post_id%-%postname%" => "/42-my-post/"
	 * - "%category%-%postname%" => "/tech-my-post/"
	 * - "%year%/%monthnum%/%day%/%postname%" => "/2024/12/01/my-post/"
	 *
	 * 注意：支持使用斜杠 "/" 构建嵌套路径。
	 */
	format: "%postname%", // 默认使用文件名
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// 注意：某些样式（如背景颜色）已被覆盖，请参阅 astro.config.mjs 文件。
	// 请选择深色主题，因为此博客主题目前仅支持深色背景
	theme: "github-dark",
	// 是否在主题切换时隐藏代码块以避免卡顿问题
	hideDuringThemeTransition: true,
};

const WALINE_ASSET_BASE = "/waline-assets" as const;
const WALINE_ONLINE_ASSET_BASE =
	"/waline-assets/@waline/emojis@1.4.0" as const;
// 设置 Waline 表情资源模式：
// - "local"：只使用 public/waline-assets 目录里已有的表情目录和图片
// - "online"：基础表情仍优先走 public/waline-assets，额外扩展表情才走 /waline-assets/@waline/emojis@1.4.0/... 同域代理回源 unpkg
const WALINE_ASSET_MODE = "local" as const;
const WALINE_BASE_REACTION_ASSETS = [
	"tw/1f44d.png",
	"tw/1f970.png",
	"tw/1f389.png",
	"tw/1f525.png",
	"tw/1f31f.png",
	"tw/1f44f.png",
	"tw/1f92f.png",
] as const;
// 本地Waline的表情静态资源目录下载方法：
// 下载：npm pack @waline/emojis@1.4.0 -> waline-emojis-1.4.0.tgz
// 本地解压：tar -xf .\waline-emojis-1.4.0.tgz -> package\
const WALINE_BASE_EMOJI_PRESETS = [
	"bmoji",
	"qq",
	"weibo",
	"tieba",
	"bilibili",
	"alus",
] as const;
// 仅在 WALINE_ASSET_MODE === "online" 时生效。
// 用来追加“本地 public/waline-assets 里没有，但你又想在 online 模式下额外启用”的 reaction 图片。
// 写法是相对于 @waline/emojis@1.4.0 的资源路径，不要带开头斜杠。
// 例如：
// "tw/1f44d.png"
// "weibo/xxx.png"
// "bmoji/xxx.png"
const WALINE_ONLINE_EXTRA_REACTION_ASSETS = [] as const;
// 仅在 WALINE_ASSET_MODE === "online" 时生效。
// 用来追加“本地 public/waline-assets 里没有，但你又想在 online 模式下额外启用”的 emoji 目录。
// 写法是 @waline/emojis@1.4.0 下的一级目录名，不要带开头斜杠。
// 例如：
// "tw-emoji"
// "soul-emoji"
const WALINE_ONLINE_EXTRA_EMOJI_PRESETS = [] as const;

function buildWalineReactionPaths(mode: "local" | "online") {
	const basePaths = WALINE_BASE_REACTION_ASSETS.map(
		(assetPath) => `${WALINE_ASSET_BASE}/${assetPath}`,
	);

	if (mode !== "online") {
		return basePaths;
	}

	return [
		...basePaths,
		...WALINE_ONLINE_EXTRA_REACTION_ASSETS.map(
			(assetPath) => `${WALINE_ONLINE_ASSET_BASE}/${assetPath}`,
		),
	];
}

function buildWalineEmojiPaths(mode: "local" | "online") {
	const basePaths = WALINE_BASE_EMOJI_PRESETS.map(
		(preset) => `${WALINE_ASSET_BASE}/${preset}`,
	) as (`/${string}`)[];

	if (mode !== "online") {
		return basePaths;
	}

	return [
		...basePaths,
		...WALINE_ONLINE_EXTRA_EMOJI_PRESETS.map(
			(preset) => `${WALINE_ONLINE_ASSET_BASE}/${preset}`,
		),
	] as (`/${string}`)[];
}

export const commentConfig: CommentConfig = {
	enable: true, // 启用评论功能。当设置为 false 时，评论组件将不会显示在文章区域。
	system: "waline", // 评论系统选择: "twikoo" | "giscus" | "waline"
	twikoo: {
		envId: "",
		lang: SITE_LANG,
	},
	giscus: {
		repo: "your-github-username/your-repo-name",
		repoId: "your-repo-id",
		category: "Announcements",
		categoryId: "your-category-id",
		mapping: "pathname",
		strict: "0",
		reactionsEnabled: "1",
		emitMetadata: "0",
		inputPosition: "top",
		theme: "preferred_color_scheme",
		lang: SITE_LANG,
		loading: "lazy",
	},
	waline: {
		// Waline 配置项说明：https://waline.js.org/reference/client/props.html
		serverURL: "https://ynga.kingcola-icg.cn/waline/",
		// Waline 表情资源模式：
		// - "local"：只使用 public/waline-assets 目录里已有的表情目录和图片
		// - "online"：基础表情仍优先走 public/waline-assets，额外扩展表情才走 /waline-assets/@waline/emojis@1.4.0/... 同域代理回源 unpkg
		assetMode: WALINE_ASSET_MODE,
		lang: "zh-CN",
		meta: ["nick", "mail", "link"],
		requiredMeta: ["nick", "mail"],
		wordLimit: [5, 1000],
		pageSize: 10,
		commentSorting: "latest",
		dark: ".dark",
		login: "force",
		noCopyright: false,
		noRss: false,
		// 基础 reaction 使用 public/waline-assets 下的相对资源路径
		// 例如 "tw/1f44d.png"、"weibo/xxx.png"、"bmoji/xxx.png"
		// 如果 assetMode === "online"，可以在 WALINE_ONLINE_EXTRA_REACTION_ASSETS 里追加远端图片相对路径
		// 这些远端额外 reaction 会走 /waline-assets/@waline/emojis@1.4.0/{assetPath}
		reaction: buildWalineReactionPaths(WALINE_ASSET_MODE),
		// 基础 emoji 始终走 /waline-assets/{preset}
		// 如果 assetMode === "online"，可以在 WALINE_ONLINE_EXTRA_EMOJI_PRESETS 里追加远端目录
		// 这些远端额外 emoji 会走 /waline-assets/@waline/emojis@1.4.0/{preset}
		emoji: buildWalineEmojiPaths(WALINE_ASSET_MODE),
		pageview: true,
		comment: true,
		search: false,
		locale: {
			placeholder:
				"欢迎留下你的想法，也可以分享这篇内容带给你的感受。",
			sofa: "还没有评论，来坐第一个沙发吧。",
			reactionTitle: "你认为这篇文章怎么样？",
		},
	},
};

export const shareConfig: ShareConfig = {
	enable: true, // 启用分享功能
};

export const announcementConfig: AnnouncementConfig = {
	title: "欢迎访问小站", // 公告标题，填空使用i18n字符串Key.announcement
	content:
		"欢迎来到HiYngaの随✏️记，这里会持续更新技术学习、折腾笔记和一些认真写下来的想法。", // 公告内容
	closable: false, // 允许用户关闭公告
	link: {
		enable: true, // 启用链接
		text: "了解本站", // 链接文本
		url: "/about/", // 链接 URL
		external: false, // 内部链接
	},
};

const MUSIC_PLAYER_MODE: MusicPlayerConfig["mode"] =
	process.env.NODE_ENV === "production" ? "meting" : "local";

export const musicPlayerConfig: MusicPlayerConfig = {
	enable: true, // 启用音乐播放器功能
	showFloatingPlayer: true, // 显示悬浮播放器 UI
	floatingEntryMode: "fab", // 悬浮入口模式："default" 为独立悬浮播放器，"fab" 为集成到通用 FAB 组
	// floatingEntryMode: "default", // 悬浮入口模式："default" 为独立悬浮播放器，"fab" 为集成到通用 FAB 组
	mode: MUSIC_PLAYER_MODE, // 开发环境默认 local，生产环境默认 meting
	// mode: "meting", // 开发环境默认 local，生产环境默认 meting
	meting_api: [
		"https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r",
		"https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id",
		// "https://meting-api-alpha-snowy.vercel.app/api?server=:server&type=:type&id=:id&auth=:auth&r=:r",
		"https://meting.mysqil.com/api?server=:server&type=:type&id=:id&auth=:auth&r=:r",
		"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&auth=:auth&r=:r",
		// "https://meting-api-omega.vercel.app/api?server=:server&type=:type&id=:id&auth=:auth&r=:r",
	], // Meting API 地址，按顺序自动兜底切换
	// https://github.com/xizeyoupan/Meting-API
	// 也可以自己根据上面这个仓库直接自己快速部署到 Vercel 或者 Cloudflare Workers 上，免费又稳定
	// id: "3778678", // 歌单ID
	// id: "14164869977", // 歌单ID
	id: "2996592506", // 歌单ID
	server: "netease", // 音乐源服务器。有的meting的api源支持更多平台,一般来说,netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
	type: "playlist", // 播单类型
};

export const footerConfig: FooterConfig = {
	enable: true, // 是否启用Footer HTML注入功能
	customHtml: "", // HTML格式的自定义页脚信息，例如备案号等，默认留空
	// 也可以直接编辑 FooterConfig.html 文件来添加备案号等自定义内容
	// 注意：若 customHtml 不为空，则使用 customHtml 中的内容；若 customHtml 留空，则使用 FooterConfig.html 文件中的内容
	// FooterConfig.html 可能会在未来的某个版本弃用
};

/**
 * 侧边栏布局配置
 * 用于控制侧边栏组件的显示、排序、动画和响应式行为
 * sidebar: 控制组件所在的侧边栏（left 或 right）。注意：移动端通常不显示右侧栏内容。若组件设置在 right，请确保 layout.position 为 "both"。
 */
export const sidebarLayoutConfig: SidebarLayoutConfig = {
	// 侧边栏组件属性配置列表
	properties: [
		{
			// 组件类型：用户资料组件
			type: "profile",
			// 组件位置："top" 表示固定在顶部
			position: "top",
			// CSS 类名，用于应用样式和动画
			class: "onload-animation",
			// 动画延迟时间（毫秒），用于错开动画效果
			animationDelay: 0,
		},
		{
			// 组件类型：分类组件
			type: "categories",
			// 右侧从分类组件开始进入吸顶区
			position: "sticky",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 50,
			// 响应式配置
			responsive: {
				// 分类数量超过 2 个后进入折叠模式
				collapseThreshold: 2,
			},
			// 组件专属属性
			customProps: {
				// 进入折叠模式后默认显示 2 行
				collapsedRows: 2,
			},
		},
		{
			// 组件类型：公告组件
			type: "announcement",
			// 公告保持在左侧顶部区域
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 100,
		},
		{
			// 组件类型：侧栏音乐组件
			type: "music-sidebar",
			position: "sticky",
			class: "onload-animation",
			animationDelay: 150,
		},
		{
			// 组件类型：标签组件
			type: "tags",
			// 分类之后继续留在左侧吸顶区
			position: "sticky",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 250,
			// 响应式配置
			responsive: {
				// 标签数量超过 10 个后进入折叠模式
				collapseThreshold: 10,
			},
			// 组件专属属性
			customProps: {
				// 进入折叠模式后默认显示 4 行
				collapsedRows: 3,
			},
		},
		{
			// 组件类型：卡片式目录组件
			type: "card-toc",
			// 组件位置
			position: "sticky",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 200,
		},
		{
			// 组件类型：站点统计组件
			type: "site-stats",
			// 组件位置
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 200,
		},
		{
			// 组件类型：日历组件(移动端不显示)
			type: "calendar",
			// 从日历开始进入右侧吸顶区
			position: "sticky",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 250,
		},
	],

	// 侧栏组件布局配置
	components: {
		left: ["profile", "announcement", "tags", "card-toc"],
		right: ["site-stats", "calendar", "categories", "music-sidebar"],
		drawer: [
			"profile",
			"announcement",
			"tags",
			"categories",
			"music-sidebar",
		],
	},

	// 默认动画配置
	defaultAnimation: {
		// 是否启用默认动画
		enable: true,
		// 基础延迟时间（毫秒）
		baseDelay: 0,
		// 递增延迟时间（毫秒），每个组件依次增加的延迟
		increment: 50,
	},

	// 响应式布局配置
	responsive: {
		// 断点配置（像素值）
		breakpoints: {
			// 移动端断点：屏幕宽度小于768px
			mobile: 768,
			// 平板端断点：屏幕宽度小于1280px
			tablet: 1280,
			// 桌面端断点：屏幕宽度大于等于1280px
			desktop: 1280,
		},
	},
};

export const sakuraConfig: SakuraConfig = {
	enable: true, // 樱花特效总开关，关闭后所有设备都不显示
	devices: {
		desktop: true, // 桌面端启用樱花特效
		mobile: false, // 移动端关闭樱花特效
	},
	// 路由级控制：后续想屏蔽其它页面，直接继续往 disabled 里追加即可
	routeRules: {
		disabled: ["/posts/**"],
		// disabled: [""],
	},
	sakuraNum: 21, // 樱花数量
	limitTimes: -1, // 樱花越界限制次数，-1为无限循环
	size: {
		min: 0.5, // 樱花最小尺寸倍数
		max: 1.1, // 樱花最大尺寸倍数
	},
	opacity: {
		min: 0.3, // 樱花最小不透明度
		max: 0.9, // 樱花最大不透明度
	},
	speed: {
		horizontal: {
			min: -1.7, // 水平移动速度最小值
			max: -1.2, // 水平移动速度最大值
		},
		vertical: {
			min: 1.5, // 垂直移动速度最小值
			max: 2.2, // 垂直移动速度最大值
		},
		rotation: 0.03, // 旋转速度
		fadeSpeed: 0.03, // 消失速度，不应大于最小不透明度
	},
	zIndex: 100, // 层级，确保樱花在合适的层级显示
};

// Pio 看板娘配置
export const pioConfig: import("./types/config").PioConfig = {
	enable: false, // 禁用看板娘以提升性能
	models: ["/pio/models/pio/model.json"], // 默认模型路径
	position: "left", // 模型位置
	width: 280, // 默认宽度
	height: 250, // 默认高度
	mode: "draggable", // 默认为可拖拽模式
	hiddenOnMobile: true, // 默认在移动设备上隐藏
	dialog: {
		welcome: "Welcome to Mizuki Website!", // 欢迎词
		touch: [
			"What are you doing?",
			"Stop touching me!",
			"HENTAI!",
			"Don't bully me like that!",
		], // 触摸提示
		home: "Click here to go back to homepage!", // 首页提示
		skin: ["Want to see my new outfit?", "The new outfit looks great~"], // 换装提示
		close: "QWQ See you next time~", // 关闭提示
		link: "https://github.com/matsuzaka-yuki/Mizuki", // 关于链接
	},
};

// 相关文章配置
export const relatedPostsConfig: RelatedPostsConfig = {
	enable: true,
	maxCount: 5,
};

// 随机文章配置
export const randomPostsConfig: RandomPostsConfig = {
	enable: true,
	maxCount: 5,
};

// 导出所有配置的统一接口
export const widgetConfigs = {
	profile: profileConfig,
	announcement: announcementConfig,
	music: musicPlayerConfig,
	layout: sidebarLayoutConfig,
	sakura: sakuraConfig,
	fullscreenWallpaper: fullscreenWallpaperConfig,
	pio: pioConfig,
	share: shareConfig,
	relatedPosts: relatedPostsConfig,
	randomPosts: randomPostsConfig,
} as const;

// Umami 统计分为两层：
// 1. Layout.astro 中注入官方 tracking script，负责真实上报访问量
// 2. UmamiStatsRuntime.astro 负责读取分享统计数据，并兼容注入到 window.oddmisc 接口
