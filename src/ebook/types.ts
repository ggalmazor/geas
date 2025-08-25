export interface Book {
  title: string;
  author: string;
  chapters: Chapter[];
  totalLines: number;
}

export interface Chapter {
  title: string;
  number: number;
  lines: string[];
  totalLines: number;
}

export interface OpfManifest {
  title: string;
  author: string;
  spineOrder: string[];
  baseDir: string;
}
