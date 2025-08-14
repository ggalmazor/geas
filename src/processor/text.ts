import type { Chapter } from '../converter/mod.ts';

export interface TextChunk {
  text: string;
  chapterIndex: number;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
}

export class TextProcessor {
  createTextChunks(
    chapters: Array<Chapter>,
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    let globalOffset = 0;

    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
      const chapter = chapters[chapterIndex];
      if (!chapter) continue;

      const paragraphs = chapter.content.split('\n');

      let chunkIndex = 0;

      for (const paragraph of paragraphs) {
        // Process each paragraph as a separate chunk to maintain fidelity
        // Skip empty paragraphs
        if (paragraph.trim().length === 0) {
          globalOffset += paragraph.length;
          continue;
        }

        chunks.push({
          text: paragraph.trim(),
          chapterIndex,
          chunkIndex,
          startOffset: globalOffset,
          endOffset: globalOffset + paragraph.length,
        });

        globalOffset += paragraph.length;
        chunkIndex++;
      }
    }

    return chunks;
  }

  estimateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const words = text.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }
}
