import { BlobReader, Entry, TextWriter, ZipReader } from '@zip-js/zip-js';
import { Parser } from '../parser.ts';
import { Book, Chapter, OpfManifest } from '../types.ts';
import { Document, DOMParser, Element } from 'deno-dom';

export class EpubParser implements Parser {
  async parse(path: string, replacements: Record<string, string>): Promise<Book> {
    const file = await Deno.readFile(path);
    const blob = new Blob([file]);

    const zipReader = new ZipReader(new BlobReader(blob));
    const entries: Entry[] = await zipReader.getEntries();

    const opfPath = await findOpfFile(entries);
    const opfContent = await extractFile(entries, opfPath);

    const manifest = parseOpf(opfContent, opfPath);
    const chapters = await extractChapters(entries, manifest, replacements);

    await zipReader.close();

    return {
      title: manifest.title,
      author: manifest.author,
      chapters,
      totalLines: chapters.map((c) => c.totalLines).reduce((a, b) => a + b, 0),
    };
  }
}

async function findOpfFile(entries: Entry[]): Promise<string> {
  const containerEntry = entries.find((entry) => entry.filename === 'META-INF/container.xml');

  if (!containerEntry) {
    throw new Error('Invalid EPUB: No container.xml found');
  }

  const writer = new TextWriter();
  const containerContent = await containerEntry.getData!(writer);

  const opfMatch = containerContent.match(/<rootfile[^>]+full-path="([^"]+)"/);

  if (!opfMatch || !opfMatch[1]) {
    throw new Error('Invalid EPUB: Cannot find OPF file path');
  }

  return opfMatch[1];
}

async function extractFile(entries: Entry[], filePath: string): Promise<string> {
  const entry = entries.find((e) => e.filename === filePath);
  if (!entry) {
    throw new Error(`File not found in EPUB: ${filePath}`);
  }

  const writer = new TextWriter();
  return await entry.getData!(writer);
}

function parseOpf(opfContent: string, opfPath: string): OpfManifest {
  const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)</);
  const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)</);

  const spineMatches = Array.from(
    opfContent.matchAll(/<itemref[^>]+idref="([^"]+)"/g),
  );

  const manifestMatches = Array.from(
    opfContent.matchAll(
      /<item[^>]+(?:id="([^"]+)"[^>]+href="([^"]+)"|href="([^"]+)"[^>]+id="([^"]+)")[^>]*>/g,
    ),
  );

  const manifestMap = new Map<string, string>();
  for (const match of manifestMatches) {
    const [, id1, href1, href2, id2] = match;
    const id = id1 || id2;
    const href = href1 || href2;
    if (id && href) {
      manifestMap.set(id, href);
    }
  }

  const spineOrder = spineMatches
    .map((match) => match[1] ? manifestMap.get(match[1]) : undefined)
    .filter((href): href is string => href !== undefined);

  return {
    title: titleMatch?.[1] || 'Unknown Title',
    author: authorMatch?.[1] || 'Unknown Author',
    spineOrder,
    baseDir: getBaseDir(opfPath),
  };
}

function getBaseDir(opfPath: string): string {
  const parts = opfPath.split('/');
  if (parts.length > 1) {
    return parts.slice(0, -1).join('/') + '/';
  }
  return '';
}

async function extractChapters(entries: Entry[], manifest: OpfManifest, replacements: Record<string, string>): Promise<Chapter[]> {
  const chapters: { title: string | undefined; lines: string[] }[] = await Promise.all(manifest.spineOrder.map(async (href) => {
    const xhtmlContent = await extractFile(entries, manifest.baseDir + href);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xhtmlContent, 'text/html');
    const lines = parseElement(doc, doc.querySelector('body')!, replacements).filter((line) => line !== '');
    if (lines.length === 0) {
      return { title: undefined, lines: [], totalLines: 0 };
    }

    return { title: parseTitle(doc), lines, totalLines: lines.length };
  }));

  return chapters
    .filter((chapter) => chapter.lines.length > 0)
    .map((chapter, index) => {
      const title = chapter.title || `Chapter ${index + 1}`;
      const lines = chapter.lines[0] === title ? chapter.lines : [title!, ...chapter.lines];
      return {
        title,
        number: index + 1,
        lines: lines,
        totalLines: lines.length,
      };
    });
}

function parseTitle(doc: Document): string | undefined {
  const headers = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((element) => {
    return {
      level: parseInt(element.tagName.toLowerCase()[1]!),
      text: element.textContent?.trim(),
    };
  }).toSorted((a, b) => a.level - b.level);
  if (headers.length === 0) {
    return undefined;
  }
  return headers[0]!.text;
}

function parseElement(doc: Document, element: Element, replacements: Record<string, string>): string[] {
  if (
    ['p', 'dt', 'dd', 'li'].includes(element.tagName.toLowerCase()) ||
    element.children.length === 0
  ) {
    if (!element.textContent) {
      return [''];
    }

    const temp = doc.createElement('div');
    const innerHTML = element.innerHTML;
    temp.innerHTML = innerHTML.replace(/<br.*?\/?>/gi, '\n'); // Replace <br> with newline
    const text = temp.textContent!
      .replace(/:(\w)/gu, ': $1')
      .replace(/…/gu, '...')
      .replace(/•/gu, ' ')
      .replace(/[()]/gu, ', ')
      .replace(/[——]/gu, '-')
      .replace(/\s[−]\s/gu, ', ')
      .replace(/\s+/gu, ' ')
      .replace(/ \./gu, '.')
      .replace(/ ,/gu, ',')
      .trim();

    if (Object.keys(replacements).length === 0) {
      return [text];
    }

    return [
      Object.entries(replacements).reduce((finalText, [key, value]) => {
        return finalText.replace(new RegExp(`(?:^|\\s)${key}(?:$|\\s)`, 'g'), (match) => match.replace(key, value));
      }, text),
    ];
  }

  return [...element.children].flatMap((child: Element) => parseElement(doc, child, replacements));
}
