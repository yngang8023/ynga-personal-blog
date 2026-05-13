(() => {
	if (window.mermaidInitialized) {
		if (typeof window.renderMermaidDiagrams !== "function") {
			window.renderMermaidDiagrams = renderMermaidDiagrams;
		}
		return;
	}

	window.mermaidInitialized = true;

	const MIN_ZOOM = 0.65;
	const MAX_ZOOM = 6;
	const ZOOM_STEP = 1.2;
	const OBSERVER_MARGIN = "280px 0px 280px 0px";
	const MERMAID_SCRIPT_SOURCES = ["/diagram/mermaid.js"];
	const IDLE_PREFETCH_LIMIT = 2;
	const THEME_PREWARM_LIMIT = 3;
	const renderCache = new Map();
	const pendingRenderCache = new Map();
	const preparedRenderCache = new Map();
	const renderQueue = [];
	const MERMAID_THEME_PALETTES = {
		default: {
			background: "#f8fafc",
			primaryColor: "#ffffff",
			secondaryColor: "#f8fafc",
			tertiaryColor: "#e2e8f0",
			primaryTextColor: "#0f172a",
			secondaryTextColor: "#0f172a",
			tertiaryTextColor: "#0f172a",
			primaryBorderColor: "#94a3b8",
			secondaryBorderColor: "#cbd5e1",
			tertiaryBorderColor: "#cbd5e1",
			lineColor: "#334155",
			textColor: "#0f172a",
			mainBkg: "#ffffff",
			secondBkg: "#f8fafc",
			tertiaryBkg: "#eef2ff",
			clusterBkg: "#f8fafc",
			clusterBorder: "#cbd5e1",
			defaultLinkColor: "#334155",
			titleColor: "#0f172a",
			edgeLabelBackground: "#ffffff",
			nodeTextColor: "#0f172a",
			labelBackground: "#ffffff",
			labelBoxBkgColor: "#ffffff",
			labelBoxBorderColor: "#cbd5e1",
			labelTextColor: "#0f172a",
			noteBkgColor: "#fff7ed",
			noteTextColor: "#7c2d12",
			noteBorderColor: "#fdba74",
			actorBkg: "#ffffff",
			actorBorder: "#94a3b8",
			actorTextColor: "#0f172a",
			actorLineColor: "#334155",
			signalColor: "#334155",
			signalTextColor: "#0f172a",
			sectionBkgColor: "#f8fafc",
			altSectionBkgColor: "#ffffff",
			gridColor: "#cbd5e1",
			taskBkgColor: "#ffffff",
			taskTextColor: "#0f172a",
			taskTextDarkColor: "#0f172a",
			taskTextOutsideColor: "#334155",
			activeTaskBkgColor: "#dbeafe",
			activeTaskBorderColor: "#60a5fa",
			doneTaskBkgColor: "#dcfce7",
			doneTaskBorderColor: "#22c55e",
			critBkgColor: "#fecaca",
			critBorderColor: "#ef4444",
			todayLineColor: "#f59e0b",
			personBkg: "#ffffff",
			personBorder: "#94a3b8",
			classText: "#0f172a",
			errorBkgColor: "#fee2e2",
			errorTextColor: "#991b1b",
			fillType0: "#dbeafe",
			fillType1: "#e0f2fe",
			fillType2: "#dcfce7",
			fillType3: "#fef3c7",
			fillType4: "#ede9fe",
			fillType5: "#fde68a",
			fillType6: "#fed7aa",
			fillType7: "#fecaca",
			pie1: "#2563eb",
			pie2: "#0ea5e9",
			pie3: "#22c55e",
			pie4: "#f59e0b",
			pie5: "#8b5cf6",
			pie6: "#ef4444",
			pie7: "#14b8a6",
			pie8: "#f97316",
			pie9: "#ec4899",
			pie10: "#64748b",
			git0: "#2563eb",
			git1: "#10b981",
			git2: "#f59e0b",
			git3: "#8b5cf6",
			git4: "#ef4444",
			git5: "#14b8a6",
			git6: "#f97316",
			git7: "#ec4899",
			tagLabelColor: "#0f172a",
			tagLabelBackground: "#e2e8f0",
		},
		dark: {
			background: "#020617",
			primaryColor: "#0f172a",
			secondaryColor: "#111827",
			tertiaryColor: "#1e293b",
			primaryTextColor: "#e5e7eb",
			secondaryTextColor: "#e5e7eb",
			tertiaryTextColor: "#e5e7eb",
			primaryBorderColor: "#64748b",
			secondaryBorderColor: "#475569",
			tertiaryBorderColor: "#475569",
			lineColor: "#cbd5e1",
			textColor: "#e5e7eb",
			mainBkg: "#0f172a",
			secondBkg: "#111827",
			tertiaryBkg: "#1e293b",
			clusterBkg: "#111827",
			clusterBorder: "#475569",
			defaultLinkColor: "#cbd5e1",
			titleColor: "#f8fafc",
			edgeLabelBackground: "#0f172a",
			nodeTextColor: "#e5e7eb",
			labelBackground: "#0f172a",
			labelBoxBkgColor: "#111827",
			labelBoxBorderColor: "#475569",
			labelTextColor: "#e5e7eb",
			noteBkgColor: "#3f2f14",
			noteTextColor: "#fde68a",
			noteBorderColor: "#f59e0b",
			actorBkg: "#111827",
			actorBorder: "#64748b",
			actorTextColor: "#e5e7eb",
			actorLineColor: "#cbd5e1",
			signalColor: "#cbd5e1",
			signalTextColor: "#e5e7eb",
			sectionBkgColor: "#111827",
			altSectionBkgColor: "#0b1220",
			gridColor: "#475569",
			taskBkgColor: "#111827",
			taskTextColor: "#e5e7eb",
			taskTextDarkColor: "#e5e7eb",
			taskTextOutsideColor: "#cbd5e1",
			activeTaskBkgColor: "#1d4ed8",
			activeTaskBorderColor: "#60a5fa",
			doneTaskBkgColor: "#14532d",
			doneTaskBorderColor: "#22c55e",
			critBkgColor: "#7f1d1d",
			critBorderColor: "#f87171",
			todayLineColor: "#fbbf24",
			personBkg: "#111827",
			personBorder: "#64748b",
			classText: "#e5e7eb",
			errorBkgColor: "#7f1d1d",
			errorTextColor: "#fee2e2",
			fillType0: "#1d4ed8",
			fillType1: "#0369a1",
			fillType2: "#166534",
			fillType3: "#92400e",
			fillType4: "#7e22ce",
			fillType5: "#9a3412",
			fillType6: "#be123c",
			fillType7: "#0f766e",
			pie1: "#60a5fa",
			pie2: "#22d3ee",
			pie3: "#4ade80",
			pie4: "#fbbf24",
			pie5: "#c084fc",
			pie6: "#fb7185",
			pie7: "#2dd4bf",
			pie8: "#fb923c",
			pie9: "#f472b6",
			pie10: "#94a3b8",
			git0: "#60a5fa",
			git1: "#34d399",
			git2: "#fbbf24",
			git3: "#c084fc",
			git4: "#fb7185",
			git5: "#22d3ee",
			git6: "#fb923c",
			git7: "#a3e635",
			tagLabelColor: "#e5e7eb",
			tagLabelBackground: "#334155",
		},
	};
	let currentTheme = getCurrentTheme();
	let mermaidLoadPromise = null;
	let mermaidInitPromise = null;
	let mermaidWorkPromise = Promise.resolve();
	let initializedTheme = "";
	let diagramObserver = null;
	let themeObserver = null;
	let fullscreenOverlay = null;
	let renderSequence = 0;
	let drainingQueuePromise = null;
	let idleBatchToken = 0;
	let prewarmBatchToken = 0;
	let resizeFrame = 0;
	let themeSwitchFrame = 0;

	function getCurrentTheme() {
		return document.documentElement.classList.contains("dark")
			? "dark"
			: "default";
	}

	function getOppositeTheme(theme) {
		return theme === "dark" ? "default" : "dark";
	}

	function getCacheKey(theme, code) {
		return `${theme}::${code}`;
	}

	function splitHostsForThemeSwitch(hosts, isVisible) {
		const visibleHosts = [];
		const deferredHosts = [];

		for (const host of hosts) {
			if (!host) {
				continue;
			}

			if (isVisible(host)) {
				visibleHosts.push(host);
			} else {
				deferredHosts.push(host);
			}
		}

		return {
			visibleHosts,
			deferredHosts,
		};
	}

	function getMermaidThemePrewarmHosts({
		visibleHosts,
		deferredHosts,
		isPrepared,
	}) {
		const immediateHosts = visibleHosts.filter((host) => !isPrepared(host));

		return {
			immediateHosts,
			deferredHosts,
		};
	}

	function runMermaidTask(task) {
		const nextTask = mermaidWorkPromise.catch(() => undefined).then(task);
		mermaidWorkPromise = nextTask.then(
			() => undefined,
			() => undefined,
		);
		return nextTask;
	}

	function cancelThemePrewarm() {
		prewarmBatchToken += 1;
		idleBatchToken += 1;
	}

	function getMermaidConfig(theme) {
		const isDark = theme === "dark";
		const palette = isDark
			? MERMAID_THEME_PALETTES.dark
			: MERMAID_THEME_PALETTES.default;

		return {
			startOnLoad: false,
			theme: "base",
			darkMode: isDark,
			securityLevel: "loose",
			errorLevel: "warn",
			logLevel: "error",
			suppressErrorRendering: true,
			themeVariables: {
				darkMode: isDark,
				fontFamily: "inherit",
				fontSize: "16px",
				...palette,
			},
		};
	}

	function loadScript(src) {
		return new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = src;
			script.async = true;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	function yieldToMainThread() {
		return new Promise((resolve) => {
			window.requestAnimationFrame(() => resolve());
		});
	}

	async function loadMermaidLibrary() {
		if (window.mermaid?.render) {
			return window.mermaid;
		}

		if (mermaidLoadPromise) {
			return mermaidLoadPromise;
		}

		mermaidLoadPromise = (async () => {
			let lastError = null;

			for (const src of MERMAID_SCRIPT_SOURCES) {
				try {
					await loadScript(src);
					break;
				} catch (error) {
					lastError = error;
				}
			}

			if (!window.mermaid?.render) {
				throw lastError || new Error("Mermaid library did not load correctly");
			}

			return window.mermaid;
		})();

		return mermaidLoadPromise;
	}

	async function ensureMermaid(theme) {
		const mermaid = await loadMermaidLibrary();

		if (initializedTheme === theme) {
			return mermaid;
		}

		if (mermaidInitPromise) {
			await mermaidInitPromise;
			if (initializedTheme === theme) {
				return mermaid;
			}
		}

		mermaidInitPromise = Promise.resolve().then(() => {
			mermaid.initialize(getMermaidConfig(theme));
			initializedTheme = theme;
			return mermaid;
		});

		try {
			return await mermaidInitPromise;
		} finally {
			mermaidInitPromise = null;
		}
	}

	async function getRenderedSvgMarkup(code, theme) {
		const normalizedCode = (code || "").trim();
		if (!normalizedCode) {
			throw new Error("Mermaid code is empty");
		}

		const cacheKey = getCacheKey(theme, normalizedCode);
		const cached = renderCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const pending = pendingRenderCache.get(cacheKey);
		if (pending) {
			return pending;
		}

		const renderPromise = runMermaidTask(async () => {
			const existing = renderCache.get(cacheKey);
			if (existing) {
				return existing;
			}

			await ensureMermaid(theme);
			const { svg } = await window.mermaid.render(
				`mermaid-${theme}-${++renderSequence}`,
				normalizedCode,
			);
			renderCache.set(cacheKey, svg);
			return svg;
		}).finally(() => {
			pendingRenderCache.delete(cacheKey);
		});

		pendingRenderCache.set(cacheKey, renderPromise);
		return renderPromise;
	}

	async function getPreparedDiagram(code, theme) {
		const normalizedCode = (code || "").trim();
		if (!normalizedCode) {
			throw new Error("Mermaid code is empty");
		}

		const cacheKey = getCacheKey(theme, normalizedCode);
		const prepared = preparedRenderCache.get(cacheKey);
		if (prepared) {
			return clonePreparedDiagram(prepared);
		}

		const svgMarkup = await getRenderedSvgMarkup(normalizedCode, theme);
		return buildPreparedDiagram(cacheKey, svgMarkup);
	}

	function getAllDiagramHosts() {
		return Array.from(document.querySelectorAll(".mermaid[data-mermaid-code]"));
	}

	function getDiagramContainer(host) {
		return host.closest(".mermaid-diagram-container");
	}

	function setContainerReady(host, ready) {
		const container = getDiagramContainer(host);
		if (!container) {
			return;
		}

		container.setAttribute("data-mermaid-ready", ready ? "true" : "false");
	}

	function dispatchRenderStart(count, total = count) {
		window.dispatchEvent(
			new CustomEvent("mermaid:render:start", {
				detail: { count, total },
			}),
		);
	}

	function dispatchRenderDone(count, total = count) {
		window.dispatchEvent(
			new CustomEvent("mermaid:render:done", {
				detail: { count, total },
			}),
		);
	}

	function setLoadingState(host, label = "Mermaid 图表加载中...") {
		if (!host || !host.isConnected) {
			return;
		}

		if (host.querySelector(".mermaid-viewport")) {
			return;
		}

		if (host.querySelector(".mermaid-loading")) {
			host.dataset.mermaidState = "loading";
			setContainerReady(host, false);
			return;
		}

		host.innerHTML = "";
		const loading = document.createElement("div");
		loading.className = "mermaid-loading";
		loading.textContent = label;
		host.appendChild(loading);
		host.dataset.mermaidState = "loading";
		setContainerReady(host, false);
	}

	function showRenderError(host, error) {
		host.innerHTML = "";
		host.dataset.mermaidState = "error";
		setContainerReady(host, false);

		const box = document.createElement("div");
		box.className = "mermaid-error";

		const message = document.createElement("p");
		message.textContent = "Mermaid 图表渲染失败，请稍后重试";
		box.appendChild(message);

		if (error?.message) {
			box.setAttribute("data-error-message", error.message);
		}

		const retry = document.createElement("button");
		retry.type = "button";
		retry.textContent = "重试";
		retry.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			host.dataset.renderedTheme = "";
			host.dataset.mermaidState = "idle";
			host.dataset.renderAttempts = "0";
			setLoadingState(host);
			queueDiagramRender(host, { force: true, priority: "high" });
		});

		box.appendChild(retry);
		host.appendChild(box);
	}

	function parseSvgMarkup(svgMarkup) {
		const parsed = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
		const svg = parsed.documentElement;
		if (!svg || svg.tagName.toLowerCase() !== "svg") {
			throw new Error("Mermaid render did not return a valid SVG");
		}
		return svg;
	}

	function assertNotMermaidErrorSvg(svgElement, svgMarkup) {
		const textContent = (svgElement.textContent || "").trim();
		const hasErrorIcon = Boolean(
			svgElement.querySelector('[class*="error-icon"], [id*="error-icon"]'),
		);
		const hasErrorText =
			/syntax error in text/i.test(textContent) ||
			/lexical error/i.test(textContent) ||
			/parse error/i.test(textContent) ||
			/class=['"][^'"]*error-icon/.test(svgMarkup);

		if (hasErrorIcon || hasErrorText) {
			throw new Error(textContent || "Mermaid returned an error SVG");
		}
	}

	function clonePreparedDiagram(prepared) {
		return {
			svg: prepared.svgTemplate.cloneNode(true),
			dimensions: {
				width: prepared.dimensions.width,
				height: prepared.dimensions.height,
			},
		};
	}

	function buildPreparedDiagram(cacheKey, svgMarkup) {
		const cachedPrepared = preparedRenderCache.get(cacheKey);
		if (cachedPrepared) {
			return clonePreparedDiagram(cachedPrepared);
		}

		const svg = parseSvgMarkup(svgMarkup);
		assertNotMermaidErrorSvg(svg, svgMarkup);
		const dimensions = getSvgDimensions(svg);
		normalizeSvgElement(svg, dimensions);

		const prepared = {
			dimensions,
			svgTemplate: svg.cloneNode(true),
		};
		preparedRenderCache.set(cacheKey, prepared);
		return clonePreparedDiagram(prepared);
	}

	function getSvgDimensions(svgElement) {
		const viewBox = svgElement.getAttribute("viewBox");
		if (viewBox) {
			const values = viewBox
				.trim()
				.split(/[\s,]+/)
				.map((value) => Number(value));
			if (
				values.length === 4 &&
				Number.isFinite(values[2]) &&
				Number.isFinite(values[3]) &&
				values[2] > 0 &&
				values[3] > 0
			) {
				return { width: values[2], height: values[3] };
			}
		}

		const width = Number.parseFloat(svgElement.getAttribute("width") || "0");
		const height = Number.parseFloat(svgElement.getAttribute("height") || "0");

		return {
			width: width > 0 ? width : 960,
			height: height > 0 ? height : 540,
		};
	}

	function normalizeSvgElement(svgElement, dimensions) {
		svgElement.removeAttribute("height");
		svgElement.removeAttribute("width");
		svgElement.setAttribute("preserveAspectRatio", "xMidYMid meet");
		svgElement.style.width = `${dimensions.width}px`;
		svgElement.style.height = `${dimensions.height}px`;
		svgElement.style.maxWidth = "none";
		svgElement.style.maxHeight = "none";
		svgElement.style.display = "block";
		svgElement.style.userSelect = "none";
		svgElement.style.pointerEvents = "auto";
	}

	function getPreviewHeight(dimensions) {
		const ratio = dimensions.height / dimensions.width;
		const nextHeight = Math.round(ratio * 760);
		return Math.max(240, Math.min(460, nextHeight || 320));
	}

	function createDiagramState(viewport, stage, dimensions) {
		return {
			viewport,
			stage,
			intrinsicWidth: dimensions.width,
			intrinsicHeight: dimensions.height,
			baseScale: 1,
			zoom: 1,
			tx: 0,
			ty: 0,
		};
	}

	function getViewportSize(state) {
		const width =
			state.viewport.clientWidth ||
			state.viewport.getBoundingClientRect().width ||
			state.intrinsicWidth;
		const height =
			state.viewport.clientHeight ||
			state.viewport.getBoundingClientRect().height ||
			state.intrinsicHeight;
		return { width, height };
	}

	function calculateFitScale(state) {
		const viewportSize = getViewportSize(state);
		const widthScale = viewportSize.width / state.intrinsicWidth;
		const heightScale = viewportSize.height / state.intrinsicHeight;
		return Math.min(widthScale, heightScale, 1);
	}

	function getTotalScale(state) {
		return state.baseScale * state.zoom;
	}

	function applyTransform(state) {
		const scale = getTotalScale(state);
		state.stage.style.transform = `matrix(${scale}, 0, 0, ${scale}, ${state.tx}, ${state.ty})`;
	}

	function centerState(state) {
		const viewportSize = getViewportSize(state);
		const scale = getTotalScale(state);
		state.tx = (viewportSize.width - state.intrinsicWidth * scale) / 2;
		state.ty = (viewportSize.height - state.intrinsicHeight * scale) / 2;
	}

	function resetView(state) {
		state.zoom = 1;
		state.baseScale = calculateFitScale(state);
		centerState(state);
		applyTransform(state);
	}

	function syncStateToResize(state) {
		if (!state) {
			return;
		}

		const previousScale = getTotalScale(state) || 1;
		const viewportSize = getViewportSize(state);
		const centerX = viewportSize.width / 2;
		const centerY = viewportSize.height / 2;
		const worldX = (centerX - state.tx) / previousScale;
		const worldY = (centerY - state.ty) / previousScale;

		state.baseScale = calculateFitScale(state);

		const nextScale = getTotalScale(state) || 1;
		state.tx = centerX - worldX * nextScale;
		state.ty = centerY - worldY * nextScale;
		applyTransform(state);
	}

	function zoomBy(state, factor, originX, originY) {
		const previousScale = getTotalScale(state);
		const nextZoom = Math.max(
			MIN_ZOOM,
			Math.min(MAX_ZOOM, +(state.zoom * factor).toFixed(3)),
		);

		if (nextZoom === state.zoom) {
			return;
		}

		state.zoom = nextZoom;
		const nextScale = getTotalScale(state);

		if (typeof originX === "number" && typeof originY === "number") {
			const worldX = (originX - state.tx) / previousScale;
			const worldY = (originY - state.ty) / previousScale;
			state.tx = originX - worldX * nextScale;
			state.ty = originY - worldY * nextScale;
		} else {
			centerState(state);
		}

		applyTransform(state);
	}

	function bindDiagramInteractions(viewport, state) {
		if (viewport.dataset.interactionBound === "true") {
			return;
		}

		viewport.dataset.interactionBound = "true";
		viewport.style.touchAction = "none";

		let dragging = false;
		let startX = 0;
		let startY = 0;
		let startTx = 0;
		let startTy = 0;

		const getLocalPoint = (event) => {
			const rect = viewport.getBoundingClientRect();
			return {
				x: event.clientX - rect.left,
				y: event.clientY - rect.top,
			};
		};

		viewport.addEventListener("pointerdown", (event) => {
			if (event.button !== 0 && event.pointerType !== "touch") {
				return;
			}

			dragging = true;
			startX = event.clientX;
			startY = event.clientY;
			startTx = state.tx;
			startTy = state.ty;
			viewport.setPointerCapture?.(event.pointerId);
		});

		viewport.addEventListener("pointermove", (event) => {
			if (!dragging) {
				return;
			}

			state.tx = startTx + (event.clientX - startX);
			state.ty = startTy + (event.clientY - startY);
			applyTransform(state);
		});

		const stopDragging = (event) => {
			if (!dragging) {
				return;
			}

			dragging = false;
			viewport.releasePointerCapture?.(event.pointerId);
		};

		viewport.addEventListener("pointerup", stopDragging);
		viewport.addEventListener("pointercancel", stopDragging);

		viewport.addEventListener(
			"wheel",
			(event) => {
				event.preventDefault();
				const point = getLocalPoint(event);
				const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
				zoomBy(state, factor, point.x, point.y);
			},
			{ passive: false },
		);

		viewport.addEventListener("dblclick", (event) => {
			const point = getLocalPoint(event);
			if (state.zoom > 1.01) {
				resetView(state);
				return;
			}

			zoomBy(state, ZOOM_STEP * ZOOM_STEP, point.x, point.y);
		});
	}

	function createControlButtons(className, actions) {
		const controls = document.createElement("div");
		controls.className = className;

		actions.forEach((action) => {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "mermaid-ctrl-btn";
			button.textContent = action.label;
			button.title = action.title;
			button.setAttribute("data-action", action.key);
			button.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				action.handler();
			});
			controls.appendChild(button);
		});

		return controls;
	}

	function closeFullscreen() {
		if (!fullscreenOverlay) {
			return;
		}

		document.body.classList.remove("mermaid-fullscreen-open");
		document.removeEventListener("keydown", fullscreenOverlay.__escHandler);
		fullscreenOverlay.remove();
		fullscreenOverlay = null;
	}

	function openFullscreen(host) {
		const sourceSvg = host.querySelector(".mermaid-stage svg");
		if (!sourceSvg) {
			return;
		}

		closeFullscreen();

		const overlay = document.createElement("div");
		overlay.className = "mermaid-fullscreen-overlay";

		const content = document.createElement("div");
		content.className = "mermaid-fs-content";

		const viewport = document.createElement("div");
		viewport.className = "mermaid-viewport mermaid-viewport-fullscreen";

		const stage = document.createElement("div");
		stage.className = "mermaid-stage";

		const clonedSvg = sourceSvg.cloneNode(true);
		const dimensions = getSvgDimensions(clonedSvg);
		normalizeSvgElement(clonedSvg, dimensions);
		stage.style.width = `${dimensions.width}px`;
		stage.style.height = `${dimensions.height}px`;
		stage.appendChild(clonedSvg);
		viewport.appendChild(stage);
		content.appendChild(viewport);
		overlay.appendChild(content);

		const fullscreenState = createDiagramState(viewport, stage, dimensions);
		bindDiagramInteractions(viewport, fullscreenState);

		const controls = createControlButtons("mermaid-fs-controls", [
			{
				key: "zoom-in",
				label: "+",
				title: "放大",
				handler: () => zoomBy(fullscreenState, ZOOM_STEP),
			},
			{
				key: "zoom-out",
				label: "−",
				title: "缩小",
				handler: () => zoomBy(fullscreenState, 1 / ZOOM_STEP),
			},
			{
				key: "reset",
				label: "↺",
				title: "重置",
				handler: () => resetView(fullscreenState),
			},
			{
				key: "close",
				label: "✕",
				title: "关闭",
				handler: closeFullscreen,
			},
		]);

		overlay.appendChild(controls);

		const escHandler = (event) => {
			if (event.key === "Escape") {
				closeFullscreen();
			}
		};

		overlay.__escHandler = escHandler;
		overlay.__mermaidView = fullscreenState;
		overlay.addEventListener("click", (event) => {
			if (event.target === overlay) {
				closeFullscreen();
			}
		});

		document.body.appendChild(overlay);
		document.body.classList.add("mermaid-fullscreen-open");
		document.addEventListener("keydown", escHandler);
		fullscreenOverlay = overlay;

		requestAnimationFrame(() => {
			resetView(fullscreenState);
			syncStateToResize(fullscreenState);
		});
	}

	function ensureDiagramShell(host, dimensions) {
		const existingState = host.__mermaidView;
		const existingViewport = host.querySelector(":scope > .mermaid-viewport");
		const existingStage = existingViewport?.querySelector(".mermaid-stage");

		if (existingState && existingViewport && existingStage) {
			return {
				isNew: false,
				stage: existingStage,
				state: existingState,
			};
		}

		host.innerHTML = "";
		const viewport = document.createElement("div");
		viewport.className = "mermaid-viewport";

		const stage = document.createElement("div");
		stage.className = "mermaid-stage";
		stage.style.width = `${dimensions.width}px`;
		stage.style.height = `${dimensions.height}px`;
		viewport.appendChild(stage);
		host.appendChild(viewport);

		const state = createDiagramState(viewport, stage, dimensions);
		host.__mermaidView = state;
		bindDiagramInteractions(viewport, state);

		const controls = createControlButtons("mermaid-controls", [
			{
				key: "zoom-in",
				label: "+",
				title: "放大",
				handler: () => zoomBy(state, ZOOM_STEP),
			},
			{
				key: "zoom-out",
				label: "−",
				title: "缩小",
				handler: () => zoomBy(state, 1 / ZOOM_STEP),
			},
			{
				key: "reset",
				label: "↺",
				title: "重置",
				handler: () => resetView(state),
			},
			{
				key: "fullscreen",
				label: "⛶",
				title: "全屏查看",
				handler: () => openFullscreen(host),
			},
		]);

		host.appendChild(controls);
		return {
			isNew: true,
			stage,
			state,
		};
	}

	function mountDiagram(host, prepared, theme) {
		const { dimensions } = prepared;
		const { isNew, stage, state } = ensureDiagramShell(host, dimensions);

		host.style.setProperty(
			"--mermaid-preview-height",
			`${getPreviewHeight(dimensions)}px`,
		);

		state.intrinsicWidth = dimensions.width;
		state.intrinsicHeight = dimensions.height;
		stage.style.width = `${dimensions.width}px`;
		stage.style.height = `${dimensions.height}px`;
		stage.replaceChildren(prepared.svg);

		if (isNew) {
			resetView(state);
		} else if (state.zoom > 1.01) {
			syncStateToResize(state);
		} else {
			state.baseScale = calculateFitScale(state);
			centerState(state);
			applyTransform(state);
		}

		host.dataset.renderedTheme = theme;
		host.dataset.mermaidState = "ready";
		host.dataset.renderAttempts = "0";
		setContainerReady(host, true);
	}

	function needsRender(host, theme, force = false) {
		if (!host || !host.isConnected) {
			return false;
		}

		if (force) {
			return true;
		}

		if (host.dataset.renderedTheme !== theme) {
			return true;
		}

		if (host.dataset.mermaidState !== "ready") {
			return true;
		}

		return !host.querySelector(".mermaid-stage svg");
	}

	function isLikelyVisible(host) {
		const rect = host.getBoundingClientRect();
		const viewportHeight =
			window.innerHeight || document.documentElement.clientHeight || 0;
		return rect.bottom >= -120 && rect.top <= viewportHeight + 240;
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

	function queueDiagramRender(host, options = {}) {
		const force = options.force === true;
		const priority = options.priority || "normal";
		const theme = getCurrentTheme();

		if (!needsRender(host, theme, force)) {
			return;
		}

		if (force) {
			host.dataset.renderedTheme = "";
		}

		if (host.dataset.renderQueued === "true") {
			return;
		}

		host.dataset.renderQueued = "true";
		if (!host.querySelector(".mermaid-viewport")) {
			setLoadingState(host);
		}

		const job = { host };
		if (priority === "high") {
			renderQueue.unshift(job);
		} else {
			renderQueue.push(job);
		}

		void drainRenderQueue();
	}

	async function renderHost(host) {
		const code = host.getAttribute("data-mermaid-code") || "";
		const theme = getCurrentTheme();
		if (!code.trim()) {
			return false;
		}

		if (!needsRender(host, theme, false)) {
			return true;
		}

		host.dataset.rendering = "true";

		try {
			const prepared = await getPreparedDiagram(code, theme);
			mountDiagram(host, prepared, theme);
			return true;
		} catch (error) {
			const attempts = Number(host.dataset.renderAttempts || "0") + 1;
			host.dataset.renderAttempts = String(attempts);

			if (attempts < 2) {
				host.dataset.renderQueued = "false";
				host.dataset.rendering = "false";
				window.setTimeout(() => {
					queueDiagramRender(host, { force: true, priority: "high" });
				}, 220 * attempts);
				return false;
			}

			console.error("Failed to render Mermaid diagram:", error);
			showRenderError(host, error);
			return false;
		} finally {
			host.dataset.rendering = "false";
		}
	}

	async function drainRenderQueue() {
		if (drainingQueuePromise) {
			return drainingQueuePromise;
		}

		drainingQueuePromise = (async () => {
			while (renderQueue.length > 0) {
				const job = renderQueue.shift();
				const host = job?.host;
				if (!host || !host.isConnected) {
					continue;
				}

				host.dataset.renderQueued = "false";
				await renderHost(host);
				if (renderQueue.length > 0) {
					await yieldToMainThread();
				}
			}
		})().finally(() => {
			drainingQueuePromise = null;
		});

		return drainingQueuePromise;
	}

	function applyThemeFromCache(hosts, theme) {
		const misses = [];

		hosts.forEach((host) => {
			if (!host?.isConnected) {
				return;
			}

			const code = host.getAttribute("data-mermaid-code") || "";
			if (!code.trim()) {
				return;
			}

			const cachedPrepared = preparedRenderCache.get(
				getCacheKey(theme, code.trim()),
			);
			if (!cachedPrepared) {
				misses.push(host);
				return;
			}

			mountDiagram(host, clonePreparedDiagram(cachedPrepared), theme);
		});

		return misses;
	}

	function prewarmThemeCache(hosts, theme, options = {}) {
		const limit = Number.isFinite(options.limit)
			? Math.max(0, options.limit)
			: Number.POSITIVE_INFINITY;
		let queue = hosts.filter((host) => host?.isConnected);
		if (Number.isFinite(limit)) {
			queue = queue.slice(0, limit);
		}
		if (queue.length === 0) {
			return;
		}

		const token = ++prewarmBatchToken;
		const pump = () => {
			if (token !== prewarmBatchToken) {
				return;
			}

			while (queue.length > 0) {
				const nextPrewarmHost = queue.shift();
				const code = nextPrewarmHost?.getAttribute("data-mermaid-code") || "";
				if (!code.trim()) {
					continue;
				}

				const cacheKey = getCacheKey(theme, code.trim());
				if (preparedRenderCache.has(cacheKey)) {
					continue;
				}

				void getPreparedDiagram(code, theme).catch(() => undefined).finally(() => {
					if (token !== prewarmBatchToken || queue.length === 0) {
						return;
					}

					scheduleIdleWork(pump);
				});
				return;
			}
		};

		pump();
	}

	function scheduleThemePrewarm(theme, hosts = getAllDiagramHosts(), options = {}) {
		const queue = hosts.filter((host) => host?.isConnected);
		if (queue.length === 0) {
			return;
		}

		const prewarmPlan = getMermaidThemePrewarmHosts({
			visibleHosts: options.treatAsDeferred === true ? [] : queue,
			deferredHosts: options.treatAsDeferred === true ? queue : [],
			isPrepared: (host) => {
				const code = host?.getAttribute("data-mermaid-code") || "";
				return preparedRenderCache.has(getCacheKey(theme, code.trim()));
			},
		});

		if (prewarmPlan.immediateHosts.length > 0) {
			scheduleIdleWork(() =>
				prewarmThemeCache(prewarmPlan.immediateHosts, theme),
			);
		}

		if (prewarmPlan.deferredHosts.length > 0) {
			scheduleIdleWork(() =>
				prewarmThemeCache(
					prewarmPlan.deferredHosts,
					theme,
					{ limit: THEME_PREWARM_LIMIT },
				),
			);
		}
	}

	function scheduleIdlePrefetch(hosts, force = false) {
		const queue = hosts.filter((host) =>
			needsRender(host, getCurrentTheme(), force),
		).slice(0, IDLE_PREFETCH_LIMIT);
		if (queue.length === 0) {
			return;
		}

		const token = ++idleBatchToken;
		scheduleIdleWork(() => {
			if (token !== idleBatchToken) {
				return;
			}

			prewarmThemeCache(queue, getCurrentTheme());
		});
	}

	function ensureDiagramObserver() {
		if (diagramObserver || typeof IntersectionObserver === "undefined") {
			return;
		}

		diagramObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting) {
						return;
					}

					diagramObserver.unobserve(entry.target);
					queueDiagramRender(entry.target, { priority: "high" });
				});
			},
			{
				rootMargin: OBSERVER_MARGIN,
				threshold: 0.01,
			},
		);
	}

	function observeHost(host) {
		ensureDiagramObserver();
		if (!diagramObserver || !host?.isConnected) {
			return;
		}

		diagramObserver.observe(host);
	}

	function refreshVisibleDiagrams(force = false) {
		const hosts = getAllDiagramHosts();
		if (hosts.length === 0) {
			dispatchRenderDone(0, 0);
			return Promise.resolve();
		}

		currentTheme = getCurrentTheme();
		dispatchRenderStart(hosts.length, hosts.length);

		const visibleHosts = [];
		const deferredHosts = [];

		hosts.forEach((host) => {
			if (force) {
				host.dataset.renderedTheme = "";
			}

			observeHost(host);

			if (!needsRender(host, currentTheme, force)) {
				return;
			}

			if (!host.querySelector(".mermaid-viewport")) {
				setLoadingState(host);
			}

			if (isLikelyVisible(host)) {
				visibleHosts.push(host);
			} else {
				deferredHosts.push(host);
			}
		});

		visibleHosts.forEach((host) =>
			queueDiagramRender(host, { force, priority: "high" }),
		);
		scheduleIdlePrefetch(deferredHosts, force);

		return drainRenderQueue().finally(() => {
			dispatchRenderDone(visibleHosts.length, hosts.length);
			scheduleThemePrewarm(getOppositeTheme(currentTheme), visibleHosts);
		});
	}

	async function renderMermaidDiagrams(options = {}) {
		await refreshVisibleDiagrams(options.force === true);
	}

	function scheduleThemeSwitch() {
		window.cancelAnimationFrame(themeSwitchFrame);
		themeSwitchFrame = window.requestAnimationFrame(() => {
			themeSwitchFrame = 0;

			const nextTheme = getCurrentTheme();
			if (nextTheme === currentTheme) {
				return;
			}

			currentTheme = nextTheme;
			closeFullscreen();

			const hosts = getAllDiagramHosts();
			hosts.forEach((host) => {
				observeHost(host);
			});
			const { visibleHosts, deferredHosts } = splitHostsForThemeSwitch(
				hosts,
				isLikelyVisible,
			);

			cancelThemePrewarm();
			const missingVisible = applyThemeFromCache(visibleHosts, nextTheme);
			if (missingVisible.length > 0) {
				dispatchRenderStart(missingVisible.length, hosts.length);
				missingVisible.forEach((host) =>
					queueDiagramRender(host, { force: true, priority: "high" }),
				);
				void drainRenderQueue().finally(() => {
					dispatchRenderDone(missingVisible.length, hosts.length);
				});
			}

			window.requestAnimationFrame(() => {
				scheduleThemePrewarm(nextTheme, deferredHosts, {
					treatAsDeferred: true,
				});
				scheduleThemePrewarm(getOppositeTheme(nextTheme), visibleHosts);
			});
		});
	}

	function handleThemeMutation() {
		scheduleThemeSwitch();
	}

	function setupThemeObserver() {
		if (themeObserver) {
			return;
		}

		themeObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (
					mutation.type === "attributes" &&
					mutation.attributeName === "class"
				) {
					handleThemeMutation();
					break;
				}
			}
		});

		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
	}

	function syncAllViewports() {
		window.cancelAnimationFrame(resizeFrame);
		resizeFrame = window.requestAnimationFrame(() => {
			getAllDiagramHosts().forEach((host) => {
				syncStateToResize(host.__mermaidView);
			});

			if (fullscreenOverlay?.__mermaidView) {
				syncStateToResize(fullscreenOverlay.__mermaidView);
			}
		});
	}

	function setupEventListeners() {
		document.addEventListener("astro:before-preparation", closeFullscreen);
		document.addEventListener("astro:before-swap", closeFullscreen);
		document.addEventListener("astro:page-load", () => {
			closeFullscreen();
			void renderMermaidDiagrams();
		});
		document.addEventListener("visibilitychange", () => {
			if (!document.hidden) {
				void renderMermaidDiagrams();
			}
		});
		window.addEventListener("resize", syncAllViewports, { passive: true });
	}

	async function initialize() {
		try {
			setupThemeObserver();
			setupEventListeners();
			window.renderMermaidDiagrams = renderMermaidDiagrams;
			await renderMermaidDiagrams();
		} catch (error) {
			console.error("Failed to initialize Mermaid system:", error);
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initialize, { once: true });
	} else {
		void initialize();
	}
})();
