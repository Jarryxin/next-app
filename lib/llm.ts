import { ChatOpenAI } from "@langchain/openai";

export const llm = new ChatOpenAI({
  modelName: process.env.AGNES_MODEL || "agnes-2.0-flash",
  configuration: {
    baseURL: process.env.AGNES_API_BASE_URL,
  },
  apiKey: process.env.AGNES_API_KEY,
  streaming: true,
  timeout: 60000,
  maxRetries: 0,
});
