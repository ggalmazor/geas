import { Book } from './types.ts';
import { buildParser } from './parser.ts';
import { events } from '../events/mod.ts';
import { join } from '@std/path';

export async function parse(inputFile: string, tempDir: string, replacements: Record<string, string>): Promise<Book> {
  const parser = buildParser(inputFile);

  events.emit({ type: 'book:parse:start', inputFile });

  const book = await parser.parse(inputFile, replacements);

  for (const chapter of book.chapters) {
    await Deno.writeTextFile(join(tempDir, `chapter_${chapter.number}.txt`), chapter.lines.join('\n'));
    chapter.lines.forEach((text, lineIndex) => {
      events.emit({ type: 'line:parse', chapterNumber: chapter.number, lineIndex, text });
    });
  }

  events.emit({ type: 'book:parse:complete', book });

  return book;
}
