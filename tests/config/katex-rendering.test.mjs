import assert from "node:assert/strict";
import test from "node:test";
import katex from "katex";

import { katexOptions } from "../../src/utils/katex-options.mjs";

test("expanded academic macros render without leaking raw macro names", () => {
	const html = katex.renderToString(
		String.raw`\softmax(\vct{z})_i + \KL(p \,\|\, q) + \tr(\mat{A}\transpose \mat{A}) + X_1 \iid \mathcal{N}(\mu, \sigma^2) + \dd{f(x)}{x} \at{x=x^\star}`,
		{
			...katexOptions,
			displayMode: true,
		},
	);

	assert.match(html, /<span class="mord boldsymbol"/);
	assert.match(html, /<span class="mord mathbf">A<\/span>/);
	assert.match(html, /<span class="mord mathrm">softmax<\/span>/);
	assert.match(html, /<span class="mord mathrm">KL<\/span>/);
	assert.match(html, /<span class="mord mathrm">tr<\/span>/);
	assert.match(html, /<span class="mord mathsf mtight">T<\/span>/);
	assert.doesNotMatch(html, /color:#cc0000/);
});

test("paper-style formulas written with native KaTeX commands render without raw command leakage", () => {
	const html = katex.renderToString(
		String.raw`p(\boldsymbol{x} \mid y = k) = \frac{1}{(2\pi)^{d/2}\operatorname{det}(\Sigma_k)^{1/2}} \exp\left(-\frac{1}{2}(\boldsymbol{x} - \mu_k)^{\mathsf{T}} \Sigma_k^{-1} (\boldsymbol{x} - \mu_k)\right)`,
		{
			...katexOptions,
			displayMode: true,
		},
	);

	assert.match(html, /<span class="mord boldsymbol"/);
	assert.match(html, /<span class="mop"><span class="mord mathrm">det<\/span><\/span>/);
	assert.match(html, /<span class="mord mathsf mtight">T<\/span>/);
	assert.doesNotMatch(html, /color:#cc0000/);
});
