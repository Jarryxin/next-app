# 项目简介

这是一个基于 Next.js 的 AI 对话平台，集成了 RAG（检索增强生成）和飞书 OAuth 登录功能。

## 技术栈

### 前端
- Next.js 16 (App Router)
- React 19
- Tailwind CSS
- Zustand（状态管理）

### 后端
- LangChain + LangGraph（AI Agent 编排）
- PostgreSQL + pgvector（向量数据库）
- Prisma ORM

### AI
- Agnes AI（免费 LLM，OpenAI 兼容）
- 智谱 AI GLM（免费 Embedding）

## RAG 工作流程

1. Markdown 文档存入 `/knowledge/` 目录
2. 启动时通过 LangChain 的 MarkdownHeaderSplitter 按标题切分
3. RecursiveCharacterSplitter 做二次切分（chunk_size=1000, overlap=200）
4. 智谱 AI GLM 生成 Embedding 向量
5. 向量存入 PostgreSQL (pgvector)
6. 用户提问时检索最相关片段
7. 拼接上下文后发给 Agnes AI 生成回答
