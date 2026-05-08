// 日记数据配置
// 用于管理日记页面的数据

export interface DiaryItem {
	id: number;
	content: string;
	date: string;
	images?: string[];
	location?: string;
	mood?: string;
	tags?: string[];
}

// 日记数据
const diaryData: DiaryItem[] = [
	{
		id: 1,
		content: `今天开始，这个博客终于认真写下了第一条随记。

想把这里当成一个可以慢慢记录生活、灵感和折腾过程的小角落，不需要太正式，也不用每一次都写得很完美，只想把当下真实留下来。

以后这里会记下做站时的小进展、日常里值得停一停的瞬间，还有那些想认真收藏起来的心情。希望等我回头再看的时候，也能看见自己一点点走过来的样子。`,
		date: "2026-05-08T01:00:40+08:00",
		images: ["/images/diary/2.webp"],
		location: "博客随记",
		mood: "✍️ 第一篇日记",
		tags: ["开站随记", "第一篇"],
	},
];

// 获取日记列表（按时间倒序）
export const getDiaryList = (limit?: number) => {
	const sortedData = [...diaryData].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);

	if (limit && limit > 0) {
		return sortedData.slice(0, limit);
	}

	return sortedData;
};

// 获取所有标签
export const getAllTags = () => {
	const tags = new Set<string>();
	diaryData.forEach((item) => {
		if (item.tags) {
			item.tags.forEach((tag) => tags.add(tag));
		}
	});
	return Array.from(tags).sort();
};
