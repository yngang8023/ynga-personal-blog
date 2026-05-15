import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const blogChatPath = path.resolve("cloudflare-rag/app/components/BlogChat.tsx");

test("dark mode user message bubble keeps a dark background and light text", async () => {
	const source = await readFile(blogChatPath, "utf8");

	assert.match(
		source,
		/dark:border-sky-800\/80 dark:bg-sky-950 dark:text-sky-50/,
	);
	assert.match(
		source,
		/prose-p:my-0 prose-a:text-sky-700 prose-a:no-underline hover:prose-a:underline dark:prose-invert dark:prose-p:text-sky-50 dark:prose-li:text-sky-50 dark:prose-strong:text-sky-50 dark:prose-a:text-sky-200/,
	);
});
