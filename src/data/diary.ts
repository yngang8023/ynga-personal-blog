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
	{
		id: 2,
		content: `这两天一直在慢慢抠博客上的一些细节，改的都不是那种一眼就能看出来的大东西，更多是评论区的层级、移动端的留白、文章信息的摆放、页面切换时状态能不能跟上这种很碎的小地方。

一开始会觉得这些点太小了，好像不值得来回折腾，但真正一点点修下来才发现，用户停留时顺不顺手、读起来会不会被打断、按钮点下去有没有明确反馈，体验往往就是被这些细节决定的。很多“说不出哪里舒服”的页面，本质上也只是把这些边边角角提前想到了。

现在越来越觉得，做博客不只是把内容发上来就结束了。版式、节奏、反馈、跳转之后那一瞬间的感受，其实也都是内容的一部分。细节抠得足够细，最后留下来的那种舒服感，反而最难被替代。`,
		date: "2026-05-10T02:15:00+08:00",
		images: ["/images/diary/2026-5-10-2-15.webp"],
		location: "博客细节微调",
		mood: "🔧 细节打磨",
		tags: ["博客折腾", "体验优化", "细节微调"],
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
