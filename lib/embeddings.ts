import { OpenAIEmbeddings } from "@langchain/openai";

export const embeddings = new OpenAIEmbeddings({
  model: "bge-m3",
  configuration: {
    baseURL: "http://localhost:11434/v1",
  },
  apiKey: "ollama",
});
