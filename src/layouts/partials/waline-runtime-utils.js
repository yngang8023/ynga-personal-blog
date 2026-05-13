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

function isValidCount(value) {
	return typeof value === "number" && !Number.isNaN(value);
}

export function resolveWalineBaseCommentCount({
	displayedCount,
	badgeCount,
	lastKnownCount,
	fallbackCount = 0,
}) {
	if (isValidCount(displayedCount)) {
		return Math.max(0, displayedCount);
	}

	if (isValidCount(badgeCount)) {
		return Math.max(0, badgeCount);
	}

	if (isValidCount(lastKnownCount)) {
		return Math.max(0, lastKnownCount);
	}

	return Math.max(0, fallbackCount);
}

export function applyWalineCommentCountDelta({
	displayedCount,
	badgeCount,
	lastKnownCount,
	delta,
}) {
	return Math.max(
		0,
		resolveWalineBaseCommentCount({
			displayedCount,
			badgeCount,
			lastKnownCount,
		}) + delta,
	);
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

	const countNodeList =
		walineCountContainer.querySelectorAll?.(".wl-num") || null;
	const countElements =
		countNodeList && countNodeList.length > 0
			? Array.from(countNodeList)
			: (() => {
					const singleCountElement =
						walineCountContainer.querySelector?.(".wl-num") ||
						null;
					return singleCountElement ? [singleCountElement] : [];
				})();
	const currentCountElement = countElements[0] || null;

	if (normalizedCount > 0) {
		const nextCountElement =
			currentCountElement ||
			createCountElement?.() ||
			null;

		if (nextCountElement) {
			if (nextCountElement.textContent !== normalizedCount.toString()) {
				nextCountElement.textContent = normalizedCount.toString();
			}

			if (!currentCountElement) {
				walineCountContainer.prepend?.(nextCountElement);
			}
		}

		for (const duplicateCountElement of countElements.slice(1)) {
			duplicateCountElement.remove?.();
		}
	} else {
		for (const countElement of countElements) {
			countElement.remove?.();
		}
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
