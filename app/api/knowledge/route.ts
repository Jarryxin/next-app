import { NextRequest, NextResponse } from "next/server";
import { unlinkSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { prisma } from "@/lib/db";
import { getSessionFromCookie } from "@/lib/auth";

const KNOWLEDGE_DIR = join(process.cwd(), "knowledge");

export interface KnowledgeDocInfo {
  id: string;
  path: string;
  category: string;
  filename: string;
  chunkCount: number;
  indexedAt: string;
  createdAt: string;
}

export async function GET() {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const docs = await prisma.knowledgeDoc.findMany({
    orderBy: { indexedAt: "desc" },
  });

  const items: KnowledgeDocInfo[] = docs.map((d) => {
    const parts = d.path.split("/");
    const category = parts.length > 1 ? parts[0] : "";
    const filename = parts.length > 1 ? parts.slice(1).join("/") : d.path;
    return {
      id: d.id,
      path: d.path,
      category,
      filename,
      chunkCount: d.chunkCount,
      indexedAt: d.indexedAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ items });
}

const IMAGE_EXTS = [".jpg", ".jpeg", ".png"];

export async function DELETE(req: NextRequest) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await req.json();
  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const doc = await prisma.knowledgeDoc.findUnique({ where: { path } });
  if (!doc) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const mdPath = join(KNOWLEDGE_DIR, path);
  if (existsSync(mdPath)) {
    unlinkSync(mdPath);
  }

  const baseName = basename(path, ".md");
  const prefix = path.slice(0, path.lastIndexOf("/") + 1);
  for (const ext of IMAGE_EXTS) {
    const imgPath = join(KNOWLEDGE_DIR, prefix, `${baseName}${ext}`);
    if (existsSync(imgPath)) {
      unlinkSync(imgPath);
    }
  }

  await prisma.knowledgeDoc.delete({ where: { id: doc.id } });

  return NextResponse.json({ ok: true });
}
