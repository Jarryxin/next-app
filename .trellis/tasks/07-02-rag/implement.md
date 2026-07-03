# RAG 知识库 — Implementation Plan

## Order

1. Prisma schema + migration（pgvector extension + DocumentChunk/KnowledgeDoc 表）
2. Embedding + text splitter 工具函数
3. Index script（`scripts/index-knowledge.ts`）
4. Retrieve API（测试用）
5. LangGraph Agent 集成（retrieve tool）
6. Integration test + fix

---

## Step 1: Prisma Schema + Migration

### Files to modify:

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `KnowledgeDoc` and `DocumentChunk` models |

### Migration:
```bash
npx prisma migrate dev --name add-rag-tables
```

Then manually add pgvector extension and vector column via a second raw SQL migration:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

Actually, better: add the raw SQL to a migration file, not via Prisma schema changes for vector.

Or: separate migration for pgvector:
```bash
npx prisma migrate dev --name enable-pgvector --create-only
```
Then edit the generated SQL to add the extension before running.

### Validation:
```bash
npx prisma migrate status
```

### Rollback:
```bash
npx prisma migrate reset
```

---

## Step 2: Embedding + Text Splitter

### Files to create:

| File | Description |
|------|-------------|
| `lib/embeddings.ts` | ZhipuAIEmbeddings instance |
| `lib/splitter.ts` | MarkdownHeaderSplitter + RecursiveCharacterTextSplitter chain |
| `lib/rag.ts` | Indexing function + retrieval function |

### Key points:
- `lib/embeddings.ts` exports a singleton embeddings instance
- `lib/splitter.ts` exports a function: `splitMarkdown(content)` → `Document[]`
- `lib/rag.ts` exports: `indexFile(path)`, `searchSimilar(query, k)`
- `searchSimilar` uses `prisma.$queryRawUnsafe` for pgvector query

### Validation:
```bash
npm run typecheck
npm run lint
```

---

## Step 3: Index Script

### Files to create:

| File | Description |
|------|-------------|
| `scripts/index-knowledge.ts` | Walks `/knowledge/`, indexes all .md files |

### Script logic:
```
1. Read all .md files from /knowledge/
2. For each file:
   a. Compute md5 checksum
   b. Check KnowledgeDoc for same path + checksum (skip if unchanged)
   c. Delete old chunks for this path
   d. Read content, split via splitMarkdown()
   e. Generate embeddings for each chunk
   f. Insert into DocumentChunk
   g. Upsert KnowledgeDoc
3. Print summary
```

### Run:
```bash
npx tsx scripts/index-knowledge.ts
```

### Validation:
```bash
npm run typecheck
```

---

## Step 4: Retrieve API

### Files to create:

| File | Description |
|------|-------------|
| `app/api/retrieve/route.ts` | POST handler for testing retrieval |

### Request:
```json
POST /api/retrieve
{ "query": "项目技术栈是什么", "k": 5 }
```

### Response:
```json
{ "results": [{ "content": "...", "source": "example.md", "similarity": 0.92 }] }
```

### Validation:
```bash
curl -X POST http://localhost:3000/api/retrieve \
  -H 'Content-Type: application/json' \
  -d '{"query": "项目技术栈"}'
```

---

## Step 5: LangGraph Agent Integration

### Files to modify:

| File | Action | Description |
|------|--------|-------------|
| `lib/agent.ts` | Modify | Add `retrieve` tool node, update graph |

### Updated graph:
```
START → retrieve → callModel → END
```

- `retrieve` node: extracts last user message, calls `searchSimilar`, returns context as tool result message
- `callModel` node: receives chat history + context, generates response
- Stream output stays the same (SSE from POST /api/chat)

### Key considerations:
- The `retrieve` node should NOT run if there's no user query
- If no relevant results found, skip context injection
- Context format: `以下是相关文档内容：\n\n---\n{content}\n---\n\n请基于以上内容回答问题。`

---

## Step 6: Integration & Fix

### Test flow:
1. Start dev server: `npm run dev`
2. Run index: `npx tsx scripts/index-knowledge.ts`
3. Test retrieve API: curl to verify results
4. Login → send question related to knowledge → verify RAG context is used

### Verify:
```bash
npm run build
npm run lint
npm run typecheck
```

---

## Review Gates

- [ ] Index script runs without error, documents stored
- [ ] Retrieve API returns relevant chunks
- [ ] Agent uses retrieved context in responses
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
