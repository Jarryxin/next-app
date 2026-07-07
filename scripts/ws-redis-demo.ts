/**
 * WebSocket + Redis Pub/Sub 多实例广播演示
 *
 * 启动方式:
 *   终端1: npx tsx scripts/ws-redis-demo.ts 3001
 *   终端2: npx tsx scripts/ws-redis-demo.ts 3002
 *
 * 浏览器打开:
 *   http://localhost:3000/ws-demo → 连 ws://localhost:3001
 *   再开一个 Tab → 连 ws://localhost:3002
 *
 * 两个 Tab 在不同 WS 实例上，通过 Redis 跨进程收发消息
 */

import { WebSocketServer, WebSocket } from "ws";
import Redis from "ioredis";

const PORT = parseInt(process.argv[2] || "3001");
const INSTANCE_ID = `ws-${PORT}`;

// ─── Redis 连接 ───
const pub = new Redis();   // 发布消息
const sub = new Redis();   // 订阅消息

// ─── 本地用户注册表 ───
const userSockets = new Map<string, WebSocket>();

// ─── WebSocket 服务 ───
const wss = new WebSocketServer({ port: PORT });
console.log(`[${INSTANCE_ID}] WebSocket running on ws://localhost:${PORT}`);

// 订阅 Redis 频道：收到其他实例发来的消息
sub.subscribe("ws:messages", (err, count) => {
  if (err) console.error(err);
  else console.log(`[${INSTANCE_ID}] Subscribed to ws:messages (${count} subs)`);
});

sub.on("message", (_channel, raw) => {
  const msg = JSON.parse(raw);
  // Redis 消息可能来自本机，跳过（否则会重复发送）
  if (msg.fromInstance === INSTANCE_ID) return;

  // 单播：发给本机上的目标用户
  if (msg.type === "unicast" && msg.targetUserId) {
    const ws = userSockets.get(msg.targetUserId);
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "redis-relay", ...msg.payload }));
    }
  }
});

// ─── WS 连接处理 ───
wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[${INSTANCE_ID}] connect: ${ip}`);

  ws.on("message", (data) => {
    let msg: { type: string; [k: string]: unknown };
    try { msg = JSON.parse(data.toString()); } catch { return; }

    switch (msg.type) {
      case "register": {
        const uid = String(msg.userId ?? "");
        userSockets.set(uid, ws);
        ws.send(JSON.stringify({ type: "registered", instance: INSTANCE_ID, userId: uid }));
        console.log(`[${INSTANCE_ID}] register: ${uid}`);
        break;
      }

      case "cross-send": {
        // 发给其他实例上的用户
        const target = String(msg.target ?? "");
        const payload = { from: msg.from, content: msg.content, timestamp: new Date().toISOString() };

        // 先检查目标是否在本机
        const localWs = userSockets.get(target);
        if (localWs?.readyState === WebSocket.OPEN) {
          localWs.send(JSON.stringify({ type: "direct", ...payload }));
          ws.send(JSON.stringify({ type: "system", message: `[本机] 已发给 ${target}` }));
        }

        // 再通过 Redis 广播给其他实例
        pub.publish("ws:messages", JSON.stringify({
          fromInstance: INSTANCE_ID,
          type: "unicast",
          targetUserId: target,
          payload,
        }));
        ws.send(JSON.stringify({ type: "system", message: `[Redis] 已广播给所有实例寻找 ${target}` }));
        break;
      }
    }
  });

  ws.on("close", () => {
    for (const [uid, sock] of userSockets) {
      if (sock === ws) userSockets.delete(uid);
    }
  });

  ws.send(JSON.stringify({
    type: "connected",
    instance: INSTANCE_ID,
    message: `已连接到 ${INSTANCE_ID}，试试 cross-send 跨实例发消息`,
  }));
});
