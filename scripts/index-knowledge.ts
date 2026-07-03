import "dotenv/config";
import { prisma } from "../lib/db";
import { indexKnowledgeDir } from "../lib/rag";

async function main() {
  console.log("Indexing knowledge directory...\n");

  const results = await indexKnowledgeDir();

  let indexed = 0;
  let skipped = 0;

  for (const r of results) {
    if (r.skipped) {
      skipped++;
      console.log(`  · ${r.path} (unchanged, ${r.chunks} chunks)`);
    } else {
      indexed++;
      console.log(`  · ${r.path} → ${r.chunks} chunks`);
    }
  }

  const docCount = await prisma.knowledgeDoc.count();
  const chunkCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "document_chunks"`
  );

  console.log(`\nDone. ${indexed} indexed, ${skipped} skipped.`);
  console.log(
    `Total: ${docCount} docs, ${Number(chunkCount[0]?.count || 0)} chunks.`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Index failed:", err);
  process.exit(1);
});
