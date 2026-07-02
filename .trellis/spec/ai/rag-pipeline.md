# RAG Pipeline

> Document ingestion, chunking, embedding, and retrieval.

---

## Pipeline Stages

```
Markdown files → Load → Split → Embed → Store (pgvector) → Retrieve → Generate
```

## Stage 1: Document Loading

```typescript
import { MarkdownLoader } from '@langchain/community/document_loaders/fs/markdown';

const loader = new MarkdownLoader('knowledge/*.md');
const docs = await loader.load();
```

- Source: `/knowledge/` directory (git-managed, Phase 1)
- Phase 2: user-uploaded documents via `/api/upload`

## Stage 2: Chunking

Two-stage split:

```typescript
import { MarkdownHeaderSplitter } from 'langchain/text_splitter';
import { RecursiveCharacterSplitter } from 'langchain/text_splitter';

const headerSplitter = new MarkdownHeaderSplitter({
  headers: [['#', 'Header 1'], ['##', 'Header 2']],
});
const headerDocs = await headerSplitter.splitDocuments(docs);

const charSplitter = new RecursiveCharacterSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});
const chunks = await charSplitter.splitDocuments(headerDocs);
```

## Stage 3: Embedding

```typescript
import { ZhipuAIEmbeddings } from '@langchain/community/embeddings/zhipu';

const embeddings = new ZhipuAIEmbeddings({
  apiKey: process.env.ZHIPU_API_KEY,
});
```

## Stage 4: Vector Store (pgvector)

- PostgreSQL with pgvector extension
- Store embeddings alongside original text and metadata
- Query: cosine similarity search

## Stage 5: Retrieval

- Retrieve top-k chunks relevant to user query
- Pass as context to LLM for answer generation
- RAG mode: phase 1 (pre-built knowledge) → phase 2 (user documents)
