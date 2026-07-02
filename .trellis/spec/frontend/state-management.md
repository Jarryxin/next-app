# State Management

> How state is managed in this project.

---

## Overview

- **Global state**: Zustand (for cross-component state like auth, chat sessions)
- **Local state**: `useState` / `useReducer` per component
- **Server state**: Fetched via Server Components (SSR) or custom hooks (CSR)
- **URL state**: Next.js search params for shareable state

## State Categories

| Category | Tool | Scope |
|----------|------|-------|
| Auth (user, session) | Zustand store | Global |
| Chat messages | `useStream` (internal) | Chat page |
| UI state (sidebar, modals) | `useState` | Component |
| Form state | `useState` | Component |

## Zustand Store Pattern

```typescript
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

## When to Use Global State

Promote local state to Zustand when:
- State is shared by 3+ components at different tree levels
- State must persist across page navigation
- State is updated by non-component code (API response, WebSocket)

## Server State

- SSR pages: fetch data in Server Component directly
- CSR pages: fetch in `useEffect` or via custom hook
- No React Query / SWR -- keep it simple
