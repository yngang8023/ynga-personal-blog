import { stream } from "fetch-event-stream";
import { X } from "lucide-react";
import React, { useRef, useState } from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import defaultLogo from "../../assets/default-logo.webp";
import { PlaceholdersAndVanishInput } from "./Input";

interface SourceImage {
  path: string;
  url: string;
  alt?: string;
  text?: string;
}

interface Source {
  postId: string;
  title: string;
  url: string;
  text: string;
  heading?: string | null;
  anchor?: string | null;
  images?: SourceImage[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  status?: "streaming" | "complete";
  metaRevealStage?: number;
}

function parseStreamText(chunk: any): string {
  return chunk.response || chunk.choices?.[0]?.delta?.content || chunk.delta?.text || "";
}

function normalizeAssistantMarkdown(content: string): string {
  return content.replace(/\[(\d+)\](?!\()/g, "[[$1]](cite:$1)");
}

function linkifyAssistantUrls(content: string): string {
  return content.replace(/https?:\/\/[^\s<>)\]]+/g, (value, offset, input) => {
    const previous = input[offset - 1] || "";
    const previousTwo = input.slice(Math.max(0, offset - 2), offset);
    if (previous === "(" || previous === "<" || previousTwo === "](") {
      return value;
    }

    const trailing = value.match(/[),.;!?]+$/)?.[0] || "";
    const normalizedUrl = trailing ? value.slice(0, -trailing.length) : value;
    return `[${decodeUrlForDisplay(normalizedUrl)}](${normalizedUrl})${trailing}`;
  });
}

function formatAssistantMarkdown(content: string): string {
  return normalizeAssistantMarkdown(linkifyAssistantUrls(content));
}

function markdownUrlTransform(value: string, key: string) {
  if (key === "src" && /^image:\d+$/i.test(value.trim())) {
    return value;
  }
  if (key === "href" && /^cite:\d+$/i.test(value.trim())) {
    return value;
  }

  return defaultUrlTransform(value);
}

function childrenToText(children: React.ReactNode): string {
  if (children === null || children === undefined || typeof children === "boolean") {
    return "";
  }
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(childrenToText).join("");
  }
  if (React.isValidElement(children)) {
    return childrenToText((children.props as { children?: React.ReactNode }).children);
  }
  return "";
}

function getSourceLabel(source: Source, index: number): string {
  return `[${index + 1}] ${source.title}${source.heading ? ` / ${source.heading}` : ""}`;
}

function splitAssistantSections(content: string) {
  const match = content.match(/(?:^|\n)(?:#{1,6}\s*)?参考来源[:：]?\s*(?:\n|$)/);
  if (!match || match.index === undefined) {
    return {
      body: content,
      references: "",
    };
  }

  return {
    body: content.slice(0, match.index).trimEnd(),
    references: content.slice(match.index).trimStart(),
  };
}

function parseInlineImageSourceIndex(src?: string): number | null {
  if (!src) {
    return null;
  }

  const match = src.trim().match(/^image:(\d+)$/i);
  if (!match) {
    return null;
  }

  const sourceIndex = Number.parseInt(match[1], 10) - 1;
  return Number.isFinite(sourceIndex) && sourceIndex >= 0 ? sourceIndex : null;
}

function collectCitedSourceIndices(children: React.ReactNode): number[] {
  const indices: number[] = [];
  const seen = new Set<number>();

  const visit = (node: React.ReactNode) => {
    if (node === null || node === undefined || typeof node === "boolean") {
      return;
    }
    if (typeof node === "string" || typeof node === "number") {
      const matches = String(node).matchAll(/\[(\d+)\]/g);
      for (const match of matches) {
        const sourceIndex = Number.parseInt(match[1], 10) - 1;
        if (Number.isFinite(sourceIndex) && sourceIndex >= 0 && !seen.has(sourceIndex)) {
          seen.add(sourceIndex);
          indices.push(sourceIndex);
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (React.isValidElement(node)) {
      const element = node as React.ReactElement<{ href?: string; children?: React.ReactNode }>;
      const href = typeof element.props.href === "string" ? element.props.href : "";
      if (href.startsWith("cite:")) {
        const sourceIndex = Number.parseInt(href.slice("cite:".length), 10) - 1;
        if (Number.isFinite(sourceIndex) && sourceIndex >= 0 && !seen.has(sourceIndex)) {
          seen.add(sourceIndex);
          indices.push(sourceIndex);
        }
      }
      visit(element.props.children);
    }
  };

  visit(children);
  return indices;
}

function decodeUrlForDisplay(value: string): string {
  try {
    const url = new URL(value);
    const pathname = url.pathname
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
    const hash = url.hash ? decodeURIComponent(url.hash) : "";
    return `${url.origin}${pathname}${hash}`;
  } catch {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
}

function buildMessageId(role: Message["role"]): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildRenderedImageKey(sourceIndex: number, image: SourceImage): string {
  return `${sourceIndex}:${image.path}:${image.url}`;
}

function normalizeImageSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

function extractImageSearchTerms(value: string): string[] {
  const normalized = normalizeImageSearchText(value);
  if (!normalized) {
    return [];
  }

  const rawTerms = [
    ...(normalized.match(/[\u4e00-\u9fff]{2,}/gu) ?? []),
    ...(normalized.match(/[\u3040-\u30ff]{2,}/gu) ?? []),
    ...(normalized.match(/[a-z0-9][a-z0-9._/-]{1,}/g) ?? []),
  ];

  const uniqueTerms: string[] = [];
  const seen = new Set<string>();

  for (const term of rawTerms) {
    const nextTerm = term.trim();
    if (nextTerm.length < 2 || seen.has(nextTerm)) {
      continue;
    }
    seen.add(nextTerm);
    uniqueTerms.push(nextTerm);
  }

  return uniqueTerms.sort((left, right) => right.length - left.length);
}

function scoreInlineImageMatch(source: Source, image: SourceImage, contextText: string): number {
  const normalizedContext = normalizeImageSearchText(contextText);
  const imageBlob = normalizeImageSearchText(
    [image.path, image.alt || "", image.text || "", source.heading || "", source.title]
      .filter(Boolean)
      .join(" "),
  );

  if (!normalizedContext || !imageBlob) {
    return 0;
  }

  let score = 0;
  const normalizedPath = normalizeImageSearchText(image.path);

  if (normalizedPath && normalizedContext.includes(normalizedPath)) {
    score += 24;
  }

  for (const term of extractImageSearchTerms(contextText)) {
    if (!imageBlob.includes(term)) {
      continue;
    }

    score += Math.min(Math.max(term.length, 2), 10);
    if (normalizedPath.includes(term)) {
      score += 4;
    }
  }

  return score;
}

export default function BlogChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [informativeMessage, setInformativeMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedSource, setSelectedSource] = useState<{
    source: Source;
    sourceIndex: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const revealTimersRef = useRef<number[]>([]);
  const activeAssistantIdRef = useRef<string | null>(null);
  const pendingSourcesRef = useRef<Source[]>([]);

  const scrollToBottom = (force = false) => {
    requestAnimationFrame(() => {
      if (containerRef.current && (force || autoScrollRef.current)) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
  };

  const clearRevealTimers = () => {
    revealTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    revealTimersRef.current = [];
  };

  const scheduleAssistantMetaReveal = (messageId: string) => {
    clearRevealTimers();
    [1].forEach((stage, index) => {
      const timer = window.setTimeout(() => {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  metaRevealStage: stage,
                }
              : message,
          ),
        );
        scrollToBottom();
      }, 180 * (index + 1));
      revealTimersRef.current.push(timer);
    });
  };

  const upsertActiveAssistantMessage = (updater: (message: Message) => Message) => {
    if (!activeAssistantIdRef.current) {
      activeAssistantIdRef.current = buildMessageId("assistant");
    }

    const assistantId = activeAssistantIdRef.current;
    setMessages((previous) => {
      const messageIndex = previous.findIndex((message) => message.id === assistantId);
      if (messageIndex !== -1) {
        const current = previous[messageIndex];
        return [
          ...previous.slice(0, messageIndex),
          updater({
            ...current,
            sources: current.sources?.length ? current.sources : pendingSourcesRef.current,
          }),
          ...previous.slice(messageIndex + 1),
        ];
      }

      return [
        ...previous,
        updater({
          id: assistantId,
          role: "assistant",
          content: "",
          sources: pendingSourcesRef.current,
          status: "streaming",
          metaRevealStage: 0,
        }),
      ];
    });
  };

  const updateActiveAssistantSources = (sources: Source[]) => {
    pendingSourcesRef.current = sources;
    const assistantId = activeAssistantIdRef.current;
    if (!assistantId) {
      return;
    }

    setMessages((previous) =>
      previous.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              sources,
            }
          : message,
      ),
    );
  };

  const completeLastAssistantMessage = () => {
    const completedId = activeAssistantIdRef.current;
    const fallbackSources = pendingSourcesRef.current;

    if (!completedId) {
      return;
    }

    setMessages((previous) => {
      return previous.map((message) =>
        message.id === completedId
          ? {
              ...message,
              sources: message.sources?.length ? message.sources : fallbackSources,
              status: "complete",
              metaRevealStage: 0,
            }
          : message,
      );
    });

    scheduleAssistantMetaReveal(completedId);
    activeAssistantIdRef.current = null;
    pendingSourcesRef.current = [];
  };

  const handleScroll = () => {
    if (!containerRef.current) {
      return;
    }

    const distanceToBottom =
      containerRef.current.scrollHeight -
      containerRef.current.scrollTop -
      containerRef.current.clientHeight;
    autoScrollRef.current = distanceToBottom < 96;
  };

  const handleWheel = (event: React.WheelEvent<HTMLElement>) => {
    if (event.deltaY < 0) {
      autoScrollRef.current = false;
    }
  };

  const openSource = (sources: Source[], sourceIndex: number) => {
    const source = sources[sourceIndex];
    if (!source) {
      return;
    }
    setSelectedSource({ source, sourceIndex });
  };

  const handleSendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = inputMessage.trim();
    if (!content || isStreaming) {
      return;
    }

    const userMessage: Message = { id: buildMessageId("user"), role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInputMessage("");
    setInformativeMessage("");
    setSelectedSource(null);
    setIsStreaming(true);
    autoScrollRef.current = true;
    activeAssistantIdRef.current = null;
    pendingSourcesRef.current = [];
    clearRevealTimers();
    scrollToBottom(true);

    try {
      const response = await stream("/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      for await (const event of response) {
        try {
          const parsedChunk = JSON.parse(event?.data?.trim().replace(/^data:\s*/, "") || "");
          const newContent = parseStreamText(parsedChunk);

          if (parsedChunk.sources) {
            updateActiveAssistantSources(parsedChunk.sources);
          }

          if (newContent) {
            setInformativeMessage("");
            upsertActiveAssistantMessage((message) => ({
              ...message,
              content: message.content + newContent,
            }));
            scrollToBottom();
          } else if (parsedChunk.message) {
            setInformativeMessage(parsedChunk.message);
          } else if (parsedChunk.error) {
            setInformativeMessage(parsedChunk.error);
          }
        } catch {
          const text = event?.data || "";
          if (text && text !== "[DONE]") {
            upsertActiveAssistantMessage((message) => ({
              ...message,
              content: message.content + text,
            }));
            scrollToBottom();
          }
        }
      }
    } catch (error) {
      setInformativeMessage(`请求失败：${(error as Error).message}`);
    } finally {
      completeLastAssistantMessage();
      setIsStreaming(false);
    }
  };

  React.useEffect(() => {
    return () => {
      clearRevealTimers();
    };
  }, []);

  return (
    <div className="blog-chat-shell flex h-screen min-h-[420px] flex-col bg-[#fafafa] text-zinc-950 transition-colors dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-base font-semibold tracking-tight">HiYngaの随✏️记 - AI助手</div>
      </header>

      <main
        ref={containerRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        className="blog-chat-scroll flex-1 overflow-y-auto px-4 py-5"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <img
              src={defaultLogo}
              alt="HiYnga 博客 Logo"
              className="mb-6 h-auto w-[15rem] max-w-full object-contain sm:w-[17rem]"
              loading="eager"
            />
            <div className="text-lg font-semibold tracking-tight">从博客里找答案</div>
            <div className="mt-2 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-300">
              可以问部署记录、配置细节、文章里的截图说明，或让助手帮你归纳某篇文章的重点。
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, messageIndex) => {
              const isAssistantComplete =
                message.role === "assistant" && message.status === "complete";
              const isLatestUserMessage =
                message.role === "user" &&
                messages.slice(messageIndex + 1).every((candidate) => candidate.role !== "user");
              const assistantSections =
                message.role === "assistant"
                  ? splitAssistantSections(message.content)
                  : { body: message.content, references: "" };
              const renderedInlineImageKeys = new Set<string>();
              const renderInlineImagesForChildren = (children: React.ReactNode) => {
                const citedSourceIndices = collectCitedSourceIndices(children);
                const contextText = childrenToText(children);
                const imagesToRender: Array<{
                  image: SourceImage;
                  source: Source;
                  sourceIndex: number;
                }> = [];

                for (const sourceIndex of citedSourceIndices) {
                  const source = message.sources?.[sourceIndex];
                  const images = source?.images || [];
                  if (!source || images.length === 0) {
                    continue;
                  }

                  const rankedImages = images
                    .map((image) => ({
                      image,
                      key: buildRenderedImageKey(sourceIndex, image),
                      score: scoreInlineImageMatch(source, image, contextText),
                    }))
                    .sort((left, right) => right.score - left.score);

                  const bestMatch =
                    rankedImages.find((candidate) => !renderedInlineImageKeys.has(candidate.key) && candidate.score > 0) ??
                    rankedImages.find((candidate) => !renderedInlineImageKeys.has(candidate.key)) ??
                    rankedImages[0];

                  if (!bestMatch) {
                    continue;
                  }

                  if (renderedInlineImageKeys.has(bestMatch.key)) {
                    continue;
                  }

                  renderedInlineImageKeys.add(bestMatch.key);
                  imagesToRender.push({ image: bestMatch.image, source, sourceIndex });
                  if (imagesToRender.length >= 1) {
                    break;
                  }
                }

                if (imagesToRender.length === 0) {
                  return null;
                }

                return (
                  <div className="my-4 space-y-3">
                    {imagesToRender.map(({ image, source, sourceIndex }) => (
                      <button
                        key={`${sourceIndex}:${image.path}`}
                        type="button"
                        onClick={() => openSource(message.sources || [], sourceIndex)}
                        className="block w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 text-left transition hover:border-amber-300 hover:bg-amber-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-400/40"
                      >
                        <img
                          src={image.url}
                          alt={image.alt || image.path}
                          className="max-h-[420px] w-full object-cover object-top"
                          loading="lazy"
                          onLoad={() => scrollToBottom()}
                        />
                        <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
                          <div className="line-clamp-2 text-xs font-medium text-zinc-800 dark:text-zinc-100">
                            {image.alt || source.heading || source.title}
                          </div>
                          <div className="mt-1 line-clamp-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            {source.heading || source.title}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              };
              const renderMarkdownLink = ({ href, children }: { href?: string; children?: React.ReactNode }) => {
                if (href?.startsWith("cite:")) {
                  const sourceIndex = Number.parseInt(href.slice("cite:".length), 10) - 1;
                  const source = message.sources?.[sourceIndex];
                  const label = childrenToText(children).trim() || `[${sourceIndex + 1}]`;
                  const fallbackTitle = source
                    ? `${source.heading || source.title}\n${decodeUrlForDisplay(source.url)}`
                    : "引用来源加载中";
                  if (!source?.url) {
                    return (
                      <button
                        type="button"
                        onClick={() => openSource(message.sources || [], sourceIndex)}
                        className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-100 dark:hover:bg-amber-400/30"
                        title={fallbackTitle}
                      >
                        {label}
                      </button>
                    );
                  }

                  return (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-100 dark:hover:bg-amber-400/30"
                      title={fallbackTitle}
                    >
                      {label}
                    </a>
                  );
                }

                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {children}
                  </a>
                );
              };

              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    message.role === "user"
                      ? "border border-sky-200 bg-sky-50 text-slate-900 dark:border-sky-400/40 dark:bg-sky-400/14 dark:text-sky-50"
                      : "border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <>
                      {assistantSections.body ? (
                        <Markdown
                          className="prose prose-sm max-w-none prose-headings:text-zinc-900 prose-strong:text-zinc-950 prose-a:break-all prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline dark:prose-invert dark:prose-headings:text-zinc-50 dark:prose-p:text-zinc-100 dark:prose-li:text-zinc-100 dark:prose-strong:text-zinc-50 dark:prose-a:text-sky-300"
                          urlTransform={markdownUrlTransform}
                          components={{
                            a: renderMarkdownLink,
                            p: ({ children }) => (
                              <div className="my-3 first:mt-0 last:mb-0">
                                <p>{children}</p>
                                {renderInlineImagesForChildren(children)}
                              </div>
                            ),
                            li: ({ children }) => (
                              <li className="my-1">
                                <div>{children}</div>
                                {renderInlineImagesForChildren(children)}
                              </li>
                            ),
                            img: ({ src, alt }) => {
                              const sourceIndex = parseInlineImageSourceIndex(src);
                              if (sourceIndex === null) {
                                return (
                                  <img
                                    src={src}
                                    alt={alt || ""}
                                    className="my-3 max-h-[420px] w-full rounded-2xl object-cover object-top"
                                    loading="lazy"
                                    onLoad={() => scrollToBottom()}
                                  />
                                );
                              }

                              const source = message.sources?.[sourceIndex];
                              const images = source?.images || [];
                              if (!source || images.length === 0) {
                                return null;
                              }

                              const altContext = `${alt || ""} ${source.heading || ""} ${source.text || ""}`.trim();
                              const rankedImages = images
                                .map((image) => ({
                                  image,
                                  key: buildRenderedImageKey(sourceIndex, image),
                                  score: scoreInlineImageMatch(source, image, altContext),
                                }))
                                .sort((left, right) => right.score - left.score);

                              const bestMatch =
                                rankedImages.find((candidate) => !renderedInlineImageKeys.has(candidate.key) && candidate.score > 0) ??
                                rankedImages.find((candidate) => !renderedInlineImageKeys.has(candidate.key)) ??
                                rankedImages[0];

                              if (!bestMatch) {
                                return null;
                              }

                              renderedInlineImageKeys.add(bestMatch.key);

                              return (
                                <div className="my-4 space-y-3">
                                  <button
                                    key={`${sourceIndex}:${bestMatch.image.path}`}
                                    type="button"
                                    onClick={() => openSource(message.sources || [], sourceIndex)}
                                    className="block w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 text-left transition hover:border-amber-300 hover:bg-amber-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-400/40"
                                  >
                                    <img
                                      src={bestMatch.image.url}
                                      alt={bestMatch.image.alt || alt || bestMatch.image.path}
                                      className="max-h-[420px] w-full object-cover object-top"
                                      loading="lazy"
                                      onLoad={() => scrollToBottom()}
                                    />
                                    <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
                                      <div className="line-clamp-2 text-xs font-medium text-zinc-800 dark:text-zinc-100">
                                        {bestMatch.image.alt || alt || source.heading || source.title}
                                      </div>
                                      <div className="mt-1 line-clamp-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                                        {source.heading || source.title}
                                      </div>
                                    </div>
                                  </button>
                                </div>
                              );
                            },
                          }}
                        >
                          {formatAssistantMarkdown(assistantSections.body)}
                        </Markdown>
                      ) : null}

                      {assistantSections.references ? (
                        <Markdown
                          className="prose prose-sm mt-4 max-w-none prose-a:break-all prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline dark:prose-invert dark:prose-p:text-zinc-200 dark:prose-li:text-zinc-200 dark:prose-strong:text-zinc-50 dark:prose-a:text-sky-300"
                          urlTransform={markdownUrlTransform}
                          components={{
                            a: renderMarkdownLink,
                            img: () => null,
                          }}
                        >
                          {formatAssistantMarkdown(assistantSections.references)}
                        </Markdown>
                      ) : null}
                    </>
                  ) : (
                    <Markdown
                      className="prose prose-sm max-w-none prose-p:my-0 dark:prose-invert dark:prose-p:text-sky-50"
                      urlTransform={markdownUrlTransform}
                    >
                      {message.content}
                    </Markdown>
                  )}
                </div>

                {isLatestUserMessage && informativeMessage && isStreaming && (
                  <div className="mt-3 w-full max-w-[90%] self-start rounded-xl bg-zinc-100 px-4 py-2 text-sm text-zinc-600 shadow-sm dark:bg-zinc-900/90 dark:text-zinc-300">
                    {informativeMessage}
                  </div>
                )}

                {isAssistantComplete && (message.metaRevealStage || 0) >= 1 && (message.sources || []).length > 0 && (
                  <section className="mt-3 w-full max-w-[90%] rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/75">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">
                      引用来源
                    </div>
                    <div className="space-y-2">
                      {(message.sources || []).map((source, index) => (
                        <div
                          key={`${source.postId}-${source.anchor || index}`}
                          className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50 dark:border-zinc-700 dark:bg-zinc-950/35 dark:hover:border-amber-400/40 dark:hover:bg-zinc-800/80"
                        >
                          <button
                            type="button"
                            onClick={() => openSource(message.sources || [], index)}
                            className="block w-full text-left"
                          >
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {getSourceLabel(source, index)}
                            </div>
                          </button>
                          <div className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-500 dark:text-zinc-300">
                            {source.text}
                          </div>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex max-w-full break-all text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
                            style={{ overflowWrap: "anywhere" }}
                          >
                            {decodeUrlForDisplay(source.url)}
                          </a>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                </div>
              );
            })}
          </div>
        )}

        {informativeMessage && !isStreaming && (
          <div className="mt-4 rounded-xl bg-zinc-100 px-4 py-2 text-sm text-zinc-600 dark:bg-zinc-900/90 dark:text-zinc-300">
            {informativeMessage}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
        <PlaceholdersAndVanishInput
          placeholders={[
            "从博客文章里找线索...",
            "帮我归纳某篇文章的重点",
            "想了解部署、评论、主题配置都可以问",
          ]}
          onChange={(event) => setInputMessage(event.target.value)}
          onSubmit={handleSendMessage}
        />
      </footer>

      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-3 backdrop-blur-sm md:items-center">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  引用 [{selectedSource.sourceIndex + 1}]
                </div>
                <div className="mt-1 text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  {selectedSource.source.title}
                </div>
                {selectedSource.source.heading && (
                  <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {selectedSource.source.heading}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                aria-label="关闭引用来源弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="blog-chat-scroll overflow-y-auto px-5 py-4">
              <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-7 text-zinc-900 dark:bg-amber-400/10 dark:text-zinc-100">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                  文章命中内容
                </div>
                <div className="rounded-xl border border-amber-200 bg-white/80 p-4 dark:border-amber-400/20 dark:bg-zinc-950/50">
                  <mark className="bg-amber-200/80 px-1 py-0.5 text-zinc-950 dark:bg-amber-300/30 dark:text-zinc-50">
                    {selectedSource.source.text}
                  </mark>
                </div>
              </div>

              {(selectedSource.source.images || []).length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    相关图片
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {(selectedSource.source.images || []).map((image) => (
                      <figure
                        key={image.path}
                        className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <img
                          src={image.url}
                          alt={image.alt || image.path}
                          className="aspect-[4/3] w-full object-cover"
                          loading="lazy"
                        />
                        <figcaption className="space-y-1 px-3 py-2">
                          <div className="line-clamp-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                            {image.alt || image.path}
                          </div>
                          {image.text && (
                            <div className="line-clamp-3 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                              {image.text}
                            </div>
                          )}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <div className="font-medium text-zinc-800 dark:text-zinc-200">原文链接</div>
                <a
                  href={selectedSource.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block break-all text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {decodeUrlForDisplay(selectedSource.source.url)}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .blog-chat-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(161, 161, 170, 0.72) transparent;
        }

        .blog-chat-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }

        .blog-chat-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .blog-chat-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(161, 161, 170, 0.72);
        }

        .blog-chat-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(113, 113, 122, 0.82);
        }

        .dark .blog-chat-scroll {
          scrollbar-color: rgba(113, 113, 122, 0.78) transparent;
        }

        .dark .blog-chat-scroll::-webkit-scrollbar-thumb {
          background: rgba(113, 113, 122, 0.78);
        }

        .dark .blog-chat-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(161, 161, 170, 0.82);
        }
      `}</style>
    </div>
  );
}
