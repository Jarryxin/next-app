# Error Handling

> Error handling patterns for backend code.

---

## API Error Response Format

```typescript
// Success
{ "data": { ... } }

// Error
{ "error": "Human-readable error message" }
```

## HTTP Status Codes

| Code | When |
|------|------|
| 200 | Success |
| 400 | Bad request (invalid input, missing fields) |
| 401 | Unauthorized (missing/invalid session) |
| 403 | Forbidden (valid auth but no permission) |
| 404 | Not found |
| 429 | Rate limited (future) |
| 500 | Internal server error |

## Error Handling Pattern

```typescript
export async function POST(req: NextRequest) {
  try {
    // 1. Auth guard
    const session = await validateSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse & validate input
    const body = await req.json();
    if (!body.message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // 3. Business logic
    const result = await processMessage(body.message);

    // 4. Success
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[POST /api/chat]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Principles

- Catch all errors in top-level handler
- Log errors server-side with context (`[METHOD /path]`)
- Never expose stack traces or internal details to client
- Always return structured JSON errors (not HTML)
