import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const handlerPath = path.resolve(
	"src/scripts/handlers/fancybox-handler.ts",
);

test("fancybox handler syncs article gallery bindings to visible images only", async () => {
	const source = await readFile(handlerPath, "utf8");

	assert.match(source, /articleGallerySelector/);
	assert.match(source, /syncArticleGalleryImages\(\)/);
	assert.match(source, /isElementVisible\(element: HTMLElement\)/);
	assert.match(source, /refreshArticleGalleryBinding\(\)/);
	assert.match(source, /window\.addEventListener\("resize"/);
	assert.match(source, /setAttribute\("data-fancybox", "article-gallery"\)/);
	assert.match(source, /unbind\(this\.articleGallerySelector\)/);
});
