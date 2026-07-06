> **状态：AI Chat ✓ RAG ✓ 飞书 OAuth Phase 1 ✓**
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
- 前端 Streaming: 自定义 `useChat` hook（SSE + fetch），未使用 `@langchain/react`（需要 LangGraph Platform Server）
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
  auth/         ← 登录页面
  chat/         ← 对话页面 (CSR)
lib/
  db.ts         ← Prisma 7 客户端（adapter-pg）
  auth.ts       ← Session 创建/验证/清理
  llm.ts        ← ChatOpenAI（Agnes AI）
  agent.ts      ← LangGraph Agent
  use-chat.ts   ← 自定义 SSE 流式 Chat Hook
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

### 图片手写笔记转录
- **脚本:** `scripts/transcribe-images.ts`
- **方式:** 读取 `knowledge/interview/` 下的 `.jpg`/`.png`，通过 Agnes AI 视觉 API 转录手写文字，生成 `.md` 文件
- **流程:** `transcribe-images` → 图片按内容重命名 + 生成 `.md` → `index-knowledge` 索引到 pgvector
- **注意:** 需要 Agnes AI API 正常运行（视觉模式），图片会以 base64 形式发送

### 笔记自动分类归档
- **脚本:** `scripts/classify-notes.ts`
- **方式:** 读取 `knowledge/interview/` 下的 `.md`，通过 Agnes AI 判断内容类别，自动将 `.md` + `.jpg` 移动到 `knowledge/<类别>/` 子目录
- **流程:** `transcribe-images` → `classify-notes` → `index-knowledge`
- **注意:** `indexKnowledgeDir()` 已支持递归扫描子目录，分类后文件会被正常索引

### RAG 模式（分阶段）
1. **Phase 1:** 预置知识库（Markdown 文件手动放入 `/knowledge/`，图片放入 `knowledge/interview/`）
2. **Phase 2:** 用户上传文档（API + 异步索引）

### Agent Flow
- **框架:** LangGraph
- **前端 Streaming:** 自定义 `useChat` hook（SSE + fetch），未使用 `@langchain/react`（需要 LangGraph Platform Server）
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
| `npx tsx scripts/index-knowledge.ts` | Index knowledge directory (need Ollama running) |
| `npx tsx scripts/transcribe-images.ts` | Transcribe handwritten note images to Markdown (need Agnes AI) |
| `npx tsx scripts/classify-notes.ts` | Classify and archive notes into category subdirectories (need Agnes AI) |
| `npm run dev` → `/upload` | Web UI: upload → LLM classify → edit → index to RAG |

---

## Troubleshooting / Gotchas

<!-- 记录常见问题、踩坑经验、以及本项目的特殊行为 -->
<!-- 如：CI 环境变量、奇怪的构建报错、需要手动执行的步骤等 -->

### Prisma 7 迁移注意事项
- `datasource` 块中**不能**写 `url`，连接串通过 `prisma.config.ts` 提供
- 客户端初始化需用 `PrismaPg` adapter：`new PrismaClient({ adapter: new PrismaPg(DATABASE_URL) })`
- 运行时 PrismaClient 初始化失败 → 检查 `PrismaClientOptions` 错误，确认 adapter 正确传入

### Middleware (Edge Runtime) 限制
- Edge Runtime **不支持** Prisma Client（需 Node.js）
- Middleware 只做 cookie 存在性检查，DB 验证延迟到 API Route 中处理

### 前端 Streaming 方案选择
- `@langchain/react` 的 `useStream` 需要 LangGraph Platform Server，不能直接对接自定义 API Route
- 自定义 SSE 方案：`fetch` + `response.body.getReader()` + `ReadableStream`
- **为什么不直接用 EventSource**：EventSource 只支持 GET，而 Chat API 需 POST 传消息体
- RAF（requestAnimationFrame）节流比 `flushSync` 更顺滑：密集 chunk 在单帧内批量渲染

### React 流式渲染优化
- 流式更新时 `flushSync` 强制同步渲染会导致卡顿，改用 RAF 每帧更新一次
- `React.memo` 包裹 Markdown 组件，避免旧消息重复解析 markdown AST
- `isLoading` 作为 prop 传给所有子组件会导致所有气泡重渲染；改为只在最后一条消息传 `showCursor`

### RAG Embedding 方案演变
- **最初**：智谱 AI GLM（`@langchain/community/embeddings/zhipu`）→ 余额不足
- **尝试**：`HuggingFaceTransformersEmbeddings`（本地 ONNX）→ `onnxruntime-node` 缺少对应 arch 的二进制
- **尝试**：`HuggingFaceInferenceEmbeddings`（HF Inference API）→ 网络不通（GFW）
- **最终（当前）**：Ollama 本地 `bge-m3` 模型（1024d），通过 `OpenAIEmbeddings` 以 OpenAI 兼容格式连接。支持中文，上下文窗口 8192 token
- **之前尝试**：`all-minilm`（384d）英文模型，中文检索效果差（相似度 < 50%），已替换
- 需要启动 Ollama 后再运行 index 脚本：`ollama serve` + `npx tsx scripts/index-knowledge.ts`

### RAG pgvector 注意事项
- pgvector 的 `ivfflat` 索引默认 `probes=1`，数据量小时可能返回 0 个结果
- 小知识库直接不用 ivfflat 索引，用精确搜索即可
- Embedding 存储使用 `Unsupported("vector(384)")` Prisma 类型，所有向量操作通过 raw SQL 进行
- 向量通过 `prisma.$queryRawUnsafe` 的 `$1::vector` 参数绑定传递（字符串格式：`[-0.075,0.009,...]`）
- 索引脚本需要 `dotenv/config` 加载环境变量

### LangGraph / LLM 流式注意事项
- `llm.stream()` 返回的 chunk 中 `content` 可能为空字符串（元数据事件），需用 `if (content)` 过滤
- 流式效果取决于 LLM 提供商的 TTFT（首 token 延迟），不是前端能优化的
- Agnes AI 首 token 延迟约 1-3 秒，后续生成较快

### 飞书 OAuth
- **Web 授权**（弹窗跳转）可在本地开发环境正常工作
- **扫码登录**需要公网可访问的 redirect_uri（localhost 手机无法访问），开发时可用 ngrok 隧道或直接部署后测试
- 使用标准飞书 OAuth v2.0 接口：`authen/v1/access_token`（非 OIDC），`app_id` + `app_secret` 直接鉴权
- 回调 `redirect_uri` 需在飞书开发者后台安全设置中精确配置
- 用户通过 `feishuUid`（open_id）唯一标识，再次登录时更新用户信息

### 路由组陷阱
- `(auth)/` 路由组与 `app/page.tsx` 都映射到 `/` 路径，导致 (auth) 页面不可达
- 解决方法：不要用路由组，直接用 `auth/` 目录

<!-- END:project-rules -->
<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
