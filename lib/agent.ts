import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { SystemMessage } from "@langchain/core/messages";
import { getLLM, llm } from "./llm";
import { searchSimilar } from "./rag";

async function retrieve(state: typeof MessagesAnnotation.State) {
  const userMessages = state.messages.filter((m) => m._getType() === "human");
  if (userMessages.length === 0) {
    return { messages: [] };
  }

  const lastQuery = userMessages[userMessages.length - 1].content;
  if (typeof lastQuery !== "string" || !lastQuery.trim()) {
    return { messages: [] };
  }

  const results = await searchSimilar(lastQuery, 5);
  if (results.length === 0) {
    return { messages: [] };
  }

  const context = results
    .map((r) => `[来源: ${r.source}]\n${r.content}`)
    .join("\n\n---\n\n");

  const systemMessage = new SystemMessage(
    `以下是与用户问题相关的知识库内容。请基于这些内容回答用户问题。如果这些内容不足以回答问题，请如实告知。\n\n${context}`
  );

  return { messages: [systemMessage] };
}

async function callModel(state: typeof MessagesAnnotation.State) {
  const modelId = (state as unknown as { model?: string }).model;
  const activeLLM = modelId ? getLLM(modelId) : llm;
  const response = await activeLLM.invoke(state.messages);
  return { messages: [response] };
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("retrieve", retrieve)
  .addNode("callModel", callModel)
  .addEdge("__start__", "retrieve")
  .addEdge("retrieve", "callModel")
  .addEdge("callModel", "__end__");

export const agent = workflow.compile();
