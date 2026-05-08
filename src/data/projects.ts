// Project data configuration file
// Used to manage data for the project display page

export interface Project {
	id: string;
	title: string;
	description: string;
	image?: string;
	category: "web" | "mobile" | "desktop" | "other";
	techStack: string[];
	status: "completed" | "in-progress" | "planned";
	liveDemo?: string;
	sourceCode?: string;
	sourceLabel?: string;
	sourceIcon?: string;
	visitUrl?: string;
	startDate?: string;
	endDate?: string;
	featured?: boolean;
	tags?: string[];
	showImage?: boolean;
}

export const projectsData: Project[] = [
	{
		id: "kingcola-icg-official-website",
		title: "KingCola学生团队官网",
		description:
			"HNUST：KingCola-ICG学生团队官网，使用 React 与 React Bits 搭建，主要用于展示团队形象、组织介绍、项目成果与整体品牌氛围。",
		category: "web",
		techStack: ["React", "React Bits", "JavaScript", "CSS3"],
		status: "completed",
		sourceCode: "https://github.com/yngang8023/KingCola-ICG-Official-Website",
		sourceLabel: "GitHub",
		sourceIcon: "mdi:github",
		featured: true,
		tags: ["官网", "团队展示", "品牌视觉"],
	},
	{
		id: "kingcola-icg-blog-web",
		title: "KingCola团队博客系统",
		description:
			"Vue 现代化视觉效果的团队博客系统，面向团队内容展示与博客记录场景，强调更清晰的信息组织、页面层次与整体浏览体验。",
		category: "web",
		techStack: ["Vue", "JavaScript", "CSS3", "Web UI"],
		status: "completed",
		sourceCode: "https://gitee.com/yngang/kingcola-icg-blog-web",
		sourceLabel: "Gitee",
		sourceIcon: "simple-icons:gitee",
		featured: true,
		tags: ["团队博客", "内容展示", "视觉设计"],
	},
];

// Get project statistics
export const getProjectStats = () => {
	const total = projectsData.length;
	const completed = projectsData.filter(
		(p) => p.status === "completed",
	).length;
	const inProgress = projectsData.filter(
		(p) => p.status === "in-progress",
	).length;
	const planned = projectsData.filter((p) => p.status === "planned").length;

	return {
		total,
		byStatus: {
			completed,
			inProgress,
			planned,
		},
	};
};

// Get projects by category
export const getProjectsByCategory = (category?: string) => {
	if (!category || category === "all") {
		return projectsData;
	}
	return projectsData.filter((p) => p.category === category);
};

// Get featured projects
export const getFeaturedProjects = () => {
	return projectsData.filter((p) => p.featured);
};

// Get all tech stacks
export const getAllTechStack = () => {
	const techSet = new Set<string>();
	projectsData.forEach((project) => {
		project.techStack.forEach((tech) => {
			techSet.add(tech);
		});
	});
	return Array.from(techSet).sort();
};
