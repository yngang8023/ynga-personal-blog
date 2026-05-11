import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const astroConfigPath = path.resolve("astro.config.mjs");
const walineRuntimePath = path.resolve("src/layouts/partials/WalineRuntime.astro");
const katexOptionsPath = path.resolve("src/utils/katex-options.mjs");

test("markdown pipeline enables KaTeX mhchem support for article rendering", async () => {
	const source = await readFile(astroConfigPath, "utf8");

	assert.match(source, /import\s+["']katex\/contrib\/mhchem["'];/);
	assert.match(source, /rehypeKatex/);
	assert.match(source, /import\s+\{\s*katexOptions\s*\}\s+from\s+["']\.\/src\/utils\/katex-options\.mjs["'];/);
	assert.match(source, /\[rehypeKatex,\s*katexOptions\]/);
});

test("shared katex options keep enhanced macros with constrained trust boundaries", async () => {
	const source = await readFile(katexOptionsPath, "utf8");

	assert.match(source, /"\\\\E":/);
	assert.match(source, /"\\\\Var":/);
	assert.match(source, /"\\\\Cov":/);
	assert.match(source, /"\\\\tr":/);
	assert.match(source, /"\\\\rank":/);
	assert.match(source, /"\\\\diag":/);
	assert.match(source, /"\\\\softmax":/);
	assert.match(source, /"\\\\KL":/);
	assert.match(source, /"\\\\iid":/);
	assert.match(source, /"\\\\given":/);
	assert.match(source, /"\\\\transpose":/);
	assert.match(source, /"\\\\norm":/);
	assert.match(source, /"\\\\inner":/);
	assert.match(source, /"\\\\pd":/);
	assert.match(source, /"\\\\pdd":/);
	assert.match(source, /const allowedKatexProtocols = new Set\(\[[\s\S]*?"https"[\s\S]*?"_relative"[\s\S]*?\]\)/);
	assert.match(source, /const allowedKatexHtmlClasses = new Set\(\[[\s\S]*?"math-accent"[\s\S]*?"math-note"[\s\S]*?"math-link"[\s\S]*?\]\)/);
	assert.match(source, /const allowedKatexStyleProperties = new Set\(/);
	assert.match(source, /context\.protocol/);
	assert.match(source, /context\.class/);
	assert.match(source, /context\.style/);
	assert.match(source, /maxExpand:\s*300/);
	assert.match(source, /maxSize:\s*12/);
});

test("Waline preview runtime enables KaTeX mhchem support for comment rendering", async () => {
	const source = await readFile(walineRuntimePath, "utf8");

	assert.match(source, /import\s+["']katex\/contrib\/mhchem["'];/);
	assert.match(source, /katex\.renderToString\(tex,\s*\{/);
	assert.match(source, /import\s+\{[\s\S]*?isTrustedKatexCommand,[\s\S]*?katexMacros,[\s\S]*?katexStrict,[\s\S]*?\}\s+from\s+["']\.\.\/\.\.\/utils\/katex-options\.mjs["'];/);
	assert.match(source, /strict:\s*katexStrict/);
	assert.match(source, /macros:\s*katexMacros/);
	assert.match(source, /trust:\s*\(context:\s*\{[^}]*command:\s*string/);
});

test("markdown pipeline registers paper-style math layout directives and invalidates digest on component changes", async () => {
	const source = await readFile(astroConfigPath, "utf8");

	assert.match(
		source,
		/import\s+\{[\s\S]*?MathColComponent,[\s\S]*?MathColsComponent,[\s\S]*?MathCompactComponent,[\s\S]*?MathLongComponent,[\s\S]*?MathStatementComponent[\s\S]*?\}\s+from\s+["']\.\/src\/plugins\/rehype-component-math-layout\.mjs["'];/,
	);
	assert.match(source, /\.\/src\/plugins\/rehype-component-math-layout\.mjs/);
	assert.match(source, /"math-compact":\s*MathCompactComponent/);
	assert.match(source, /"math-cols":\s*MathColsComponent/);
	assert.match(source, /"math-col":\s*MathColComponent/);
	assert.match(source, /theorem:\s*\(x,\s*y\)\s*=>\s*MathStatementComponent\(x,\s*y,\s*"theorem"\)/);
	assert.match(source, /lemma:\s*\(x,\s*y\)\s*=>\s*MathStatementComponent\(x,\s*y,\s*"lemma"\)/);
	assert.match(source, /"math-long":\s*MathLongComponent/);
});

test("markdown pipeline enables Firefly-style [grid] image gallery syntax", async () => {
	const source = await readFile(astroConfigPath, "utf8");

	assert.match(
		source,
		/import\s+\{\s*remarkImageGrid\s*\}\s+from\s+["']\.\/src\/plugins\/remark-image-grid\.js["'];/,
	);
	assert.match(source, /\.\/src\/plugins\/remark-image-grid\.js/);
	assert.match(source, /remarkDirective,/);
	assert.match(source, /remarkImageGrid,/);
	assert.match(source, /"image-grid":\s*ImageGridComponent/);
});
