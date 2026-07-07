# 前端文档上传分类与 RAG 工作流 — 实施计划

## 顺序

1. **API: 上传路由** `app/api/upload/route.ts` — 文件接收 + 保存
2. **API: 分类路由** `app/api/classify/route.ts` — 转录（图片）+ LLM 分类
3. **API: 索引路由** `app/api/index/route.ts` — 文件移动 + pgvector 索引
4. **页面: 上传页面** `app/upload/page.tsx` — 拖拽上传 + 步骤工作流 UI
5. **验证** typecheck + lint + build

## 验证命令

```bash
npm run typecheck
npm run lint
npm run build
```

## 回滚点

- `git checkout main -- app/upload/ app/api/upload/ app/api/classify/ app/api/index/`
- 删除 `knowledge/upload/` 目录

## 风险文件

- `app/upload/page.tsx` — 前端工作流逻辑最重
- `lib/rag.ts` — 需要确认 `indexFile()` 支持相对路径
