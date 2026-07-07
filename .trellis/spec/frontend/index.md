# Frontend Development Guidelines

> Frontend conventions for the AI Chat + RAG + Feishu OAuth app.

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| State | Zustand (global) + useState/useReducer (local) |
| Streaming | `@langchain/react` `useStream` hook |
| Linting | ESLint (next/core-web-vitals + next/typescript) |

## Pre-Development Checklist

Before writing frontend code:

- [ ] Is this a Server Component or Client Component? (`'use client'` only when needed: hooks, state, event handlers, browser APIs)
- [ ] Does it need global state (Zustand) or is local state sufficient?
- [ ] Is there an existing component or hook to reuse?
- [ ] Imports use `@/*` path alias -- never relative imports
- [ ] Tailwind classes only -- no CSS modules, styled-components, or UI libraries
- [ ] Check quality guidelines below

## UI Patterns

### 会话列表删除按钮

```tsx
<div key={conv.id} className="group relative">
  <button onClick={() => handleSelect(conv.id)}>
    <div className="truncate font-medium">{conv.title}</div>
  </button>
  <button
    onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 opacity-0 transition hover:bg-red-100 group-hover:opacity-100"
  >
    <svg>...</svg> {/* trash icon */}
  </button>
</div>
```

- 使用 `group` + `group-hover` 实现 hover 显示删除按钮
- `e.stopPropagation()` 防止点击删除触发选中
- 删除后更新本地 state 过滤，如果删除当前会话则 `loadConversation("")`

## React 19 注意事项

**`setState` in `useEffect` 警告** — React 19 ESLint 插件禁止在 effect 中直接/间接调用 setState。解决方案：

```tsx
// ❌ 错误：通过 useCallback 间接调用 setState
const fetchData = useCallback(async () => {
  setData(await fetch("/api/data").then(r => r.json()));
}, []);
useEffect(() => { fetchData(); }, [fetchData]);

// ✅ 正确：直接在 effect 内 inline async，使用 cancelled 守卫
useEffect(() => {
  let cancelled = false;
  (async () => {
    const res = await fetch("/api/data");
    if (res.ok && !cancelled) {
      setData(await res.json());
    }
  })();
  return () => { cancelled = true; };
}, []);
```

## Quality Check

- [ ] Passes `npm run lint` (no ESLint warnings/errors)
- [ ] Passes `npm run typecheck` (strict mode, no `any` escape hatches)
- [ ] Client vs Server Component split is correct
- [ ] No accessibility issues (proper role, aria-label, keyboard navigation)
- [ ] Console.log / debug code removed
