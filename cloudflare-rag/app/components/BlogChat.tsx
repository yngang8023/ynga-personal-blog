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
    <div className="flex h-screen min-h-[420px] flex-col bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="text-sm font-semibold">HiYnga 博客 AI 助手</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          直接引用博客正文、章节片段和相关图片
        </div>
      </header>

      <main ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="text-base font-semibold">问我博客里的内容</div>
            <div className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              例如：EdgeOne Pages 怎么部署？Waline 代理怎么配置？
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const previewImages = collectPreviewImages(message.sources || []);

              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <Markdown
                      className="prose prose-sm max-w-none dark:prose-invert"
                      components={{
                        a: ({ href, children }) => {
                          if (href?.startsWith("cite:")) {
                            const sourceIndex = Number.parseInt(href.slice("cite:".length), 10) - 1;
                            return (
                              <button
                                type="button"
                                onClick={() => openSource(message.sources || [], sourceIndex)}
                                className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-200 dark:bg-amber-400/20 dark:text-amber-200 dark:hover:bg-amber-400/30"
                              >
                                {children}
                              </button>
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
                  ) : (
                    <Markdown className="prose prose-sm max-w-none dark:prose-invert">
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
                        <button
                          key={`${source.postId}-${source.anchor || index}`}
                          type="button"
                          onClick={() => openSource(message.sources || [], index)}
                          className="w-full rounded-xl border border-zinc-200 px-3 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50 dark:border-zinc-800 dark:hover:border-amber-400/40 dark:hover:bg-zinc-900"
                        >
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {getSourceLabel(source, index)}
                          </div>
                          <div className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                            {source.text}
                          </div>
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
                        </button>
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
            "问问博客里的文章...",
            "EdgeOne Pages 怎么部署？",
            "Waline 代理怎么配置？",
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
