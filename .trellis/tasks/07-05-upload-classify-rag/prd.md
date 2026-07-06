# 前端文档上传分类与 RAG 工作流

## Goal

可视化工作流页面（`/upload`），用户批量上传图片或 Markdown 文档 → LLM 自动分类 → 用户可编辑分类名称 → 用户逐步骤确认 → RAG 索引到知识库。每一步都由用户手动触发，不自动推进。

## Confirmed Facts (from codebase)

- 前端：Next.js App Router，Tailwind CSS，CSR 页面
- 后端：API Route Handler，LangChain ChatOpenAI（Agnes AI），LangGraph Agent
- 数据库：KnowledgeDoc + DocumentChunk（pgvector）
- 现有脚本：`scripts/transcribe-images.ts`（图片 OCR）、`scripts/classify-notes.ts`（文本分类）
- `indexKnowledgeDir()` 已支持递归扫描子目录
- Auth：飞书 OAuth 登录（cookie session），`/chat` 已有登录检查
- 前端无组件库，Tailwind 手写

## Requirements

1. **上传页面** (`/upload`): 拖拽/选择批量上传 `.jpg` `.png` `.md` 文件，需登录
2. **LLM 分类**: 上传后逐个调用 LLM（Agnes AI）分析内容，建议分类名称
3. **分类编辑**: 列表展示每个文件的分类结果，用户可修改分类名称
4. **分步控制**: 上传 → 分类 → 确认 → 索引，每步由用户手动点击按钮触发
5. **RAG 索引**: 确认后将文件从 `knowledge/upload/` 移到 `knowledge/<类别>/`，调用索引 API 写入 pgvector

## Technical Decisions

| 决策 | 结论 |
|------|------|
| 页面位置 | `/upload` 独立页面 |
| 文件类型 | `.jpg` `.png` `.md` |
| 存储路径 | `knowledge/upload/` → 分类后移至 `knowledge/<类别>/` |
| 登录要求 | 需要飞书 OAuth 登录，未登录跳转 `/auth` |
| 上传方式 | 批量上传，列表展示，逐一确认 |

## Acceptance Criteria

1. [ ] `/upload` 页面需要登录，未登录跳转 `/auth`
2. [ ] 用户可拖拽或选择多个文件上传
3. [ ] 上传后页面显示文件列表，每个文件显示状态（待分类/已分类）
4. [ ] 点击「分类」按钮后，LLM 逐个分析文件并建议分类名称
5. [ ] 用户可编辑每个文件的分类名称
6. [ ] 点击「确认并索引」后，文件移至 `knowledge/<类别>/` 并写入 pgvector
7. [ ] 索引完成后显示成功/失败状态
8. [ ] `npm run typecheck` + `lint` + `build` 通过

## Out of Scope

- PDF/Word 等格式支持（后续 Phase 补充）
- 用户上传文件的管理/删除功能
- 飞书消息图片直接导入
- 文档版本管理
