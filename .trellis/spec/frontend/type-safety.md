# Type Safety

> TypeScript type patterns in this project.

---

## Type System

- TypeScript strict mode enabled (`tsconfig.json`)
- No `any` -- use `unknown` with type guards when type is uncertain
- Prefer `interface` over `type` for object shapes (extends better)
- Use `type` for unions, intersections, and utility types

## Type Organization

- **Shared types**: defined near usage (colocated), exported when reused
- **API types**: defined alongside the API route handler
- **Database types**: Prisma-generated (`@prisma/client`)
- **AI types**: LangChain types imported from `@langchain/core` / `@langchain/community`

## Type Patterns

```typescript
// Interface for component props (exported)
export interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
}

// Type for unions
export type MessageRole = 'user' | 'assistant' | 'system';

// Type guard for unknown data
function isUser(data: unknown): data is User {
  return typeof data === 'object' && data !== null && 'id' in data;
}
```

## Validation

- Runtime validation is minimal (trusted internal data for now)
- API input validation in Route Handlers (manual checks)
- Prisma schema as source of truth for DB shapes

## Forbidden

- ❌ `as any` type assertions
- ❌ `@ts-ignore` / `@ts-expect-error`
- ❌ `as` casts without type guard (prefer `satisfies` or guard functions)
- ❌ Non-null assertion `!` unless proven safe with a comment
