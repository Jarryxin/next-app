"use client";

import { useRef, useState, useCallback } from "react";

interface LogEntry {
  type: "send" | "recv" | "system";
  content: string;
  time: string;
}

export default function WsDemoPage() {
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState("");
  const [room, setRoom] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [wsUrl, setWsUrl] = useState("ws://localhost:3001");
  const wsRef = useRef<WebSocket | null>(null);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const send = useCallback((data: object) => {
    if (!wsRef.current) return;
    wsRef.current.send(JSON.stringify(data));
    addLog({ type: "send", content: JSON.stringify(data), time: new Date().toLocaleTimeString() });
  }, [addLog]);

  const connect = useCallback(() => {
    if (wsRef.current) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      addLog({ type: "system", content: "连接成功", time: new Date().toLocaleTimeString() });
    };

    ws.onmessage = (event) => {
      addLog({ type: "recv", content: event.data, time: new Date().toLocaleTimeString() });
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      addLog({ type: "system", content: "连接已断开", time: new Date().toLocaleTimeString() });
    };

    ws.onerror = () => {
      addLog({ type: "system", content: "连接错误", time: new Date().toLocaleTimeString() });
    };
  }, [addLog]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-xl font-bold">WebSocket Demo — 三种广播模式</h1>

      {/* 连接控制 */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
          disabled={connected}
          className="w-48 rounded border border-zinc-300 px-3 py-1.5 text-sm font-mono dark:border-zinc-600 dark:bg-zinc-800"
        />
        <div className={`h-3 w-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`} />
        <span className="text-sm text-zinc-500">{connected ? "已连接" : "未连接"}</span>
        {connected ? (
          <button onClick={disconnect} className="rounded-lg bg-red-500 px-4 py-1.5 text-sm text-white hover:bg-red-600">断开</button>
        ) : (
          <button onClick={connect} className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">连接</button>
        )}
      </div>

      {/* 身份注册 */}
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="输入用户ID（用于注册身份）"
          disabled={!connected}
          className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          onClick={() => send({ type: "register", userId })}
          disabled={!connected || !userId.trim()}
          className="rounded bg-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          注册
        </button>
      </div>

      {/* 房间管理 */}
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="房间名"
          disabled={!connected}
          className="w-32 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <button
          onClick={() => send({ type: "join", room })}
          disabled={!connected || !room.trim()}
          className="rounded bg-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          加入房间
        </button>
      </div>

      {/* 目标用户 + 消息输入 */}
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={targetUser}
          onChange={(e) => setTargetUser(e.target.value)}
          placeholder="目标用户ID（单播用）"
          disabled={!connected}
          className="w-32 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="消息内容"
          disabled={!connected}
          className="flex-1 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
      </div>

      {/* 三种发送模式按钮 */}
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          onClick={() => send({ type: "unicast", target: targetUser, from: userId || "anonymous", content: input })}
          disabled={!connected || !input.trim() || !targetUser.trim()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          title="发给指定用户"
        >
          单播 (unicast)
        </button>
        <button
          onClick={() => send({ type: "roomcast", room, from: userId || "anonymous", content: input })}
          disabled={!connected || !input.trim() || !room.trim()}
          className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          title="发给房间所有人"
        >
          组播 (roomcast)
        </button>
        <button
          onClick={() => send({ type: "broadcast", from: userId || "anonymous", content: input })}
          disabled={!connected || !input.trim()}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
          title="发给所有连接"
        >
          广播 (broadcast)
        </button>
        <button
          onClick={() => send({ type: "cross-send", target: targetUser, from: userId || "anonymous", content: input })}
          disabled={!connected || !input.trim() || !targetUser.trim()}
          className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
          title="跨实例发送（需要先启动 ws-redis-demo）"
        >
          跨实例 (Redis)
        </button>
      </div>

      {/* 日志 */}
      <div className="h-80 overflow-y-scroll rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900">
        {logs.map((log, i) => (
          <div key={i} className={`mb-1 ${
            log.type === "send" ? "text-blue-600" : log.type === "recv" ? "text-green-600" : "text-zinc-400"
          }`}>
            <span className="text-zinc-400">[{log.time}]</span>{" "}
            <span className="font-semibold">{log.type === "send" ? "→" : log.type === "recv" ? "←" : "●"}</span>{" "}
            {log.content}
          </div>
        ))}
        {logs.length === 0 && <p className="text-zinc-400">连接后尝试三种模式：先注册身份、加入房间，再发送消息</p>}
      </div>
    </div>
  );
}
