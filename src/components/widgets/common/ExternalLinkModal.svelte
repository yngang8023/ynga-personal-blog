<script lang="ts">
	import { onMount } from "svelte";
	import Icon from "@iconify/svelte";

	interface ExternalLinkPayload {
		url: string;
		hostname: string;
		title?: string;
	}

	const {
		siteName = "",
		logo = "",
	} = $props<{
		siteName?: string;
		logo?: string;
	}>();

	let visible = $state(false);
	let currentLink = $state<ExternalLinkPayload | null>(null);
	let lockedScrollY = 0;

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

	function closeModal() {
		visible = false;
		currentLink = null;
		document.body.style.top = "";
		document.body.style.position = "";
		document.body.style.width = "";
		document.documentElement.classList.remove("external-link-modal-open");
		document.body.classList.remove("external-link-modal-open");
		window.scrollTo({ top: lockedScrollY, behavior: "instant" });
	}

	function openExternalLink() {
		if (!currentLink) {
			return;
		}

		window.open(currentLink.url, "_blank", "noopener,noreferrer");
		closeModal();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!visible) {
			return;
		}

		if (event.key === "Escape") {
			closeModal();
		}
	}

	onMount(() => {
		const handleOpen = ((event: CustomEvent<ExternalLinkPayload>) => {
			lockedScrollY = window.scrollY;
			currentLink = event.detail;
			visible = true;
			document.documentElement.classList.add("external-link-modal-open");
			document.body.classList.add("external-link-modal-open");
			document.body.style.top = `-${lockedScrollY}px`;
			document.body.style.position = "fixed";
			document.body.style.width = "100%";
		}) as EventListener;

		document.addEventListener("external-link:open-modal", handleOpen);
		document.addEventListener("keydown", handleKeydown);

		return () => {
			document.removeEventListener(
				"external-link:open-modal",
				handleOpen,
			);
			document.removeEventListener("keydown", handleKeydown);
			closeModal();
		};
	});
</script>

{#if visible && currentLink}
	<div
		use:portal
		class="external-link-modal fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-6"
		aria-modal="true"
		role="dialog"
		aria-labelledby="external-link-modal-title"
		on:click={closeModal}
	>
		<div class="external-link-modal__backdrop"></div>

		<div
			class="external-link-modal__panel card-base"
			on:click|stopPropagation
		>
			<div class="external-link-modal__brand">
				{#if logo}
					<img
						src={logo}
						alt={siteName}
						class="external-link-modal__logo"
						loading="lazy"
					/>
				{:else}
					<div class="external-link-modal__logo external-link-modal__logo--fallback">
						{siteName.slice(0, 1)}
					</div>
				{/if}

				<div class="min-w-0">
					<p class="external-link-modal__eyebrow">External Link</p>
					<p class="external-link-modal__brand-name">{siteName}</p>
				</div>
			</div>

			<div class="external-link-modal__hero">
				<div class="external-link-modal__badge">
					<Icon icon="material-symbols:shield-outline-rounded" width="18" />
					<span>外链访问提醒</span>
				</div>
				<h2 id="external-link-modal-title" class="external-link-modal__title">
					即将打开外部网站
				</h2>
				<p class="external-link-modal__desc">
					你仍停留在本站当前页面，确认后会以新标签页打开目标外链。请自行判断目标站点内容与访问风险。
				</p>
			</div>

			<div class="external-link-modal__target">
				<p class="external-link-modal__label">目标站点</p>
				<p class="external-link-modal__host">{currentLink.hostname}</p>
				<p class="external-link-modal__url">{currentLink.url}</p>
			</div>

			<ul class="external-link-modal__tips">
				<li>
					<Icon icon="material-symbols:policy-outline-rounded" width="18" />
					<span>外部站点内容与可用性不受本站控制，请自行甄别。</span>
				</li>
				<li>
					<Icon icon="material-symbols:privacy-tip-outline-rounded" width="18" />
					<span>涉及登录、下载或授权时，请留意账号与隐私安全。</span>
				</li>
			</ul>

			<div class="external-link-modal__actions">
				<button
					type="button"
					class="external-link-modal__secondary"
					on:click={closeModal}
				>
					<Icon icon="material-symbols:close-rounded" width="18" />
					<span>取消</span>
				</button>
				<button
					type="button"
					class="external-link-modal__primary"
					on:click={openExternalLink}
				>
					<Icon icon="material-symbols:open-in-new-rounded" width="18" />
					<span>继续跳转</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(html.external-link-modal-open),
	:global(body.external-link-modal-open) {
		overflow: hidden;
		scrollbar-gutter: auto;
	}

	:global(html.external-link-modal-open) {
		scrollbar-width: none;
	}

	:global(html.external-link-modal-open::-webkit-scrollbar) {
		width: 0;
		height: 0;
	}

	.external-link-modal {
		isolation: isolate;
		--external-link-accent-soft: color-mix(
			in oklab,
			var(--primary) 18%,
			transparent
		);
		--external-link-accent-surface: color-mix(
			in oklab,
			var(--primary) 10%,
			white 90%
		);
		--external-link-accent-surface-strong: color-mix(
			in oklab,
			var(--primary) 18%,
			white 82%
		);
		--external-link-accent-shadow: color-mix(
			in oklab,
			var(--primary) 24%,
			transparent
		);
	}

	.external-link-modal__backdrop {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(
				circle at 20% 20%,
				var(--external-link-accent-soft),
				transparent 34%
			),
			rgba(15, 23, 42, 0.52);
		backdrop-filter: blur(18px);
	}

	.external-link-modal__panel {
		position: relative;
		z-index: 1;
		width: min(100%, 38rem);
		padding: 1.4rem;
		border-radius: 1.8rem;
		border: 1px solid rgba(0, 0, 0, 0.06);
		background:
			linear-gradient(
				180deg,
				rgba(255, 255, 255, 0.97),
				color-mix(in oklab, white 92%, var(--primary) 8%)
			);
		box-shadow: 0 30px 90px rgba(15, 23, 42, 0.24);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	:global(.dark) .external-link-modal__panel {
		border-color: rgba(255, 255, 255, 0.09);
		background:
			linear-gradient(
				180deg,
				rgba(16, 23, 37, 0.96),
				color-mix(in oklab, rgb(9 14 24) 88%, var(--primary) 12%)
			);
		box-shadow: 0 34px 100px rgba(0, 0, 0, 0.46);
	}

	.external-link-modal__brand {
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.external-link-modal__logo {
		width: 3.1rem;
		height: 3.1rem;
		border-radius: 1rem;
		object-fit: cover;
		flex-shrink: 0;
		box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
	}

	.external-link-modal__logo--fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--primary);
		color: white;
		font-weight: 800;
	}

	.external-link-modal__eyebrow {
		margin: 0;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--primary);
		opacity: 0.78;
	}

	.external-link-modal__brand-name {
		margin: 0.18rem 0 0;
		font-size: 1rem;
		font-weight: 800;
		color: rgba(0, 0, 0, 0.84);
	}

	:global(.dark) .external-link-modal__brand-name {
		color: rgba(255, 255, 255, 0.9);
	}

	.external-link-modal__hero {
		padding: 1.1rem 1.1rem 1.2rem;
		border-radius: 1.4rem;
		background:
			radial-gradient(
				circle at top right,
				color-mix(in oklab, var(--primary) 22%, transparent),
				transparent 45%
			),
			linear-gradient(
				150deg,
				color-mix(in oklab, var(--primary) 12%, white 88%),
				color-mix(in oklab, var(--primary) 4%, white 96%) 52%,
				transparent
			);
	}

	:global(.dark) .external-link-modal__hero {
		background:
			radial-gradient(
				circle at top right,
				color-mix(in oklab, var(--primary) 24%, transparent),
				transparent 45%
			),
			linear-gradient(
				150deg,
				color-mix(in oklab, var(--primary) 16%, rgb(18 28 44) 84%),
				color-mix(in oklab, var(--primary) 6%, rgb(11 16 28) 94%) 52%,
				transparent
			);
	}

	.external-link-modal__badge {
		display: inline-flex;
		align-items: center;
		gap: 0.38rem;
		padding: 0.38rem 0.7rem;
		border-radius: 999px;
		background: var(--external-link-accent-surface);
		color: var(--primary);
		font-size: 0.77rem;
		font-weight: 700;
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
	}

	:global(.dark) .external-link-modal__badge {
		background: color-mix(in oklab, var(--primary) 12%, rgb(15 23 42) 88%);
	}

	.external-link-modal__title {
		margin: 0.9rem 0 0;
		font-size: clamp(1.55rem, 3vw, 2rem);
		line-height: 1.15;
		font-weight: 900;
		color: rgba(0, 0, 0, 0.88);
	}

	:global(.dark) .external-link-modal__title {
		color: rgba(255, 255, 255, 0.94);
	}

	.external-link-modal__desc {
		margin: 0.7rem 0 0;
		font-size: 0.95rem;
		line-height: 1.8;
		color: rgba(0, 0, 0, 0.58);
	}

	:global(.dark) .external-link-modal__desc {
		color: rgba(255, 255, 255, 0.62);
	}

	.external-link-modal__target {
		padding: 1rem 1.05rem;
		border-radius: 1.25rem;
		border: 1px solid color-mix(in oklab, var(--primary) 18%, white 82%);
		background: var(--external-link-accent-surface);
	}

	:global(.dark) .external-link-modal__target {
		border-color: color-mix(in oklab, var(--primary) 24%, rgb(15 23 42) 76%);
		background: color-mix(in oklab, var(--primary) 10%, rgb(255 255 255 / 0.04) 90%);
	}

	.external-link-modal__label {
		margin: 0;
		font-size: 0.73rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(0, 0, 0, 0.42);
	}

	:global(.dark) .external-link-modal__label {
		color: rgba(255, 255, 255, 0.4);
	}

	.external-link-modal__host {
		margin: 0.45rem 0 0;
		font-size: 1.08rem;
		font-weight: 800;
		word-break: break-word;
		color: rgba(0, 0, 0, 0.86);
	}

	:global(.dark) .external-link-modal__host {
		color: rgba(255, 255, 255, 0.9);
	}

	.external-link-modal__url {
		margin: 0.32rem 0 0;
		font-size: 0.84rem;
		line-height: 1.7;
		word-break: break-all;
		color: rgba(0, 0, 0, 0.54);
	}

	:global(.dark) .external-link-modal__url {
		color: rgba(255, 255, 255, 0.52);
	}

	.external-link-modal__tips {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.72rem;
	}

	.external-link-modal__tips li {
		display: flex;
		align-items: flex-start;
		gap: 0.62rem;
		font-size: 0.88rem;
		line-height: 1.7;
		color: rgba(0, 0, 0, 0.6);
	}

	:global(.dark) .external-link-modal__tips li {
		color: rgba(255, 255, 255, 0.6);
	}

	.external-link-modal__tips :global(svg) {
		margin-top: 0.12rem;
		flex-shrink: 0;
		color: var(--primary);
	}

	.external-link-modal__actions {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}

	.external-link-modal__primary,
	.external-link-modal__secondary {
		min-height: 3rem;
		border-radius: 1rem;
		font-size: 0.95rem;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			background-color 0.18s ease,
			color 0.18s ease;
	}

	.external-link-modal__primary {
		border: 1px solid color-mix(in oklab, var(--primary) 34%, white 66%);
		color: rgba(15, 23, 42, 0.88);
		cursor: pointer;
		background: var(--external-link-accent-surface-strong);
		box-shadow: 0 18px 38px var(--external-link-accent-shadow);
	}

	:global(.dark) .external-link-modal__primary {
		border-color: color-mix(in oklab, var(--primary) 40%, rgb(18 28 44) 60%);
		color: rgba(255, 255, 255, 0.92);
		background: color-mix(in oklab, var(--primary) 24%, rgb(18 28 44) 76%);
	}

	.external-link-modal__primary:hover {
		transform: translateY(-1px);
		box-shadow: 0 22px 44px color-mix(in oklab, var(--primary) 28%, transparent);
	}

	.external-link-modal__primary:active,
	.external-link-modal__secondary:active {
		transform: scale(0.985);
	}

	.external-link-modal__secondary {
		border: 1px solid rgba(0, 0, 0, 0.06);
		background: rgba(255, 255, 255, 0.72);
		color: rgba(0, 0, 0, 0.72);
		cursor: pointer;
	}

	:global(.dark) .external-link-modal__secondary {
		border-color: rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.05);
		color: rgba(255, 255, 255, 0.82);
	}

	@media (min-width: 640px) {
		.external-link-modal__actions {
			grid-template-columns: 0.9fr 1.1fr;
		}
	}

	@media (max-width: 640px) {
		.external-link-modal__panel {
			padding: 1.05rem;
			border-radius: 1.45rem;
		}

		.external-link-modal__hero {
			padding: 1rem;
		}
	}
</style>
