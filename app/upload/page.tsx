"use client";

import { useCallback, useRef, useState } from "react";

interface UploadFile {
  id: string;
  name: string;
  size: number;
  category: string;
  mdName: string;
  status: "pending" | "uploaded" | "classified" | "indexed" | "error";
  error?: string;
}

type Step = "select" | "classify" | "review" | "index" | "done";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STEP_LABELS = ["选择文件", "分类", "确认", "完成"] as const;
const STEP_ORDER: Step[] = ["select", "classify", "review", "done"];

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [step, setStep] = useState<Step>("select");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileBlobsRef = useRef<Map<string, File>>(new Map());

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const mapped: UploadFile[] = [];
    for (const f of Array.from(incoming)) {
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (!ext || !["jpg", "jpeg", "png", "md"].includes(ext)) continue;
      fileBlobsRef.current.set(f.name, f);
      mapped.push({ id: "", name: f.name, size: f.size, category: "", mdName: "", status: "pending" });
    }
    if (mapped.length === 0) return;
    setFiles((prev) => [...prev, ...mapped]);
    setError(null);
  }, []);

  const handleUpload = useCallback(async () => {
    const toUpload = files.filter((f) => f.status === "pending");
    if (toUpload.length === 0) return;

    setBusy(true);
    setError(null);

    const formData = new FormData();
    for (const f of toUpload) {
      const blob = fileBlobsRef.current.get(f.name);
      if (blob) formData.append("files", blob);
    }

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = (await res.json()) as { files: { id: string; name: string }[] };
      const idMap = new Map(data.files.map((r) => [r.name, r.id]));

      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          id: idMap.get(f.name) || f.id,
          status: idMap.has(f.name) ? "uploaded" : f.status,
        }))
      );
      setStep("classify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }, [files]);

  const handleClassify = useCallback(async () => {
    const toClassify = files.filter((f) => f.status === "uploaded" || f.status === "classified");
    if (toClassify.length === 0) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: toClassify.map((f) => ({ id: f.id, name: f.name })) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Classify failed");
      }
      const data = (await res.json()) as { results: { id: string; name: string; category: string; error?: string }[] };

      setFiles((prev) =>
        prev.map((f) => {
          const r = data.results.find((x) => x.id === f.id);
          return r
            ? { ...f, name: r.name || f.name, mdName: r.name || f.mdName, category: r.category || "其他", status: (r.error ? "error" : "classified") as UploadFile["status"], error: r.error }
            : f;
        })
      );
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classify failed");
    } finally {
      setBusy(false);
    }
  }, [files]);

  const handleIndex = useCallback(async () => {
    const toIndex = files.filter((f) => f.status === "classified" && f.category);
    if (toIndex.length === 0) {
      setError("没有已分类的文档，请先分类");
      return;
    }

    setBusy(true);
    setError(null);
    setStep("index");

    try {
      const res = await fetch("/api/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: toIndex.map((f) => ({ name: f.mdName, category: f.category })) }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Index failed");
      }
      const data = (await res.json()) as { results: { name: string; success: boolean; error?: string }[] };

      setFiles((prev) =>
        prev.map((f) => {
          const r = data.results.find((x) => x.name === f.mdName);
          return r
            ? { ...f, status: (r.success ? "indexed" : "error") as UploadFile["status"], error: r.error }
            : f;
        })
      );
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Index failed");
      setStep("review");
    } finally {
      setBusy(false);
    }
  }, [files]);

  const updateCategory = useCallback((index: number, val: string) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, category: val } : f)));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleFilePick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [addFiles]
  );

  const stepIndex = STEP_ORDER.indexOf(step === "index" ? "review" : step);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col bg-zinc-50 p-6 dark:bg-black">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">上传文档到知识库</h1>
        <a href="/chat" className="text-sm text-blue-500 underline">
          去对话 →
        </a>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2 text-sm text-zinc-400">
        {STEP_LABELS.map((label, i) => {
          const isActive = i === stepIndex;
          const isDone = i < stepIndex;
          return (
            <span key={label} className="flex items-center gap-1">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isActive ? "bg-blue-600 text-white" : isDone ? "bg-green-500 text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800"
                }`}
              >
                {isDone ? "✓" : i + 1}
              </span>
              <span className={isActive ? "font-medium text-zinc-700 dark:text-zinc-300" : ""}>{label}</span>
              {i < 3 && <span className="text-zinc-300 dark:text-zinc-600">→</span>}
            </span>
          );
        })}
      </div>

      {/* Drop zone */}
      {step === "select" && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-4 cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
            dragOver ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
          }`}
        >
          <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.md" onChange={handleFilePick} className="hidden" />
          <div className="text-zinc-400">
            <p className="mb-1 text-lg">拖拽文件到此处</p>
            <p className="text-sm">或点击选择 .jpg .png .md 文件</p>
          </div>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="mb-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-500 dark:border-zinc-800">
            <span>文件列表 ({files.length})</span>
            {busy && <span className="animate-pulse text-blue-500">处理中...</span>}
          </div>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-sm last:border-0 dark:border-zinc-800/50">
              <span className="w-4 text-center text-xs">
                {f.status === "error" ? <span className="text-red-500">✗</span>
                : f.status === "indexed" ? <span className="text-green-500">✓</span>
                : f.status === "classified" ? <span className="text-blue-500">●</span>
                : f.status === "uploaded" ? <span className="text-zinc-400">●</span>
                : <span className="text-zinc-300">○</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate">{f.name}</p>
                <p className="text-xs text-zinc-400">{formatSize(f.size)}</p>
              </div>
              <div className="flex items-center gap-2">
                {step === "review" ? (
                  <input
                    type="text"
                    value={f.category}
                    onChange={(e) => updateCategory(i, e.target.value)}
                    className="w-28 rounded border border-zinc-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                    placeholder="输入分类"
                  />
                ) : f.category ? (
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {f.category}
                  </span>
                ) : null}
                {f.status === "error" && f.error && (
                  <span className="max-w-[160px] truncate text-xs text-red-500" title={f.error}>
                    {f.error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {step === "select" && files.some((f) => f.status === "pending") && !busy && (
          <button onClick={handleUpload} className="rounded-lg bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700">
            上传到服务器
          </button>
        )}
        {step === "classify" && !busy && (
          <button onClick={handleClassify} className="rounded-lg bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700">
            LLM 自动分类
          </button>
        )}
        {step === "review" && !busy && (
          <>
            <button onClick={handleIndex} className="rounded-lg bg-green-600 px-5 py-2 text-sm text-white hover:bg-green-700">
              确认并索引到知识库
            </button>
            <button onClick={handleClassify} className="rounded-lg border border-zinc-300 px-5 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              重新分类
            </button>
          </>
        )}
        {step === "done" && !busy && (
          <button onClick={() => { setFiles([]); setStep("select"); setError(null); }} className="rounded-lg bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700">
            继续上传
          </button>
        )}
        {busy && (
          <div className="rounded-lg bg-zinc-100 px-5 py-2 text-sm text-zinc-500 dark:bg-zinc-800">
            <span className="animate-pulse">处理中...</span>
          </div>
        )}
      </div>
    </div>
  );
}
