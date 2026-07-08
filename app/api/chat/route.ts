import { NextRequest } from "next/server";
import { SystemMessage, HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { getLLM, llm } from "@/lib/llm";
import { searchSimilar } from "@/lib/rag";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";

const TOKEN_LIMIT = 6000;
const WINDOW_SIZE = 20;

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

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookie();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, conversationId: rawConversationId, model } = await req.json();
  if (!messages || !Array.isArray(messages)) {
    return new Response("Invalid messages", { status: 400 });
  }

  const llm = getLLM(model);

  let conversationId = rawConversationId;

  if (!conversationId) {
    const conv = await prisma.conversation.create({
      data: { userId: session.userId },
    });
    conversationId = conv.id;
  } else {
    const belongs = await prisma.conversation.findFirst({
      where: { id: conversationId, userId: session.userId },
    });
    if (!belongs) {
      return new Response("Conversation not found", { status: 404 });
    }
  }

  const lastUserMsg = messages.filter((m: { role: string }) => m.role === "user").pop();
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

  const userMessage = messages[messages.length - 1];
  if (userMessage?.role === "user") {
    await prisma.message.create({
      data: {
        conversationId,
        role: "user",
        content: userMessage.content,
      },
    });
  }

  let summary = "";
  let recentMessages = messages;

  const estimatedTokens = estimateMessagesTokens(messages);
  if (estimatedTokens > TOKEN_LIMIT && messages.length > WINDOW_SIZE) {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { summary: true },
    });
    summary = conv?.summary || "";

    if (!summary) {
      const oldMessages = messages.slice(0, messages.length - WINDOW_SIZE);
      try {
        summary = await generateSummary(oldMessages);
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { summary },
        });
      } catch (e) {
        console.error("[chat] summary generation failed:", e);
      }
    }

    recentMessages = messages.slice(-WINDOW_SIZE);
  }

  const langchainMessages: BaseMessage[] = [];

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

  let sources: { content: string; source: string; similarity: number }[] = [];
  if (lastUserMsg) {
    sources = await searchSimilar(lastUserMsg.content, 5);
    if (sources.length > 0) {
      const context = sources
        .map((r) => `[来源: ${r.source}]\n${r.content}`)
        .join("\n\n---\n\n");
      langchainMessages.unshift(
        new SystemMessage(
          `以下是与用户问题相关的知识库内容。请基于这些内容回答用户问题。如果这些内容不足以回答问题，请如实告知。\n\n${context}`
        )
      );
    }
  }

  const stream = await llm.stream(langchainMessages);

  const encoder = new TextEncoder();
  let fullContent = "";
  const readableStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "meta", model: model || "agnes", sources })}\n\n`)
      );
      for await (const chunk of stream) {
        const content = chunk.content;
        if (content) {
          const text = typeof content === "string" ? content : String(content);
          fullContent += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();

      try {
        await prisma.message.create({
          data: {
            conversationId,
            role: "assistant",
            content: fullContent,
            sources,
            model: model || "agnes",
          },
        });
      } catch (e) {
        console.error("[chat] failed to save assistant message:", e);
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Conversation-Id": conversationId,
    },
  });
}
