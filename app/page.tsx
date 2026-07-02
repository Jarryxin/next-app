import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
      <h1 className="text-2xl font-bold">AI Chat — 主页面</h1>
      <Link
        href="/chat"
        className="rounded-lg bg-blue-600 px-6 py-2 text-sm text-white transition hover:bg-blue-700"
      >
        进入对话
      </Link>
      <Link
        href="/auth"
        className="text-sm text-blue-500 underline"
      >
        登录
      </Link>
    </div>
  );
}
