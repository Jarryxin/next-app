"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface SourceResult {
  content: string;
  source: string;
  similarity: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceResult[];
}

export function useChat(api: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef("");
  const rafRef = useRef(0);
  const conversationIdRef = useRef<string | null>(null);

  const scheduleRender = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const text = contentRef.current;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: text };
        return updated;
      });
    });
  }, []);

  const loadConversation = useCallback(async (convId: string) => {
    setConversationId(convId || null);
    conversationIdRef.current = convId || null;
    setMessages([]);
    if (!convId) return;
    const res = await fetch(`/api/conversations/${convId}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(
      data.messages.map((m: { role: string; content: string; sources?: SourceResult[] }) => ({
        role: m.role,
        content: m.content,
        sources: m.sources,
      }))
    );
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: Message = { role: "user", content: input.trim() };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            conversationId: conversationIdRef.current,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(res.status === 401 ? "未登录" : "请求失败");
        }

        const convId = res.headers.get("X-Conversation-Id");
        if (convId && !conversationIdRef.current) {
          conversationIdRef.current = convId;
          setConversationId(convId);
        }

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";

        contentRef.current = "";
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "sources") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = { ...last, sources: parsed.sources };
                  }
                  return updated;
                });
                continue;
              }
              if (parsed.content) {
                contentRef.current += parsed.content;
                scheduleRender();
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "出错了，请重试" },
        ]);
      } finally {
        cancelAnimationFrame(rafRef.current);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: contentRef.current };
          return updated;
        });
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [api, input, isLoading, messages, scheduleRender]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    cancelAnimationFrame(rafRef.current);
    setIsLoading(false);
  }, []);

  return { messages, input, setInput, handleSubmit, isLoading, stop, conversationId, loadConversation };
}
