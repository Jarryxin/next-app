import { NextRequest } from "next/server";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { llm } from "@/lib/llm";
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

  const langchainMessages = messages.map((m: { role: string; content: string }) =>
    m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
  );

  const stream = await llm.stream(langchainMessages);

  const encoder = new TextEncoder();
  let chunkCount = 0;
  const startTime = Date.now();
  const readableStream = new ReadableStream({
    async start(controller) {
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
