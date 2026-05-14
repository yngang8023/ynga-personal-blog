#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { collectBlogRagPosts } from "./blog-rag-sync-utils.mjs";
import { loadEnv } from "./load-env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const configPath = path.resolve(rootDir, "src/config.ts");

loadEnv();

function readExportedStringConstant(sourceFile, constantName) {
	for (const statement of sourceFile.statements) {
		if (!ts.isVariableStatement(statement)) {
			continue;
		}

		const isExported = statement.modifiers?.some(
			(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
		);
		if (!isExported) {
			continue;
		}

		for (const declaration of statement.declarationList.declarations) {
			if (
				!ts.isIdentifier(declaration.name) ||
				declaration.name.text !== constantName
			) {
				continue;
			}

			const initializer = declaration.initializer;
			if (
				initializer &&
				(ts.isStringLiteral(initializer) ||
				 ts.isNoSubstitutionTemplateLiteral(initializer))
			) {
				return initializer.text;
			}
		}
	}

	throw new Error(`Missing exported string constant ${constantName} in src/config.ts`);
}

function readBlogRagDefaults() {
	const configSource = readFileSync(configPath, "utf8");
	const sourceFile = ts.createSourceFile(
		configPath,
		configSource,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);

	return {
		endpoint: readExportedStringConstant(sourceFile, "BLOG_RAG_SYNC_ENDPOINT"),
		siteURL: readExportedStringConstant(sourceFile, "BLOG_RAG_SITE_URL"),
	};
}

function hasFlag(name) {
	return process.argv.includes(name);
}

function readConfig() {
	const defaults = readBlogRagDefaults();
	const endpoint = process.env.BLOG_RAG_SYNC_ENDPOINT || defaults.endpoint;
	const token = process.env.BLOG_RAG_SYNC_TOKEN || process.env.RAG_SYNC_TOKEN || "";
	const siteURL = process.env.BLOG_RAG_SITE_URL || defaults.siteURL;
	const dryRun = hasFlag("--dry-run");

	return { endpoint, token, siteURL, dryRun };
}

async function syncPosts({ endpoint, token, siteURL, posts }) {
	if (!token) {
		throw new Error(
			"Missing BLOG_RAG_SYNC_TOKEN or RAG_SYNC_TOKEN. Put it in .env or CI secrets.",
		);
	}

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({ siteURL, posts }),
	});

	const text = await response.text();
	let payload;
	try {
		payload = JSON.parse(text);
	} catch {
		payload = { raw: text };
	}

	if (!response.ok) {
		throw new Error(
			`RAG sync failed with HTTP ${response.status}: ${JSON.stringify(payload)}`,
		);
	}

	return payload;
}

async function main() {
	const config = readConfig();
	const posts = await collectBlogRagPosts({
		rootDir,
		siteURL: config.siteURL,
	});

	console.log(`准备同步 ${posts.length} 篇公开博客文章目录到 RAG 知识库。`);
	console.log(`同步地址：${config.endpoint}`);

	if (config.dryRun) {
		console.log("\nDry run 模式，不会发送请求。");
		console.log(
			JSON.stringify(
				{
					count: posts.length,
					posts: posts.map((post) => ({
						id: post.id,
						url: post.url,
						entryPath: post.entryPath,
						fileCount: post.files.length,
						imageCount: post.files.filter((file) =>
							file.contentType.startsWith("image/"),
						).length,
						contentHash: post.contentHash,
					})),
				},
				null,
				2,
			),
		);
		return;
	}

	const result = await syncPosts({
		endpoint: config.endpoint,
		token: config.token,
		siteURL: config.siteURL,
		posts,
	});

	console.log("RAG 知识库同步完成：");
	console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});
