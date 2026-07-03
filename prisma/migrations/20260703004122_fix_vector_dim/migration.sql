-- DropForeignKey
ALTER TABLE "document_chunks" DROP CONSTRAINT "document_chunks_doc_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "idx_chunks_embedding";

-- Change vector dimension from 1536 to 384 (all-MiniLM-L6-v2)
ALTER TABLE "document_chunks" ALTER COLUMN "embedding" TYPE vector(384);

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_doc_id_fkey" FOREIGN KEY ("doc_id") REFERENCES "knowledge_docs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
