import { MarkdownTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

export async function splitMarkdown(content: string): Promise<Document[]> {
  const splitter = new MarkdownTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const texts = await splitter.splitText(content);
  return texts.map((text) => new Document({ pageContent: text, metadata: {} }));
}
