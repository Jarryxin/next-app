# 飞书 OAuth 实现经验记录

## 概述

本文档记录飞书 OAuth 登录（Phase 1）实现过程中遇到的问题、决策原因及解决方案。

---

## 认证模式选择

### 需求

支持两种登录方式：
1. **Web 授权跳转** — 点击按钮 → 跳飞书授权页 → 授权 → 回调 → 登录成功
2. **扫码登录** — PC 显示二维码 → 手机扫码 → 授权 → 回调 → PC 自动登录

### 实现

两种模式共享同一套 OAuth 回调端点，区别在于用户交互流程：

**Web 授权**：
```
/auth (点击按钮) → GET /api/auth/feishu → 获取授权URL → redirect 飞书
  → 飞书授权 → redirect callback → 创建/更新用户 + session + cookie → redirect /chat
```

**扫码登录**：
```
/auth (点击按钮) → GET /api/auth/feishu → 获取授权URL + state → 显示二维码
  → 手机扫码 → 飞书授权 → 回调(手机上) → 创建/更新用户 + session
  → PC 轮询 GET /api/auth/feishu/status?state=xxx (1.5s间隔)
  → 轮询到 success → cookie 设置到 PC 浏览器 → redirect /chat
```

---

## 标准端点 vs OIDC 端点

### 首次尝试（OIDC）

```ts
// 先取 app_access_token
POST https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal
{ app_id, app_secret }

// 再用 Bearer token 换用户 access_token
POST https://open.feishu.cn/open-apis/authen/v1/oidc/access_token
Authorization: Bearer {app_access_token}
{ grant_type: "authorization_code", code }

// 再取用户信息
GET https://open.feishu.cn/open-apis/authen/v1/oidc/userinfo
Authorization: Bearer {user_access_token}
```

**问题**：部分飞书应用配置可能不兼容 OIDC 端点，报错或返回异常。

### 最终方案（标准端点）

```ts
// 一步到位：app_id + app_secret 直接鉴权
POST https://open.feishu.cn/open-apis/authen/v1/access_token
{
  app_id: FEISHU_APP_ID,
  app_secret: FEISHU_APP_SECRET,
  code: "...",
  grant_type: "authorization_code",
  redirect_uri: "http://localhost:3000/api/auth/feishu/callback"
}
```

**优点**：
- 不需要先取 app_access_token（少一次网络往返）
- 返回结果已包含用户信息（name, avatar, open_id, union_id）
- 需传入 `redirect_uri` 重复校验（安全要求）

**注意**：请求 body 必须是 `application/json`，且带 `charset=utf-8`。

---

## 重定向 URL 配置

### 问题

飞书回调时报 `错误码 20029`（重定向 URL 有误）。

### 原因

飞书开发者后台的安全设置中需要精确配置 `redirect_uri`，必须与请求中的 `redirect_uri` 完全一致（包括协议、域名、端口、路径）。

### 解决

1. 在 `.env` 中配置 `FEISHU_REDIRECT_URI=http://localhost:3000/api/auth/feishu/callback`
2. 在飞书开发者后台 → 安全设置 → 重定向 URL 中添加完全相同的 URL
3. token 请求中也传入同样的 `redirect_uri`

---

## Cookie 设置方式

### 问题

需要在 OAuth 回调中设置 session cookie 并重定向。

### 错误方式

```ts
// 使用 Next.js cookies() API
const cookieStore = await cookies();
cookieStore.set("session_token", token, { ... });
return NextResponse.redirect(new URL("/chat", req.url));
```

这种方式在回调 + redirect 的组合中可能不生效，因为 `cookies()` 依赖于请求上下文，而 `NextResponse.redirect()` 创建的是新响应。

### 正确方式

```ts
const response = NextResponse.redirect(new URL("/chat", req.url));
response.cookies.set("session_token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
});
return response;
```

直接在 `response.cookies.set()` 上操作，保证 cookie 设置到 redirect 响应中。

---

## 扫码登录的 localhost 限制

### 问题

扫码登录在本地开发环境不可用。二维码被手机扫描后，飞书回调到 `localhost:3000`，手机无法访问电脑的本地服务。

### 解决

1. **代码层面**：前台检测 `window.location.hostname === "localhost"` 时，扫码按钮点开会提示"需要公网地址"
2. **开发测试**：
   - 使用 ngrok 隧道：`ngrok http 3000`，将 ngrok URL 更新到飞书后台和 `.env`
   - 或部署到测试服务器
3. **生产环境**：扫码登录自动正常工作（公网可访问的 redirect_uri）

---

## Auth State 存储

### 方案

扫码登录需要 PC 端和移动端通过 `state` 参数通信。使用内存 Map 存储：

```ts
const store = new Map<string, { state: string; sessionToken?: string; createdAt: number }>();
```

- 每 60 秒清理过期条目（TTL = 10 分钟）
- `createPendingAuth(state)` — 扫码开始时调用
- `completeAuth(state, token)` — 回调成功后调用
- `getAuthStatus(state)` — 轮询时调用

### 生产环境注意事项

- 内存 Map 只在单进程模式下工作
- 多实例部署或 Serverless 环境需替换为 Redis 或数据库
- 当前阶段（单实例 dev）可接受

---

## 用户创建策略

### 决策

飞书登录时，直接用飞书身份创建用户，不与已有昵称账号关联。

```ts
const existing = await prisma.user.findUnique({ where: { feishuUid: userInfo.sub } });
if (existing) {
  // 更新用户信息（name, avatar, tokens）
} else {
  // 创建新用户
}
```

- 通过 `feishuUid`（= open_id）唯一标识
- 同一飞书用户再次登录时更新信息，不重复创建
- 存储 `feishuAccessToken` 和 `feishuRefreshToken` 备用（Phase 3 消息推送）

---

## 关键词索引

| 关键词 | 相关内容 |
|--------|---------|
| OIDC | 端点 `authen/v1/oidc/` 部分环境不兼容，改用标准端点 |
| 标准端点 | `authen/v1/access_token`，app_id + app_secret 直接鉴权 |
| 20029 | 重定向 URL 不匹配，检查飞书后台和 .env 配置 |
| cookies.set | 应使用 `response.cookies.set()` 而非 `(await cookies()).set()` |
| 扫码 localhost | 本地开发无法扫码，用 ngrok 或 Web 授权替代 |
| auth-state | 内存储存扫码 state，多实例需换 Redis |
| feishuUid | 用户唯一标识（open_id），再次登录更新不重复创建 |
| redirect_uri | 飞书后台精确配置，token 请求中重复传入 |
