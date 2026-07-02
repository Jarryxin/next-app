# Hook Guidelines

> How hooks are used in this project.

---

## AI Streaming Hook

Use `useStream` from `@langchain/react` for chat message streaming:

```typescript
import { useStream } from '@langchain/react';

function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useStream({
      api: '/api/chat',
    });
}
```

## Custom Hook Patterns

- Create custom hooks for reusable stateful logic
- Name: `use<Feature>` (PascalCase after `use`)
- Hooks that call API routes go in `hooks/` alongside the feature

## Data Fetching

| Page Type | Method |
|-----------|--------|
| SSR Pages | `async` Server Component, direct data fetch |
| CSR Pages | `useStream` (chat) or `fetch` in `useEffect` / custom hook |
| API Routes | Next.js Route Handler |
