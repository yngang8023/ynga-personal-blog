(() => {
	if (window.plantumlInitialized) {
		return;
	}

	window.plantumlInitialized = true;

	const MIN_SCALE = 0.5;
	const MAX_SCALE = 5;
	const SCALE_STEP = 1.2;
	const PRELOAD_MARGIN = "240px 0px 240px 0px";
	const ACTIVATION_MARGIN = "540px 0px 540px 0px";
	const PLANTUML_PLACEHOLDER_SVG =
		"data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3C/svg%3E";
	const PLANTUML_PLACEHOLDER_PREFIX = "data:image/svg+xml";
	const fullscreenOverlays = new Set();
	const imagePreloadCache = new Map();
	const loadedImageSources = new Set();
	let activationObserver = null;
	let interactionObserver = null;
	let preloadBatchToken = 0;
	let themeApplyFrame = 0;

	function getCurrentThemeMode() {
		return document.documentElement.classList.contains("dark")
			? "dark"
			: "light";
	}

	function getOppositeThemeMode(themeMode) {
		return themeMode === "dark" ? "light" : "dark";
	}

	function scheduleIdleWork(callback) {
		if ("requestIdleCallback" in window) {
			window.requestIdleCallback(callback, { timeout: 900 });
			return;
		}

		window.setTimeout(
			() =>
				callback({
					didTimeout: true,
					timeRemaining: () => 0,
				}),
			40,
		);
	}

	function decodeBase64Utf8(value) {
		if (!value) {
			return "";
		}

		try {
			const binary = atob(value);
			const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

			if (typeof TextDecoder !== "undefined") {
				return new TextDecoder().decode(bytes);
			}

			return binary;
		} catch {
			return "";
		}
	}

	function getSourceCode(container) {
		const wrapper = container.querySelector(".plantuml-wrapper");
		const encoded =
			wrapper?.getAttribute("data-source-base64") ||
			wrapper?.dataset?.sourceBase64 ||
			"";
		return decodeBase64Utf8(encoded).trim();
	}

	function parseSourceList(value) {
		if (!value) {
			return [];
		}

		if (Array.isArray(value)) {
			return value
				.map((item) => (typeof item === "string" ? item.trim() : ""))
				.filter(Boolean);
		}

		if (typeof value !== "string") {
			return [];
		}

		const trimmed = value.trim();
		if (!trimmed) {
			return [];
		}

		if (trimmed.startsWith("[")) {
			try {
				return parseSourceList(JSON.parse(trimmed));
			} catch {
				return [];
			}
		}

		return [trimmed];
	}

	function getWrapper(container) {
		return container?.querySelector(".plantuml-wrapper") || null;
	}

	function getLoadingNode(wrapper) {
		return wrapper?.querySelector(".plantuml-loading") || null;
	}

	function ensureLoadingNode(wrapper) {
		if (!wrapper) {
			return null;
		}

		const existing = getLoadingNode(wrapper);
		if (existing) {
			return existing;
		}

		const loading = document.createElement("div");
		loading.className = "plantuml-loading";
		loading.textContent = "PlantUML 图表加载中...";
		wrapper.prepend(loading);
		return loading;
	}

	function setLoadingState(container, loading, label = "PlantUML 图表加载中...") {
		const wrapper = getWrapper(container);
		if (!wrapper) {
			return;
		}

		const loadingNode = ensureLoadingNode(wrapper);
		if (loadingNode) {
			loadingNode.textContent = label;
		}

		wrapper.setAttribute("data-loading", loading ? "true" : "false");
	}

	function markSourceLoaded(src) {
		if (src) {
			loadedImageSources.add(src);
		}
	}

	function isSourceLoaded(src) {
		return Boolean(src && loadedImageSources.has(src));
	}

	function preloadPlantumlSource(src) {
		if (!src) {
			return Promise.resolve("");
		}

		if (isSourceLoaded(src)) {
			return Promise.resolve(src);
		}

		const cached = imagePreloadCache.get(src);
		if (cached) {
			return cached;
		}

		const promise = new Promise((resolve, reject) => {
			const preloader = new Image();
			preloader.decoding = "async";
			let settled = false;

			const finalize = () => {
				if (settled) {
					return;
				}

				settled = true;
				markSourceLoaded(src);
				resolve(src);
			};

			preloader.addEventListener(
				"load",
				() => {
					if (typeof preloader.decode === "function") {
						preloader.decode().catch(() => undefined).finally(finalize);
						return;
					}

					finalize();
				},
				{ once: true },
			);
			preloader.addEventListener(
				"error",
				() => {
					settled = true;
					imagePreloadCache.delete(src);
					reject(new Error(`Failed to preload PlantUML image: ${src}`));
				},
				{ once: true },
			);
			preloader.src = src;

			if (preloader.complete && preloader.naturalWidth > 0) {
				queueMicrotask(finalize);
			}
		});

		imagePreloadCache.set(src, promise);
		return promise;
	}

	function setTemporaryButtonLabel(
		button,
		nextText,
		defaultText,
		state = "",
		delay = 1600,
	) {
		if (!button) {
			return;
		}

		button.textContent = nextText;
		if (state) {
			button.setAttribute("data-copy-state", state);
		} else {
			button.removeAttribute("data-copy-state");
		}
		window.clearTimeout(button.__plantumlResetTimer);
		button.__plantumlResetTimer = window.setTimeout(() => {
			button.textContent = defaultText;
			button.removeAttribute("data-copy-state");
		}, delay);
	}

	function copyTextUsingExecCommand(text) {
		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.setAttribute("readonly", "");
		textarea.setAttribute("aria-hidden", "true");
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		textarea.style.pointerEvents = "none";
		textarea.style.left = "-9999px";
		textarea.style.top = "0";
		textarea.style.contain = "strict";
		document.body.appendChild(textarea);

		const selection = document.getSelection();
		const originalRanges = [];
		if (selection) {
			for (let index = 0; index < selection.rangeCount; index += 1) {
				originalRanges.push(selection.getRangeAt(index));
			}
		}

		textarea.focus({ preventScroll: true });
		textarea.select();
		textarea.setSelectionRange(0, textarea.value.length);

		let copied = false;
		try {
			copied = document.execCommand("copy");
		} catch {
			copied = false;
		} finally {
			textarea.remove();
			if (selection) {
				selection.removeAllRanges();
				originalRanges.forEach((range) => selection.addRange(range));
			}
		}

		return copied;
	}

	function selectNodeText(node) {
		if (!node) {
			return false;
		}

		const selection = window.getSelection?.();
		if (!selection) {
			return false;
		}

		const range = document.createRange();
		range.selectNodeContents(node);
		selection.removeAllRanges();
		selection.addRange(range);
		return true;
	}

	async function copyText(text, fallbackNode) {
		if (!text) {
			return { copied: false, manual: false };
		}

		if (copyTextUsingExecCommand(text)) {
			return { copied: true, manual: false };
		}

		if (navigator.clipboard?.writeText) {
			try {
				await navigator.clipboard.writeText(text);
				return { copied: true, manual: false };
			} catch {
				// Continue to the manual fallback when clipboard access is denied.
			}
		}

		try {
			selectNodeText(fallbackNode);
			window.prompt("复制失败，请手动复制下面的源码：", text);
		} catch {
			return { copied: false, manual: false };
		}

		return { copied: false, manual: true };
	}

	async function copySourceWithFeedback(button, sourceCode, fallbackNode) {
		const defaultText = "复制源码";
		if (!sourceCode) {
			setTemporaryButtonLabel(button, "暂无源码", defaultText, "warning");
			return false;
		}

		const result = await copyText(sourceCode, fallbackNode);
		setTemporaryButtonLabel(
			button,
			result.copied
				? "复制成功"
				: result.manual
					? "请手动复制"
					: "复制失败",
			defaultText,
			result.copied ? "success" : result.manual ? "warning" : "error",
			result.manual ? 2200 : 1600,
		);
		return result.copied;
	}

	function createSourcePanel(container) {
		const panel = document.createElement("div");
		panel.className = "plantuml-source-panel";
		panel.hidden = true;

		const actions = document.createElement("div");
		actions.className = "plantuml-source-actions";

		const copyButton = document.createElement("button");
		copyButton.type = "button";
		copyButton.className = "plantuml-source-btn";
		copyButton.textContent = "复制源码";

		const code = document.createElement("pre");
		code.className = "plantuml-source-code";

		const source = getSourceCode(container);
		code.textContent = source;

		copyButton.addEventListener("click", async (event) => {
			event.preventDefault();
			event.stopPropagation();
			await copySourceWithFeedback(copyButton, source, code);
		});

		actions.appendChild(copyButton);
		panel.appendChild(actions);
		panel.appendChild(code);
		container.appendChild(panel);

		return panel;
	}

	function getThemeSourceForImage(img, themeMode) {
		return getThemeSourcesForImage(img, themeMode)[0] || "";
	}

	function getContainerImages(container) {
		return Array.from(container?.querySelectorAll(".plantuml-image") || []);
	}

	function getThemeImage(container, themeMode) {
		return (
			container?.querySelector(`.plantuml-image[data-plantuml-theme="${themeMode}"]`) ||
			null
		);
	}

	function getActiveThemeImage(container) {
		const themeMode = container?.dataset.activeThemeMode || getCurrentThemeMode();
		return getThemeImage(container, themeMode) || container?.querySelector(".plantuml-image") || null;
	}

	function cloneThemeImage(img, themeMode) {
		const nextImg = new Image();
		nextImg.className =
			themeMode === "dark"
				? "plantuml-image plantuml-image-dark"
				: "plantuml-image plantuml-image-light";
		nextImg.alt = img?.alt || "PlantUML diagram";
		nextImg.src = PLANTUML_PLACEHOLDER_SVG;
		nextImg.hidden = themeMode !== "light";
		nextImg.setAttribute("data-plantuml-theme", themeMode);
		nextImg.setAttribute(
			"data-light-src",
			img?.getAttribute("data-light-src") || "",
		);
		nextImg.setAttribute(
			"data-dark-src",
			img?.getAttribute("data-dark-src") || "",
		);
		nextImg.setAttribute(
			"data-light-sources",
			img?.getAttribute("data-light-sources") || "",
		);
		nextImg.setAttribute(
			"data-dark-sources",
			img?.getAttribute("data-dark-sources") || "",
		);
		nextImg.loading = "lazy";
		nextImg.decoding = "async";
		return nextImg;
	}

	function ensureResidentImages(container) {
		const wrapper = getWrapper(container);
		if (!wrapper) {
			return [];
		}

		const images = getContainerImages(container);
		if (images.length >= 2) {
			return images;
		}

		const firstImage = images[0];
		if (!firstImage) {
			return [];
		}

		const lightImage =
			getThemeImage(container, "light") ||
			(firstImage.getAttribute("data-plantuml-theme") === "light"
				? firstImage
				: cloneThemeImage(firstImage, "light"));
		const darkImage =
			getThemeImage(container, "dark") ||
			(firstImage.getAttribute("data-plantuml-theme") === "dark"
				? firstImage
				: cloneThemeImage(firstImage, "dark"));

		if (!lightImage.isConnected) {
			wrapper.appendChild(lightImage);
		}
		if (!darkImage.isConnected) {
			wrapper.appendChild(darkImage);
		}

		return [lightImage, darkImage];
	}

	function updateImageVisibility(container, themeMode) {
		const images = getContainerImages(container);
		images.forEach((img) => {
			const isActiveThemeImage =
				(img.getAttribute("data-plantuml-theme") || "light") === themeMode;
			img.hidden = !isActiveThemeImage;
			img.setAttribute("aria-hidden", isActiveThemeImage ? "false" : "true");
		});
		container.dataset.activeThemeMode = themeMode;
	}

	function getThemeSourcesForImage(img, themeMode) {
		const lightSources = parseSourceList(
			img.getAttribute("data-light-sources") || img.dataset.lightSources || "",
		);
		const darkSources = parseSourceList(
			img.getAttribute("data-dark-sources") || img.dataset.darkSources || "",
		);
		const fallbackLight = img.getAttribute("data-light-src") || "";
		const fallbackDark = img.getAttribute("data-dark-src") || fallbackLight;

		const light = lightSources.length > 0 ? lightSources : [fallbackLight].filter(Boolean);
		const dark = darkSources.length > 0 ? darkSources : [fallbackDark].filter(Boolean);

		return themeMode === "dark" ? dark : light;
	}

	function isPlaceholderSource(src) {
		return typeof src === "string" && src.startsWith(PLANTUML_PLACEHOLDER_PREFIX);
	}

	function scheduleThemePreload(themeMode, containers) {
		const queue = containers
			.filter((container) => container?.dataset?.plantumlActivated === "true")
			.flatMap((container) => getContainerImages(container))
			.flatMap((img) => getThemeSourcesForImage(img, themeMode))
			.filter(Boolean)
			.slice(0, 4);

		if (queue.length === 0) {
			return;
		}

		const token = ++preloadBatchToken;
		const pump = (deadline) => {
			if (token !== preloadBatchToken) {
				return;
			}

			while (queue.length > 0) {
				if (
					deadline &&
					!deadline.didTimeout &&
					typeof deadline.timeRemaining === "function" &&
					deadline.timeRemaining() < 8
				) {
					break;
				}

				const nextSrc = queue.shift();
				if (isSourceLoaded(nextSrc)) {
					continue;
				}

				void preloadPlantumlSource(nextSrc).catch(() => undefined);
			}

			if (queue.length > 0) {
				scheduleIdleWork(pump);
			}
		};

		scheduleIdleWork(pump);
	}

	function swapThemeImage(container, img, nextSrc, requestId, themeMode) {
		if (!nextSrc || img.dataset.themeRequestId !== requestId) {
			return;
		}

		if (img.getAttribute("src") !== nextSrc) {
			img.setAttribute("src", nextSrc);
		}
		img.dataset.activeThemeMode = themeMode;
		img.dataset.activeSrc = nextSrc;

		if (isSourceLoaded(nextSrc)) {
			setLoadingState(container, false);
		}
	}

	async function resolveThemeSource(container, img, themeMode, requestId) {
		const candidates = getThemeSourcesForImage(img, themeMode);
		if (candidates.length === 0) {
			return "";
		}

		for (const candidate of candidates) {
			if (!candidate) {
				continue;
			}

			try {
				if (!isSourceLoaded(candidate)) {
					await preloadPlantumlSource(candidate);
				}
				swapThemeImage(container, img, candidate, requestId, themeMode);
				return candidate;
			} catch {
				continue;
			}
		}

		return "";
	}

	function applyThemeToContainer(
		container,
		themeMode = getCurrentThemeMode(),
		options = {},
	) {
		const images = ensureResidentImages(container);
		const activeImage = getThemeImage(container, themeMode);
		if (images.length === 0 || !activeImage) {
			return;
		}

		const force = options.force === true;
		const sources = getThemeSourcesForImage(activeImage, themeMode);
		if (sources.length === 0) {
			return;
		}

		const currentSrc = activeImage.getAttribute("src") || "";
		const activeTheme = container.dataset.activeThemeMode || "";
		if (
			!force &&
			activeTheme === themeMode &&
			currentSrc &&
			!isPlaceholderSource(currentSrc) &&
			isSourceLoaded(currentSrc)
		) {
			updateImageVisibility(container, themeMode);
			setLoadingState(container, false);
			return;
		}

		const requestId = String(
			Math.max(
				0,
				...images.map((img) =>
					Number.parseInt(img.dataset.themeRequestId || "0", 10),
				),
			) + 1,
		);
		images.forEach((img) => {
			img.dataset.themeRequestId = requestId;
		});
		container.dataset.pendingThemeMode = themeMode;
		setLoadingState(container, true);

		void Promise.allSettled(
			images.map((img) => {
				const targetTheme = img.getAttribute("data-plantuml-theme") || "light";
				return resolveThemeSource(container, img, targetTheme, requestId);
			}),
		).then((results) => {
			if (images.some((img) => img.dataset.themeRequestId !== requestId)) {
				return;
			}

			updateImageVisibility(container, themeMode);

			const resolved = results
				.map((result) =>
					result.status === "fulfilled" ? result.value : "",
				)
				.filter(Boolean);
			if (resolved.length > 0) {
				setLoadingState(container, false);
				observeInteraction(container);
				return;
			}

			container.dataset.errorShown = "true";
			setLoadingState(container, false);
			const wrapper = getWrapper(container);
			if (!wrapper) {
				return;
			}

			wrapper.innerHTML = "";
			const errorBox = document.createElement("div");
			errorBox.className = "plantuml-error";

			const msg = document.createElement("p");
			msg.textContent = "PlantUML 图表加载失败，请检查网络或服务器状态";

			const retry = document.createElement("button");
			retry.type = "button";
			retry.textContent = "重试";
			retry.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				delete container.dataset.errorShown;
				wrapper.innerHTML = "";
				wrapper.setAttribute("data-loading", "false");

				const loading = document.createElement("div");
				loading.className = "plantuml-loading";
				loading.textContent = "PlantUML 图表加载中...";
				wrapper.appendChild(loading);

				const seedImage = activeImage || images[0];
				const newLightImg = cloneThemeImage(seedImage, "light");
				const newDarkImg = cloneThemeImage(seedImage, "dark");

				wrapper.appendChild(newLightImg);
				wrapper.appendChild(newDarkImg);
				bindErrorHandler(newLightImg, container);
				bindLoadHandler(newLightImg, container);
				bindErrorHandler(newDarkImg, container);
				bindLoadHandler(newDarkImg, container);
				activateContainer(container, { force: true });
			});

			errorBox.appendChild(msg);
			errorBox.appendChild(retry);
			wrapper.appendChild(errorBox);
		});
	}

	function applyTheme(themeMode = getCurrentThemeMode()) {
		const containers = Array.from(
			document.querySelectorAll(".plantuml-diagram-container"),
		);

		containers.forEach((container) => {
			if (container.dataset.plantumlActivated !== "true") {
				container.dataset.pendingThemeMode = themeMode;
				return;
			}
			applyThemeToContainer(container, themeMode);
		});

		scheduleThemePreload(getOppositeThemeMode(themeMode), containers);
	}

	function scheduleThemeApply() {
		window.cancelAnimationFrame(themeApplyFrame);
		themeApplyFrame = window.requestAnimationFrame(() => {
			themeApplyFrame = 0;
			applyTheme(getCurrentThemeMode());
		});
	}

	function bindErrorHandler(img, container) {
		if (img.dataset.errorBound === "true") {
			return;
		}

		img.dataset.errorBound = "true";
		img.addEventListener("error", () => {
			if (isPlaceholderSource(img.currentSrc || img.getAttribute("src") || "")) {
				return;
			}

			if (container.dataset.errorShown === "true") {
				return;
			}

			container.dataset.errorShown = "true";
			setLoadingState(container, false);
			const wrapper = container.querySelector(".plantuml-wrapper");
			if (!wrapper) {
				return;
			}

			wrapper.innerHTML = "";
			const errorBox = document.createElement("div");
			errorBox.className = "plantuml-error";

			const msg = document.createElement("p");
			msg.textContent = "PlantUML 图表加载失败，请检查网络或服务器状态";

			const retry = document.createElement("button");
			retry.type = "button";
			retry.textContent = "重试";
			retry.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				delete container.dataset.errorShown;
				wrapper.innerHTML = "";
				wrapper.setAttribute("data-loading", "true");

				const loading = document.createElement("div");
				loading.className = "plantuml-loading";
				loading.textContent = "PlantUML 图表加载中...";
				wrapper.appendChild(loading);

				const newLightImg = cloneThemeImage(img, "light");
				const newDarkImg = cloneThemeImage(img, "dark");

				wrapper.appendChild(newLightImg);
				wrapper.appendChild(newDarkImg);
				bindErrorHandler(newLightImg, container);
				bindLoadHandler(newLightImg, container);
				bindErrorHandler(newDarkImg, container);
				bindLoadHandler(newDarkImg, container);
				activateContainer(container, { force: true });
			});

			errorBox.appendChild(msg);
			errorBox.appendChild(retry);
			wrapper.appendChild(errorBox);
		});
	}

	function bindLoadHandler(img, container) {
		if (img.dataset.loadBound === "true") {
			return;
		}

		img.dataset.loadBound = "true";
		const onLoad = () => {
			const currentSrc = img.currentSrc || img.getAttribute("src") || "";
			if (isPlaceholderSource(currentSrc)) {
				return;
			}

			markSourceLoaded(currentSrc);
			setLoadingState(container, false);
			observeInteraction(container);
		};

		img.addEventListener("load", onLoad);

		if (img.complete && img.naturalWidth > 0) {
			queueMicrotask(onLoad);
		}
	}

	function isLikelyVisible(element) {
		const rect = element.getBoundingClientRect();
		const viewportHeight =
			window.innerHeight || document.documentElement.clientHeight || 0;
		return rect.bottom >= -120 && rect.top <= viewportHeight + 200;
	}

	function ensureInteractionObserver() {
		if (interactionObserver || typeof IntersectionObserver === "undefined") {
			return;
		}

		interactionObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue;
					}

					interactionObserver.unobserve(entry.target);
					initInteraction(entry.target);
				}
			},
			{
				rootMargin: PRELOAD_MARGIN,
				threshold: 0.01,
			},
		);
	}

	function ensureActivationObserver() {
		if (activationObserver || typeof IntersectionObserver === "undefined") {
			return;
		}

		activationObserver = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue;
					}

					activationObserver.unobserve(entry.target);
					activateContainer(entry.target);
				}
			},
			{
				rootMargin: ACTIVATION_MARGIN,
				threshold: 0.01,
			},
		);
	}

	function activateContainer(container, options = {}) {
		if (!container) {
			return;
		}

		if (options.force === true) {
			container.dataset.plantumlActivated = "false";
		}

		if (container.dataset.plantumlActivated === "true") {
			applyThemeToContainer(
				container,
				container.dataset.pendingThemeMode || getCurrentThemeMode(),
				options,
			);
			return;
		}

		container.dataset.plantumlActivated = "true";
		applyThemeToContainer(
			container,
			container.dataset.pendingThemeMode || getCurrentThemeMode(),
			options,
		);
	}

	function observeActivation(container) {
		if (!container || container.dataset.plantumlObserved === "true") {
			return;
		}

		container.dataset.plantumlObserved = "true";
		if (isLikelyVisible(container) || typeof IntersectionObserver === "undefined") {
			activateContainer(container);
			return;
		}

		ensureActivationObserver();
		activationObserver?.observe(container);
	}

	function observeInteraction(container) {
		if (!container || container.dataset.interactionInit === "true") {
			return;
		}

		if (isLikelyVisible(container) || typeof IntersectionObserver === "undefined") {
			initInteraction(container);
			return;
		}

		ensureInteractionObserver();
		interactionObserver?.observe(container);
	}

	function initInteraction(container) {
		if (container.dataset.interactionInit === "true") {
			return;
		}

		const img = getActiveThemeImage(container);
		if (!img) {
			return;
		}

		container.dataset.interactionInit = "true";

		const state = { scale: 1, translateX: 0, translateY: 0 };
		const sourceCode = getSourceCode(container);
		const sourcePanel = createSourcePanel(container);
		const getInteractiveImage = () => getActiveThemeImage(container);
		const toggleSource = () => {
			sourcePanel.hidden = !sourcePanel.hidden;
		};
		const openOriginal = () => {
			const currentSrc = getInteractiveImage()?.getAttribute("src");
			if (!currentSrc) {
				return;
			}

			window.open(currentSrc, "_blank", "noopener,noreferrer");
		};

		const applyTransform = () => {
			const currentImg = getInteractiveImage();
			if (!currentImg) {
				return;
			}
			getContainerImages(container).forEach((node) => {
				node.style.transformOrigin = "center center";
				node.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
			});
		};

		const clampScale = (next) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));

		const reset = () => {
			state.scale = 1;
			state.translateX = 0;
			state.translateY = 0;
			applyTransform();
		};

		const zoomBy = (factor, originX, originY) => {
			const prev = state.scale;
			const next = clampScale(prev * factor);
			if (next === prev) {
				return;
			}

			if (typeof originX === "number" && typeof originY === "number") {
				const rect = (getInteractiveImage() || img).getBoundingClientRect();
				const cx = rect.left + rect.width / 2;
				const cy = rect.top + rect.height / 2;
				const dx = originX - cx;
				const dy = originY - cy;
				const ratio = next / prev;
				state.translateX = state.translateX - dx * (ratio - 1);
				state.translateY = state.translateY - dy * (ratio - 1);
			}

			state.scale = next;
			applyTransform();
		};

		const controls = document.createElement("div");
		controls.className = "plantuml-controls";

		[
			{
				label: "\u2261",
				title: "显示源码",
				action: toggleSource,
			},
			{ label: "+", title: "放大", action: () => zoomBy(SCALE_STEP) },
			{
				label: "\u2212",
				title: "缩小",
				action: () => zoomBy(1 / SCALE_STEP),
			},
			{ label: "\u21BA", title: "重置", action: reset },
			{
				label: "\u2197",
				title: "新标签打开原图",
				action: openOriginal,
			},
			{
				label: "\u26F6",
				title: "全屏",
				action: () => openFullscreen(container),
			},
		].forEach((btn) => {
			const el = document.createElement("button");
			el.type = "button";
			el.className = "plantuml-ctrl-btn";
			el.textContent = btn.label;
			el.title = btn.title;
			el.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				btn.action();
			});
			controls.appendChild(el);
		});

		container.appendChild(controls);

		container.addEventListener(
			"wheel",
			(event) => {
				event.preventDefault();
				const factor = event.deltaY < 0 ? SCALE_STEP : 1 / SCALE_STEP;
				zoomBy(factor, event.clientX, event.clientY);
			},
			{ passive: false },
		);

		let isDragging = false;
		let startX = 0;
		let startY = 0;
		let startTx = 0;
		let startTy = 0;

		const onPointerDown = (event) => {
			if (event.button !== 0 && event.pointerType !== "touch") {
				return;
			}

			if (
				event.target.closest(".plantuml-controls") ||
				event.target.closest(".plantuml-source-panel")
			) {
				return;
			}

			isDragging = true;
			startX = event.clientX;
			startY = event.clientY;
			startTx = state.translateX;
			startTy = state.translateY;
			container.setPointerCapture?.(event.pointerId);
			container.style.cursor = "grabbing";
		};

		const onPointerMove = (event) => {
			if (!isDragging) {
				return;
			}

			state.translateX = startTx + (event.clientX - startX);
			state.translateY = startTy + (event.clientY - startY);
			applyTransform();
		};

		const onPointerUp = (event) => {
			if (!isDragging) {
				return;
			}

			isDragging = false;
			container.releasePointerCapture?.(event.pointerId);
			container.style.cursor = "";
		};

		container.addEventListener("pointerdown", onPointerDown);
		container.addEventListener("pointermove", onPointerMove);
		container.addEventListener("pointerup", onPointerUp);
		container.addEventListener("pointercancel", onPointerUp);

		container.addEventListener("dblclick", (event) => {
			if (
				event.target.closest(".plantuml-controls") ||
				event.target.closest(".plantuml-source-panel")
			) {
				return;
			}

			if (state.scale !== 1) {
				reset();
			} else {
				zoomBy(SCALE_STEP * SCALE_STEP, event.clientX, event.clientY);
			}
		});

		applyTransform();
	}

	function openFullscreen(container) {
		const sourceImg = getActiveThemeImage(container);
		if (!sourceImg) {
			return;
		}
		const sourceCode = getSourceCode(container);

		const overlay = document.createElement("div");
		overlay.className = "plantuml-fullscreen-overlay";

		const content = document.createElement("div");
		content.className = "plantuml-fs-content";

		const img = document.createElement("img");
		img.src = sourceImg.src;
		img.alt = sourceImg.alt;
		img.draggable = false;
		content.appendChild(img);

		const fsControls = document.createElement("div");
		fsControls.className = "plantuml-fs-controls";
		const state = { scale: 1, tx: 0, ty: 0 };
		const openOriginal = () => {
			if (!img.src) {
				return;
			}

			window.open(img.src, "_blank", "noopener,noreferrer");
		};

		const apply = () => {
			img.style.transformOrigin = "center center";
			img.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
		};

		const zoom = (factor, originX, originY) => {
			const prev = state.scale;
			const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
			if (next === prev) {
				return;
			}

			if (typeof originX === "number" && typeof originY === "number") {
				const rect = img.getBoundingClientRect();
				const cx = rect.left + rect.width / 2;
				const cy = rect.top + rect.height / 2;
				const dx = originX - cx;
				const dy = originY - cy;
				const ratio = next / prev;
				state.tx = state.tx - dx * (ratio - 1);
				state.ty = state.ty - dy * (ratio - 1);
			}

			state.scale = next;
			apply();
		};

		const resetState = () => {
			state.scale = 1;
			state.tx = 0;
			state.ty = 0;
			apply();
		};

		const close = () => {
			document.removeEventListener("keydown", onKeyDown);
			overlay.remove();
			fullscreenOverlays.delete(overlay);
		};

		const onKeyDown = (event) => {
			if (event.key === "Escape") {
				close();
			}
		};

		[
			{
				label: "\u2261",
				title: "复制源码",
				action: async (button) =>
					copySourceWithFeedback(button, sourceCode, content),
			},
			{ label: "+", title: "放大", action: () => zoom(SCALE_STEP) },
			{
				label: "\u2212",
				title: "缩小",
				action: () => zoom(1 / SCALE_STEP),
			},
			{ label: "\u21BA", title: "重置", action: resetState },
			{ label: "\u2197", title: "新标签打开原图", action: openOriginal },
			{ label: "\u2715", title: "关闭", action: close },
		].forEach((btn) => {
			const el = document.createElement("button");
			el.type = "button";
			el.className = "plantuml-ctrl-btn";
			el.textContent = btn.label;
			el.title = btn.title;
			el.addEventListener("click", async (event) => {
				event.preventDefault();
				event.stopPropagation();
				await btn.action(el);
			});
			fsControls.appendChild(el);
		});

		content.addEventListener(
			"wheel",
			(event) => {
				event.preventDefault();
				const factor = event.deltaY < 0 ? SCALE_STEP : 1 / SCALE_STEP;
				zoom(factor, event.clientX, event.clientY);
			},
			{ passive: false },
		);

		let dragging = false;
		let sx = 0;
		let sy = 0;
		let stx = 0;
		let sty = 0;

		content.addEventListener("pointerdown", (event) => {
			if (event.target.closest(".plantuml-fs-controls")) {
				return;
			}

			dragging = true;
			sx = event.clientX;
			sy = event.clientY;
			stx = state.tx;
			sty = state.ty;
			content.setPointerCapture?.(event.pointerId);
		});

		content.addEventListener("pointermove", (event) => {
			if (!dragging) {
				return;
			}

			state.tx = stx + (event.clientX - sx);
			state.ty = sty + (event.clientY - sy);
			apply();
		});

		const endDrag = (event) => {
			if (!dragging) {
				return;
			}

			dragging = false;
			content.releasePointerCapture?.(event.pointerId);
		};

		content.addEventListener("pointerup", endDrag);
		content.addEventListener("pointercancel", endDrag);

		overlay.addEventListener("click", (event) => {
			if (event.target === overlay) {
				close();
			}
		});

		overlay.appendChild(content);
		overlay.appendChild(fsControls);
		document.body.appendChild(overlay);
		fullscreenOverlays.add(overlay);
		document.addEventListener("keydown", onKeyDown);
	}

	function closeAllOverlays() {
		fullscreenOverlays.forEach((overlay) => {
			overlay.remove();
		});
		fullscreenOverlays.clear();
	}

	function initAll() {
		const containers = document.querySelectorAll(".plantuml-diagram-container");

		containers.forEach((container) => {
			const images = ensureResidentImages(container);
			if (images.length === 0) {
				return;
			}

			setLoadingState(container, false);
			container.dataset.pendingThemeMode = getCurrentThemeMode();
			updateImageVisibility(container, getCurrentThemeMode());
			images.forEach((img) => {
				bindErrorHandler(img, container);
				bindLoadHandler(img, container);
			});
			observeActivation(container);
		});

		scheduleThemePreload(
			getOppositeThemeMode(getCurrentThemeMode()),
			Array.from(containers).filter((container) => isLikelyVisible(container)),
		);
	}

	const themeObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (
				mutation.type === "attributes" &&
				mutation.attributeName === "class"
			) {
				scheduleThemeApply();
				break;
			}
		}
	});

	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});

	document.addEventListener("astro:before-preparation", closeAllOverlays);
	document.addEventListener("astro:page-load", () => {
		closeAllOverlays();
		initAll();
	});

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initAll, { once: true });
	} else {
		initAll();
	}
})();
