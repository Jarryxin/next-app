"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { wsClient } from "./ws-client";

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

export function useWSChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("idle");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const contentRef = useRef("");
  const rafRef = useRef(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const unsub = wsClient.on("status", (status) => {
      setConnectionStatus(status as string);
    });
    return () => { unsub(); };
  }, []);

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

  useEffect(() => {
    const unsub = wsClient.on("message", (raw) => {
      const data = raw as Record<string, unknown>;
      switch (data.type as string) {
        case "sources":
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") {
              updated[updated.length - 1] = { ...last, sources: data.sources as SourceResult[] };
            }
            return updated;
          });
          break;
        case "token":
          contentRef.current += (data.content as string) || "";
          scheduleRender();
          break;
        case "done":
          cancelAnimationFrame(rafRef.current);
          contentRef.current = "";
          setIsLoading(false);
          if (data.conversationId) {
            conversationIdRef.current = data.conversationId as string;
            setConversationId(data.conversationId as string);
          }
          break;
        case "error":
          cancelAnimationFrame(rafRef.current);
          contentRef.current = "";
          setIsLoading(false);
          setMessages((prev) => [...prev, { role: "assistant", content: (data.message as string) || "出错了" }]);
          break;
      }
    });
    return () => { unsub(); };
  }, [scheduleRender]);

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
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: Message = { role: "user", content: input.trim() };
      const history = [...messagesRef.current, userMessage];

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      contentRef.current = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      wsClient.send({
        type: "chat",
        conversationId: conversationIdRef.current,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      });

      setInput("");
    },
    [input, isLoading]
  );

  const stop = useCallback(() => {
    wsClient.send({ type: "stop" });
    cancelAnimationFrame(rafRef.current);
    setIsLoading(false);
  }, []);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    wsClient.connect(`${protocol}//${window.location.host}/api/ws`);
  }, []);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
  }, []);

  return {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading,
    stop,
    conversationId,
    loadConversation,
    connectionStatus,
    connect,
    disconnect,
  };
}
