import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const markdownCssPath = path.resolve("src/styles/markdown.css");

const readMarkdownCss = async () => readFile(markdownCssPath, "utf8");

test("styles trusted KaTeX helper classes and links for article content", async () => {
	const css = await readMarkdownCss();

	assert.match(
		css,
		/\.katex\s+\.math-accent\s*\{[\s\S]*?color:\s*var\(--primary\);/,
	);

	assert.match(
		css,
		/\.katex\s+\.math-note\s*\{[\s\S]*?background:\s*var\(--btn-plain-bg-hover\);/,
	);

	assert.match(
		css,
		/\.katex-html\s+a\s*\{[\s\S]*?color:\s*var\(--primary\);/,
	);

	assert.match(
		css,
		/&::\-webkit-scrollbar\s*\{[\s\S]*?height:\s*3px;[\s\S]*?width:\s*3px;/,
	);

	assert.match(
		css,
		/&::\-webkit-scrollbar-button\s*\{[\s\S]*?display:\s*none;/,
	);

	assert.match(
		css,
		/scrollbar-width:\s*thin;/,
	);

	assert.match(
		css,
		/counter-reset:\s*theorem-counter lemma-counter;/,
	);

	assert.match(
		css,
		/\.paper-math-cols\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/,
	);

	assert.match(
		css,
		/@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.paper-math-cols\s*\{[\s\S]*?grid-template-columns:\s*1fr;/,
	);

	assert.match(
		css,
		/\.paper-theorem\s*\{[\s\S]*?counter-increment:\s*theorem-counter;/,
	);

	assert.match(
		css,
		/\.paper-lemma\s*\{[\s\S]*?counter-increment:\s*lemma-counter;/,
	);

	assert.match(
		css,
		/\.paper-theorem\s+\.math-statement-kind::before\s*\{[\s\S]*?content:\s*"定理 "\s*counter\(theorem-counter\);/,
	);

	assert.match(
		css,
		/\.paper-lemma\s+\.math-statement-kind::before\s*\{[\s\S]*?content:\s*"引理 "\s*counter\(lemma-counter\);/,
	);

	assert.match(
		css,
		/\.paper-math-long\s+\.katex-display\s*>\s*\.katex\s*\{[\s\S]*?min-width:\s*max-content;/,
	);

	assert.match(
		css,
		/\.image-grid\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/,
	);

	assert.match(
		css,
		/\.image-grid-row\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*repeat\(var\(--image-grid-columns,\s*2\),\s*minmax\(0,\s*1fr\)\);/,
	);

	assert.match(
		css,
		/\.image-grid\[data-gap='sm'\]\s*\{[\s\S]*?--image-grid-gap:\s*0\.6rem;/,
	);

	assert.match(
		css,
		/\.image-grid\[data-gap='lg'\]\s*\{[\s\S]*?--image-grid-gap:\s*1\.25rem;/,
	);

	assert.match(
		css,
		/\.image-grid-figure\s*\{[\s\S]*?display:\s*flex;[\s\S]*?height:\s*100%;/,
	);

	assert.match(
		css,
		/\.image-grid-image\s*\{[\s\S]*?object-fit:\s*cover;/,
	);

	assert.match(
		css,
		/\.image-grid-caption\s*\{[\s\S]*?margin-top:\s*0\.55rem;/,
	);

	assert.match(
		css,
		/@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.custom-md\s*\{[\s\S]*?\.image-grid-row\s*\{[\s\S]*?grid-template-columns:\s*1fr;/,
	);
});
