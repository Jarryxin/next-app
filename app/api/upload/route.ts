import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getSessionFromCookie } from "@/lib/auth";

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".md"]);
const UPLOAD_DIR = join(process.cwd(), "knowledge", "upload");

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const results: { id: string; name: string; size: number; type: "image" | "markdown" }[] = [];

  for (const file of files) {
    const rawName = file.name;
    const ext = "." + (rawName.split(".").pop()?.toLowerCase() || "");
    if (!ALLOWED_EXTS.has(ext)) continue;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const safeName = `${id}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(UPLOAD_DIR, safeName), buffer);

    results.push({
      id,
      name: rawName,
      size: file.size,
      type: ext === ".md" ? "markdown" : "image",
    });
  }

  return NextResponse.json({ files: results });
}
