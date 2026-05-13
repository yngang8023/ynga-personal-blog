export interface LyricLine {
	time: number;
	text: string;
}

export type LyricsStatus = "none" | "loading" | "loaded" | "failed";

export interface LyricsResult {
	lines: LyricLine[];
	status: LyricsStatus;
}

const LRC_TIME_PATTERN = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

function normalizeMilliseconds(value: string | undefined): number {
	if (!value) {
		return 0;
	}

	if (value.length === 1) {
		return Number(value) / 10;
	}

	if (value.length === 2) {
		return Number(value) / 100;
	}

	return Number(value.padEnd(3, "0").slice(0, 3)) / 1000;
}

export function parseLrc(source: string): LyricLine[] {
	if (!source.trim()) {
		return [];
	}

	const lines: LyricLine[] = [];

	for (const rawLine of source.split(/\r?\n/)) {
		const matches = Array.from(rawLine.matchAll(LRC_TIME_PATTERN));
		if (matches.length === 0) {
			continue;
		}

		const text = rawLine.replace(LRC_TIME_PATTERN, "").trim();
		if (!text) {
			continue;
		}

		for (const match of matches) {
			const minutes = Number(match[1]);
			const seconds = Number(match[2]);
			const milliseconds = normalizeMilliseconds(match[3]);

			if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
				continue;
			}

			lines.push({
				time: minutes * 60 + seconds + milliseconds,
				text,
			});
		}
	}

	return lines.sort((a, b) => a.time - b.time);
}

function isLyricsUrl(source: string): boolean {
	return (
		/^(https?:)?\/\//i.test(source) ||
		source.startsWith("/") ||
		/\.(lrc|txt)(\?|#|$)/i.test(source)
	);
}

function toAssetUrl(source: string): string {
	if (
		/^(https?:)?\/\//i.test(source) ||
		source.startsWith("/") ||
		source.startsWith("data:")
	) {
		return source;
	}

	return `/${source}`;
}

export async function resolveLyrics(source: string | undefined): Promise<LyricsResult> {
	const lrc = source?.trim() ?? "";

	if (!lrc) {
		return { lines: [], status: "none" };
	}

	if (!isLyricsUrl(lrc)) {
		const lines = parseLrc(lrc);
		return {
			lines,
			status: lines.length > 0 ? "loaded" : "none",
		};
	}

	try {
		const response = await fetch(toAssetUrl(lrc), { cache: "force-cache" });
		if (!response.ok) {
			return { lines: [], status: "failed" };
		}

		const lines = parseLrc(await response.text());
		return {
			lines,
			status: lines.length > 0 ? "loaded" : "none",
		};
	} catch {
		return { lines: [], status: "failed" };
	}
}
