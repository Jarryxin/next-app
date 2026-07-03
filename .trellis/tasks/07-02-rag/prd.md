# RAG 知识库

## Goal

实现 RAG（检索增强生成）知识库：预置 Markdown 文档自动索引，AI 对话时检索相关片段作为上下文。

## Background

- Embedding: 智谱 AI GLM（`@langchain/community/embeddings/zhipu`）
- Vector DB: PostgreSQL + pgvector（已有数据库）
- 知识库目录: `/knowledge/`（项目内，git 管理）
- 分块策略: MarkdownHeaderSplitter（按 `#` `##` 切）→ RecursiveCharacterSplitter（chunk_size=1000, overlap=200）
- Agent: LangGraph（已有 `lib/agent.ts`，需添加 retrieval tool）

## Requirements

### 向量存储
- 启用 pgvector 扩展（via Prisma migration raw SQL）
- 创建 `DocumentChunk` 表：id, content, metadata (JSON), embedding (vector), source
- 创建 `KnowledgeDoc` 表：记录已索引的文档（path, status, indexedAt）

### 索引流程
- **按需索引**（非自动）：调用 API 或脚本触发
- 索引脚本：读取 `/knowledge/*.md` → 切分 → 生成 embedding → 存入 pgvector
- 支持增量更新：已索引的文档跳过，修改过的重新索引

### 检索 API
- `POST /api/retrieve` — 接收 query，返回 Top-K 相关片段
- K=5（默认）

### Agent 集成
- 更新 `lib/agent.ts`：添加 `retrieve` 工具节点
- Agent 在响应前自动检索相关文档，拼接上下文
- 流式输出保持不变

### Chat 界面
- 对话页增加"知识库状态"提示（已索引文档数）
- 是否启用 RAG 的 toggle（可选）

## Acceptance Criteria

- [ ] `npx tsx scripts/index-knowledge.ts` 能索引 `/knowledge/` 下所有 md 文件
- [ ] 索引完成后查询 `POST /api/retrieve` 返回相关片段
- [ ] 对话时 Agent 自动使用检索结果作为上下文
- [ ] 新文档放入 `/knowledge/` 后重新索引可增量更新
- [ ] `npm run build` / `lint` / `typecheck` 通过

## Out of Scope

- 用户上传文档（Phase 2）
- 增量 watch（文件变动自动重索引）
- 飞书文档导入（Phase 3）

## Dependencies

- 依赖 智谱 AI API Key（已配置）
- 依赖 PostgreSQL pgvector 扩展（需 migration 启用）
- 依赖已有 AI Chat 基础设施
