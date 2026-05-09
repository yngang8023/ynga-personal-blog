import type { CollectionEntry } from "astro:content";

function toValidDate(value: Date | undefined): Date | null {
	if (!(value instanceof Date)) {
		return null;
	}

	return Number.isNaN(value.getTime()) ? null : value;
}

export function resolvePostActivityDate(
	entry: Pick<CollectionEntry<"posts">, "data">,
): Date {
	const updatedDate = toValidDate(entry.data.updated);
	if (updatedDate) {
		return updatedDate;
	}

	return entry.data.published;
}

export function resolveLatestPostActivityDate(
	posts: Pick<CollectionEntry<"posts">, "data">[],
): Date | null {
	if (posts.length === 0) {
		return null;
	}

	return posts.reduce<Date>((latestDate, post) => {
		const activityDate = resolvePostActivityDate(post);
		return activityDate > latestDate ? activityDate : latestDate;
	}, resolvePostActivityDate(posts[0]));
}

export async function resolvePostLastModifiedDate(
	entry: CollectionEntry<"posts">,
): Promise<Date> {
	return resolvePostActivityDate(entry);
}
