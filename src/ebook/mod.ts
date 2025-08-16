import { Book } from './types.ts';
import { buildParser } from './parser.ts';

export async function parse(path: string): Promise<Book> {
  return await buildParser(path).parse(path);
}
