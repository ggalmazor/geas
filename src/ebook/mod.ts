import { Book } from './types.ts';
import { buildParser } from './parser.ts';
import { LineState, ProgressMatrix } from '../utils/progress.ts';

export async function parse(path: string, progress?: ProgressMatrix): Promise<Book> {
  const book = await buildParser(path).parse(path);

  if (progress) {
    // Mark all lines as parsed
    for (const chapter of book.chapters) {
      for (let i = 0; i < chapter.lines.length; i++) {
        progress.updateLineState(chapter.number, i, LineState.PARSED);
      }
    }
  }

  return book;
}
