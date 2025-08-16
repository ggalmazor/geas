export interface Book {
  title: string;
  author: string;
  chapters: Chapter[];
}

export interface Chapter {
  title: string;
  number: number;
  lines: string[];
}

export interface ChapterChunk {
  number: number;
  text: string;
  chapterNumber: number;
  startOffset: number;
  endOffset: number;
}

export interface OpfManifest {
  title: string;
  author: string;
  spineOrder: string[];
  baseDir: string;
}
