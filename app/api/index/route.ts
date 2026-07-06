import { NextRequest, NextResponse } from "next/server";
import { readdirSync, renameSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { getSessionFromCookie } from "@/lib/auth";
import { indexFile } from "@/lib/rag";

const UPLOAD_DIR = join(process.cwd(), "knowledge", "upload");
const KNOWLEDGE_DIR = join(process.cwd(), "knowledge");
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png"]);

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const entries: { name: string; category: string }[] = body.files;

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return NextResponse.json({ error: "No files specified" }, { status: 400 });
  }

  const allFiles = new Set(readdirSync(UPLOAD_DIR));
  const results: { name: string; success: boolean; chunks?: number; error?: string }[] = [];

  for (const { name, category } of entries) {
    const baseName = basename(name, ".md");
    const safeCategory = category || "其他";
    const targetDir = join(KNOWLEDGE_DIR, safeCategory);

    try {
      if (!allFiles.has(name)) {
        results.push({ name, success: false, error: "File not found" });
        continue;
      }

      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      const mdSourcePath = join(UPLOAD_DIR, name);
      const mdTargetPath = join(targetDir, name);
      const mdContent = readFileSync(mdSourcePath, "utf-8");

      renameSync(mdSourcePath, mdTargetPath);

      for (const ext of IMAGE_EXTS) {
        const imgName = `${baseName}${ext}`;
        const imgPath = join(UPLOAD_DIR, imgName);
        if (allFiles.has(imgName) && existsSync(imgPath)) {
          renameSync(imgPath, join(targetDir, imgName));
          break;
        }
      }

      const relativePath = `${safeCategory}/${name}`;
      const result = await indexFile(relativePath, mdContent);

      results.push({ name, success: true, chunks: result.chunks });
    } catch (err) {
      results.push({ name, success: false, error: String(err) });
    }
  }

  return NextResponse.json({ results });
}
