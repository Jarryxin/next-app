# RAG 实现经验记录

## 概述

本文档记录 AI Chat RAG（检索增强生成）功能实现过程中遇到的问题、决策原因及解决方案。

---

## Embedding 模型选型历程

### 问题

需要选择一个 Embedding 模型将知识库文本转为向量，支持中文检索。

### 尝试方案

#### 1. 智谱 AI GLM Embedding（最初方案）

```ts
import { ZhipuAIEmbeddings } from "@langchain/community/embeddings/zhipu";
```

**结果**：API key 余额不足 → 放弃。

#### 2. HuggingFaceTransformersEmbeddings（本地 ONNX）

```ts
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
```

**结果**：`onnxruntime-node` 缺少 darwin/arm64 架构的预编译二进制 → 安装失败。

#### 3. HuggingFaceInferenceEmbeddings（HF Inference API）

```ts
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
```

**结果**：HuggingFace API 在国内被墙，`fetch` 超时 → 不可用。

#### 4. Ollama all-minilm（本地，最终→被替换）

通过 `OpenAIEmbeddings` 以 OpenAI 兼容格式连接本地 Ollama：

```ts
const embeddings = new OpenAIEmbeddings({
  model: "all-minilm",
  configuration: { baseURL: "http://localhost:11434/v1" },
  apiKey: "ollama",
});
```

**问题**：`all-minilm` 是纯英文模型（384d），中文检索效果极差：
- 中文查询的相似度通常 < 50%
- 知识库有相关文档也匹配不上

**已替换**。

#### 5. Ollama bge-m3（当前方案）

`bge-m3` 是多语言模型（1024d），上下文窗口 8192 token，中文支持好。

```ts
model: "bge-m3",
```

**检索效果**：
| 查询 | all-minilm | bge-m3 |
|------|:----------:|:------:|
| Ollama怎么安装 | ~42% | ~63% |
| 排查思路 | ~45% | ~73% |
| 系统架构 | ~47% | ~91% |

---

## pgvector 向量维度管理

### 问题

Prisma schema 中使用 `Unsupported("vector(N)")` 类型，Prisma 无法自动 diff 维度变化。

### 解决方案

1. 在 schema 中声明 `Unsupported("vector(N)")`（N 必须与实际一致）
2. 直接通过 raw SQL 修改列类型：

```sql
ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(1024);
```

3. 创建手动 migration SQL 文件记录变更
4. 使用 `prisma migrate resolve --applied` 标记已应用

### 注意事项

- 向量操作通过 raw SQL 的 `::vector` 参数绑定传递
- 维度不匹配会在运行时报错（`expected N dimensions, not M`）
- 维度由列定义决定，不是由 SQL 查询中的 `::vector` 决定

---

## ivfflat 索引坑

### 问题

建了 ivfflat 索引后，小知识库检索返回 0 结果。

### 原因

pgvector 的 ivfflat 索引默认 `probes=1`（每个列表只探测 1 个条目）。数据量小（<100 条）时，可能所有向量都被分到列表之外，导致 0 结果。

### 解决

数据量小时直接用精确搜索（不用索引）：

```sql
SELECT ... ORDER BY embedding <=> $1::vector;
```

数据量大（>1000 条）时再考虑重建索引：

```sql
CREATE INDEX idx_chunks_embedding ON document_chunks
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```

---

## 相似度阈值过滤

### 问题

无关查询也返回低相似度（<45%）的片段，浪费 LLM 上下文窗口且污染回答。

### 解决

在 `searchSimilar` 中加 WHERE 条件过滤：

```ts
const WHERE = `1 - (embedding <=> $1::vector) >= $3`;
// 默认 minSimilarity = 0.45
```

结果：
- 低于 45% 的片段根本不出现在结果中
- 无相关结果时跳过 RAG，直接走 LLM
- 前端不显示低质量来源

---

## Chunk 大小选择

### 问题

`all-minilm` 上下文窗口仅 256 token，中文长 chunk 会报 `the input length exceeds the context length`。

### 方案演变

| 模型 | 窗口 | chunk_size |
|------|------|:----------:|
| all-minilm | 256 token | 300 |
| bge-m3 | 8192 token | 500 |

### 分割策略

使用 `MarkdownTextSplitter`（按 `#`、`##` 等标题切分）→ `RecursiveCharacterSplitter`（按字符数细切，chunk_size=500, overlap=100）。

---

## 上下文注入方式

### 方案：Inline RAG（非 LangGraph）

最初用 LangGraph（retrieve → callModel 双节点），但流程是线性无分支的（无条件边、无循环、无并行），用 LangGraph 图编排反而增加额外复杂度。改为：

1. 在 chat route 中直接调 `searchSimilar(query)`
2. 若有结果，以 `SystemMessage` 形式注入消息列表头部
3. 调 `llm.stream(messages)` 正常流式输出

```ts
const results = await searchSimilar(query, 5, 0.45);
if (results.length > 0) {
  const context = results.map(r => `[来源: ${r.source}]\n${r.content}`).join("\n\n---\n\n");
  langchainMessages.unshift(new SystemMessage(`相关知识：\n\n${context}`));
}
const stream = await llm.stream(langchainMessages);
```

### 优点

- 保持 SSE 流式效果（LLM token 逐字输出）
- 不需要 LangGraph 的图编排
- 相同进程内调用，无网络开销

---

## 前端来源展示

### 方案

在 SSE 流的第一个事件中发送来源数据：

```
data: {"type":"sources","sources":[{"content":"...","source":"...","similarity":0.95}]}
```

前端 `useChat` hook 解析 `type: "sources"` 事件，存储到 `messages[i].sources`。

UI 中每个 AI 回复下方显示可折叠的"知识库来源"面板，包含文件名和相似度。

### 性能

- 来源数据在 content streaming 之前发送，不阻塞渲染
- 折叠面板默认收起，不影响阅读体验

---

## 关键词索引

| 关键词 | 相关内容 |
|--------|---------|
| Embedding 选型 | 智谱(余额不足)→HF(ONNX缺arch→API被墙)→all-minilm(英文差)→bge-m3(当前) |
| bge-m3 | Ollama 多语言模型，1024d，上下文 8192 |
| all-minilm | Ollama 英文模型，384d，中文检索 <50% |
| pgvector 维度 | `Unsupported("vector(N)")`，raw SQL `::vector`，手动 migration |
| ivfflat | 小数据量返回 0 结果，探测数不够 |
| chunk_size | 500（bge-m3），之前 300（all-minilm 窗口小） |
| 相似度阈值 | 45%，低于此值不返回 + 不展示 |
| Inline RAG | 直接调 searchSimilar，不走 LangGraph |
| SSE 来源事件 | `type: "sources"` 第一个事件，折叠展示 |
