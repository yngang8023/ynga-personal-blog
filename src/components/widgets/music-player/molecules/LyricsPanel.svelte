<script lang="ts">
	import Key from "../../../../i18n/i18nKey";
	import { i18n } from "../../../../i18n/translation";
	import AccordionDrawer from "../../common/AccordionDrawer.svelte";
	import type {
		LyricLine,
		LyricsStatus,
	} from "../utils/lyrics";

	interface Props {
		show: boolean;
		lyrics: LyricLine[];
		lyricsStatus: LyricsStatus;
		currentLyricIndex: number;
		onLyricClick: (time: number) => void;
	}

	const {
		show,
		lyrics,
		lyricsStatus,
		currentLyricIndex,
		onLyricClick,
	}: Props = $props();

	let container: HTMLDivElement | undefined;
	let userScrolling = false;
	let scrollTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!show || currentLyricIndex < 0 || userScrolling) {
			return;
		}

		requestAnimationFrame(() => {
			const active = container?.querySelector<HTMLElement>(
				`[data-lyric-index="${currentLyricIndex}"]`,
			);
			active?.scrollIntoView({
				block: "center",
				behavior: "smooth",
			});
		});
	});

	function markUserScrolling() {
		userScrolling = true;
		if (scrollTimer) {
			clearTimeout(scrollTimer);
		}
		scrollTimer = setTimeout(() => {
			userScrolling = false;
		}, 2400);
	}

	function getEmptyLabel() {
		if (lyricsStatus === "loading") {
			return i18n(Key.musicPlayerLyricsLoading);
		}

		if (lyricsStatus === "failed") {
			return i18n(Key.musicPlayerLyricsFailed);
		}

		return i18n(Key.musicPlayerLyricsEmpty);
	}
</script>

<AccordionDrawer {show} class="lyrics-drawer">
	<div class="lyrics-shell">
		<div
			bind:this={container}
			class="lyrics-content"
			role="group"
			aria-label={i18n(Key.musicPlayerLyrics)}
			onwheel={markUserScrolling}
			ontouchstart={markUserScrolling}
		>
			{#if lyrics.length > 0}
				{#each lyrics as line, index}
					<button
						type="button"
						class="lyrics-line"
						class:active={index === currentLyricIndex}
						data-lyric-index={index}
						aria-current={index === currentLyricIndex}
						onclick={() => onLyricClick(line.time)}
					>
						{line.text}
					</button>
				{/each}
			{:else}
				<div class="lyrics-empty">
					{getEmptyLabel()}
				</div>
			{/if}
		</div>
	</div>
</AccordionDrawer>

<style>
	:global(.lyrics-drawer) {
		margin-top: 0;
	}

	.lyrics-shell {
		margin-top: 0.5rem;
		padding-top: 0.6rem;
		border-top: 1px solid
			color-mix(in srgb, var(--content-meta) 12%, transparent 88%);
	}

	.lyrics-content {
		max-height: 12rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
		padding: 3.5rem 0.25rem;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.lyrics-content::-webkit-scrollbar {
		display: none;
	}

	.lyrics-line {
		width: 100%;
		border: 0;
		border-radius: 0.7rem;
		padding: 0.28rem 0.45rem;
		background: transparent;
		color: var(--content-meta);
		font-size: 0.78rem;
		line-height: 1.45;
		text-align: center;
		cursor: pointer;
		transition:
			color 180ms ease,
			background-color 180ms ease,
			transform 180ms ease,
			font-size 180ms ease;
	}

	.lyrics-line:hover,
	.lyrics-line:focus-visible {
		color: var(--primary);
		background: color-mix(in srgb, var(--primary) 8%, transparent);
		outline: none;
	}

	.lyrics-line.active {
		color: var(--primary);
		font-weight: 700;
		font-size: 0.9rem;
		transform: scale(1.02);
		background: color-mix(in srgb, var(--primary) 10%, transparent);
	}

	.lyrics-empty {
		padding: 2.8rem 0.5rem;
		color: var(--content-meta);
		text-align: center;
		font-size: 0.82rem;
	}

	@media (max-width: 520px) {
		.lyrics-content {
			max-height: 10.5rem;
			padding-block: 3rem;
		}

		.lyrics-line {
			font-size: 0.74rem;
		}

		.lyrics-line.active {
			font-size: 0.84rem;
		}
	}
</style>
