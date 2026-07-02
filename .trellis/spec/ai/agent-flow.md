# Agent Flow

> LangGraph agent orchestration and frontend streaming.

---

## Agent Architecture

```
User Input → LangGraph Agent → (search RAG | LLM call) → Stream tokens → UI
```

- **Orchestration**: LangGraph defines the agent state graph
- **Tools**: RAG retrieval is a tool the agent can invoke
- **Streaming**: LangChain streaming callbacks → SSE → `useStream` hook

## LangGraph Setup

```typescript
import { StateGraph } from '@langchain/langgraph';

// Define agent state
const workflow = new StateGraph({
  channels: { messages: 'list' },
});

// Add nodes and edges
workflow.addNode('agent', agentNode);
workflow.addNode('retrieve', retrieveNode);
workflow.addEdge('agent', 'retrieve');
workflow.addConditionalEdges('retrieve', router);
```

## Frontend Streaming

```typescript
import { useStream } from '@langchain/react';

function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useStream({
      api: '/api/chat',
    });
}
```

## API → Frontend Flow

```
POST /api/chat
  → Route Handler creates LangChain runnable
  → LangGraph agent executes (RAG + LLM)
  → Streams response tokens
  → useStream hook renders in UI
```

## Phase Roadmap

| Phase | Agent Capability |
|-------|-----------------|
| 1 | Basic Q&A with RAG (pre-built knowledge) |
| 2 | User document upload + dynamic indexing |
| 3 | Multi-turn conversation with memory |
