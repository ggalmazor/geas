import { join } from '@std/path';
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

  async saveChapterTextFiles(chapters: Array<Chapter>, outputDir: string): Promise<void> {
    console.log('📝 Saving chapter text files for inspection...');

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      if (!chapter) continue;

      const filename = `chapter_${(i + 1).toString().padStart(2, '0')}_${this.sanitizeFilename(chapter.title || 'Untitled')}.txt`;
      const filePath = join(outputDir, filename);

      await Deno.writeTextFile(filePath, chapter.content);
      console.log(`  Saved: ${filename}`);
    }
  }

  private sanitizeFilename(title: string): string {
    return title
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase()
      .slice(0, 50); // Limit length
  }
}
