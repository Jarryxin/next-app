# API Routes

> Conventions for API Route Handlers.

---

## Route Structure

```
app/api/
├── chat/
│   └── route.ts      ← POST /api/chat (AI conversation)
├── auth/
│   └── route.ts      ← GET /api/auth (Feishu OAuth callback)
└── upload/
    └── route.ts      ← POST /api/upload (Phase 2, docs)
```

## Handler Pattern

```typescript
// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // validate, process, respond
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

## Conventions

- **No Server Actions** -- use Route Handlers exclusively
- File named `route.ts` (not `route.tsx`)
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`
- Error format: `{ error: string }` with appropriate HTTP status
- Input validation at the handler entry point
- Auth check as early guard in each protected route

## Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/chat` | Send message, stream AI response | Session cookie |
| GET | `/api/auth` | Feishu OAuth callback | Public |
| POST | `/api/upload` | Upload document (Phase 2) | Session cookie |
