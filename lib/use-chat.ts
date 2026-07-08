"use client";

import { useState, useRef, useCallback } from "react";

interface SourceResult {
  content: string;
  source: string;
  similarity: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: SourceResult[];
  model?: string;
}

export function useChat(api: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState(false);
  const [selectedModel, setSelectedModel] = useState("agnes");
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
    setStreamError(false);
    if (!convId) return;
    const res = await fetch(`/api/conversations/${convId}`);
    if (!res.ok) return;
    const data = await res.json();
    setMessages(
      data.messages.map((m: { role: string; content: string; sources?: SourceResult[]; model?: string }) => ({
        role: m.role,
        content: m.content,
        sources: m.sources,
        model: m.model,
      }))
    );
  }, []);

  const doFetch = useCallback(async (msgs: Message[], signal: AbortSignal) => {
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        conversationId: conversationIdRef.current,
        model: selectedModel,
      }),
      signal,
    });
    if (!res.ok) throw new Error(res.status === 401 ? "未登录" : "请求失败");

    const convId = res.headers.get("X-Conversation-Id");
    if (convId && !conversationIdRef.current) {
      conversationIdRef.current = convId;
      setConversationId(convId);
    }

    const reader = res.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = "";
    let receivedDone = false;

    contentRef.current = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") { receivedDone = true; continue; }

        try {
          const parsed = JSON.parse(data);
              if (parsed.type === "meta") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = { ...last, sources: parsed.sources, model: parsed.model };
                  }
                  return updated;
                });
                continue;
              }
          if (parsed.content) {
            contentRef.current += parsed.content;
            scheduleRender();
          }
        } catch { /* skip */ }
      }
    }

    if (!receivedDone) throw new Error("STREAM_INCOMPLETE");
  }, [api, scheduleRender, selectedModel]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading) return;

      setStreamError(false);

      const userMessage: Message = { role: "user", content: input.trim() };
      const updatedMessages = [...messages, userMessage];
      setMessages([...updatedMessages, { role: "assistant", content: "" }]);
      setInput("");
      setIsLoading(true);

      contentRef.current = "";

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await doFetch(updatedMessages, controller.signal);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setStreamError(true);
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
    [api, input, isLoading, messages, scheduleRender, doFetch]
  );

  const retry = useCallback(async () => {
    if (messages.length < 2) return;
    setStreamError(false);
    setIsLoading(true);

    // 去掉上次失败的 assistant 消息，用全新气泡重试
    const msgsWithoutPartial = messages.slice(0, -1);
    setMessages([...msgsWithoutPartial, { role: "assistant", content: "" }]);
    contentRef.current = "";

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await doFetch(msgsWithoutPartial, controller.signal);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setStreamError(true);
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
  }, [messages, doFetch]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    cancelAnimationFrame(rafRef.current);
    setIsLoading(false);
  }, []);

  return { messages, input, setInput, handleSubmit, isLoading, stop, conversationId, loadConversation, streamError, retry, selectedModel, setSelectedModel };
}
