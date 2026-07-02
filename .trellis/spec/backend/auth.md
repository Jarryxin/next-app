# Feishu OAuth

> Feishu (飞书) OAuth authentication flow.

---

## Phase 1: Scan-to-Login

```
User → Feishu QR page → callback to /api/auth → create/update User → set session cookie
```

### Flow

1. User clicks "Login with Feishu" → redirect to Feishu OAuth authorize URL
2. User scans QR code in Feishu app
3. Feishu redirects to `/api/auth?code=...`
4. API Route Handler exchanges `code` for `access_token` + `refresh_token`
5. Fetch user info from Feishu API
6. Upsert `User` record (keyed by `feishuUid`)
7. Create `Session` with random token, set cookie
8. Redirect to `/chat`

## Session Management

- Session token stored in HTTP-only cookie
- Token validated on each protected request
- Session expiry checked; expired sessions return 401

## Future Phases

- Phase 2-3: Feishu message push, token refresh, webhook handling
