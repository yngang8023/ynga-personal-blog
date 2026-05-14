import { stream } from "fetch-event-stream";
import React, { useRef, useState } from "react";
import Markdown from "react-markdown";
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
}

function parseStreamText(chunk: any): string {
  return chunk.response || chunk.choices?.[0]?.delta?.content || chunk.delta?.text || "";
}

function normalizeAssistantMarkdown(content: string): string {
  return content.replace(/\[(\d+)\]/g, "[[$1]](cite:$1)");
}

function getSourceLabel(source: Source, index: number): string {
  return `[${index + 1}] ${source.title}${source.heading ? ` / ${source.heading}` : ""}`;
}

function getSourceImages(source: Source | undefined, maxCount = 2) {
  return (source?.images || []).slice(0, maxCount);
}

function getInlineImageSources(sources: Source[], maxCount = 3) {
  const seen = new Set<string>();
  const result: Array<Source & { sourceIndex: number; inlineImages: SourceImage[] }> = [];

  sources.forEach((source, sourceIndex) => {
    const inlineImages = (source.images || []).filter((image) => {
      const key = `${image.path}#${image.url}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    if (inlineImages.length > 0 && result.length < maxCount) {
      result.push({ ...source, sourceIndex, inlineImages: inlineImages.slice(0, 2) });
    }
  });

  return result;
}

function collectPreviewImages(sources: Source[]) {
  const seen = new Set<string>();

  return sources
    .flatMap((source, sourceIndex) =>
      (source.images || []).map((image) => ({
        ...image,
        sourceIndex,
        label: source.heading || source.title,
      })),
    )
    .filter((image) => {
      const key = `${image.path}#${image.url}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function buildMessageId(role: Message["role"]): string {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }
    });
  };

  const upsertLastAssistantMessage = (updater: (message: Message) => Message) => {
    setMessages((previous) => {
      const lastMessage = previous[previous.length - 1];
      if (lastMessage?.role === "assistant") {
        return [...previous.slice(0, -1), updater(lastMessage)];
      }

      return [
        ...previous,
        updater({
          id: buildMessageId("assistant"),
          role: "assistant",
          content: "",
          sources: [],
        }),
      ];
    });
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
    scrollToBottom();

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
            upsertLastAssistantMessage((message) => ({
              ...message,
              sources: parsedChunk.sources,
            }));
          }

          if (newContent) {
            setInformativeMessage("");
            upsertLastAssistantMessage((message) => ({
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
            upsertLastAssistantMessage((message) => ({
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
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-screen min-h-[420px] flex-col bg-[#fafafa] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-base font-semibold tracking-tight">HiYngaの随✏️记 - AI助手</div>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          参考博客文章、章节片段和相关图片，帮你快速定位内容
        </div>
      </header>

      <main ref={containerRef} className="flex-1 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="text-lg font-semibold tracking-tight">从博客里找答案</div>
            <div className="mt-2 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              可以问部署记录、配置细节、文章里的截图说明，或让助手帮你归纳某篇文章的重点。
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const previewImages = collectPreviewImages(message.sources || []);
              const inlineImageSources = getInlineImageSources(message.sources || []);

              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    message.role === "user"
                      ? "border border-sky-200 bg-sky-50 text-slate-900 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-50"
                      : "border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <>
                      <Markdown
                        className="prose prose-sm max-w-none prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline dark:prose-invert dark:prose-a:text-blue-300"
                        components={{
                          a: ({ href, children }) => {
                            if (href?.startsWith("cite:")) {
                              const sourceIndex = Number.parseInt(href.slice("cite:".length), 10) - 1;
                              const source = message.sources?.[sourceIndex];
                              return (
                                <a
                                  href={source?.url || "#"}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => {
                                    if (!source?.url) {
                                      event.preventDefault();
                                      openSource(message.sources || [], sourceIndex);
                                    }
                                  }}
                                  className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-100 dark:hover:bg-amber-400/30"
                                  title={source?.heading || source?.title || "查看引用来源"}
                                >
                                  {children}
                                </a>
                              );
                            }

                            return (
                              <a href={href} target="_blank" rel="noreferrer">
                                {children}
                              </a>
                            );
                          },
                        }}
                      >
                        {normalizeAssistantMarkdown(message.content)}
                      </Markdown>

                      {inlineImageSources.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {inlineImageSources.map((source) => (
                            <div
                              key={`${source.postId}-${source.sourceIndex}`}
                              className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/60"
                            >
                              <div className="grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                                <div className="grid grid-cols-1 gap-2 p-2">
                                  {getSourceImages(source, 2).map((image) => (
                                    <img
                                      key={image.path}
                                      src={image.url}
                                      alt={image.alt || image.path}
                                      className="max-h-56 w-full rounded-xl object-cover"
                                      loading="lazy"
                                    />
                                  ))}
                                </div>
                                <div className="p-3">
                                  <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                                    配图来源 [{source.sourceIndex + 1}]
                                  </div>
                                  <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    {source.heading || source.title}
                                  </div>
                                  <div className="mt-2 line-clamp-5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                    {source.text}
                                  </div>
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-flex text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
                                  >
                                    打开原文
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <Markdown className="prose prose-sm max-w-none prose-p:my-0 dark:prose-invert">
                      {message.content}
                    </Markdown>
                  )}
                </div>

                {message.role === "assistant" && previewImages.length > 0 && (
                  <section className="mt-3 w-full max-w-[88%] rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      相关图片
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {previewImages.map((image) => (
                        <button
                          key={`${image.path}-${image.sourceIndex}`}
                          type="button"
                          onClick={() => openSource(message.sources || [], image.sourceIndex)}
                          className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 text-left transition hover:border-amber-300 hover:bg-amber-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-400/40"
                        >
                          <img
                            src={image.url}
                            alt={image.alt || image.path}
                            className="aspect-[4/3] w-full object-cover"
                            loading="lazy"
                          />
                          <div className="px-3 py-2">
                            <div className="line-clamp-1 text-xs font-medium text-zinc-800 dark:text-zinc-100">
                              {image.alt || image.path}
                            </div>
                            <div className="mt-1 line-clamp-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                              {image.label}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {message.role === "assistant" && (message.sources || []).length > 0 && (
                  <section className="mt-3 w-full max-w-[88%] rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      引用来源
                    </div>
                    <div className="space-y-2">
                      {(message.sources || []).map((source, index) => (
                        <div
                          key={`${source.postId}-${source.anchor || index}`}
                          className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50 dark:border-zinc-800 dark:hover:border-amber-400/40 dark:hover:bg-zinc-900"
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
                          <div className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                            {source.text}
                          </div>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex break-all text-xs font-medium text-blue-600 hover:underline dark:text-blue-300"
                          >
                            {source.url}
                          </a>
                          {(source.images || []).length > 0 && (
                            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                              {(source.images || []).slice(0, 4).map((image) => (
                                <div
                                  key={image.path}
                                  className="h-16 w-16 flex-none overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
                                >
                                  <img
                                    src={image.url}
                                    alt={image.alt || image.path}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
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

        {informativeMessage && (
          <div className="mt-4 rounded-xl bg-zinc-100 px-4 py-2 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
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
                className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-500 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                关闭
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
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
                  {selectedSource.source.url}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
