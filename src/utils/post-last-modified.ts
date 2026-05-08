import { stat } from "node:fs/promises";
import path from "node:path";

import type { CollectionEntry } from "astro:content";

function toValidDate(value: Date | undefined): Date | null {
	if (!(value instanceof Date)) {
		return null;
	}

	return Number.isNaN(value.getTime()) ? null : value;
}

async function getFileLastModifiedDate(
	filePath: string | undefined,
): Promise<Date | null> {
	if (!filePath) {
		return null;
	}

	try {
		const absolutePath = path.resolve(process.cwd(), filePath);
		const fileStat = await stat(absolutePath);
		return toValidDate(fileStat.mtime);
	} catch {
		return null;
	}
}

export async function resolvePostLastModifiedDate(
	entry: CollectionEntry<"posts">,
): Promise<Date> {
	const fileLastModified = await getFileLastModifiedDate(entry.filePath);
	if (fileLastModified) {
		return fileLastModified;
	}

	const updatedDate = toValidDate(entry.data.updated);
	if (updatedDate) {
		return updatedDate;
	}

	return entry.data.published;
}
