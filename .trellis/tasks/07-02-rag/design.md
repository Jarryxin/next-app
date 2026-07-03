# RAG 知识库 — Technical Design

## Architecture

```
                      Index Pipeline
/knowledge/*.md ──> MarkdownHeaderSplitter
                    └─ RecursiveCharacterSplitter
                       └─ 智谱 Embedding ──> pgvector (PostgreSQL)

                      Query Pipeline
用户消息 ──> LangGraph Agent
              ├─ retrieve tool ──> 智谱 Embedding ──> pgvector search
              └─ callModel ──> Agnes AI (with context)
```

## Data Flow

### Index Flow
```
1. Script reads all .md files from /knowledge/
2. For each file:
   a. Check if already indexed (by path + modified time)
   b. MarkdownHeaderSplitter → chunks by # / ## headers
   c. RecursiveCharacterSplitter → chunk_size=1000, overlap=200
   d. 智谱 GLM → embedding (1536 dimensions)
   e. Store in DocumentChunk table
   f. Update KnowledgeDoc record
```

### Query Flow
```
1. Agent receives user message
2. retrieve tool called with user query
3. Query → 智谱 GLM → query embedding
4. pgvector cosine similarity search (limit=5)
5. Return top-K content snippets
6. Agent concatenates: [system prompt + retrieved context + chat history]
7. Agnes AI generates response with context
```

## Key Components

### 1. Prisma Schema

```prisma
model KnowledgeDoc {
  id        String   @id @default(cuid())
  path      String   @unique        // relative path from /knowledge/
  checksum  String                  // md5 of file content
  chunkCount Int
  indexedAt DateTime @default(now())
  createdAt DateTime @default(now())

  @@map("knowledge_docs")
}

model DocumentChunk {
  id        String   @id @default(cuid())
  content   String
  metadata  Json
  source    String                  // path of source file
  docId     String
  embedding String?                 // pgvector vector, stored as string, queried via raw SQL

  @@map("document_chunks")
}
```

Note: pgvector's `vector` type cannot be directly modeled in Prisma. We'll use `String?` and query via raw SQL with `$queryRawUnsafe`.

### 2. Embedding

```ts
import { ZhipuAIEmbeddings } from "@langchain/community/embeddings/zhipu";

const embeddings = new ZhipuAIEmbeddings({
  apiKey: process.env.ZHIPUAI_API_KEY,
});
```

- Model: `text_embedding` (智谱 GLM)
- Dimensions: 1536 (default for GLM embedding)

### 3. Text Splitter Chain

```ts
import { MarkdownHeaderTextSplitter } from "@langchain/textsplitters";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const headerSplitter = new MarkdownHeaderTextSplitter({
  headers: [
    { level: "#", name: "h1" },
    { level: "##", name: "h2" },
  ],
});

const charSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
```

### 4. pgvector Queries

Enable extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB,
  source TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  embedding vector(1536)
);
CREATE INDEX idx_document_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

Search:
```sql
SELECT content, source, 1 - (embedding <=> $1::vector) AS similarity
FROM document_chunks
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

### 5. LangGraph Agent Update

Current: `callModel` node only.
Updated:
```
START → retrieve → callModel → END
```

The `retrieve` node:
1. Takes last user message
2. Generates query embedding
3. Searches pgvector
4. Returns formatted context string

The `callModel` node prepends context to system prompt.

### 6. Index Script

`scripts/index-knowledge.ts` — standalone Node.js script:
```
npx tsx scripts/index-knowledge.ts
```

- Walks `/knowledge/*.md`
- Computes md5 checksum
- Skips if KnowledgeDoc exists with same checksum
- Deletes old chunks for modified files, re-indexes
- Reports summary

### 7. Retrieve API (optional for testing)

`app/api/retrieve/route.ts` — GET/POST:
```
POST /api/retrieve
Body: { query: string, k?: number }
Response: { results: { content, source, similarity }[] }
```

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Embedding storage | pgvector via raw SQL | Prisma doesn't support `vector` type natively |
| Index trigger | Manual script | Phase 1 MVP, auto-watch is Phase 2 |
| Context injection | Agent tool | LangGraph tool node is cleaner than pre/post-processing |
| Search granularity | Per user query (not per message) | Each turn retrieves fresh context |
| Similarity metric | Cosine distance (`<=>`) | Standard for text embeddings |

## Dependencies

Already in package.json:
- `@langchain/community` (ZhipuAIEmbeddings)
- `pg` (PostgreSQL client for raw queries)
- `@prisma/client`, `prisma`

New dependencies to add:
- none (all already installed)
