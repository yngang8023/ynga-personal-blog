import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const cardTocPath = path.resolve("src/components/widgets/card-toc/CardTOC.astro");

test("card toc supports post navigation items before falling back to heading toc", async () => {
	const source = await readFile(cardTocPath, "utf8");

	assert.match(source, /postNavigationItems\?:/);
	assert.match(source, /const hasPostNavigation = postNavigationItems\.length > 0/);
	assert.match(source, /data-card-toc-mode=\{hasPostNavigation \? "posts" : "headings"\}/);
	assert.match(source, /postNavigationItems\.map\(\(item, index\) =>/);
	assert.match(source, /href=\{item\.href\}/);
	assert.match(source, /item\.label/);
	assert.match(source, /item\.meta/);
	assert.match(source, /syncCardTocModeFromMainContent\(root, tocContent\)/);
	assert.match(source, /document\.querySelectorAll\("a\[data-card-toc-post-source\]"\)/);
	assert.match(source, /root\.dataset\.cardTocMode = "posts"/);
	assert.match(source, /root\.dataset\.cardTocMode = "headings"/);
	assert.match(source, /tocContent\.innerHTML = ""/);
	assert.match(source, /if \(mode === "posts"\) \{/);
	assert.match(source, /querySelectorAll\("a\[data-card-toc-post-link\]"\)/);
	assert.match(source, /:global\(\.card-toc-post-copy \.toc-label\)\s*\{/);
	assert.match(source, /white-space:\s*normal;/);
	assert.match(source, /max-width:\s*100%;/);
	assert.match(source, /:global\(\.card-toc-post-meta\)\s*\{/);
	assert.match(
		source,
		/color:\s*color-mix\(in oklab,\s*var\(--primary\)\s*70%,\s*var\(--content-meta\)\);/,
	);
	assert.doesNotMatch(source, /当前页面没有目录/);
});

test("post cards expose stable data for rebuilding home page card toc after swup navigation", async () => {
	const source = await readFile(
		path.resolve("src/components/features/posts/PostCard.astro"),
		"utf8",
	);

	assert.match(source, /data-card-toc-post-source/);
	assert.match(source, /data-card-toc-post-title=\{title\}/);
	assert.match(source, /data-card-toc-post-meta=\{tocMeta\}/);
});
