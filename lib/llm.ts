import { ChatOpenAI } from "@langchain/openai";
import { modelList, type ModelMeta } from "./models";

interface LLMConfig {
  provider: string;
  providerLabel: string;
  label: string;
  modelName: string;
  configuration: { baseURL: string };
  apiKey: string;
  timeout: number;
  maxRetries: number;
}

function buildConfigs(): Record<string, LLMConfig> {
  const configs: Record<string, LLMConfig> = {};

  for (const meta of modelList) {
    let apiKey = "";
    let baseURL = "";
    let timeout = 15000;
    let maxRetries = 1;

    if (meta.provider === "agnes") {
      apiKey = process.env.AGNES_API_KEY || "";
      baseURL = process.env.AGNES_API_BASE_URL || "";
      timeout = 8000;
      maxRetries = 0;
    } else if (meta.provider === "zhipu") {
      apiKey = process.env.ZHIPUAI_API_KEY || "";
      baseURL = process.env.ZHIPUAI_API_BASE_URL || "";
    } else if (meta.provider === "dashscope") {
      apiKey = process.env.DASHSCOPE_API_KEY || "";
      baseURL = process.env.DASHCOPE_API_BASE_URL || "";
      timeout = 30000;
      maxRetries = 1;
    }

    configs[meta.id] = {
      provider: meta.provider,
      providerLabel: meta.providerLabel,
      label: meta.label,
      modelName: meta.label,
      configuration: { baseURL },
      apiKey,
      timeout,
      maxRetries,
    };
  }

  return configs;
}

const configs = buildConfigs();

function createLLM(c: LLMConfig): ChatOpenAI {
  return new ChatOpenAI({
    modelName: c.modelName,
    configuration: c.configuration,
    apiKey: c.apiKey,
    streaming: true,
    timeout: c.timeout,
    maxRetries: c.maxRetries,
  });
}

export { type ModelMeta, modelList };

export function getLLM(modelId?: string) {
  const id = modelId || "agnes";
  const config = configs[id];
  if (!config) return createLLM(configs["agnes"]);
  const primary = createLLM(config);
  const fallbacks = Object.values(configs)
    .filter((c) => c.provider !== config.provider)
    .reduce<Record<string, LLMConfig>>((acc, c) => {
      if (!acc[c.provider]) acc[c.provider] = c;
      return acc;
    }, {});
  return primary.withFallbacks({ fallbacks: Object.values(fallbacks).map(createLLM) });
}

export const llm = getLLM("agnes");
