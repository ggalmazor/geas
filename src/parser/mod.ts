import { EpubParser } from './epub.ts';

export { EpubParser };

export async function parseEbook(
  filePath: string,
): Promise<import('../converter/mod.ts').BookMetadata> {
  if (filePath.toLowerCase().endsWith('.epub')) {
    const parser = new EpubParser();
    return await parser.parse(filePath);
  }

  throw new Error(`Unsupported file format: ${filePath}`);
}
