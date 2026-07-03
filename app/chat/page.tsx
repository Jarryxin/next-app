"use client";

import { useChat } from "@/lib/use-chat";
import { useEffect, useRef, useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SourceResult {
  content: string;
  source: string;
  similarity: number;
}

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
  msg: { role: string; content: string; sources?: SourceResult[] };
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
  const { messages, input, setInput, handleSubmit, isLoading, stop } =
    useChat("/api/chat");
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

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

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">AI Chat</h1>
      </header>

      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-zinc-400">
            发送一条消息开始对话
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

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息..."
          disabled={isLoading}
          className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800"
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
  );
}
