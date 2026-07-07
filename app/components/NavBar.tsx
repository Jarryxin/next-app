"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface UserInfo {
  id: string;
  name: string | null;
  avatar: string | null;
}

export default function NavBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const navItems = [
    { href: "/chat", label: "对话" },
    { href: "/upload", label: "知识库" },
    { href: "/manage", label: "管理" },
  ];

  return (
    <header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-black/90">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          AI Chat
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2 text-sm">
        {loading ? (
          <div className="h-6 w-6 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
        ) : user ? (
          <div className="flex items-center gap-2">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt=""
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                {user.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}
            <span className="text-zinc-600 dark:text-zinc-400">{user.name || "用户"}</span>
          </div>
        ) : (
          <Link
            href="/auth"
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white transition hover:bg-blue-700"
          >
            登录
          </Link>
        )}
      </div>
    </header>
  );
}
