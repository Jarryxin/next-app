# AI / RAG / Agent Development Guidelines

> LLM, RAG pipeline, and LangGraph agent conventions.

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| LLM Provider | Agnes AI (`agnes-2.0-flash`, OpenAI-compatible) |
| Fallback | DeepSeek (swap model + baseURL) |
| LangChain | `ChatOpenAI` with custom baseURL |
| Embedding | 智谱 AI GLM (`@langchain/community/embeddings/zhipu`) |
| Vector DB | PostgreSQL + pgvector (via Prisma/raw SQL) |
| Agent Framework | LangGraph |
| Document Loading | `@langchain/community/document_loaders/fs/markdown` |
| Chunking | MarkdownHeaderSplitter → RecursiveCharacterSplitter |
| Frontend Streaming | 自定义 `useChat` hook（SSE + fetch） |

## Pre-Development Checklist

- [ ] LLM provider env vars set (baseURL, API key, model name)
- [ ] Embedding model: Ollama running with `ollama serve` + `all-minilm` model pulled
- [ ] pgvector extension enabled in PostgreSQL
- [ ] `knowledge/` directory has valid Markdown files
- [ ] Chunking params aligned (chunk_size=1000, overlap=200)
- [ ] Check quality guidelines below

## Quality Check

- [ ] Passes `npm run lint`
- [ ] Passes `npm run typecheck`
- [ ] LLM responds correctly (test with a simple prompt)
- [ ] RAG retrieval returns relevant chunks
- [ ] Agent flow completes without hanging
- [ ] Streaming works end-to-end (frontend receives tokens)
