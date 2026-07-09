"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "@/app/components/NavBar";

interface UserInfo {
  id: string;
  name: string | null;
  avatar: string | null;
}

const features = [
  {
    title: "AI 对话",
    description: "多模型流式对话，支持 Agnes AI / 智谱 GLM / 百炼 DashScope 多 Provider 切换，自动 Fallback 保障可用性",
    href: "/chat",
    label: "开始对话",
  },
  {
    title: "RAG 知识库检索",
    description: "基于 pgvector + bge-m3 语义检索，Markdown 文档自动分块索引，对话时实时增强生成",
    href: "/upload",
    label: "管理知识库",
  },
  {
    title: "文档上传与分类",
    description: "拖拽上传 .md / .jpg / .png，LLM 自动分类，支持编辑后再索引到知识库",
    href: "/upload",
    label: "上传文档",
  },
  {
    title: "手写笔记转录",
    description: "通过视觉 API 将手写笔记图片自动转录为 Markdown，保留排版与内容，随 RAG 索引",
    href: "/upload",
    label: "转录笔记",
  },
  {
    title: "笔记自动分类归档",
    description: "AI 识别笔记内容类别，自动归档到对应目录，支持递归扫描索引",
    href: "/upload",
    label: "分类归档",
  },
  {
    title: "WebSocket 实时通信",
    description: "单播 / 房间播 / 广播三种分发模式，结合 Redis Pub/Sub 支撑多实例横向扩展",
    href: "/ws-demo",
    label: "查看 Demo",
  },
  {
    title: "流式 SSE 中断恢复",
    description: "自定义 SSE 钩子，RAF 节流渲染，网络中断后保留已收内容并支持一键重试",
    href: "/chat",
    label: "了解详情",
  },
  {
    title: "飞书 OAuth 登录",
    description: "企业级身份认证，扫码授权登录，自动创建会话，用户数据隔离",
    href: "/auth",
    label: "了解登录",
  },
];

export default function Home() {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-950">
      <NavBar />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pt-16 pb-12">
        <div className="mb-4 rounded-full bg-blue-100 px-4 py-1 text-xs text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          v0.2 · AI Chat + RAG + Feishu OAuth
        </div>

        <h1 className="mb-3 text-center text-3xl font-bold tracking-tight text-zinc-800 dark:text-zinc-100">
          AI 智能助手
        </h1>

        <p className="mb-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          对话式 AI · 知识库 RAG · 多模型切换 · 文档上传分类 · 飞书登录
        </p>

        {user ? (
          <div className="mb-10 flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-green-500">&#x2713;</span>
            <span>已登录：</span>
            {user.avatar && (
              <img src={user.avatar} alt="" className="h-6 w-6 rounded-full" />
            )}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{user.name || "用户"}</span>
            <Link
              href="/chat"
              className="ml-2 rounded-lg bg-blue-600 px-4 py-1.5 text-xs text-white transition hover:bg-blue-700"
            >
              进入对话
            </Link>
          </div>
        ) : (
          <Link
            href="/auth"
            className="mb-10 rounded-lg bg-blue-600 px-6 py-2 text-sm text-white transition hover:bg-blue-700"
          >
            登录开始使用
          </Link>
        )}

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-700"
            >
              <h3 className="mb-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                {f.title}
              </h3>
              <p className="mb-3 text-xs leading-relaxed text-zinc-400">
                {f.description}
              </p>
              <span className="text-xs font-medium text-blue-500 transition group-hover:text-blue-600">
                {f.label} &rarr;
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
