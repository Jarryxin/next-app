# AI Chat 实现经验记录

## 概述

本文档记录 AI Chat MVP 实现过程中遇到的问题、决策原因及解决方案。

---

## 前端 Streaming 方案选择

### 问题

使用 `@langchain/react` 的 `useStream` hook 还是自定义 SSE 方案？

### 决策

使用自定义 `useChat` hook（`fetch` + `ReadableStream` + SSE）。

### 原因

- `@langchain/react` 的 `useStream` 是 LangGraph Platform 的 React 客户端 SDK，需要后端运行 LangGraph Platform Server（商业产品或 Docker 自托管）
- 它内部通过 `@langchain/langgraph-sdk` 的 `Client` 连接服务端，协议路径是 `/threads/{id}/runs/stream` 等，与自定义 API Route 不兼容
- 我们的场景只需单 Agent + 简单 SSE 流式，自写 hook 更轻量、无额外依赖

### 为什么不直接用 EventSource（原生 SSE）

- `EventSource` 只支持 GET 请求
- Chat API 需要 POST 传消息体（消息可能很长，不适合 query string）
- `fetch` + `response.body.getReader()` 可以达到相同的流式效果，且不受 HTTP 方法限制

### 参考

- LangGraph Platform 的特性（持久化线程、中断恢复、子 Agent 编排）才值得迁移到 Platform
- 当前自定义方案切换回 LangGraph 只需在 API Route 中调用 agent 而非 llm

---

## Prisma 7 迁移注意事项

### 问题

运行时 `PrismaClient` 初始化报错：`PrismaClient` needs to be constructed with a non-empty, valid PrismaClientOptions。

### 原因

Prisma 7 不再支持 schema 文件中写 `url`：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")  // 报错：Prisma 7 不支持
}
```

### 解决

```ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });
```

连接 URL 通过 `prisma.config.ts` 提供给 CLI 使用：
```ts
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URL! },
});
```

---

## Middleware (Edge Runtime) 限制

### 问题

Middleware 中使用 `prisma.session.findUnique()` 报错：Edge Runtime 不支持 Node.js 模块。

### 原因

Next.js Middleware 运行在 Edge Runtime，不支持 `pg`、`@prisma/client` 等 Node.js 原生模块。

### 解决

Middleware 只做 cookie 存在性检查（Edge Runtime 支持的 API）：

```ts
const token = request.cookies.get("session_token")?.value;
if (!token) return NextResponse.redirect(new URL("/auth", request.url));
```

DB 验证延迟到 API Route（Node.js Runtime）中处理。

---

## 路由组陷阱

### 问题

创建 `app/(auth)/page.tsx` 后，该页面无法访问，构建输出也不显示。

### 原因

`(auth)` 路由组不改变 URL 路径，`app/(auth)/page.tsx` 与 `app/page.tsx` 都映射到 `/`，后者覆盖前者。

### 解决

避免使用路由组（至少不要与根页面冲突），直接用 `app/auth/page.tsx`。

---

## React 流式渲染优化

### 问题

流式更新时，UI 出现两种问题：
1. 卡顿（渲染初期）
2. 文字跳变/页面跳动

### 优化历程

#### Phase 1: 基础实现（无优化）

`setMessages` 在 async 流循环中被 React 自动批处理，攒到微任务间隙才一次性渲染。结果：文字一次性出现，没有流式效果。

#### Phase 2: flushSync

```ts
import { flushSync } from "react-dom";
flushSync(() => setMessages(...));
```

效果：流式出现了，但 `flushSync` 强制同步布局，密集 chunk（50+ chunk 在 <100ms 内）卡住主线程，感觉"卡"。

#### Phase 3: RAF 节流（最终方案）

```ts
let pendingContent = "";
contentRef.current += parsed.content;
cancelAnimationFrame(rafId);
rafId = requestAnimationFrame(() => {
  setMessages(prev => {
    const updated = [...prev];
    updated[updated.length - 1] = { role: "assistant", content: contentRef.current };
    return updated;
  });
});
```

特点：
- 同一帧内的多个 chunk 合并渲染（16ms 窗口）
- 不阻塞主线程
- 文字逐帧出现，视觉上顺滑
- 流结束时 `finally` 中强制刷最后一次渲染

#### Phase 4: React.memo 减少重复渲染

- `MarkdownContent` → `React.memo`：已完成的旧消息不重复解析 markdown AST
- `MessageBubble` → `React.memo`：只有内容变化的单条气泡才重渲染
- `showCursor` 替代 `isLoading`：避免 `isLoading` 变化时所有气泡不必要重渲染（之前 `isLoading` 作为 prop 传给所有子组件）

---

## LLM 流式行为

### TTFT（Time to First Token）

- Agnes AI `agnes-2.0-flash` 的首 token 延迟约 1-3 秒
- 后续 token 生成较快（通常 <1 秒完成全回复）
- 流式效果受限于 LLM 提供商的 API 响应速度，前端无法优化

### Chunk 内容过滤

`llm.stream()` 返回的 `AIMessageChunk` 中，`content` 可能为：
- 空字符串 `""`（元数据事件，如 role 声明）
- 字符串（实际 token 内容）
- 需要 `if (content)` 过滤空内容，否则会输出大量空白 SSE 事件

### 判断流式是否工作

在服务端/客户端加时间戳日志：

```
服务端: [stream] chunk #1 @ 3200ms — content: "你好"
客户端: [client] chunk #1 @ 3500ms — content: "你好"
```

- chunks 在 <200ms 内到达 → LLM 生成快，无法进一步优化
- chunks 分散在 >2s 内 → 前端渲染逻辑有问题

---

## 项目文件结构（当前状态）

```
app/
  api/
    auth/login/  ← POST 登录（创建 User + Session + Cookie）
    chat/        ← POST Chat（SSE 流式返回 AI 回复）
  auth/          ← 登录页（名字输入）
  chat/          ← 对话页（流式 Markdown 渲染）
lib/
  db.ts          ← Prisma 7 客户端（adapter-pg）
  auth.ts         ← Session 创建/验证/清理
  llm.ts          ← ChatOpenAI（Agnes AI: agnes-2.0-flash）
  agent.ts        ← LangGraph Agent（单节点，预留给 RAG）
  use-chat.ts     ← 自定义 SSE Chat Hook（fetch + ReadableStream + RAF 节流）
middleware.ts    ← 路由保护（Cookie 检查，Edge Runtime）
```

---

## 关键词索引

| 关键词 | 相关内容 |
|--------|---------|
| useStream | @langchain/react 需要 LangGraph Platform |
| EventSource | 只支持 GET，Chat API 需 POST |
| SSE | `fetch` + `ReadableStream` + `getReader()` |
| Prisma 7 | adapter-pg 替代 schema url |
| Edge Runtime | 不支持 Prisma |
| (auth) | 路由组与 / 冲突 |
| flushSync | 强制同步渲染导致卡顿 |
| RAF | requestAnimationFrame 节流渲染 |
| React.memo | 避免重复解析 markdown |
| TTFT | LLM 首 token 延迟（1-3s） |
| Agnes AI | `agnes-2.0-flash`，OpenAI 兼容 |
