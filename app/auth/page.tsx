"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AuthPage() {
  const [error, setError] = useState("");
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrState, setQrState] = useState<string | null>(null);
  const router = useRouter();

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
      <div className="flex flex-col items-center gap-5 rounded-xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="text-xl font-semibold">登录</h1>
        <p className="text-center text-sm text-zinc-500">
          使用飞书账号登录以使用 AI 助手
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex w-64 flex-col gap-3">
          <button
            onClick={handleFeishuWeb}
            disabled={feishuLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5.5 2.5L2.5 4.5V8L4 6.5V5L6.5 4L7.5 2L5.5 2.5ZM20.5 5.5L22 4V8L19 10L18.5 8.5L21 7.5V6L19 4.5L20.5 5.5ZM8 4L12 6L16 4L18 6V9L14 7.5V8.5L17 10L13 12L11 14L9 12L5 10L8 8.5V7.5L10 8.5V10L8 9V6L6 4.5L8 4ZM12 17L14 15L16 17L14 19L12 17ZM10 14L11 15L14 12L17 15L18 14L15 11L18 8L17 7L14 10L11 7L10 8L13 11L10 14Z" />
            </svg>
            飞书 Web 授权登录
          </button>

          <button
            onClick={handleFeishuQR}
            disabled={feishuLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-800"
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
