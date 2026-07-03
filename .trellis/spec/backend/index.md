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

## Feishu OAuth

### 场景：飞书 OAuth 登录 (Phase 1)

#### 1. 范围 / 触发器
- 飞书 OAuth v2.0 扫码/Web 授权登录
- 涉及：API Route Handler、Prisma、Cookie、轮询

#### 2. 签名

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/auth/feishu` | GET | 生成 state，返回授权 URL |
| `/api/auth/feishu/callback?code=&state=` | GET | OAuth 回调 |
| `/api/auth/feishu/status?state=` | GET | PC 端轮询扫码结果 |

#### 3. 合约

**请求/响应**:

`GET /api/auth/feishu` → `{ url: string, state: string }`

`GET /api/auth/feishu/status?state=xxx` →
- `{ status: "pending" }`
- `{ status: "success" }` （同时设 cookie）
- `{ status: "expired" }`

**环境变量**:
- `FEISHU_APP_ID` (必填)
- `FEISHU_APP_SECRET` (必填)
- `FEISHU_REDIRECT_URI` (必填，需在飞书后台精确匹配)

#### 4. 验证与错误矩阵

| 条件 | 错误 |
|------|------|
| callback 缺少 code/state | 400 `{ error: "Missing code or state" }` |
| 飞书 API 返回错误 | redirect `/auth?error=...` |
| cookie token 过期 | redirect `/auth` |
| state 不存在/过期 | polling 返回 `expired` |

#### 5. 模式

- **Web 授权**：同浏览器 redirect → 回调设置 cookie → 跳转 /chat
- **扫码登录**：手机扫码 → 手机端回调设 cookie → PC 轮询 1.5s 间隔 → PC 端设 cookie → 跳转 /chat
- `auth-state.ts` 使用内存 Map 存 state（12 进程部署需换 Redis）
- 标准端点 `authen/v1/access_token`（非 OIDC），`app_id` + `app_secret` 直接鉴权
- 用户通过 `feishuUid`（= open_id）唯一标识

#### 6. 需要测试

- [ ] Web 授权流程
- [ ] 扫码轮询流程
- [ ] 重复登录（更新用户信息，不重复创建）
- [ ] 无效 code 回调（跳转错误页）
- [ ] state 过期（轮询返回 expired）

#### 7. 错误与正确

```typescript
// 正确：使用 response.cookies.set 而非 await cookies().set
const response = NextResponse.redirect(new URL("/chat", req.url));
response.cookies.set("session_token", token, { httpOnly: true, ... });

// 正确：error 响应使用 { error: string } 格式
return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
```

## Quality Check
- [ ] Passes `npm run typecheck`
- [ ] `npm run build` succeeds
- [ ] Error paths tested (invalid input, auth failure, DB error)
- [ ] No sensitive data in error responses
