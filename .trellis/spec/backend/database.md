# Database

> PostgreSQL + Prisma ORM conventions.

---

## Schema

```prisma
model User {
  id                 String    @id @default(cuid())
  feishuUid          String?   @unique
  name               String?
  avatar             String?
  feishuAccessToken  String?
  feishuRefreshToken String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  sessions           Session[]
  conversations      Conversation[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Conversation {
  id        String   @id @default(cuid())
  userId    String
  title     String   @default("新对话")
  summary   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages  Message[]
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  role           String
  content        String
  sources        Json?        @default("[]")
  createdAt      DateTime     @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

### Conversation

| Field | Type | Description |
|-------|------|-------------|
| `id` | cuid | 主键 |
| `userId` | String | 关联 users |
| `title` | String | 自动从首条用户消息截取前50字符 |
| `summary` | String? | LLM 生成的对话摘要（滑动窗口用） |

### Message

| Field | Type | Description |
|-------|------|-------------|
| `id` | cuid | 主键 |
| `conversationId` | String | 关联 conversations |
| `role` | String | "user" 或 "assistant" |
| `content` | String | 消息全文 |
| `sources` | Json? | 知识库引用，`[{ content, source, similarity }]` |

## Migration Workflow

1. Edit `prisma/schema.prisma`
2. Run `npm run db:migrate` to create migration
3. Update seed data in `prisma/seed.ts` if needed
4. Run `npm run db:seed`

## Naming Conventions

- **Tables**: snake_case plural (`users`, `sessions`, `conversations`, `messages`)
- **Columns**: snake_case (`feishu_uid`, `conversation_id`)
- **Model names**: PascalCase singular (`User`, `Session`)
- **Fields**: camelCase (`feishuUid`); use `@map` for DB column mapping
- **Relations**: field name matches model name (`user User`, `messages Message[]`)

## Type Safety

- Prisma Client generates types from schema
- Import types from `@prisma/client` or `@prisma/adapter-pg`
- Never write raw SQL unless absolutely necessary
