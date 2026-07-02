# AI Chat 对话

## Goal

实现 AI 对话核心功能：用户登录后可在对话页面与 Agnes AI 进行流式对话。

## Background

- AI Provider: Agnes AI（`agnes-2.0-flash`），OpenAI 兼容接口
- 接入方式: LangChain `ChatOpenAI` + 自定义 baseURL
- Agent 框架: LangGraph（基础对话 Agent）
- 前端 Streaming: `@langchain/react` useStream hook
- 对话 UI: Tailwind CSS 手写
- 会话历史: MVP 阶段存内存，后续接数据库

## Requirements

### 认证（Phase 1 基础版）
- 使用已有 User + Session 表
- 登录页面 `app/(auth)/page.tsx` — 简单用户名/ID 输入 + 创建 Session（后期被飞书 OAuth 替换）
- Session Token 存入 Cookie
- 中间件保护 `/chat/` 路由，未登录重定向到登录页

### Chat API
- `app/api/chat/route.ts` — POST 接口
- 接收用户消息，通过 LangGraph Agent 调用 Agnes AI
- 返回流式响应（Server-Sent Events）

### Chat 页面
- `app/chat/page.tsx` — Client Component
- 聊天消息列表（用户消息 + AI 回复）
- 输入框 + 发送按钮
- 使用 `useStream` hook 实现流式输出
- 加载状态（发送中、错误提示）

### 首页
- `app/page.tsx` — 已登录跳转 `/chat`，未登录显示登录入口

## Acceptance Criteria

- [ ] 用户在登录页输入名称后可创建会话进入聊天页
- [ ] 用户在 `/chat` 页可输入问题并收到 Agnes AI 的流式回复
- [ ] AI 回复逐 token 展示（流式效果）
- [ ] 会话保持（页面刷新后需重新登录，内存中的对话记录丢失）——MVP 预期行为
- [ ] 未登录用户访问 `/chat` 被重定向到登录页
- [ ] `npm run build` 通过，`npm run lint` 通过，`npm run typecheck` 通过

## Out of Scope

- 消息持久化（后续接数据库）
- 对话历史列表
- 多轮对话上下文管理（MVP 只保留当前会话）
- 飞书 OAuth（Phase 3 实现）

## Dependencies

- 依赖 Session 表（已有 schema）和 User 表
- 依赖 Agnes AI API Key（已配置）
