# LLM Configuration

> How the LLM provider is configured.

---

## Primary Provider: Agnes AI

```typescript
import { ChatOpenAI } from '@langchain/openai';

const llm = new ChatOpenAI({
  modelName: 'agnes-2.0-flash',
  configuration: {
    baseURL: process.env.AGNES_BASE_URL, // OpenAI-compatible endpoint
  },
  apiKey: process.env.AGNES_API_KEY,
  temperature: 0.7,
});
```

## Fallback: DeepSeek

```typescript
const llm = new ChatOpenAI({
  modelName: 'deepseek-chat',
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL,
  },
  apiKey: process.env.DEEPSEEK_API_KEY,
});
```

## Switching Providers

- Only `modelName` and `baseURL` need to change
- Abstraction: use a factory function that reads `LLM_PROVIDER` env var
- All env vars documented in `.env.example`

## Required Environment Variables

```
AGNES_BASE_URL=https://api.agnes.ai/v1
AGNES_API_KEY=sk-...
AGNES_MODEL=agnes-2.0-flash

# Optional fallback
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=sk-...
```
