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
		abortCommentCount: commentCount({
			serverURL,
			path,
			lang,
			selector: commentSelector,
		}),
		abortPageviewCount: pageviewCount({
			serverURL,
			path,
			lang,
			selector: pageviewSelector,
			update: false,
		}),
	};
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
