# AI Chat — Technical Design

## Architecture

```
Browser                    Next.js Server                    Agnes AI
  │                            │                               │
  │  POST /api/chat            │                               │
  │  { message, session } ────>│                               │
  │                            │  LangGraph Agent              │
  │                            │    └─ ChatOpenAI ────────────>│
  │                            │    └─ (tool/RAG later)       │
  │  <── SSE stream ───────────│  stream response              │
  │                            │                               │
  │  useStream hook            │                               │
  │    displays tokens         │                               │
```

## Data Flow

### Auth Flow
```
Login Page → POST /api/auth/login → create User (if new) + Session
                                    → set cookie (session token)
                                    → redirect to /chat

Middleware → read cookie → validate session in DB
           → valid: continue to /chat
           → invalid: redirect to /auth
```

### Chat Flow
```
1. User types message → useStream sends POST /api/chat
2. API Route validates session token from cookie
3. LangGraph Agent receives { messages: [...] }
4. ChatOpenAI (Agnes AI) generates response
5. Response streamed back via SSE (ReadableStream)
6. useStream hook appends tokens to message list
```

## Key Components

### 1. Auth Infrastructure

**Files:**
- `app/api/auth/login/route.ts` — POST handler
- `lib/auth.ts` — session helpers (createSession, validateSession)
- `middleware.ts` — Next.js middleware for route protection
- `app/(auth)/page.tsx` — login form

**Session Model** (already in schema.prisma):
- Session: id, userId, token (unique), expiresAt, createdAt
- User: id, name, feishuUid (nullable), etc.

**Token**: `crypto.randomUUID()` stored in cookie as `session_token`

### 2. Chat API Route

**File:** `app/api/chat/route.ts`

```
POST /api/chat
Headers: Cookie: session_token=xxx
Body: { messages: { role, content }[] }

Response: ReadableStream (SSE format)
```

**Implementation:**
- `ChatOpenAI` model with Agnes AI config:
  ```ts
  new ChatOpenAI({
    modelName: "agnes-2.0-flash",
    configuration: { baseURL: "https://apihub.agnes-ai.com/v1" },
  })
  ```
- LangGraph: `StateGraph` with single `callModel` node
- Stream the response using `.stream()` method

### 3. LangGraph Agent

**File:** `lib/agent.ts`

```
State: { messages: BaseMessage[] }
↓
callModel node → ChatOpenAI.invoke(state.messages)
↓
Returns new messages → update state
```

Simple graph for MVP:
```
START → callModel → END
```

The graph structure allows adding tools (RAG retrieval) later without rewriting.

### 4. Chat Page

**File:** `app/chat/page.tsx` (Client Component)
**Hook:** `lib/use-chat.ts` (custom SSE hook)

- Custom `useChat` hook reads SSE stream directly from POST `/api/chat`
- Message list: scrollable container with auto-scroll
- Input: text + send/stop button
- States: idle, loading (streaming), error

**Why not `@langchain/react` `useStream`:**
`useStream` is designed for LangGraph Platform server runtime. For our custom API route, a simple SSE reader hook is simpler and gives full control.

**Streaming with useChat:**
```tsx
const { messages, input, setInput, handleSubmit, isLoading, stop } =
  useChat("/api/chat");
```

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Streaming format | SSE via ReadableStream | Next.js native, works with useStream hook |
| Auth cookie | `session_token` HTTP-only | Simple, secure enough for MVP |
| Session storage | Database | Already have Session table, no Redis needed |
| LangGraph agent | Single node MVP | Easy to extend with RAG later |
| Chat history | In-memory (useStream) | MVP speed, no DB writes needed |

## Dependencies

All already in package.json:
- `@langchain/core`, `@langchain/openai`, `@langchain/langgraph`
- `@langchain/react` (useStream)
- `@prisma/client`, `prisma`
- `next`, `react`, `zustand` (not directly needed for chat MVP)
