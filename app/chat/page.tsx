"use client";

import { useChat } from "@/lib/use-chat";
import { useEffect, useRef, useState, memo, useCallback } from "react";
import NavBar from "@/app/components/NavBar";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SourceResult {
  content: string;
  source: string;
  similarity: number;
}

interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

const modelLabels: Record<string, string> = {
  agnes: "Agnes AI",
  dashscope: "百炼 DashScope",
};

const MarkdownContent = memo(function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className="rounded bg-zinc-300/50 px-1 dark:bg-zinc-700/50"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <pre className="overflow-x-auto rounded-lg bg-zinc-800 p-3 text-sm text-zinc-100">
              <code className={className} {...props}>
                {children}
              </code>
            </pre>
          );
        },
        ul({ children }) {
          return <ul className="list-disc pl-5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-5">{children}</ol>;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {children}
            </a>
          );
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0">{children}</p>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
});

function SourcesBlock({ sources }: { sources: SourceResult[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2 border-t border-zinc-300/50 pt-1 dark:border-zinc-700/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
      >
        <span>{expanded ? "▼" : "▶"}</span>
        <span>知识库来源 ({sources.length})</span>
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {sources.map((s, i) => (
            <div key={i} className="rounded bg-zinc-100 p-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <div className="mb-0.5 font-medium text-zinc-500 dark:text-zinc-500">
                {s.source} · 相似度 {(s.similarity * 100).toFixed(0)}%
              </div>
              <div className="line-clamp-3">{s.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MessageBubble = memo(function MessageBubble({
  msg,
  showCursor,
}: {
  msg: { role: string; content: string; sources?: SourceResult[]; model?: string };
  showCursor: boolean;
}) {
  return (
    <div
      className={`mb-4 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
          msg.role === "user"
            ? "bg-blue-600 text-white [&_p]:text-white"
            : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        }`}
      >
        {msg.role === "assistant" ? (
          <>
            {msg.model && (
              <div className="mb-1 text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
                {modelLabels[msg.model] || msg.model}
              </div>
            )}
            {msg.content ? (
              <MarkdownContent content={msg.content} />
            ) : showCursor ? (
              <span className="animate-pulse">...</span>
            ) : null}
            {msg.sources && msg.sources.length > 0 && (
              <SourcesBlock sources={msg.sources} />
            )}
          </>
        ) : (
          <p>{msg.content}</p>
        )}
      </div>
    </div>
  );
});

export default function ChatPage() {
  const { messages, input, setInput, handleSubmit, isLoading, stop, conversationId, loadConversation, streamError, retry, selectedModel, setSelectedModel } =
    useChat("/api/chat");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok && !cancelled) {
          setConversations(await res.json());
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok && !cancelled) {
          setConversations(await res.json());
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (!userScrolledUp.current || isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onScroll() {
      const cur = containerRef.current;
      if (!cur) return;
      const nearBottom =
        cur.scrollHeight - cur.scrollTop - cur.clientHeight < 100;
      userScrolledUp.current = !nearBottom;
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const handleConversationClick = useCallback(async (convId: string) => {
    await loadConversation(convId);
  }, [loadConversation]);

  const handleNewChat = useCallback(() => {
    loadConversation("");
  }, [loadConversation]);

  const handleDeleteConversation = useCallback(async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/conversations/${convId}`, { method: "DELETE" });
      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (conversationId === convId) {
          loadConversation("");
        }
      }
    } catch {}
  }, [conversationId, loadConversation]);

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-black">
      <NavBar />
      <div className="mx-auto flex flex-1 w-full max-w-5xl overflow-hidden">
      <aside className="flex w-64 flex-col border-r border-zinc-200 dark:border-zinc-800">
        <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
          <button
            onClick={handleNewChat}
            className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition hover:bg-blue-700"
          >
            + 新对话
          </button>
        </div>
        <div className="flex-1 overflow-y-scroll p-2">
          {conversations.map((conv) => (
            <div key={conv.id} className="group relative">
              <button
                onClick={() => handleConversationClick(conv.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  conv.id === conversationId
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <div className="truncate font-medium">{conv.title}</div>
                <div className="text-xs text-zinc-400">
                  {conv._count.messages} 条消息
                </div>
              </button>
              <button
                onClick={(e) => handleDeleteConversation(e, conv.id)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-400 opacity-0 transition hover:bg-red-100 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/30"
                title="删除对话"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="p-3 text-center text-xs text-zinc-400">暂无对话</p>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h1 className="text-lg font-semibold">AI Chat</h1>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoading}
            className="rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="agnes">Agnes AI</option>
            <option value="dashscope">百炼 DashScope</option>
          </select>
        </header>

        <div ref={containerRef} className="flex-1 overflow-y-scroll px-4 py-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-zinc-400">
              选择或创建一个对话
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              msg={msg}
              showCursor={isLoading && i === messages.length - 1 && msg.role === "assistant" && !msg.content}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {streamError && (
          <div className="flex items-center justify-between border-t border-zinc-200 bg-orange-50 px-4 py-2 dark:border-zinc-800 dark:bg-orange-900/20">
            <span className="text-sm text-orange-700 dark:text-orange-300">
              连接中断，已收到部分内容
            </span>
            <button
              onClick={retry}
              disabled={isLoading}
              className="rounded-lg bg-orange-500 px-3 py-1 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
            >
              重试
            </button>
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息... (Shift+Enter 换行, Enter 发送)"
            disabled={isLoading}
            className="flex-1 resize-none rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition hover:bg-red-600"
            >
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              发送
            </button>
          )}
        </form>
      </div>
    </div>
    </div>
  );
}
