import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const askYPagePath = path.join(projectRoot, "src", "pages", "ask-y.astro");

test("ask-y page renders an independent fullscreen chat shell with close-back behavior", () => {
	const source = fs.readFileSync(askYPagePath, "utf8");

	assert.match(source, /ASK_Y_PAGE_TITLE/);
	assert.match(source, /<ProtectedRagEmbed/);
	assert.match(source, /pageShell="minimal"/);
	assert.match(source, /disableMusicPlayer=\{true\}/);
	assert.match(source, /class="ask-y-stage"/);
	assert.match(source, /class="ask-y-shell"/);
	assert.match(source, /class="ask-y-panel"/);
	assert.match(source, /class="ask-y-topbar"/);
	assert.match(source, /class="ask-y-chat-shell"/);
	assert.match(source, /data-ask-y-close/);
	assert.match(
		source,
		/<Fragment slot="head">[\s\S]*?name="theme-color"/,
	);
	assert.match(source, /:global\(html,\s*body\)\s*\{[\s\S]*?background:\s*var\(--page-bg/);
	assert.match(source, /ask-y-minimal-page/);
	assert.match(source, /window\.history\.back\(\)/);
	assert.match(source, /window\.location\.href = fallbackPath/);
	assert.match(source, /floating-controls-container/);
	assert.match(source, /music-player/);
	assert.match(source, /position:\s*fixed;/);
	assert.match(source, /inset:\s*0;/);
	assert.match(source, /--primary:\s*oklch\(0\.7 0\.14 var\(--hue, 60\)\);/);
	assert.match(source, /--page-bg:\s*oklch\(0\.95 0\.01 var\(--hue, 60\)\);/);
	assert.match(source, /\.ask-y-stage\[data-ask-y-mode="dark"\]/);
	assert.match(source, /stage\.dataset\.askYMode = doc\.documentElement\.classList\.contains\("dark"\)/);
	assert.match(source, /min-height:\s*max\(0px, calc\(100dvh - 8\.4rem\)\);/);
	assert.match(source, /:global\(html\.ask-y-no-scrollbar\)/);
	assert.match(source, /root\.classList\.add\("ask-y-no-scrollbar"\)/);
	assert.match(source, /root\.classList\.remove\("ask-y-no-scrollbar"\)/);
	assert.match(source, /scrollbar-gutter:\s*auto !important;/);
	assert.match(source, /overflow:\s*hidden !important;/);
	assert.match(source, /--ask-y-heading-color:\s*rgb\(248 250 252 \/ 0\.96\);/);
	assert.match(source, /--ask-y-eyebrow-color:\s*rgb\(248 250 252 \/ 0\.96\);/);
	assert.doesNotMatch(source, /hideSidebars=\{true\}/);
	assert.doesNotMatch(source, /MainGridLayout/);
	assert.doesNotMatch(source, /PageHeader/);
	assert.doesNotMatch(source, /ask-y-overview-grid/);
	assert.doesNotMatch(source, /ask-y-intro-card/);
	assert.doesNotMatch(source, /ask-y-note-card/);
	assert.doesNotMatch(source, /ask-y-page-lock/);
	assert.doesNotMatch(source, /body\.appendChild\(shell\)/);
	assert.doesNotMatch(source, /description=\{ASK_Y_PAGE_SUBTITLE\}/);
	assert.doesNotMatch(source, /<p>\{ASK_Y_PAGE_SUBTITLE\}<\/p>/);
});
