import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const articlePath = path.resolve("src/content/posts/website-make-demo/index.md");

test("website-make-demo keeps the website-card override example outside the previous code fence", async () => {
	const source = await readFile(articlePath, "utf8");

	assert.match(
		source,
		/```md\s*\n::site\{url="ynga\.kingcola-icg\.cn"\}\s*\n```/,
	);
	assert.match(
		source,
		/如果目标站点本身没有做好 SEO 元数据，也可以手动覆盖卡片信息：\s*\n\s*```md/,
	);
});

test("website-make-demo documents gitee cards and chemical equation examples", async () => {
	const source = await readFile(articlePath, "utf8");

	assert.match(
		source,
		/::gitee\{repo="[^"\n]+\/[^"\n]+"\}/,
	);
	assert.match(
		source,
		/\\ce\{CH4 \+ 2O2 -> CO2 \+ 2H2O\}/,
	);
	assert.match(
		source,
		/\\pu\{[\s\S]*?mol/,
	);
	assert.match(
		source,
		/\\begin\{aligned\}/,
	);
	assert.match(
		source,
		/\\cancel\{/,
	);
	assert.match(
		source,
		/\\htmlClass\{/,
	);
	assert.match(
		source,
		/\\htmlStyle\{/,
	);
	assert.match(
		source,
		/\\textcolor\{/,
	);
	assert.match(
		source,
		/\\href\{/,
	);
	assert.match(
		source,
		/\\url\{/,
	);
	assert.match(
		source,
		/\\tag\{/,
	);
	assert.match(
		source,
		/\\argmin_\{x \\in \\RR\}/,
	);
	assert.match(
		source,
		/x\^\\star/,
	);
	assert.match(
		source,
		/\\E\[/,
	);
	assert.match(
		source,
		/\\Var\(/,
	);
	assert.match(
		source,
		/\\Cov\(/,
	);
	assert.match(
		source,
		/\\norm\{/,
	);
	assert.match(
		source,
		/\\inner\{/,
	);
	assert.match(
		source,
		/\\pd\{/,
	);
	assert.match(
		source,
		/机器学习常用模板/,
	);
	assert.match(
		source,
		/线性代数常用模板/,
	);
	assert.match(
		source,
		/概率统计常用模板/,
	);
	assert.match(
		source,
		/优化问题常用模板/,
	);
	assert.match(
		source,
		/\\begin\{array\}/,
	);
	assert.doesNotMatch(
		source,
		/\\vct\{|\\mat\{|\\softmax\(|\\KL\\bigl|\\tr\(|\\rank\(|\\diag\(|\\iid|\\transpose|\\dd\{|\\at\{|\\given/,
	);
	assert.match(
		source,
		/\\operatorname\{softmax\}/,
	);
	assert.match(
		source,
		/\\operatorname\{KL\}/,
	);
	assert.match(
		source,
		/\\operatorname\{rank\}/,
	);
	assert.match(
		source,
		/\\operatorname\{tr\}/,
	);
	assert.match(
		source,
		/\\mathbf\{A\}/,
	);
	assert.match(
		source,
		/\\boldsymbol\{x\}/,
	);
	assert.match(
		source,
		/\\overset\{\\mathrm\{i\.i\.d\.\}\}\{\\sim\}/,
	);
	assert.match(
		source,
		/\\frac\{\\mathrm\{d\} f\(x\)\}\{\\mathrm\{d\} x\}/,
	);
	assert.match(
		source,
		/\\bigg\\rvert_\{x=x\^\\star\}/,
	);
	assert.match(
		source,
		/\\mid/,
	);
	assert.match(
		source,
		/\\operatorname\{det\}/,
	);
});

test("website-make-demo documents unified paper-style math layout directives", async () => {
	const source = await readFile(articlePath, "utf8");

	assert.match(source, /论文风格统一排版/);
	assert.match(source, /::::math-compact\[[^\]]+\]/);
	assert.match(source, /::::math-cols/);
	assert.match(source, /:::math-col\[[^\]]+\]/);
	assert.match(source, /::::theorem\[[^\]]+\]/);
	assert.match(source, /::::lemma\[[^\]]*\]/);
	assert.match(source, /::::math-long\[[^\]]+\]/);
	assert.match(source, /长公式保持单行展示并支持左右滚动/);
});

test("website-make-demo documents Firefly-style image grid syntax and local demo images", async () => {
	const source = await readFile(articlePath, "utf8");

	assert.match(source, /图片画廊网格/);
	assert.match(source, /\[grid\]/);
	assert.match(source, /\[\/grid\]/);
	assert.match(source, /!\[.*?\]\(\.\/1\.webp\)/);
	assert.match(source, /!\[.*?\]\(\.\/2\.webp\)/);
	assert.match(source, /!\[.*?\]\(\.\/3\.webp\)/);
	assert.match(source, /!\[.*?\]\(\.\/4\.webp(?:\s+"[^"]*")?\)/);
	assert.match(source, /\[grid cols=2\]/);
	assert.match(source, /多行多列/);
	assert.match(source, /\[grid cols=4 desktop=true tablet=true tabletCols=3 mobile=true mobileCols=2\]/);
	assert.match(source, /\[grid cols=4 desktop=true tablet=false mobile=false\]/);
	assert.match(source, /\[grid cols=3 desktop=false tablet=true tabletCols=3 mobile=false\]/);
	assert.match(source, /\[grid cols=2 desktop=false tablet=false mobile=true mobileCols=2\]/);
	assert.match(source, /\[grid rows=2 cols=3\]/);
	assert.match(source, /\[grid layout="4,3,2,1"\]/);
	assert.match(source, /\[grid cols=3 gap=lg\]/);
	assert.match(source, /\[grid cols=4 mobile=2 tablet=3\]/);
	assert.match(source, /新增语法说明/);
	assert.match(source, /desktop=true\|false/);
	assert.match(source, /tabletCols=1~3/);
	assert.match(source, /mobileCols=1~2/);
	assert.match(source, /默认都按 `true` 处理/);
	assert.match(source, /gap=sm\|md\|lg/);
});
