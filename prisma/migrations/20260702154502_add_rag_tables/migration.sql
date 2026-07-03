-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "knowledge_docs" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "chunk_count" INTEGER NOT NULL,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_docs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_docs_path_key" ON "knowledge_docs"("path");

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "embedding" vector(384),

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_chunks_doc_id" ON "document_chunks"("doc_id");

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_doc_id_fkey"
    FOREIGN KEY ("doc_id") REFERENCES "knowledge_docs"("id") ON DELETE CASCADE;
