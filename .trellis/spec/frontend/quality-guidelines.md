# Quality Guidelines

> Code quality standards for frontend development.

---

## Required Patterns

- TypeScript strict mode -- all types explicit, no `any`
- `@/*` path alias for imports (never relative)
- Server Components by default; `'use client'` only when needed
- Tailwind classes only for styling
- Hand-written UI (no shadcn/ui or similar)
- Semantic HTML with proper a11y attributes

## Forbidden Patterns

- ❌ `any` type (use `unknown` + type guard instead)
- ❌ Relative imports (use `@/` alias)
- ❌ CSS modules, styled-components, inline styles
- ❌ UI libraries (shadcn/ui, MUI, Chakra, etc.)
- ❌ `useEffect` without cleanup where needed
- ❌ Console.log / debugger statements in committed code

## Testing Requirements

| Type | Tool | Scope |
|------|------|-------|
| Unit/Integration | Vitest | Components, hooks, utils |
| E2E | Playwright | Critical user flows |
| Lint | ESLint | All files |
| Type check | tsc --noEmit | All files |

## Pre-Commit

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes (affected tests)
- [ ] `npm run build` succeeds
