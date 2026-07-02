import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { llm } from "./llm";

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await llm.invoke(state.messages);
  return { messages: [response] };
}

const workflow = new StateGraph(MessagesAnnotation)
  .addNode("callModel", callModel)
  .addEdge("__start__", "callModel")
  .addEdge("callModel", "__end__");

export const agent = workflow.compile();
