# AI 对话 + RAG + 飞书 OAuth 功能实现

## Goal

基于已有 Next.js 脚手架和 AGENTS.md 规划，实现 AI 对话、RAG 知识库问答、飞书 OAuth 登录三大核心功能，将项目从"规划中/部分实现"推进到可用的 MVP 状态。

## Background

- **已有依赖**: LangChain, LangGraph, Prisma, pg, zustand, @langchain/react 等已安装
- **数据库 Schema**: User（feishu_uid, tokens）+ Session 模型已定义
- **环境变量**: Agnes AI API Key、智谱 API Key、飞书 OAuth 凭据均已配置
- **知识库**: `/knowledge/example.md` 示例文档
- **前端**: 基础 Next.js + Tailwind 布局，首页骨架
- **项目目录**: `app/` 下缺少 `api/chat/`, `api/auth/`, `(auth)/`, `chat/` 等目录

## Requirements

### 1. AI Chat 对话（Phase 1）

- API Route: `app/api/chat/route.ts` — LangChain + ChatOpenAI（Agnes AI）对话接口
- 前端: `app/chat/page.tsx` — 对话页面，使用 `@langchain/react` useStream hook 流式输出
- LangGraph Agent: 基础对话 Agent
- Chat 页面需要登录认证

### 2. RAG 知识库（Phase 2）

- 向量存储: PostgreSQL + pgvector
- Embedding: 智谱 AI GLM（`@langchain/community/embeddings/zhipu`）
- 文档切分: MarkdownHeaderSplitter → RecursiveCharacterSplitter（chunk_size=1000, overlap=200）
- 知识库索引: 按需索引（手动触发）
- 检索增强: 用户提问时检索相关片段，拼接上下文后发给 LLM

### 3. 飞书 OAuth 登录（Phase 3）

- 扫码登录: 飞书 OAuth 2.0 授权码流程
- 回调处理: `app/api/auth/feishu/callback/route.ts`
- 会话管理: Session Token，存入数据库 Session 表
- 登录页面: `app/(auth)/page.tsx` — 飞书扫码入口
- 登录态中间件: 保护 `/chat/` 等需要登录的页面

### 4. 项目基础设施

- 首页: `app/page.tsx` 跳转到登录/聊天
- 基本 Auth 基础设施（Session 管理、登录保护中间件）——在 Phase 1 完成
- 错误处理与加载状态

## Acceptance Criteria

- [ ] AI Chat: 用户在 `/chat` 页面可输入问题并收到 Agnes AI 的流式回复，需要登录才能访问
- [ ] RAG: 系统能按需索引 `/knowledge/` 下的 Markdown 文档，在对话中检索相关上下文
- [ ] 飞书 OAuth: 用户可扫码登录，登录后可访问 `/chat` 页面
- [ ] 整体: `npm run build` 通过，`npm run lint` 通过，`npm run typecheck` 通过

## Out of Scope

- 用户上传文档（Project Phase 2）
- 飞书消息推送与 token 刷新（Project Phase 2-3）
- 大规模并发与性能优化
- 完整的测试覆盖（基础测试即可）

## Implementation Order

1. **AI Chat** — 实现 Chat API（包含基本 Session 认证）、Chat 页面（流式 Streaming）
2. **RAG** — 实现知识库索引与检索，增强 Chat
3. **飞书 OAuth** — 替换基本 Auth 为飞书扫码登录

## Resolved Questions

- 实现顺序: AI Chat → RAG → 飞书 OAuth
- Chat 是否需要 auth: 需要，Phase 1 实现基本 Session 认证
- RAG 索引时机: 按需索引（手动触发）
