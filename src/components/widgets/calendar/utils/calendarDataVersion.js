function normalizeDate(value) {
	return value instanceof Date ? value.toISOString() : "";
}

function hashText(input) {
	let hash = 2166136261;
	for (let index = 0; index < input.length; index += 1) {
		hash ^= input.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

export function createCalendarDataVersion(posts) {
	const payload = posts
		.map((post) => {
			const id = post?.id ?? "";
			const title = post?.data?.title ?? "";
			const publishedText = normalizeDate(post?.data?.published);
			const updatedText = normalizeDate(post?.data?.updated);
			return `${id}:${title}:${publishedText}:${updatedText}`;
		})
		.join("|");

	return hashText(payload);
}
