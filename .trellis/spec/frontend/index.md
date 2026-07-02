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

## Quality Check

- [ ] Passes `npm run lint` (no ESLint warnings/errors)
- [ ] Passes `npm run typecheck` (strict mode, no `any` escape hatches)
- [ ] Client vs Server Component split is correct
- [ ] No accessibility issues (proper role, aria-label, keyboard navigation)
- [ ] Console.log / debug code removed
