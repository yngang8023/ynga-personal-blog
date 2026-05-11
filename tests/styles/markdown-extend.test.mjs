import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import stylus from "stylus";

const markdownExtendPath = path.resolve("src/styles/markdown-extend.styl");

const readMarkdownExtend = async () => readFile(markdownExtendPath, "utf8");

const renderStylus = (source, filename) =>
	new Promise((resolve, reject) => {
		stylus(source)
			.set("filename", filename)
			.render((error, css) => {
				if (error) {
					reject(error);
					return;
				}

				resolve(css);
			});
	});

test("markdown-extend stylus compiles and keeps PlantUML source panel color-mix output", async () => {
	const source = await readMarkdownExtend();
	const css = await renderStylus(source, markdownExtendPath);

	assert.match(
		css,
		/\.plantuml-source-panel\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--card-bg\) 92%, black 8%\);/,
	);

	assert.match(
		css,
		/\.plantuml-source-btn\[data-copy-state='success'\],\s*\.plantuml-ctrl-btn\[data-copy-state='success'\]\s*\{[\s\S]*?background:\s*#16a34a;/,
	);

	assert.match(
		css,
		/\.mermaid-viewport\s*\{[\s\S]*?height:\s*var\(--mermaid-preview-height,\s*clamp\(240px,\s*48vw,\s*460px\)\);[\s\S]*?overflow:\s*hidden;/,
	);

	assert.match(
		css,
		/\.mermaid-fs-controls\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?top:\s*16px;[\s\S]*?right:\s*16px;/,
	);

	assert.match(
		css,
		/\.dark \.plantuml-fs-content\s*\{[\s\S]*?background:\s*rgba\(5,\s*8,\s*22,\s*0\.96\);/,
	);

	assert.match(
		css,
		/\.plantuml-wrapper\[data-loading='true'\]\s*\.plantuml-loading\s*\{[\s\S]*?opacity:\s*1;/,
	);

	assert.match(
		css,
		/\.plantuml-wrapper\[data-loading='false'\]\s*\.plantuml-loading\s*\{[\s\S]*?opacity:\s*0;/,
	);

	assert.match(
		css,
		/a\.card-github \.gc-stars,\s*\n\s*a\.card-github \.gc-forks,\s*\n\s*a\.card-github \.gc-license,\s*\n\s*a\.card-github \.github-logo,\s*\n\s*a\.card-github \.gitee-logo\s*\{/,
	);

	assert.match(
		css,
		/\.gitee-logo:before\s*\{[\s\S]*?background-color:\s*transparent;[\s\S]*?background-image:\s*url\("data:image\/svg\+xml,[\s\S]*?mask-image:\s*none;/,
	);

	assert.match(
		css,
		/%3Csvg xmlns='http:\/\/www\.w3\.org\/2000\/svg' viewBox='0 0 1024 1024'%3E%3Cpath d='M512 1024C229\.222 1024 0 794\.778 0 512S229\.222 0 512 0s512 229\.222 512 512-229\.222 512-512 512z/,
	);

	assert.match(
		css,
		/\.card-github,\s*\.card-gitee,\s*\.gc-description,/,
	);
});
