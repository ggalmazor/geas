import { Book } from './types.ts';
import { buildParser } from './parser.ts';
import { progressEmitter } from '../events/mod.ts';

export async function parse(path: string): Promise<Book> {
  progressEmitter.emit({
    type: 'book:parse:start',
    filePath: path,
  });

  const book = await buildParser(path).parse(path);

  // Calculate total lines
  const totalLines = book.chapters.reduce((sum, chapter) => sum + chapter.lines.length, 0);

  progressEmitter.emit({
    type: 'book:parse:complete',
    book: {
      title: book.title,
      author: book.author,
      chapters: book.chapters.length,
      totalLines,
    },
  });

  // Emit line parse events
  for (const chapter of book.chapters) {
    for (let i = 0; i < chapter.lines.length; i++) {
      const line = chapter.lines[i];
      if (line) {
        progressEmitter.emit({
          type: 'line:parse',
          chapterNumber: chapter.number,
          lineIndex: i,
          text: line,
        });
      }
    }
  }

  return book;
}
