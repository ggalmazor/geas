import { Book } from './types.ts';
import { EpubParser } from './parser/epub.ts';

export interface Parser {
  parse(path: string): Promise<Book>;
}

export function buildParser(path: string): Parser {
  if (path.toLowerCase().endsWith('.epub')) {
    return new EpubParser();
  }

  throw new Error(`No parser for ebook at ${path}`);
}
