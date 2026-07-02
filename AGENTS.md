> **状态：规划中 / 部分实现**
<!-- BEGIN:project-rules -->
# Project Overview

简述项目定位：AI 对话+RAG+飞书OAuth

**Tech Stack:**
- **Framework:** Next.js (App Router)
- **Language:** TypeScript 
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Database:** PostgreSQL (Prisma ORM), Redis
- **Testing:** Vitest, Playwright 
- **Linting/Formatting:**  ESLint + Prettier 

**Key libraries used:**
<!-- 列出项目中特有的关键依赖及其用途 -->
- AI: LangChain + LangGraph（后端 Agent/RAG 编排）
- LLM: Agnes AI（免费，OpenAI 兼容接口）
- Embedding: 智谱 AI GLM（免费不限量）
- Vector DB: PostgreSQL + pgvector
- 前端 Streaming: `@langchain/react`（useStream hook）
- 飞书OAuth

---

## Architecture & Conventions

### Project structure
<!-- 描述 src/ 或 app/ 目录结构约定 -->
app/
  api/
    chat/       ← AI 对话 API Route
    auth/       ← 飞书 OAuth 回调
    upload/     ← 用户上传文档 (Phase 2)
  (auth)/       ← 登录页面
  chat/         ← 对话页面 (CSR)
knowledge/      ← Markdown 知识库目录

### Routing
<!-- 文件路由还是配置路由？动态路由参数、布局嵌套规则等 -->
使用 Next.js 文件路由 (App Router)

### Data fetching
<!-- SSR / SSG / ISR / RSC / Client fetch？有什么约定？ -->
首页 SSR，对话页面 CSR（useStream）

### Component patterns
<!-- Server Component vs Client Component 区分规则？ -->
<!-- 组件命名、文件组织方式（colocation / atomic design / feature-based）？ -->
对话 UI 先用 Tailwind 手写，不引入 shadcn/ui 等组件库

### API / Server Actions
<!-- API Route Handler 还是 Server Actions？错误处理模式？ -->
API Route Handler

### Database schema changes
<!-- 如何做 migration？是否需要同步更新种子数据？ -->
Prisma migrate + 种子数据脚本

### Testing approach
<!-- 测试文件放在哪里？命名规范？Mock 策略？ -->
按推荐默认

---

## Coding Standards

### Imports
<!-- 导入排序、路径别名（@/）使用规则 -->
使用 @/* 路径别名（已配置）

### Naming conventions
<!-- 文件名、变量名、组件名、API 路由名的风格 -->

### Error handling
<!-- 错误边界、错误类型、用户提示规范 -->

### Accessibility
<!-- a11y 要求：role、aria-label、键盘导航等 -->

### Performance
<!-- 图片优化、动态导入、缓存策略等 -->

---

## AI & RAG Architecture

### LLM
- **Provider:** Agnes AI (`agnes-2.0-flash`)
- **接入方式:** LangChain `ChatOpenAI` + 自定义 baseURL（OpenAI 兼容）
- **备选:** DeepSeek（切换只需改 model name + baseURL）

### RAG Pipeline
- **Vector DB:** PostgreSQL + pgvector
- **Embedding:** 智谱 AI GLM（`@langchain/community/embeddings/zhipu`）
- **Document Loader:** Markdown (`@langchain/community/document_loaders/fs/markdown`)
- **Chunking:** MarkdownHeaderSplitter（按 `#` `##` 切）→ RecursiveCharacterSplitter（chunk_size=1000, overlap=200）
- **知识库目录:** `/knowledge/`（项目内，git 管理）

### RAG 模式（分阶段）
1. **Phase 1:** 预置知识库（Markdown 文件手动放入 `/knowledge/`）
2. **Phase 2:** 用户上传文档（API + 异步索引）

### Agent Flow
- **框架:** LangGraph
- **前端 Streaming:** `@langchain/react` `useStream` hook
- **对话 UI:** Tailwind 手写，不依赖额外 UI 库

### 飞书 OAuth
- **Phase 1:** 扫码登录鉴权
- **Phase 2-3:** 飞书消息推送 + token 刷新

---

## Workflow

- [x] **Lint** — `npm run lint`（提交前必须通过）
- [x] **Type check** — `npm run typecheck`（提交前必须通过）
- [x] **Test** — `npm run test`（提交前运行受影响用例）
- [x] **Build** — `npm run build`（确保可构建成功）

---

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Lint check |
| `npm run typecheck` | TypeScript check |
| `npm run test` | Run tests |
| `npm run test -- -u` | Update snapshots |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database |

---

## Troubleshooting / Gotchas

<!-- 记录常见问题、踩坑经验、以及本项目的特殊行为 -->
<!-- 如：CI 环境变量、奇怪的构建报错、需要手动执行的步骤等 -->

<!-- END:project-rules -->
