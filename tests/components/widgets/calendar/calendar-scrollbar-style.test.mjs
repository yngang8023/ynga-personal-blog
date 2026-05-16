import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const calendarPath = path.resolve("src/components/widgets/calendar/Calendar.svelte");
const postListPath = path.resolve(
	"src/components/widgets/calendar/components/PostList.svelte",
);

const readSource = (filePath) => readFile(filePath, "utf8");

for (const [name, filePath] of [
	["Calendar.svelte", calendarPath],
	["PostList.svelte", postListPath],
]) {
	test(`${name} uses theme-aware subtle scrollbar styles`, async () => {
		const source = await readSource(filePath);

		assert.match(source, /scrollbar-width:\s*thin;/);
		assert.match(
			source,
			/scrollbar-color:\s*color-mix\(in oklch,\s*var\(--primary\)\s*18%,\s*transparent\)\s+transparent;/,
		);
		assert.match(source, /::-webkit-scrollbar\s*\{[\s\S]*?width:\s*1px;/);
		assert.match(
			source,
			/::-webkit-scrollbar-thumb\s*\{[\s\S]*?background-color:\s*color-mix\([\s\S]*?var\(--primary\)\s*18%,[\s\S]*?transparent[\s\S]*?\);/,
		);
		assert.match(
			source,
			/::-webkit-scrollbar-thumb:hover\s*\{[\s\S]*?background-color:\s*color-mix\([\s\S]*?var\(--primary\)\s*34%,[\s\S]*?transparent[\s\S]*?\);/,
		);
	});
}
