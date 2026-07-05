import "dotenv/config";
import { readdirSync, readFileSync, renameSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname, basename } from "node:path";
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

const INTERVIEW_DIR = join(process.cwd(), "knowledge", "interview");

const SUPPORTED_EXTS = new Set([".jpg", ".jpeg", ".png"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function imageToBase64(filePath: string): string {
  const data = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${data.toString("base64")}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, "_").trim();
}

async function transcribeWithRetry(filePath: string, retries = 3): Promise<{ title: string; content: string }> {
  const base64 = imageToBase64(filePath);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
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

      if (!content) {
        throw new Error("Empty transcription result");
      }

      return { title, content };
    } catch (err) {
      if (attempt < retries) {
        const delay = attempt * 3000;
        console.log(`    ⏱ Retry ${attempt}/${retries} after ${delay}ms...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

function buildMdContent(title: string, imageName: string, originalFile: string, content: string): string {
  return `---
title: ${title}
source_image: ${imageName}
original_file: ${originalFile}
transcribed_at: ${new Date().toISOString()}
---

${content}
`;
}

async function main() {
  console.log("Transcribing images in knowledge/interview/...\n");

  if (!existsSync(INTERVIEW_DIR)) {
    console.log("Directory knowledge/interview/ does not exist. Creating it.");
    mkdirSync(INTERVIEW_DIR, { recursive: true });
    return;
  }

  const files = readdirSync(INTERVIEW_DIR).filter((f) => {
    const ext = extname(f).toLowerCase();
    return SUPPORTED_EXTS.has(ext);
  });

  if (files.length === 0) {
    console.log("No images found in knowledge/interview/.");
    return;
  }

  let transcribed = 0;
  let skipped = 0;

  for (const [index, file] of files.entries()) {
    if (index > 0) {
      await sleep(1500);
    }

    const nameWithoutExt = basename(file, extname(file));
    const mdPath = join(INTERVIEW_DIR, `${nameWithoutExt}.md`);

    if (existsSync(mdPath)) {
      skipped++;
      console.log(`  · ${file} (already transcribed, skipping)`);
      continue;
    }

    const filePath = join(INTERVIEW_DIR, file);
    console.log(`  · Processing ${file}...`);

    try {
      const { title, content } = await transcribeWithRetry(filePath);
      const safeTitle = sanitizeFilename(title);

      if (!safeTitle) {
        const mdContent = buildMdContent(nameWithoutExt, file, file, content);
        writeFileSync(mdPath, mdContent, "utf-8");
        console.log(`    → Created ${nameWithoutExt}.md (empty title, used original name)`);
        transcribed++;
        continue;
      }

      const newImageName = `${safeTitle}${extname(file).toLowerCase()}`;
      const newImagePath = join(INTERVIEW_DIR, newImageName);
      const newMdName = `${safeTitle}.md`;
      const newMdPath = join(INTERVIEW_DIR, newMdName);

      if (file !== newImageName && existsSync(newImagePath)) {
        const mdContent = buildMdContent(safeTitle, file, file, content);
        writeFileSync(mdPath, mdContent, "utf-8");
        console.log(`    → ${newImageName} already exists, keeping original image name`);
        transcribed++;
        continue;
      }

      if (file !== newImageName) {
        renameSync(filePath, newImagePath);
        console.log(`    → Renamed ${file} → ${newImageName}`);
      }

      writeFileSync(newMdPath, buildMdContent(safeTitle, newImageName, file, content), "utf-8");
      console.log(`    → Created ${newMdName}`);
      transcribed++;
    } catch (err) {
      console.error(`    ✗ Failed: ${err}`);
    }
  }

  console.log(`\nDone. ${transcribed} transcribed, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error("Transcription failed:", err);
  process.exit(1);
});
