# Agent Flow

> LangGraph agent orchestration and frontend streaming.

---

## Agent Architecture

```
User Input → LangGraph Agent → (search RAG | LLM call) → Stream tokens → UI
```

- **Orchestration**: LangGraph defines the agent state graph
- **Tools**: RAG retrieval is a tool the agent can invoke
- **Streaming**: LangChain streaming callbacks → SSE → `useChat` hook

## Conversation History

对话记录存储在 PostgreSQL `messages` 表中。每次请求前端发送当前全部消息，API 处理后保存到数据库。

### Save Flow

```
POST /api/chat
  → 1. 创建/查找 conversation（返回 X-Conversation-Id）
  → 2. 保存 user message 到 DB
  → 3. 调用 llm.stream() 并 SSE 返回
  → 4. 流结束后保存 assistant message 到 DB（含完整 content + sources）
  → 5. 首条用户消息 → 自动生成对话 title（截取前50字符）
```

### Load Flow

```
前端选择对话 → GET /api/conversations/[id]
  → 返回 { conversation, messages[] }
  → useChat.loadConversation() 设置 messages state
```

## Long Context Management

对话过长时采用 **滑动窗口 + 历史摘要** 策略，避免超出 LLM 上下文窗口。

### Algorithm (`app/api/chat/route.ts`)

```
1. 估算所有消息的 token 数（content.length / 2）
2. 如果 token > TOKEN_LIMIT(6000) 且 消息数 > WINDOW_SIZE(20)：
   a. 从 conversation.summary 读取已有摘要
   b. 如果无摘要：
      - 取窗口外消息调用 LLM 生成摘要（200字内）
      - 存入 conversation.summary
   c. 只保留最近 WINDOW_SIZE 条消息
   d. 拼接：SystemMessage(摘要) + 最近消息
3. 否则全量传递
```

### Key Design Decisions

- **摘要只生成一次**：超出窗口时生成，后续复用，减少 LLM 调用
- **完整历史不受影响**：DB 始终保存所有消息，前端加载时全量展示
- **Token 估算**：`Math.ceil(content.length / 2)`，对中英文混合偏保守
- **知识库上下文优先**：SystemMessage(知识库) 放在 SystemMessage(摘要) 之前，确保 RAG 内容不被覆盖

### State Evolution

```
msg=5   → 全量传递（无摘要）
msg=21  → token 超限 → LLM 概括 → 存入 summary
msg=22  → 已有 summary → 直接复用
```

## Frontend Streaming

```typescript
import { useChat } from '@/lib/use-chat';

function ChatPage() {
  const { messages, input, setInput, handleSubmit, isLoading, stop, conversationId, loadConversation } =
    useChat('/api/chat');
}
```

### useChat Hook API

| Return | Type | Description |
|--------|------|-------------|
| `messages` | `{ role, content, sources? }[]` | 当前对话消息 |
| `input` | string | 输入框内容 |
| `setInput` | (v: string) => void | 更新输入 |
| `handleSubmit` | (e?) => Promise | 发送消息 |
| `isLoading` | boolean | 是否正在流式响应 |
| `stop` | () => void | 中止请求 |
| `conversationId` | string \| null | 当前对话 ID |
| `loadConversation` | (id: string) => Promise | 加载指定对话历史 |

### SSE Event Format

```
data: {"type":"sources","sources":[...]}
data: {"content":"Hello"}
data: {"content":" world"}
data: [DONE]
```

## Phase Roadmap

| Phase | Agent Capability |
|-------|-----------------|
| 1 | Basic Q&A with RAG (pre-built knowledge) |
| 2 | User document upload + dynamic indexing |
| 3 | Multi-turn conversation with memory ✅ |

## Common Gotchas

- **Streaming + DB save**：assistant message 在流结束后通过 `ReadableStream.start()` 的闭环保存，用 `try/catch` 包裹避免 save 失败影响响应
- **conversationId 传递**：API 通过响应头 `X-Conversation-Id` 返回新对话 ID，前端在流结束后读取
- **摘要生成失败**：`generateSummary` 中的 LLM 调用失败时仅打印错误，不阻塞主对话流程
