# Backend Development Guidelines

> API, database, and auth conventions.

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Runtime | Next.js API Route Handlers (Node.js) |
| Language | TypeScript (strict) |
| ORM | Prisma (PostgreSQL) |
| Auth | Feishu OAuth (Phase 1: scan-to-login) |
| AI Layer | See `.trellis/spec/ai/` |

## Pre-Development Checklist

- [ ] Prisma schema update needs migration (`npm run db:migrate`)
- [ ] New API route follows the Route Handler pattern (no Server Actions)
- [ ] Error responses use consistent `{ error: string }` format
- [ ] Auth-protected routes check session token
- [ ] Environment variables documented in `.env.example`
- [ ] Check quality guidelines below

## Quality Check

- [ ] Passes `npm run lint`
- [ ] Passes `npm run typecheck`
- [ ] `npm run build` succeeds
- [ ] Error paths tested (invalid input, auth failure, DB error)
- [ ] No sensitive data in error responses
