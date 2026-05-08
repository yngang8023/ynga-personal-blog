// Skill data configuration file
// Used to manage data for the skill display page

export interface Skill {
	id: string;
	name: string;
	description: string;
	icon: string;
	category: "frontend" | "backend" | "database" | "tools" | "other";
	level: "beginner" | "intermediate" | "advanced" | "expert";
	startedAt: string; // YYYY-MM-DD
	projects?: string[];
	certifications?: string[];
	color?: string;
}

export interface SkillExperience {
	years: number;
	months: number;
	totalMonths: number;
}

const parseStartedAt = (startedAt: string) => {
	const [yearText, monthText, dayText = "1"] = startedAt.split("-");
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);

	if (
		!Number.isFinite(year) ||
		!Number.isFinite(month) ||
		!Number.isFinite(day)
	) {
		return null;
	}

	return { year, month, day };
};

export const getSkillExperience = (
	skillOrStartedAt: Pick<Skill, "startedAt"> | string,
	now = new Date(),
): SkillExperience => {
	const startedAt =
		typeof skillOrStartedAt === "string"
			? skillOrStartedAt
			: skillOrStartedAt.startedAt;
	const parsed = parseStartedAt(startedAt);

	if (!parsed) {
		return {
			years: 0,
			months: 0,
			totalMonths: 0,
		};
	}

	let totalMonths =
		(now.getFullYear() - parsed.year) * 12 +
		(now.getMonth() + 1 - parsed.month);

	if (now.getDate() < parsed.day) {
		totalMonths -= 1;
	}

	totalMonths = Math.max(0, totalMonths);

	return {
		years: Math.floor(totalMonths / 12),
		months: totalMonths % 12,
		totalMonths,
	};
};

export const skillsData: Skill[] = [
	// Frontend Skills
	{
		id: "javascript",
		name: "JavaScript",
		description:
			"熟悉前端基础逻辑开发，能够完成页面交互、异步请求、组件配合与常见业务功能实现。",
		icon: "logos:javascript",
		category: "frontend",
		level: "intermediate",
		startedAt: "2024-09-08",
		color: "#F7DF1E",
	},
	{
		id: "typescript",
		name: "TypeScript",
		description:
			"能够在前端项目中使用 TypeScript 做类型约束和结构整理，让页面开发和联调过程更清晰稳定。",
		icon: "logos:typescript-icon",
		category: "frontend",
		level: "intermediate",
		startedAt: "2025-03-08",
		color: "#3178C6",
	},
	{
		id: "vue",
		name: "Vue.js",
		description:
			"可以使用 Vue 完成常见页面、后台界面和组件开发，能配合后端接口完成实际业务功能。",
		icon: "logos:vue",
		category: "frontend",
		level: "intermediate",
		startedAt: "2024-11-08",
		color: "#4FC08D",
	},
	{
		id: "react",
		name: "React",
		description:
			"能够编写 React 页面与组件，完成基础状态管理、接口交互和功能联调，具备独立落地常见页面的能力。",
		icon: "logos:react",
		category: "frontend",
		level: "intermediate",
		startedAt: "2025-05-08",
		color: "#61DAFB",
	},
	{
		id: "astro",
		name: "Astro",
		description:
			"用于当前博客与内容站点的搭建和改造，熟悉基于主题进行定制、页面优化和内容结构调整。",
		icon: "logos:astro-icon",
		category: "frontend",
		level: "intermediate",
		startedAt: "2025-07-08",
		color: "#FF5D01",
	},

	// Backend Skills
	{
		id: "java",
		name: "Java",
		description:
			"当前主要技术方向，重点放在 Java 后端开发，能够围绕实际业务需求完成接口、逻辑与服务端功能实现。",
		icon: "logos:java",
		category: "backend",
		level: "advanced",
		startedAt: "2024-05-08",
		color: "#ED8B00",
	},
	{
		id: "spring-boot",
		name: "Spring Boot",
		description:
			"对 Spring Boot 及常见后端开发流程比较熟悉，能完成接口设计、业务分层、项目结构组织与常规服务开发。",
		icon: "logos:spring-icon",
		category: "backend",
		level: "advanced",
		startedAt: "2024-09-08",
		color: "#6DB33F",
	},
	{
		id: "ai-agent",
		name: "AI Agent",
		description:
			"目前重点关注的方向，正在持续探索 AI Agent、工具调用、工作流编排、提示词设计与后端服务结合的实现方式。",
		icon: "material-symbols:smart-toy-outline-rounded",
		category: "backend",
		level: "intermediate",
		startedAt: "2025-09-08",
		color: "#8B5CF6",
	},
	{
		id: "python",
		name: "Python",
		description:
			"主要用于 AI 相关脚本、自动化辅助、数据处理和一些 Agent 实验场景，作为后端探索的辅助能力使用。",
		icon: "logos:python",
		category: "backend",
		level: "intermediate",
		startedAt: "2025-05-08",
		color: "#3776AB",
	},
	{
		id: "nodejs",
		name: "Node.js",
		description:
			"能用于接口调试、小型服务、工具脚本和前端工程配套开发，适合快速完成一些辅助型后端任务。",
		icon: "logos:nodejs-icon",
		category: "backend",
		level: "intermediate",
		startedAt: "2025-05-08",
		color: "#339933",
	},

	// Database Skills
	{
		id: "mysql",
		name: "MySQL",
		description:
			"熟悉常见关系型数据库设计、基础 SQL 编写和后端项目中的数据表结构组织与接口配合。",
		icon: "logos:mysql-icon",
		category: "database",
		level: "advanced",
		startedAt: "2024-07-08",
		color: "#4479A1",
	},
	{
		id: "redis",
		name: "Redis",
		description:
			"了解在后端项目中使用 Redis 处理缓存、临时数据和部分高频访问场景，能够完成基础接入与使用。",
		icon: "logos:redis",
		category: "database",
		level: "intermediate",
		startedAt: "2025-07-08",
		color: "#DC382D",
	},

	// Tools
	{
		id: "git",
		name: "Git",
		description:
			"日常开发中的基础工具，能够完成版本管理、分支协作、代码回溯和常见的项目协同流程。",
		icon: "logos:git-icon",
		category: "tools",
		level: "advanced",
		startedAt: "2023-11-08",
		color: "#F05032",
	},
	{
		id: "intellij",
		name: "IntelliJ IDEA",
		description:
			"Java 后端开发常用主力 IDE，已经能够比较熟练地用于 Spring Boot 项目开发、调试和问题排查。",
		icon: "logos:intellij-idea",
		category: "tools",
		level: "advanced",
		startedAt: "2024-09-08",
		color: "#616161",
	},
	{
		id: "vscode",
		name: "VS Code",
		description:
			"主要用于前端页面、博客内容、脚本修改和 AI 辅助开发场景，配合插件生态使用效率较高。",
		icon: "logos:visual-studio-code",
		category: "tools",
		level: "advanced",
		startedAt: "2024-05-08",
		color: "#007ACC",
	},
	{
		id: "docker",
		name: "Docker",
		description:
			"能够在开发和部署过程中使用 Docker 做环境统一、服务运行和项目辅助配置，适合常见后端场景。",
		icon: "logos:docker-icon",
		category: "tools",
		level: "intermediate",
		startedAt: "2025-07-08",
		color: "#2496ED",
	},
	{
		id: "linux",
		name: "Linux",
		description:
			"具备基础的 Linux 使用与服务端操作能力，能够处理常见部署、运行、日志查看与环境排查工作。",
		icon: "logos:linux-tux",
		category: "tools",
		level: "intermediate",
		startedAt: "2025-01-08",
		color: "#FCC624",
	},
	{
		id: "postman",
		name: "Postman",
		description:
			"用于接口调试、参数验证和联调测试，是后端开发与前后端协作过程中的常用辅助工具。",
		icon: "logos:postman-icon",
		category: "tools",
		level: "intermediate",
		startedAt: "2025-03-08",
		color: "#FF6C37",
	},

	// Other Skills
	{
		id: "ai-coding",
		name: "AI Coding",
		description:
			"前端与内容开发时会大量结合 AI 编程工具进行辅助实现，注重通过高效协作把想法快速落到页面和功能上。",
		icon: "material-symbols:auto-awesome-outline-rounded",
		category: "other",
		level: "advanced",
		startedAt: "2025-07-08",
		color: "#F59E0B",
	},
];
