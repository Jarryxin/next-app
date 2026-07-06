import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, readdirSync, renameSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { getSessionFromCookie } from "@/lib/auth";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const llm = new ChatOpenAI({
  modelName: process.env.AGNES_MODEL || "agnes-2.0-flash",
  configuration: {
    baseURL: process.env.AGNES_API_BASE_URL,
  },
  apiKey: process.env.AGNES_API_KEY,
  temperature: 0.1,
});

const UPLOAD_DIR = join(process.cwd(), "knowledge", "upload");

function imageToBase64(filePath: string): string {
  const data = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${data.toString("base64")}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "_").trim();
}

function extractFrontmatterTitle(content: string): string | null {
  const match = content.match(/^---\n[\s\S]*?\ntitle:\s*(.+?)\s*\n/);
  return match ? match[1].trim() : null;
}

async function transcribeWithTitle(filePath: string): Promise<{ title: string; content: string }> {
  const base64 = imageToBase64(filePath);

  const response = await llm.invoke([
    new SystemMessage("你是一个手写笔记识别助手。请准确识别图片中的手写文字，并建议一个简短标题。"),
    new HumanMessage({
      content: [
        {
          type: "text",
          text: `请完成以下两步：
1. 根据笔记内容，提炼一个简短标题（2-8 个中文字或英文，用于文件名）
2. 逐字准确转录图片中的全部手写文字，不要修改、修正或美化原文

请按以下格式回复：

标题: <标题>
转录:
<转录内容>`,
        },
        {
          type: "image_url",
          image_url: { url: base64 },
        },
      ],
    }),
  ]);

  const text = typeof response.content === "string" ? response.content : "";
  const titleMatch = text.match(/标题:\s*(.+)/);
  const contentMatch = text.match(/转录:\s*([\s\S]*)/);

  const title = titleMatch ? titleMatch[1].trim() : basename(filePath, extname(filePath));
  const content = contentMatch ? contentMatch[1].trim() : text;

  return { title, content: content || "（空转录结果）" };
}

async function classifyContent(text: string, title: string): Promise<string> {
  const response = await llm.invoke([
    new SystemMessage("你是一个知识库管理员。根据笔记内容判断类别。"),
    new HumanMessage(
      `判断以下笔记属于哪个类别。只返回类别名称（2-4 字），如 React、前端、Node.js、AI、JavaScript、工程化、架构。

笔记标题: ${title}
笔记内容:
${text.slice(0, 1500)}

只返回类别名称，不要其他内容。`
    ),
  ]);

  const category = typeof response.content === "string" ? response.content.trim() : "其他";
  return category.replace(/[<>:"/\\|?*\n\r]/g, "").trim() || "其他";
}

function safeRename(oldPath: string, newPath: string): void {
  if (oldPath === newPath) return;
  if (existsSync(newPath)) {
    const dir = join(oldPath, "..");
    const ext = extname(oldPath);
    const base = basename(newPath, ext);
    let i = 1;
    while (existsSync(join(dir, `${base}_${i}${ext}`))) i++;
    renameSync(oldPath, join(dir, `${base}_${i}${ext}`));
  } else {
    renameSync(oldPath, newPath);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const fileEntries: { id: string; name?: string }[] = body.files;

  if (!fileEntries || !Array.isArray(fileEntries) || fileEntries.length === 0) {
    return NextResponse.json({ error: "No files specified" }, { status: 400 });
  }

  const allFiles = readdirSync(UPLOAD_DIR);
  const results: { id: string; name: string; category: string; title?: string; error?: string }[] = [];

  for (const { id, name: originalName } of fileEntries) {
    const matched = allFiles.find((f) => f.startsWith(id));
    if (!matched) {
      results.push({ id, name: id, category: "其他", error: "File not found" });
      continue;
    }

    const filePath = join(UPLOAD_DIR, matched);
    const ext = extname(matched).toLowerCase();
    const isImage = ext !== ".md";

    try {
      let text = "";
      let fileTitle = "";

      if (isImage) {
        const result = await transcribeWithTitle(filePath);
        fileTitle = sanitizeFilename(result.title) || basename(matched, ext);
        text = result.content;

        const safeTitle = sanitizeFilename(fileTitle);
        const newImageName = `${safeTitle}${ext}`;
        const newImagePath = join(UPLOAD_DIR, newImageName);
        safeRename(filePath, newImagePath);

        const mdContent = `---
title: ${safeTitle}
source_image: ${newImageName}
transcribed_at: ${new Date().toISOString()}
---

${text}
`;
        writeFileSync(join(UPLOAD_DIR, `${safeTitle}.md`), mdContent, "utf-8");
      } else {
        text = readFileSync(filePath, "utf-8");
        const fmTitle = extractFrontmatterTitle(text);
        fileTitle = fmTitle || originalName || basename(matched, ".md");

        const safeTitle = sanitizeFilename(fileTitle);
        const newMdName = `${safeTitle}.md`;
        const newMdPath = join(UPLOAD_DIR, newMdName);
        if (matched !== newMdName) {
          safeRename(filePath, newMdPath);
        }
      }

      if (!text) {
        results.push({ id, name: matched, category: "其他", error: "Empty content" });
        continue;
      }

      const category = await classifyContent(text, fileTitle);
      results.push({ id, name: `${sanitizeFilename(fileTitle)}.md`, title: sanitizeFilename(fileTitle), category });
    } catch (err) {
      results.push({ id, name: matched, category: "其他", error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
