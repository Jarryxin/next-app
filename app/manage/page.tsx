"use client";

import { useEffect, useState, useCallback } from "react";
import NavBar from "@/app/components/NavBar";

interface KnowledgeDoc {
  id: string;
  path: string;
  category: string;
  filename: string;
  chunkCount: number;
  indexedAt: string;
  createdAt: string;
}

export default function ManagePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to fetch" }));
        throw new Error(err.error || "Failed to fetch");
      }
      const data = await res.json();
      setDocs(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleDelete = useCallback(async (path: string) => {
    if (!confirm(`确认删除「${path}」？此操作不可恢复。`)) return;

    setDeleting(path);
    setError(null);
    try {
      const res = await fetch("/api/knowledge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(err.error || "Delete failed");
      }
      setDocs((prev) => prev.filter((d) => d.path !== path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <NavBar />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold">知识库文件管理</h1>
          <button
            onClick={fetchDocs}
            disabled={loading}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {loading ? "刷新中..." : "刷新"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-zinc-400">
            <span className="animate-pulse">加载中...</span>
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-zinc-400">
            <div className="text-center">
              <p className="mb-2 text-lg">暂无知识库文件</p>
              <p className="text-sm">前往「知识库」页面上传文档</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-100 text-left text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">文件名</th>
                  <th className="px-4 py-3 font-medium">分类</th>
                  <th className="px-4 py-3 font-medium text-right">向量块数</th>
                  <th className="px-4 py-3 font-medium">索引时间</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="border-b border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="max-w-[300px] truncate px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {doc.filename}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {doc.category || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400">
                      {doc.chunkCount}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(doc.indexedAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(doc.path)}
                        disabled={deleting === doc.path}
                        className="rounded px-2 py-1 text-xs text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                      >
                        {deleting === doc.path ? "删除中..." : "删除"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 text-xs text-zinc-400">
          共 {docs.length} 个文件，{docs.reduce((s, d) => s + d.chunkCount, 0)} 个向量块
        </div>
      </div>
    </div>
  );
}
