import { visit } from "unist-util-visit";

import {
	buildUrl,
	encodePlantUML,
	injectBackgroundColor,
	injectTheme,
} from "./plantuml-encoder.js";

const DEFAULT_OPTIONS = {
	enable: true,
	servers: [
		"https://uml.planttext.com/plantuml",
		"https://www.plantuml.com/plantuml",
	],
	lightTheme: "",
	lightBackgroundColor: "",
	darkTheme: "cyborg",
	darkBackgroundColor: "#050816",
};

const PLANTUML_LANGUAGES = new Set(["plantuml", "puml", "uml"]);

function resolveServers(config) {
	const input =
		Array.isArray(config.servers) && config.servers.length > 0
			? config.servers
			: config.server
				? [config.server]
				: DEFAULT_OPTIONS.servers;

	return Array.from(
		new Set(
			input
				.map((server) =>
					typeof server === "string" ? server.trim().replace(/\/+$/, "") : "",
				)
				.filter(Boolean),
		),
	);
}

export function remarkPlantuml(options = {}) {
	const config = { ...DEFAULT_OPTIONS, ...options };
	const servers = resolveServers(config);

	return (tree) => {
		if (config.enable === false) {
			return;
		}

		visit(tree, "code", (node) => {
			const lang = typeof node.lang === "string" ? node.lang.toLowerCase() : "";
			if (!PLANTUML_LANGUAGES.has(lang)) {
				return;
			}

			const code = typeof node.value === "string" ? node.value : "";
			if (!code.trim()) {
				return;
			}

			const lightSource = injectBackgroundColor(
				injectTheme(code, config.lightTheme),
				config.lightBackgroundColor,
			);
			const darkSource = injectBackgroundColor(
				injectTheme(code, config.darkTheme),
				config.darkBackgroundColor,
			);
			const lightEncoded = encodePlantUML(lightSource);
			const darkEncoded = encodePlantUML(darkSource);
			const lightUrls = servers.map((server) => buildUrl(server, lightEncoded));
			const darkUrls =
				darkSource === lightSource
					? lightUrls
					: servers.map((server) => buildUrl(server, darkEncoded));
			const lightUrl = lightUrls[0];
			const darkUrl = darkUrls[0] || lightUrl;

			node.type = "plantuml";
			node.data = {
				hName: "div",
				hProperties: {
					className: ["plantuml-container"],
					"data-plantuml-light": lightUrl,
					"data-plantuml-dark": darkUrl,
					"data-plantuml-light-sources": JSON.stringify(lightUrls),
					"data-plantuml-dark-sources": JSON.stringify(darkUrls),
					"data-plantuml-alt": code.slice(0, 200),
				},
				hChildren: [{ type: "text", value: code }],
			};
			node.value = undefined;
		});
	};
}
