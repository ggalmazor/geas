import type { Chapter } from '../converter/mod.ts';

export interface TextChunk {
  text: string;
  chapterIndex: number;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
}

export class TextProcessor {
  populateChapterTextChunks(chapters: Array<Chapter>): void {
    let globalOffset = 0;

    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
      const chapter = chapters[chapterIndex];
      if (!chapter) continue;

      const chapterChunks: TextChunk[] = [];
      const paragraphs = chapter.content.split('\n');

      let chunkIndex = 0;

      for (const paragraph of paragraphs) {
        // Skip empty paragraphs
        if (paragraph.trim().length === 0) {
          globalOffset += paragraph.length;
          continue;
        }

        chapterChunks.push({
          text: paragraph.trim(),
          chapterIndex,
          chunkIndex,
          startOffset: globalOffset,
          endOffset: globalOffset + paragraph.length,
        });

        globalOffset += paragraph.length;
        chunkIndex++;
      }

      chapter.textChunks = chapterChunks;
    }
  }

  countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  estimateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const words = this.countWords(text);
    return Math.ceil(words / wordsPerMinute);
  }
}
