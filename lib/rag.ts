import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "./db";
import { embeddings } from "./embeddings";
import { splitMarkdown } from "./splitter";

export interface SearchResult {
  content: string;
  source: string;
  similarity: number;
}

function md5(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

export async function indexFile(
  filePath: string,
  content: string
): Promise<{ path: string; chunks: number; skipped: boolean }> {
  const checksum = md5(content);

  const existing = await prisma.knowledgeDoc.findUnique({
    where: { path: filePath },
  });

  if (existing && existing.checksum === checksum && existing.chunkCount > 0) {
    return { path: filePath, chunks: existing.chunkCount, skipped: true };
  }

  const docs = await splitMarkdown(content);

  if (existing) {
    await prisma.knowledgeDoc.update({
      where: { id: existing.id },
      data: { checksum, chunkCount: 0, indexedAt: new Date() },
    });
  }

  const doc = await prisma.knowledgeDoc.upsert({
    where: { path: filePath },
    update: { checksum, chunkCount: 0, indexedAt: new Date() },
    create: { path: filePath, checksum, chunkCount: 0 },
  });

  if (existing) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "document_chunks" WHERE "doc_id" = $1`,
      doc.id
    );
  }

  const texts = docs.map((d) => d.pageContent);
  const metadatas = docs.map((d) => d.metadata);

  const vectors = await embeddings.embedDocuments(texts);

  for (let i = 0; i < texts.length; i++) {
    const vectorStr = `[${vectors[i].join(",")}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "document_chunks" ("id", "content", "metadata", "source", "doc_id", "embedding")
       VALUES ($1, $2, $3::jsonb, $4, $5, $6::vector)`,
      `${doc.id}-chunk-${i}`,
      texts[i],
      JSON.stringify(metadatas[i] || {}),
      filePath,
      doc.id,
      vectorStr
    );
  }

  await prisma.knowledgeDoc.update({
    where: { id: doc.id },
    data: { chunkCount: texts.length },
  });

  return { path: filePath, chunks: texts.length, skipped: false };
}

export async function indexKnowledgeDir(): Promise<
  { path: string; chunks: number; skipped: boolean }[]
> {
  const { readdirSync } = await import("node:fs");
  const { join } = await import("node:path");

  const knowledgeDir = join(process.cwd(), "knowledge");
  const files = readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));

  const results: { path: string; chunks: number; skipped: boolean }[] = [];

  for (const file of files) {
    const content = readFileSync(join(knowledgeDir, file), "utf-8");
    const result = await indexFile(file, content);
    results.push(result);
  }

  return results;
}

export async function searchSimilar(
  query: string,
  k = 5,
  minSimilarity = 0.45
): Promise<SearchResult[]> {
  const [queryVector] = await embeddings.embedDocuments([query]);
  const vectorStr = `[${queryVector.join(",")}]`;

  const rows: { content: string; source: string; similarity: number }[] =
    await prisma.$queryRawUnsafe(
      `SELECT content, source, 1 - (embedding <=> $1::vector) AS similarity
       FROM "document_chunks"
       WHERE embedding IS NOT NULL
         AND 1 - (embedding <=> $1::vector) >= $3
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      vectorStr,
      k,
      minSimilarity
    );

  return rows.map((r) => ({
    content: r.content,
    source: r.source,
    similarity: r.similarity,
  }));
}
