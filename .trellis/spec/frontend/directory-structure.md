# Directory Structure

> How frontend code is organized using Next.js App Router.

---

## Directory Layout

```
app/
├── (auth)/               ← 登录页面 (Route Group, SSR)
├── chat/                 ← 对话页面 (CSR, uses useStream)
├── api/
│   ├── chat/             ← AI 对话 API Route
│   ├── auth/             ← 飞书 OAuth 回调
│   └── upload/           ← 用户上传文档 (Phase 2)
├── components/           ← Shared components
├── layout.tsx            ← Root layout
├── page.tsx              ← Home page (SSR)
└── globals.css           ← Tailwind globals
```

## Module Organization

- **Route groups** `(auth)`, `(main)` for layout isolation
- **Components** colocated in `app/components/` for now; extract to feature dirs when they grow
- **API routes** under `app/api/<name>/route.ts`

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | `kebab-case` | `chat-input.tsx`, `message-list.tsx` |
| Components | PascalCase | `ChatInput`, `MessageList` |
| Hooks | camelCase with `use` prefix | `useChatStream`, `useAuth` |
| Directories | `kebab-case` | `my-feature/` |
