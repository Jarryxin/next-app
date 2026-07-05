# 图片手写笔记 OCR 识别与 RAG 检索

## Goal

提供图片手写笔记的转录工具：利用 Agnes AI 的视觉理解能力识别 `knowledge/interview/` 中的图片（手写笔记照片），将转录的文本保存为 `.md` 文件，图片按内容重命名，再由现有 RAG 管道索引到 pgvector，实现图片笔记的语义检索。

## Confirmed Facts (from codebase)

- `knowledge/` 目录已有 `.jpg` 图片文件和 `.md` 文件
- LLM: Agnes AI `agnes-2.0-flash`，通过 `ChatOpenAI` 接入，支持 vision/image URL 输入（base64 data URI）
- 现有 RAG 管道：`indexKnowledgeDir()` → `indexFile()` → MarkdownTextSplitter → embed → pgvector
- `indexKnowledgeDir()` 只处理 `.md` 文件（`f.endsWith(".md")` 过滤）
- Embedding: Ollama `bge-m3` (1024d)
- 数据库: `KnowledgeDoc` (path, checksum) + `DocumentChunk` (content, source, metadata JSON, embedding)

## Requirements

1. **图片转录脚本**: 新增 `scripts/transcribe-images.ts`
   - 扫描 `knowledge/interview/` 目录下的 `.jpg`/`.png` 文件
   - 通过 Agnes AI 视觉 API 转录手写文字
   - 幂等：已处理的图片（有对应 `.md` 文件）跳过
2. **文件重命名**: LLM 在转录时提炼 3-5 字标题，用标题重命名图片（如 `IMG_001.jpg` → `机器学习笔记.jpg`）
3. **生成 Markdown 文件**: 在 `knowledge/interview/` 下生成同名 `.md` 文件，包含：
   - Frontmatter：`title`、`source_image`、`original_file`、`transcribed_at`
   - 正文：逐字转录的完整笔记内容
4. **复用现有 RAG 管道**: 生成的 `.md` 文件由 `index-knowledge` 正常索引

## Technical Decisions

| 决策 | 结论 |
|------|------|
| 图片传递方式 | Base64 inline（data URI） |
| 转录策略 | 逐字准确转录，不做修正美化 |
| 分块策略 | 转录文本写入 `.md` 后，由现有 MarkdownTextSplitter 处理 |
| 图片定位 | 扫描 `knowledge/interview/` 目录 |
| 图片格式 | `.jpg` + `.png` |
| 文件名来源 | LLM 转录时同时建议标题 |
| 图片处理 | 原地重命名（不复制） |
| 元数据 | Frontmatter 存储 `title`、`source_image`、`original_file`、`transcribed_at` |

## Acceptance Criteria

1. [ ] `npx tsx scripts/transcribe-images.ts` 能扫描并处理 `knowledge/interview/` 下的图片
2. [ ] 转录后图片文件被重命名为 LLM 建议的标题（如 `机器学习笔记.jpg`）
3. [ ] 同目录下生成同名 `.md` 文件，包含正确的 frontmatter + 转录正文
4. [ ] 幂等：重复运行不重复生成已处理的图片
5. [ ] `npx tsx scripts/index-knowledge.ts` 能索引新生成的 `.md` 文件
6. [ ] RAG 检索能召回图片中提取的文字内容
7. [ ] `npm run typecheck` + `lint` 通过

## Out of Scope

- 不修改现有 RAG 管道（rag.ts / agent.ts / schema）
- 不新建数据库表
- 不引入额外的 OCR 库
- 不上传图片到外部托管服务
- 不处理飞书消息中的图片
- 不处理用户上传（Phase 2 范围）
