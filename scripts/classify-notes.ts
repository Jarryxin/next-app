import "dotenv/config";
import {
  readdirSync,
  readFileSync,
  renameSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join, basename } from "node:path";
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
const KNOWLEDGE_DIR = join(process.cwd(), "knowledge");

const IMAGE_EXTS = [".jpg", ".jpeg", ".png"];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function classifyWithRetry(
  content: string,
  title: string,
  retries = 3
): Promise<string> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await llm.invoke([
        new SystemMessage("你是一个知识库管理员。根据笔记内容判断类别，只返回类别名称。"),
        new HumanMessage(
          `判断以下笔记属于哪个类别。类别是像"React"、"前端"、"Node.js"、"AI"、"JavaScript"、"工程化"、"架构"这样的简短名词。

笔记标题: ${title}
笔记内容:
${content.slice(0, 1200)}

只返回类别名称，不要其他内容。`
        ),
      ]);

      const category =
        typeof response.content === "string" ? response.content.trim() : "其他";
      return category.replace(/[<>:"/\\|?*\n\r]/g, "").trim() || "其他";
    } catch (err) {
      if (attempt < retries) {
        const delay = attempt * 2000;
        console.log(`    ⏱ Retry ${attempt}/${retries} after ${delay}ms...`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw new Error("Unreachable");
}

function extractTitle(content: string, filename: string): string {
  const match = content.match(/^---\n[\s\S]*?\ntitle:\s*(.+?)\s*\n/);
  return match ? match[1].trim() : basename(filename, ".md");
}

async function main() {
  console.log("Classifying notes in knowledge/interview/...\n");

  if (!existsSync(INTERVIEW_DIR)) {
    console.log("No knowledge/interview/ directory found.");
    return;
  }

  const files = readdirSync(INTERVIEW_DIR).filter((f) => f.endsWith(".md"));

  if (files.length === 0) {
    console.log("No .md files found in knowledge/interview/.");
    return;
  }

  let classified = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, file] of files.entries()) {
    if (index > 0) {
      await sleep(1000);
    }

    const filePath = join(INTERVIEW_DIR, file);
    const content = readFileSync(filePath, "utf-8");
    const title = extractTitle(content, file);

    console.log(`  · ${file}...`);

    try {
      const category = await classifyWithRetry(content, title);
      const targetDir = join(KNOWLEDGE_DIR, category);

      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      const targetMd = join(targetDir, file);
      if (existsSync(targetMd)) {
        console.log(`    ⚠ Already exists in ${category}/, skipping`);
        skipped++;
        continue;
      }

      renameSync(filePath, targetMd);

      const nameBase = basename(file, ".md");
      for (const ext of IMAGE_EXTS) {
        const imagePath = join(INTERVIEW_DIR, `${nameBase}${ext}`);
        if (existsSync(imagePath)) {
          const targetImage = join(targetDir, `${nameBase}${ext}`);
          if (!existsSync(targetImage)) {
            renameSync(imagePath, targetImage);
          }
          break;
        }
      }

      console.log(`    → ${category}/`);
      classified++;
    } catch (err) {
      console.error(`    ✗ Failed: ${err}`);
      failed++;
    }
  }

  console.log(
    `\nDone. ${classified} classified, ${skipped} skipped, ${failed} failed.`
  );
  console.log("Run 'npx tsx scripts/index-knowledge.ts' to re-index.");
}

main().catch((err) => {
  console.error("Classification failed:", err);
  process.exit(1);
});
