# 前端文档上传分类与 RAG 工作流 — 技术设计

## 架构概览

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────┐
│  /upload    │────▶│ /api/upload  │────▶│ /api/classify │────▶│ /api/index │
│  (page)     │     │ 保存文件     │     │ 转录+分类     │     │ 移动+索引  │
└─────────────┘     └──────────────┘     └──────────────┘     └───────────┘
       │                    │                    │                    │
       │  files[]           │  {id, name}        │  {id, category}    │  {id, status}
       ▼                    ▼                    ▼                    ▼
   React State        knowledge/upload/     LLM(Agnes AI)        knowledge/<cat>/
```

## 数据流

### Step 1: 上传
- 用户选择文件（批量）→ `POST /api/upload` → 保存到 `knowledge/upload/`
- 返回文件列表：`{ id, name, size, type }`
- 前端更新状态：`files[]` + `step='classify'`

### Step 2: 分类
- 用户点击「开始分类」→ `POST /api/classify` (携带 file IDs)
- 服务端对每个文件：
  - 图片：先转录（Agnes AI vision）→ 生成 `.md`
  - `.md`：直接读取内容
  - LLM 分类 → 返回 `{ id, category }`
- 支持 SSE 流式返回进度（或一次性返回）
- 前端展示：每个文件的分类名称，可编辑

### Step 3: 索引
- 用户编辑分类名称确认后 → `POST /api/index` (携带 `{ id, category }[]`)
- 服务端：
  - 移动文件到 `knowledge/<category>/`
  - 调用 `indexFile()` 索引到 pgvector
- 返回每个文件的索引结果 `{ id, success, chunks }`

## API 设计

### POST /api/upload
```
Content-Type: multipart/form-data
Body: files[] (FileList)
Response: { files: { id: string, name: string, size: number, type: string }[] }
```

### POST /api/classify
```
Content-Type: application/json
Body: { files: { id: string }[] }
Response: { results: { id: string, name: string, category: string }[] }
```

### POST /api/index
```
Content-Type: application/json
Body: { files: { id: string, category: string }[] }
Response: { results: { id: string, name: string, success: boolean, chunks?: number, error?: string }[] }
```

## 前端状态管理

```typescript
interface UploadFile {
  id: string;
  name: string;
  size: number;
  type: 'image' | 'markdown';
  status: 'uploaded' | 'classifying' | 'classified' | 'ready' | 'indexing' | 'indexed' | 'error';
  category: string;
}

type WorkflowStep = 'upload' | 'classify' | 'confirm' | 'indexing' | 'done';
```

## 文件存储

- 上传临时目录：`knowledge/upload/<id>/`
- 最终目录：`knowledge/<category>/<filename>`
- 图片转录后：源图 + `.md` 同时移动

## 安全性

- 所有 API 路由检查 session cookie（与现有 auth 一致）
- 文件类型白名单：仅 `.jpg` `.png` `.md`
