import { commentCount as walineCommentCount } from "@waline/client/comment";
import { pageviewCount as walinePageviewCount } from "@waline/client/pageview";

const DEFAULT_COMMENT_SELECTOR = ".waline-comment-count";
const DEFAULT_PAGEVIEW_SELECTOR = ".waline-pageview-count";

const DEFAULT_DELETE_DIALOG_OPTIONS = {
	badge: "评论操作",
	title: "删除这条评论？",
	message: "删除后将无法恢复，这条评论会从当前页面永久移除。",
	confirmText: "确认删除",
	cancelText: "先保留",
	tone: "danger",
};

export function refreshWalineStats({
	serverURL,
	path,
	lang,
	commentSelector = DEFAULT_COMMENT_SELECTOR,
	pageviewSelector = DEFAULT_PAGEVIEW_SELECTOR,
	refreshCommentCount = true,
	commentCount = walineCommentCount,
	pageviewCount = walinePageviewCount,
}) {
	if (!serverURL) {
		return {
			abortCommentCount: null,
			abortPageviewCount: null,
		};
	}

	return {
		abortCommentCount: refreshCommentCount
			? commentCount({
					serverURL,
					path,
					lang,
					selector: commentSelector,
				})
			: null,
		abortPageviewCount: pageviewCount({
			serverURL,
			path,
			lang,
			selector: pageviewSelector,
			update: false,
		}),
	};
}

function isWalineCardItem(node) {
	return (
		node &&
		typeof node === "object" &&
		"classList" in node &&
		typeof node.classList?.contains === "function" &&
		node.classList.contains("wl-card-item")
	);
}

export function getWalineCommentMutationDelta(mutations) {
	let addedCount = 0;
	let removedCount = 0;

	for (const mutation of mutations) {
		if (mutation?.type !== "childList") {
			continue;
		}

		addedCount += Array.from(mutation.addedNodes || []).filter(
			isWalineCardItem,
		).length;
		removedCount += Array.from(mutation.removedNodes || []).filter(
			isWalineCardItem,
		).length;
	}

	if (addedCount === 1 && removedCount === 0) {
		return 1;
	}

	if (removedCount === 1 && addedCount === 0) {
		return -1;
	}

	return 0;
}

export function resolveWalineCommentCount({
	displayedCount,
	lastKnownCount,
	pendingRootDelta = 0,
}) {
	const hasDisplayedCount =
		typeof displayedCount === "number" &&
		!Number.isNaN(displayedCount);
	const hasLastKnownCount =
		typeof lastKnownCount === "number" &&
		!Number.isNaN(lastKnownCount);

	if (pendingRootDelta === 0) {
		if (hasLastKnownCount) {
			return Math.max(0, lastKnownCount);
		}

		if (hasDisplayedCount) {
			return Math.max(0, displayedCount);
		}

		return null;
	}

	if (hasLastKnownCount) {
		return Math.max(0, lastKnownCount + pendingRootDelta);
	}

	if (hasDisplayedCount) {
		return Math.max(0, displayedCount + pendingRootDelta);
	}

	return null;
}

/**
 * @param {{
 *   count: number | null;
 *   badgeElement?: HTMLElement | null;
 *   walineCountContainer?: HTMLElement | null;
 *   createCountElement?: (() => HTMLElement | null) | undefined;
 * }} options
 * @returns {number | null}
 */
export function syncWalineCommentCountDisplay({
	count,
	badgeElement = null,
	walineCountContainer = null,
	createCountElement,
}) {
	if (typeof count !== "number" || Number.isNaN(count)) {
		return null;
	}

	const normalizedCount = Math.max(0, count);

	if (badgeElement) {
		badgeElement.textContent = normalizedCount.toString();
	}

	if (!walineCountContainer) {
		return normalizedCount;
	}

	const currentCountElement =
		walineCountContainer.querySelector?.(".wl-num") || null;

	if (normalizedCount > 0) {
		if (currentCountElement) {
			currentCountElement.textContent = normalizedCount.toString();
		}

		const nextCountElement =
			currentCountElement ||
			createCountElement?.() ||
			null;

		if (nextCountElement) {
			nextCountElement.textContent =
				normalizedCount.toString();

			if (!currentCountElement) {
				walineCountContainer.prepend?.(nextCountElement);
			}
		}
	} else if (currentCountElement) {
		currentCountElement.remove?.();
	}

	return normalizedCount;
}

export function matchWalineDeleteButton(target, containerId = "waline") {
	if (!(target instanceof Element)) {
		return null;
	}

	return target.closest(`#${containerId} .wl-delete`);
}

export function createWalineDeleteConfirmBridge({
	resolveConfirm,
	nativeConfirm,
	matchDeleteButton = matchWalineDeleteButton,
	buildDialogOptions = () => DEFAULT_DELETE_DIALOG_OPTIONS,
}) {
	let allowNextNativeConfirm = false;
	const approvedButtons = new WeakSet();
	const fallbackConfirm =
		nativeConfirm || ((message) => window.confirm(message));

	return {
		confirm(message) {
			if (allowNextNativeConfirm) {
				allowNextNativeConfirm = false;
				return true;
			}

			return fallbackConfirm(message);
		},
		handleDeleteClick(event) {
			const deleteButton = matchDeleteButton(event.target);

			if (!deleteButton) {
				return;
			}

			if (approvedButtons.has(deleteButton)) {
				approvedButtons.delete(deleteButton);
				return;
			}

			const confirmHandler = resolveConfirm?.() || null;

			if (!confirmHandler) {
				return;
			}

			event.preventDefault?.();
			event.stopImmediatePropagation?.();
			event.stopPropagation?.();

			Promise.resolve(confirmHandler(buildDialogOptions()))
				.then((confirmed) => {
					if (!confirmed) {
						return;
					}

					approvedButtons.add(deleteButton);
					allowNextNativeConfirm = true;
					deleteButton.click();
				})
				.catch((error) => {
					console.error("[Waline] 删除确认弹窗调用失败:", error);
				});
		},
		reset() {
			allowNextNativeConfirm = false;
		},
	};
}

export function teardownWalineInstance(instance, mountedContainer) {
	if (!instance) {
		return {
			destroyed: false,
			reason: "missing-instance",
		};
	}

	if (!mountedContainer?.isConnected) {
		return {
			destroyed: false,
			reason: "detached-container",
		};
	}

	try {
		instance.destroy();
	} catch (error) {
		return {
			destroyed: false,
			reason: "destroy-failed",
			error,
		};
	}

	return {
		destroyed: true,
		reason: "destroyed",
	};
}
