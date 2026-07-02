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
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Migration Workflow

1. Edit `prisma/schema.prisma`
2. Run `npm run db:migrate` to create migration
3. Update seed data in `prisma/seed.ts` if needed
4. Run `npm run db:seed`

## Naming Conventions

- **Tables**: snake_case plural (`users`, `sessions`)
- **Columns**: snake_case (`feishu_uid`, `created_at`)
- **Model names**: PascalCase singular (`User`, `Session`)
- **Fields**: camelCase (`feishuUid`); use `@map` for DB column mapping
- **Relations**: field name matches model name (`user User`, `sessions Session[]`)

## Type Safety

- Prisma Client generates types from schema
- Import types from `@prisma/client` or `@prisma/adapter-pg`
- Never write raw SQL unless absolutely necessary
