import { OpenAIEmbeddings } from "@langchain/openai";

export const embeddings = new OpenAIEmbeddings({
  model: "all-minilm",
  configuration: {
    baseURL: "http://localhost:11434/v1",
  },
  apiKey: "ollama",
});
