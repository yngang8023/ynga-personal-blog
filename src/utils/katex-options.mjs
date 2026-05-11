export const katexMacros = {
	"\\RR": "\\mathbb{R}",
	"\\NN": "\\mathbb{N}",
	"\\ZZ": "\\mathbb{Z}",
	"\\CC": "\\mathbb{C}",
	"\\QQ": "\\mathbb{Q}",
	"\\bm": "\\boldsymbol",
	"\\d": "\\mathrm{d}",
	"\\argmax": "\\operatorname*{arg\\,max}",
	"\\argmin": "\\operatorname*{arg\\,min}",
	"\\grad": "\\nabla",
	"\\E": "\\mathbb{E}",
	"\\Var": "\\operatorname{Var}",
	"\\Cov": "\\operatorname{Cov}",
	"\\tr": "\\operatorname{tr}",
	"\\rank": "\\operatorname{rank}",
	"\\diag": "\\operatorname{diag}",
	"\\softmax": "\\operatorname{softmax}",
	"\\KL": "\\operatorname{KL}",
	"\\iid": "\\overset{\\mathrm{i.i.d.}}{\\sim}",
	"\\transpose": "^{\\mathsf{T}}",
	"\\abs": "\\left\\lvert #1 \\right\\rvert",
	"\\norm": "\\left\\lVert #1 \\right\\rVert",
	"\\set": "\\left\\{ #1 \\right\\}",
	"\\inner": "\\left\\langle #1, #2 \\right\\rangle",
	"\\vct": "\\boldsymbol{#1}",
	"\\mat": "\\mathbf{#1}",
	"\\pd": "\\frac{\\partial #1}{\\partial #2}",
	"\\pdd": "\\frac{\\partial^2 #1}{\\partial #2^2}",
	"\\dd": "\\frac{\\mathrm{d} #1}{\\mathrm{d} #2}",
	"\\at": "\\bigg\\rvert_{#1}",
	"\\given": "\\mathrel{}\\middle\\vert\\mathrel{}",
};

export const allowedKatexProtocols = new Set([
	"https",
	"_relative",
]);

export const allowedKatexHtmlClasses = new Set([
	"math-accent",
	"math-note",
	"math-link",
]);

export const allowedKatexStyleProperties = new Set([
	"background",
	"background-color",
	"border",
	"border-color",
	"border-radius",
	"color",
	"font-weight",
	"padding",
	"padding-block",
	"padding-inline",
]);

const allowedKatexCommands = new Set([
	"\\htmlClass",
	"\\htmlId",
	"\\htmlStyle",
	"\\href",
	"\\url",
]);

const allowedKatexIdPattern = /^math-[a-z0-9_-]{1,40}$/;
const disallowedKatexStylePattern =
	/(?:url\s*\(|expression\s*\(|javascript:|data:|@import|-moz-binding|behavior\s*:)/i;
const allowedKatexStyleValuePattern = /^[a-z0-9#.,()%\s+\-_/]*$/i;

const hasOnlyAllowedKatexClasses = (classValue) => {
	if (typeof classValue !== "string") {
		return false;
	}

	const classNames = classValue
		.split(/\s+/u)
		.map((name) => name.trim())
		.filter(Boolean);

	return (
		classNames.length > 0 &&
		classNames.every((name) => allowedKatexHtmlClasses.has(name))
	);
};

const hasOnlyAllowedKatexStyles = (styleValue) => {
	if (
		typeof styleValue !== "string" ||
		styleValue.trim().length === 0 ||
		styleValue.length > 240 ||
		disallowedKatexStylePattern.test(styleValue)
	) {
		return false;
	}

	const declarations = styleValue
		.split(";")
		.map((declaration) => declaration.trim())
		.filter(Boolean);

	if (declarations.length === 0) {
		return false;
	}

	return declarations.every((declaration) => {
		const separatorIndex = declaration.indexOf(":");

		if (separatorIndex <= 0) {
			return false;
		}

		const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
		const value = declaration.slice(separatorIndex + 1).trim();

		return (
			allowedKatexStyleProperties.has(property) &&
			value.length > 0 &&
			value.length <= 120 &&
			allowedKatexStyleValuePattern.test(value)
		);
	});
};

export const isTrustedKatexCommand = (context) => {
	if (!context || typeof context.command !== "string") {
		return false;
	}

	if (!allowedKatexCommands.has(context.command)) {
		return false;
	}

	if (context.command === "\\href" || context.command === "\\url") {
		return allowedKatexProtocols.has(context.protocol);
	}

	if (context.command === "\\htmlClass") {
		return hasOnlyAllowedKatexClasses(context.class);
	}

	if (context.command === "\\htmlId") {
		return (
			typeof context.id === "string" &&
			allowedKatexIdPattern.test(context.id)
		);
	}

	if (context.command === "\\htmlStyle") {
		return hasOnlyAllowedKatexStyles(context.style);
	}

	return false;
};

export const katexStrict = (errorCode, errorMsg, token) => {
	if (errorCode === "htmlExtension") {
		return "ignore";
	}

	return "warn";
};

export const katexOptions = {
	throwOnError: false,
	maxExpand: 300,
	maxSize: 12,
	strict: katexStrict,
	trust: (context) => isTrustedKatexCommand(context),
	macros: katexMacros,
};
