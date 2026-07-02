# AI Chat — Implementation Plan

## Order

1. Auth infrastructure (session + middleware + login page)
2. Chat API (LangChain + LangGraph + streaming)
3. Chat page (useStream + UI)
4. Integration test & fix

---

## Step 1: Auth Infrastructure

### Files to create/modify:

| File | Action | Description |
|------|--------|-------------|
| `lib/db.ts` | Create | Prisma client singleton |
| `lib/auth.ts` | Create | `createUser()`, `createSession()`, `validateSession()` helpers |
| `app/api/auth/login/route.ts` | Create | POST handler: receive name → create User+Session → set cookie |
| `middleware.ts` | Create | Next.js middleware: read cookie → validate → protect /chat |
| `app/(auth)/page.tsx` | Create | Login page: name input → submit → redirect |

### Validation commands:
```bash
npm run typecheck
npm run lint
```

### Rollback:
Delete the above files if auth flow doesn't work.

---

## Step 2: Chat API

### Files to create:

| File | Action | Description |
|------|--------|-------------|
| `lib/agent.ts` | Create | LangGraph state + agent node |
| `lib/llm.ts` | Create | ChatOpenAI instance configured for Agnes AI |
| `app/api/chat/route.ts` | Create | POST handler: validate auth → agent → stream |

### Key points:
- Use `ChatOpenAI` from `@langchain/openai`
- Use `StateGraph` from `@langchain/langgraph`
- Stream response via `.stream()` method
- Validate session token before processing

### Validation commands:
```bash
npm run typecheck
npm run lint
```

---

## Step 3: Chat Page

### Files to create:

| File | Action | Description |
|------|--------|-------------|
| `app/chat/page.tsx` | Create | Client component with useStream hook |

### Key points:
- `"use client"` directive
- Import `useStream` from `@langchain/react`
- Message display: user bubble + AI bubble
- Loading state, error state, empty state

### Validation commands:
```bash
npm run typecheck
npm run lint
```

---

## Step 4: Integration & Fix

### Verify end-to-end:
```bash
npm run build
npm run lint
npm run typecheck
```

### Test flow:
1. Start dev server: `npm run dev`
2. Visit `/` → redirected to `/auth`
3. Enter name → redirected to `/chat`
4. Send message → see streaming response

---

## Rollback Plan

If anything breaks mid-implementation:
- Revert changed files: `git checkout -- <files>`
- Delete new files: `rm <new-files>`
- Start checkpoint: working Next.js scaffold with Prisma

## Design Deviations

| Planned | Actual | Reason |
|---------|--------|--------|
| `(auth)/` route group | `auth/` directory | Route group conflicted with `/` page |
| `@langchain/react` useStream hook | Custom `lib/use-chat.ts` hook | useStream requires LangGraph Platform server |
| Prisma standard client | Prisma 7 adapter (`@prisma/adapter-pg`) | Prisma 7 removed `url` from schema |
| Middleware DB validation | Cookie-only check in middleware | Edge Runtime doesn't support Prisma |

## Review Gates

- [x] `npm run build` passes
- [x] `npm run lint` passes
- [x] `npm run typecheck` passes
- [x] Login → Chat → Stream message flow works manually
