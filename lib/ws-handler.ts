import { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import { getSessionFromToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { llm } from "@/lib/llm";
import { searchSimilar } from "@/lib/rag";
import { SystemMessage, HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";

const RATE_LIMIT = 10;
const IDLE_TIMEOUT = 30 * 60 * 1000;
const TOKEN_LIMIT = 6000;
const WINDOW_SIZE = 20;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const userConnections = new Map<string, Set<WebSocket>>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 1000 });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) return false;
  return true;
}

function parseCookies(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  raw.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      result[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    }
  });
  return result;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

function estimateMessagesTokens(messages: { role: string; content: string }[]): number {
  let total = 0;
  for (const m of messages) {
    total += estimateTokens(m.content);
  }
  total += messages.length * 10;
  return total;
}

async function generateSummary(
  messages: { role: string; content: string }[]
): Promise<string> {
  const text = messages
    .map((m) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`)
    .join("\n");

  const result = await llm.invoke([
    new SystemMessage(
      "请用中文简要总结以上对话的核心内容，包括用户的主要问题和已讨论过的关键信息。保留重要细节，控制在200字以内。"
    ),
    new HumanMessage(text),
  ]);

  return (typeof result.content === "string" ? result.content : String(result.content)).trim();
}

async function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

async function handleChat(
  ws: WebSocket,
  userId: string,
  data: { conversationId?: string; messages: { role: string; content: string }[] },
  signal: AbortSignal
) {
  let conversationId = data.conversationId || "";

  if (!conversationId) {
    const conv = await prisma.conversation.create({
      data: { userId },
    });
    conversationId = conv.id;
  } else {
    const belongs = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!belongs) {
      await send(ws, { type: "error", message: "Conversation not found" });
      return;
    }
  }

  const lastUserMsg = data.messages.filter((m) => m.role === "user").pop();
  if (lastUserMsg) {
    const titleConv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { title: true },
    });
    if (titleConv?.title === "新对话") {
      const title = lastUserMsg.content.slice(0, 50).replace(/\n/g, " ");
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });
    }
  }

  const lastMsg = data.messages[data.messages.length - 1];
  if (lastMsg?.role === "user") {
    await prisma.message.create({
      data: { conversationId, role: "user", content: lastMsg.content },
    });
  }

  let summary = "";
  let recentMessages = data.messages;

  const estimatedTokens = estimateMessagesTokens(data.messages);
  if (estimatedTokens > TOKEN_LIMIT && data.messages.length > WINDOW_SIZE) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { summary: true },
    });
    summary = conv?.summary || "";

    if (!summary) {
      const oldMessages = data.messages.slice(0, data.messages.length - WINDOW_SIZE);
      try {
        summary = await generateSummary(oldMessages);
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { summary },
        });
      } catch (e) {
        console.error("[ws] summary generation failed:", e);
      }
    }

    recentMessages = data.messages.slice(-WINDOW_SIZE);
  }

  const langchainMessages: BaseMessage[] = [];

  let sources: { content: string; source: string; similarity: number }[] = [];
  if (lastUserMsg) {
    sources = await searchSimilar(lastUserMsg.content, 5);
    if (sources.length > 0) {
      const context = sources
        .map((r) => `[来源: ${r.source}]\n${r.content}`)
        .join("\n\n---\n\n");
      langchainMessages.push(
        new SystemMessage(
          `以下是与用户问题相关的知识库内容。请基于这些内容回答用户问题。如果这些内容不足以回答问题，请如实告知。\n\n${context}`
        )
      );
    }
  }

  if (summary) {
    langchainMessages.push(
      new SystemMessage(
        `以下是之前的对话摘要，请基于这些上下文回答当前问题：\n\n${summary}`
      )
    );
  }

  for (const m of recentMessages) {
    langchainMessages.push(
      m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
    );
  }

  await send(ws, { type: "sources", sources });

  const stream = await llm.stream(langchainMessages);
  let fullContent = "";

  for await (const chunk of stream) {
    if (signal.aborted) break;
    const content = chunk.content;
    if (content) {
      const text = typeof content === "string" ? content : String(content);
      fullContent += text;
      await send(ws, { type: "token", content: text });
    }
  }

  if (signal.aborted) return;

  try {
    await prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: fullContent,
        sources,
      },
    });
  } catch (e) {
    console.error("[ws] failed to save assistant message:", e);
  }

  await send(ws, { type: "done", conversationId });
}

export async function handleWSConnection(ws: WebSocket, req: IncomingMessage) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies.session_token;
  if (!token) {
    ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    ws.close(4001, "Unauthorized");
    return;
  }

  const session = await getSessionFromToken(token);
  if (!session) {
    ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    ws.close(4001, "Unauthorized");
    return;
  }

  const userId = session.userId;

  if (!userConnections.has(userId)) userConnections.set(userId, new Set());
  userConnections.get(userId)!.add(ws);

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => ws.close(4002, "Idle timeout"), IDLE_TIMEOUT);
  };
  resetIdle();

  let abortController: AbortController | null = null;

  ws.on("message", async (raw) => {
    resetIdle();

    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case "ping":
          await send(ws, { type: "pong" });
          return;
        case "stop":
          abortController?.abort();
          return;
        case "chat":
          if (!checkRateLimit(userId)) {
            await send(ws, { type: "error", message: "Rate limited" });
            return;
          }
          abortController = new AbortController();
          try {
            await handleChat(ws, userId, data, abortController.signal);
          } catch (e: unknown) {
            if (e instanceof Error && e.name === "AbortError") return;
            console.error("[ws] chat error:", e);
            await send(ws, { type: "error", message: "Chat failed" });
          }
          return;
        default:
          await send(ws, { type: "error", message: `Unknown type: ${data.type}` });
      }
    } catch {
      await send(ws, { type: "error", message: "Invalid message" });
    }
  });

  ws.on("close", () => {
    if (idleTimer) clearTimeout(idleTimer);
    abortController?.abort();
    userConnections.get(userId)?.delete(ws);
    if (userConnections.get(userId)?.size === 0) userConnections.delete(userId);
  });

  ws.on("error", () => {
    /* cleanup handled in close */
  });
}
