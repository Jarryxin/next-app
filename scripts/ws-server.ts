import { WebSocketServer, WebSocket } from "ws";

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

/** 单播映射: userId -> WebSocket */
const userSockets = new Map<string, WebSocket>();

/** 组播映射: roomId -> Set<WebSocket> */
const roomSockets = new Map<string, Set<WebSocket>>();

/** 辅助：将 ws 加入房间 */
function joinRoom(ws: WebSocket, room: string) {
  if (!roomSockets.has(room)) roomSockets.set(room, new Set());
  roomSockets.get(room)!.add(ws);
}

/** 辅助：从所有房间移除 ws */
function leaveAllRooms(ws: WebSocket) {
  for (const [, members] of roomSockets) members.delete(ws);
}

// ─── 三种发送模式 ───

function sendToUser(userId: string, data: object) {
  const ws = userSockets.get(userId);
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function sendToRoom(room: string, data: object, exclude?: WebSocket) {
  roomSockets.get(room)?.forEach((ws) => {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  });
}

function broadcast(data: object, exclude?: WebSocket) {
  wss.clients.forEach((ws) => {
    if (ws !== exclude && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  });
}

// ─── 连接处理 ───

wss.on("connection", (ws: WebSocket, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[connect] ${clientIp}`);

  // 连接后立即广播上线通知
  broadcast({ type: "system", message: `新用户加入 (${clientIp})` }, ws);

  ws.on("message", (data) => {
    const raw = data.toString();
    let msg: { type: string; [key: string]: unknown };
    try {
      msg = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "无效的 JSON 格式" }));
      return;
    }

    const now = new Date().toISOString();

    switch (msg.type) {
      // 注册身份（单播基础）
      case "register": {
        const uid = String(msg.userId ?? "");
        if (!uid) break;
        userSockets.set(uid, ws);
        ws.send(JSON.stringify({ type: "registered", userId: uid, timestamp: now }));
        console.log(`[register] ${uid}`);
        break;
      }

      // 加入房间
      case "join": {
        const room = String(msg.room ?? "");
        if (!room) break;
        joinRoom(ws, room);
        // 通知房间其他人
        sendToRoom(room, { type: "system", message: "新成员加入了房间", room, timestamp: now }, ws);
        ws.send(JSON.stringify({ type: "joined", room, timestamp: now }));
        console.log(`[join] ${clientIp} -> ${room}`);
        break;
      }

      // 单播：发给指定用户
      case "unicast": {
        const target = String(msg.target ?? "");
        sendToUser(target, {
          type: "message",
          from: msg.from || "anonymous",
          content: msg.content || "",
          scope: "unicast",
          timestamp: now,
        });
        break;
      }

      // 组播：发给房间所有人
      case "roomcast": {
        const room = String(msg.room ?? "");
        sendToRoom(room, {
          type: "message",
          from: msg.from || "anonymous",
          content: msg.content || "",
          scope: "roomcast",
          room,
          timestamp: now,
        });
        break;
      }

      // 广播：发给所有连接
      case "broadcast": {
        broadcast({
          type: "message",
          from: msg.from || "anonymous",
          content: msg.content || "",
          scope: "broadcast",
          timestamp: now,
        }, ws);
        break;
      }

      default:
        ws.send(JSON.stringify({ type: "error", message: `未知消息类型: ${msg.type}` }));
    }
  });

  ws.on("close", () => {
    console.log(`[disconnect] ${clientIp}`);
    // 清理注册和房间
    for (const [uid, sock] of userSockets) {
      if (sock === ws) userSockets.delete(uid);
    }
    leaveAllRooms(ws);
    broadcast({ type: "system", message: `用户离开了 (${clientIp})` }, ws);
  });

  ws.on("error", (err) => {
    console.error(`[error] ${clientIp}: ${err.message}`);
  });

  ws.send(JSON.stringify({
    type: "connected",
    message: "WebSocket 连接成功。可用命令: register, join, unicast, roomcast, broadcast",
    timestamp: new Date().toISOString(),
  }));
});

console.log(`WebSocket server running on ws://localhost:${PORT}`);
console.log(`支持消息类型: register, join, unicast, roomcast, broadcast`);
