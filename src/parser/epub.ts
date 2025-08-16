import { BlobReader, type Entry, TextWriter, ZipReader } from '@zip-js/zip-js';
import { type Document, DOMParser, type Element } from 'deno-dom';
import type { BookMetadata, Chapter } from '../converter/mod.ts';

export class EpubParser {
  async parse(filePath: string): Promise<BookMetadata> {
    const file = await Deno.readFile(filePath);
    const blob = new Blob([file]);

    const zipReader = new ZipReader(new BlobReader(blob));
    const entries: Entry[] = await zipReader.getEntries();

    const opfPath = await this.findOpfFile(entries);
    const opfContent = await this.extractFile(entries, opfPath);

    const manifest = this.parseOpf(opfContent, opfPath);
    const chapters = await this.extractChapters(entries, manifest);

    await zipReader.close();

    return {
      title: manifest.title,
      author: manifest.author,
      chapters,
    };
  }

  private async findOpfFile(entries: Entry[]): Promise<string> {
    const containerEntry = entries.find((entry) => entry.filename === 'META-INF/container.xml');

    if (!containerEntry) {
      throw new Error('Invalid EPUB: Missing container.xml');
    }

    const containerXml = await this.extractFile(
      entries,
      'META-INF/container.xml',
    );
    const opfMatch = containerXml.match(/full-path="([^"]+)"/);

    if (!opfMatch || !opfMatch[1]) {
      throw new Error('Invalid EPUB: Cannot find OPF file path');
    }

    return opfMatch[1];
  }

  private async extractFile(
    entries: Entry[],
    filePath: string,
  ): Promise<string> {
    const entry = entries.find((e) => e.filename === filePath);
    if (!entry) {
      throw new Error(`File not found in EPUB: ${filePath}`);
    }

    const writer = new TextWriter();
    return await entry.getData!(writer);
  }

  private parseOpf(opfContent: string, opfPath: string): OpfManifest {
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)</);
    const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)</);

    const spineMatches = Array.from(
      opfContent.matchAll(/<itemref[^>]+idref="([^"]+)"/g),
    );

    // Parse manifest items - handle both id-first and href-first ordering
    const manifestMatches: Array<[string, string, string]> = [];
    const itemMatches = Array.from(opfContent.matchAll(/<item[^>]*>/g));

    for (const itemMatch of itemMatches) {
      const itemTag = itemMatch[0];
      const idMatch = itemTag.match(/id="([^"]+)"/);
      const hrefMatch = itemTag.match(/href="([^"]+)"/);

      if (idMatch?.[1] && hrefMatch?.[1]) {
        manifestMatches.push([itemMatch[0], idMatch[1], hrefMatch[1]]);
      }
    }

    const manifestMap = new Map(
      manifestMatches.map((match) => [match[1], match[2]]),
    );

    const spineOrder = spineMatches
      .map((match) => match[1] ? manifestMap.get(match[1]) : undefined)
      .filter((href): href is string => href !== undefined);

    return {
      title: titleMatch?.[1] || 'Unknown Title',
      author: authorMatch?.[1] || 'Unknown Author',
      spineOrder,
      baseDir: this.getBaseDir(opfPath),
    };
  }

  private getBaseDir(opfPath: string): string {
    // Extract base directory from OPF file location
    const parts = opfPath.split('/');
    if (parts.length > 1) {
      // If OPF is in OEBPS/content.opf, base dir is OEBPS/
      return parts.slice(0, -1).join('/') + '/';
    }
    return '';
  }

  private async extractChapters(
    entries: Entry[],
    manifest: OpfManifest,
  ): Promise<Chapter[]> {
    const chapters: Chapter[] = [];

    for (let index = 0; index < manifest.spineOrder.length; index++) {
      const href = manifest.spineOrder[index];
      const fullPath = manifest.baseDir + href;

      try {
        const xhtmlContent = await this.extractFile(entries, fullPath);
        const chapter = this.parseChapter(xhtmlContent, index);

        if (chapter.content.trim()) {
          chapters.push(chapter);
        }
      } catch (error) {
        console.warn(`Failed to extract chapter from ${fullPath}:`, error);
      }
    }

    return chapters;
  }

  private parseChapter(xhtmlContent: string, chapterIndex: number): Chapter {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xhtmlContent, 'text/html');
    const headers = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(
      (element) => {
        return {
          level: parseInt(element.tagName.toLowerCase()[1]!),
          text: element.textContent?.trim(),
        };
      },
    ).toSorted((a, b) => a.level - b.level);

    const title = headers[0]?.text || `Chapter ${chapterIndex + 1}`;
    const mainContent = this.parseContent(doc);

    // Prepend the title as the first line of content, but avoid duplication
    const content = this.deduplicateTitle(title, mainContent);

    return {
      title,
      content,
    };
  }

  private parseContent(doc: Document): string {
    return [...doc.querySelector('body')!.children].flatMap((
      element: Element,
    ) => this.extractTexts(element)).filter((text) => text !== '').join('\n');
  }

  private deduplicateTitle(title: string, mainContent: string): string {
    // Check if content starts with the title (allowing for minor variations)
    const contentLines = mainContent.split('\n').filter((line) => line.trim());

    if (contentLines.length > 0) {
      const firstLine = contentLines[0]?.trim();
      if (firstLine) {
        const titleNormalized = title.toLowerCase().trim();
        const firstLineNormalized = firstLine.toLowerCase().trim();

        // If first line matches title (exact or close match), skip adding title
        if (
          firstLineNormalized === titleNormalized ||
          firstLineNormalized.includes(titleNormalized) ||
          titleNormalized.includes(firstLineNormalized)
        ) {
          return mainContent;
        }
      }
    }

    // Title doesn't duplicate, safe to prepend
    return `${title}\n\n${mainContent}`;
  }

  private extractTexts(element: Element): string[] {
    if (
      ['p', 'dt', 'dd', 'li'].includes(element.tagName.toLowerCase()) ||
      element.children.length === 0
    ) {
      const text = element.textContent?.trim().replace(/\s+/g, ' ') || '';
      if (text === '') {
        return [];
      } else {
        return [text];
      }
    } else {
      return [...element.children].flatMap((childElement: Element) => this.extractTexts(childElement));
    }
  }
}

interface OpfManifest {
  title: string;
  author: string;
  spineOrder: string[];
  baseDir: string;
}
