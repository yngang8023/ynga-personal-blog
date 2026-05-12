<script lang="ts">
	import { onMount } from "svelte";
	import Icon from "@iconify/svelte";

	type ConfirmTone = "default" | "danger";

	interface ConfirmDialogOptions {
		badge?: string;
		title?: string;
		message: string;
		note?: string;
		confirmText?: string;
		cancelText?: string;
		tone?: ConfirmTone;
	}

	interface ConfirmDialogState extends ConfirmDialogOptions {
		badge: string;
		title: string;
		confirmText: string;
		cancelText: string;
		tone: ConfirmTone;
	}

	const DEFAULT_OPTIONS: ConfirmDialogState = {
		badge: "操作确认",
		title: "确认继续吗？",
		message: "",
		note: "",
		confirmText: "确认",
		cancelText: "取消",
		tone: "default",
	};

	let visible = $state(false);
	let currentDialog = $state<ConfirmDialogState | null>(null);
	let lockedScrollY = 0;
	let resolver: ((value: boolean) => void) | null = null;

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			},
		};
	}

	function lockScroll() {
		lockedScrollY = window.scrollY;
		document.documentElement.classList.add("mizuki-confirm-dialog-open");
		document.body.classList.add("mizuki-confirm-dialog-open");
		document.body.style.top = `-${lockedScrollY}px`;
		document.body.style.position = "fixed";
		document.body.style.width = "100%";
	}

	function unlockScroll() {
		document.body.style.top = "";
		document.body.style.position = "";
		document.body.style.width = "";
		document.documentElement.classList.remove("mizuki-confirm-dialog-open");
		document.body.classList.remove("mizuki-confirm-dialog-open");
		window.scrollTo({ top: lockedScrollY, behavior: "instant" });
	}

	function closeDialog(result = false) {
		visible = false;
		currentDialog = null;
		unlockScroll();

		if (resolver) {
			const resolve = resolver;
			resolver = null;
			resolve(result);
		}
	}

	function openConfirmDialog(options: ConfirmDialogOptions) {
		if (resolver) {
			closeDialog(false);
		}

		currentDialog = {
			...DEFAULT_OPTIONS,
			...options,
		};
		visible = true;
		lockScroll();

		return new Promise<boolean>((resolve) => {
			resolver = resolve;
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!visible) {
			return;
		}

		if (event.key === "Escape") {
			closeDialog(false);
		}
	}

	const isDangerTone = $derived(currentDialog?.tone === "danger");
	const dialogIcon = $derived(
		isDangerTone
			? "material-symbols:delete-outline-rounded"
			: "material-symbols:help-outline-rounded",
	);

	onMount(() => {
		const api = {
			confirm: (options: ConfirmDialogOptions) =>
				openConfirmDialog(options),
		};

		window.__mizukiConfirm = api;
		document.addEventListener("keydown", handleKeydown);

		return () => {
			if (window.__mizukiConfirm === api) {
				delete window.__mizukiConfirm;
			}

			document.removeEventListener("keydown", handleKeydown);
			if (resolver) {
				closeDialog(false);
			}
		};
	});
</script>

{#if visible && currentDialog}
	<div
		use:portal
		class="confirm-dialog fixed inset-0 z-[10010] flex items-center justify-center p-4 md:p-6"
		class:is-danger={isDangerTone}
		aria-modal="true"
		role="dialog"
		aria-labelledby="mizuki-confirm-dialog-title"
		aria-describedby="mizuki-confirm-dialog-message"
		on:click={() => closeDialog(false)}
	>
		<div class="confirm-dialog__backdrop"></div>

		<div class="confirm-dialog__panel card-base" on:click|stopPropagation>
			<div class="confirm-dialog__hero">
				<div class="confirm-dialog__badge">
					<Icon icon={dialogIcon} width="18" />
					<span>{currentDialog.badge}</span>
				</div>

				<h2
					id="mizuki-confirm-dialog-title"
					class="confirm-dialog__title"
				>
					{currentDialog.title}
				</h2>

				<p
					id="mizuki-confirm-dialog-message"
					class="confirm-dialog__message"
				>
					{currentDialog.message}
				</p>

				{#if currentDialog.note}
					<p class="confirm-dialog__note">{currentDialog.note}</p>
				{/if}
			</div>

			<div class="confirm-dialog__actions">
				<button
					type="button"
					class="confirm-dialog__secondary"
					on:click={() => closeDialog(false)}
				>
					<Icon
						icon="material-symbols:arrow-back-rounded"
						width="18"
					/>
					<span>{currentDialog.cancelText}</span>
				</button>
				<button
					type="button"
					class="confirm-dialog__primary"
					on:click={() => closeDialog(true)}
				>
					<Icon icon={dialogIcon} width="18" />
					<span>{currentDialog.confirmText}</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(html.mizuki-confirm-dialog-open),
	:global(body.mizuki-confirm-dialog-open) {
		overflow: hidden;
		scrollbar-gutter: auto;
	}

	:global(html.mizuki-confirm-dialog-open) {
		scrollbar-width: none;
	}

	:global(html.mizuki-confirm-dialog-open::-webkit-scrollbar) {
		width: 0;
		height: 0;
	}

	.confirm-dialog {
		isolation: isolate;
		--confirm-accent: color-mix(in oklab, var(--primary) 72%, white 28%);
		--confirm-accent-soft: color-mix(
			in oklab,
			var(--confirm-accent) 16%,
			transparent
		);
		--confirm-surface: color-mix(
			in oklab,
			var(--confirm-accent) 8%,
			white 92%
		);
		--confirm-border: color-mix(
			in oklab,
			var(--confirm-accent) 22%,
			white 78%
		);
	}

	.confirm-dialog.is-danger {
		--confirm-accent: color-mix(in oklab, #cf4d3c 84%, #f3b287 16%);
	}

	.confirm-dialog__backdrop {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				circle at 18% 18%,
				var(--confirm-accent-soft),
				transparent 34%
			),
			rgba(15, 23, 42, 0.54);
		backdrop-filter: blur(18px);
	}

	.confirm-dialog__panel {
		position: relative;
		z-index: 1;
		width: min(100%, 32rem);
		padding: 1.35rem;
		border-radius: 1.7rem;
		border: 1px solid var(--confirm-border);
		background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.97),
			color-mix(in oklab, white 90%, var(--confirm-accent) 10%)
		);
		box-shadow: 0 32px 96px rgba(15, 23, 42, 0.24);
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	:global(.dark) .confirm-dialog__panel {
		border-color: rgba(255, 255, 255, 0.1);
		background: linear-gradient(
			180deg,
			rgba(16, 23, 37, 0.97),
			color-mix(in oklab, rgb(9 14 24) 86%, var(--confirm-accent) 14%)
		);
		box-shadow: 0 36px 110px rgba(0, 0, 0, 0.46);
	}

	.confirm-dialog__hero {
		display: grid;
		gap: 0.8rem;
	}

	.confirm-dialog__badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		width: fit-content;
		padding: 0.42rem 0.78rem;
		border-radius: 999px;
		font-size: 0.86rem;
		font-weight: 700;
		color: color-mix(in oklab, var(--confirm-accent) 88%, black 12%);
		background: color-mix(in oklab, var(--confirm-accent) 14%, white 86%);
		border: 1px solid
			color-mix(in oklab, var(--confirm-accent) 20%, white 80%);
	}

	:global(.dark) .confirm-dialog__badge {
		color: color-mix(in oklab, var(--confirm-accent) 84%, white 16%);
		background: color-mix(in oklab, var(--confirm-accent) 16%, transparent);
		border-color: color-mix(
			in oklab,
			var(--confirm-accent) 24%,
			transparent
		);
	}

	.confirm-dialog__title {
		margin: 0;
		font-size: 1.34rem;
		font-weight: 800;
		letter-spacing: 0.01em;
		color: rgb(17 24 39 / 0.96);
	}

	:global(.dark) .confirm-dialog__title {
		color: rgb(255 255 255 / 0.94);
	}

	.confirm-dialog__message,
	.confirm-dialog__note {
		margin: 0;
		line-height: 1.75;
	}

	.confirm-dialog__message {
		font-size: 0.98rem;
		color: rgb(51 65 85 / 0.9);
	}

	.confirm-dialog__note {
		font-size: 0.9rem;
		color: rgb(100 116 139 / 0.88);
		padding: 0.85rem 0.95rem;
		border-radius: 1rem;
		background: color-mix(in oklab, var(--confirm-accent) 8%, white 92%);
		border: 1px solid
			color-mix(in oklab, var(--confirm-accent) 14%, white 86%);
	}

	:global(.dark) .confirm-dialog__message {
		color: rgb(226 232 240 / 0.88);
	}

	:global(.dark) .confirm-dialog__note {
		color: rgb(203 213 225 / 0.84);
		background: color-mix(in oklab, var(--confirm-accent) 12%, transparent);
		border-color: color-mix(
			in oklab,
			var(--confirm-accent) 20%,
			transparent
		);
	}

	.confirm-dialog__actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.confirm-dialog__primary,
	.confirm-dialog__secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		min-width: 7.6rem;
		padding: 0.85rem 1.2rem;
		border-radius: 999px;
		font-size: 0.94rem;
		font-weight: 700;
		border: 0;
		cursor: pointer;
		transition:
			transform 160ms ease,
			box-shadow 160ms ease,
			background-color 160ms ease,
			border-color 160ms ease;
	}

	.confirm-dialog__primary {
		color: white;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--confirm-accent) 80%, white 20%),
			var(--confirm-accent)
		);
		box-shadow:
			0 16px 36px
				color-mix(in oklab, var(--confirm-accent) 28%, transparent),
			inset 0 1px 0 rgba(255, 255, 255, 0.18);
	}

	.confirm-dialog__secondary {
		color: rgb(30 41 59 / 0.86);
		background: rgba(255, 255, 255, 0.84);
		border: 1px solid rgba(148, 163, 184, 0.28);
		box-shadow:
			0 10px 26px rgba(15, 23, 42, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.92);
	}

	:global(.dark) .confirm-dialog__secondary {
		color: rgb(241 245 249 / 0.9);
		background: rgba(255, 255, 255, 0.06);
		border-color: rgba(255, 255, 255, 0.1);
		box-shadow:
			0 14px 28px rgba(0, 0, 0, 0.22),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
	}

	.confirm-dialog__primary:hover,
	.confirm-dialog__secondary:hover {
		transform: translateY(-1px);
	}

	.confirm-dialog__primary:active,
	.confirm-dialog__secondary:active {
		transform: translateY(0);
	}

	@media (max-width: 640px) {
		.confirm-dialog__panel {
			padding: 1.1rem;
			border-radius: 1.35rem;
		}

		.confirm-dialog__title {
			font-size: 1.18rem;
		}

		.confirm-dialog__actions {
			flex-direction: column-reverse;
		}

		.confirm-dialog__primary,
		.confirm-dialog__secondary {
			width: 100%;
		}
	}
</style>
