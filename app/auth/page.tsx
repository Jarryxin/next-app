"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AuthPage() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrState, setQrState] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "登录失败");
        return;
      }

      router.push("/chat");
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  async function handleFeishuWeb() {
    setFeishuLoading(true);
    try {
      const res = await fetch("/api/auth/feishu");
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setError("飞书登录启动失败");
      setFeishuLoading(false);
    }
  }

  async function handleFeishuQR() {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      setError("扫码登录需要公网地址，本地开发请使用「飞书 Web 授权登录」");
      return;
    }
    setFeishuLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/feishu");
      const { url, state } = await res.json();
      setQrState(state);
      setQrUrl(url);
    } catch {
      setError("飞书登录启动失败");
      setFeishuLoading(false);
    }
  }

  useEffect(() => {
    if (!qrState) return;

    let cancelled = false;
    async function poll() {
      while (!cancelled) {
        try {
          const res = await fetch(`/api/auth/feishu/status?state=${qrState}`);
          const data = await res.json();
          if (data.status === "success") {
            cancelled = true;
            router.push("/chat");
            return;
          }
        } catch {
          // retry
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    poll();

    return () => { cancelled = true; };
  }, [qrState, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="flex flex-col items-center gap-4 rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="text-xl font-semibold">登录</h1>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入你的名字"
          className="w-64 rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
          disabled={loading}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit(e as unknown as FormEvent)}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !name.trim()}
          className="w-64 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "登录中..." : "进入"}
        </button>

        <div className="flex w-64 flex-col gap-2">
          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-zinc-300 dark:border-zinc-600" />
            <span className="mx-3 text-xs text-zinc-400">或</span>
            <div className="flex-grow border-t border-zinc-300 dark:border-zinc-600" />
          </div>

          <button
            onClick={handleFeishuWeb}
            disabled={feishuLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.5 2.5L2.5 4.5V8L4 6.5V5L6.5 4L7.5 2L5.5 2.5ZM20.5 5.5L22 4V8L19 10L18.5 8.5L21 7.5V6L19 4.5L20.5 5.5ZM8 4L12 6L16 4L18 6V9L14 7.5V8.5L17 10L13 12L11 14L9 12L5 10L8 8.5V7.5L10 8.5V10L8 9V6L6 4.5L8 4ZM12 17L14 15L16 17L14 19L12 17ZM10 14L11 15L14 12L17 15L18 14L15 11L18 8L17 7L14 10L11 7L10 8L13 11L10 14Z" />
            </svg>
            飞书 Web 授权登录
          </button>

          <button
            onClick={handleFeishuQR}
            disabled={feishuLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="3" height="3" />
              <rect x="18" y="18" width="3" height="3" />
            </svg>
            飞书扫码登录
          </button>
        </div>

        {qrUrl && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <Image
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
              alt="扫码登录飞书"
              width={200}
              height={200}
              className="rounded-lg border border-zinc-200 dark:border-zinc-700"
              unoptimized
            />
            <p className="text-xs text-zinc-400">使用飞书 App 扫码登录</p>
          </div>
        )}
      </div>
    </div>
  );
}
