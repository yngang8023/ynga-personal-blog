import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");
const configPath = path.join(rootDir, "src/config.ts");

function runNodeScript(scriptName, { ignoreFailure = false, label } = {}) {
	return new Promise((resolve, reject) => {
		const scriptPath = path.join(scriptsDir, scriptName);
		const child = spawn("node", [scriptPath], {
			stdio: "inherit",
			shell: true,
		});

		child.on("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			const error = new Error(
				`${label || scriptName} exited with code ${code}`,
			);
			if (ignoreFailure) {
				console.warn(`[predev] ${error.message}, continuing...`);
				resolve();
				return;
			}
			reject(error);
		});

		child.on("error", (error) => {
			if (ignoreFailure) {
				console.warn(
					`[predev] Failed to start ${label || scriptName}: ${error.message}`,
				);
				resolve();
				return;
			}
			reject(error);
		});
	});
}

async function readConfigContent() {
	return fs.readFile(configPath, "utf-8");
}

function parseConfigValue(content, sectionName, keyName) {
	const pattern = new RegExp(
		`${sectionName}:\\s*\\{[\\s\\S]*?${keyName}:\\s*["']?([^,"'\\n}]+)["']?`,
	);
	const match = content.match(pattern);
	return match?.[1]?.trim() ?? null;
}

async function resolveAnimeDevTask() {
	const configContent = await readConfigContent();
	const mode = parseConfigValue(configContent, "anime", "mode") || "bangumi";

	if (mode !== "bilibili" && mode !== "bangumi") {
		return null;
	}

	const fetchOnDev =
		parseConfigValue(configContent, mode, "fetchOnDev") === "true";
	if (!fetchOnDev) {
		console.log(`[predev] ${mode} fetchOnDev is off, skipping dev data update.`);
		return null;
	}

	const filename =
		mode === "bilibili" ? "bilibili-data.json" : "bangumi-data.json";
	const scriptName =
		mode === "bilibili" ? "update-bilibili.mjs" : "update-bangumi.mjs";
	const dataFilePath = path.join(rootDir, "src/data", filename);

	try {
		await fs.access(dataFilePath);
		console.log(`[predev] Using existing ${mode} dev data: ${filename}`);
		return null;
	} catch {
		return {
			mode,
			scriptName,
			filename,
		};
	}
}

async function main() {
	await runNodeScript("sync-content.js", {
		ignoreFailure: true,
		label: "sync-content.js",
	});

	const animeTask = await resolveAnimeDevTask();
	if (!animeTask) {
		return;
	}

	console.log(
		`[predev] Missing ${animeTask.filename}, generating ${animeTask.mode} dev data...`,
	);
	await runNodeScript(animeTask.scriptName, {
		ignoreFailure: true,
		label: animeTask.scriptName,
	});
}

main().catch((error) => {
	console.error("[predev] Failed to prepare dev environment:");
	console.error(error);
	process.exit(1);
});
