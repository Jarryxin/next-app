import { ChatOpenAI } from "@langchain/openai";

const agnes = new ChatOpenAI({
  modelName: process.env.AGNES_MODEL || "agnes-2.0-flash",
  configuration: { baseURL: process.env.AGNES_API_BASE_URL },
  apiKey: process.env.AGNES_API_KEY,
  streaming: true,
  timeout: 8000,
  maxRetries: 0,
});

const dashscope = new ChatOpenAI({
  modelName: "deepseek-v4-flash",
  configuration: { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  apiKey: process.env.DASHSCOPE_API_KEY,
  streaming: true,
  timeout: 30000,
  maxRetries: 1,
});

export type ModelId = "agnes" | "dashscope";

const models: Record<ModelId, ChatOpenAI> = { agnes, dashscope };

export function getLLM(modelId?: string) {
  const id: ModelId = (modelId === "dashscope" ? "dashscope" : "agnes");
  const primary = models[id];
  const fallbacks = Object.values(models).filter((m) => m !== primary);
  return primary.withFallbacks({ fallbacks });
}

export const llm = getLLM("agnes");
