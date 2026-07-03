import { NextRequest } from "next/server";
import { SystemMessage, HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { llm } from "@/lib/llm";
import { searchSimilar } from "@/lib/rag";
import { getSessionFromCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookie();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await req.json();
  if (!messages || !Array.isArray(messages)) {
    return new Response("Invalid messages", { status: 400 });
  }

  const langchainMessages: BaseMessage[] = messages.map((m: { role: string; content: string }) =>
    m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
  );

  let sources: { content: string; source: string; similarity: number }[] = [];
  const lastUserMsg = messages.filter((m: { role: string }) => m.role === "user").pop();
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
  let chunkCount = 0;
  const startTime = Date.now();
  const readableStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "sources", sources })}\n\n`)
      );
      for await (const chunk of stream) {
        chunkCount++;
        const content = chunk.content;
        if (content) {
          const text = typeof content === "string" ? content : String(content);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
        }
      }
      console.log(`[stream] total ${chunkCount} chunks in ${Date.now() - startTime}ms`);
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
