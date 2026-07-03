-- Switch from all-minilm (384d) to bge-m3 (1024d) for better Chinese support
ALTER TABLE "document_chunks" ALTER COLUMN "embedding" TYPE vector(1024);
