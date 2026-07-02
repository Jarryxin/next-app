# Component Guidelines

> How components are built in this project.

---

## Component Patterns

- **Dialogue UI is hand-written with Tailwind** -- no shadcn/ui, no component libraries
- Server Components are the default; add `'use client'` only when needed
- Props are typed with `interface` (not `type`), exported when shared

## Server vs Client Component

| Criteria | Server Component | Client Component |
|----------|-----------------|------------------|
| Uses hooks | ❌ | ✅ |
| Has state/effects | ❌ | ✅ |
| Handles events (onClick, etc.) | ❌ | ✅ |
| Needs browser APIs | ❌ | ✅ |
| Pure rendering of passed data | ✅ | ❌ |
| Data fetching (SSR) | ✅ | ❌ |

## Props Conventions

```typescript
// Interface style, exported when used by other components
export interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}
```

## Styling

- Tailwind utility classes only -- never CSS modules, styled-components, or inline styles
- Use Tailwind `cn()` helper for conditional classes when needed

## Accessibility (a11y)

- Semantic HTML: `<button>`, `<nav>`, `<main>`, `<section>`
- Interactive elements need focus styles
- Icons/buttons need `aria-label`
- Loading states show `aria-busy` or accessible text
