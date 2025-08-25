import { Book } from '../ebook/types.ts';
import { SpeechOptions } from '../speech/types.ts';

export interface BookParseStartEvent {
  type: 'book:parse:start';
  inputFile: string;
}

export interface BookParseCompleteEvent {
  type: 'book:parse:complete';
  book: Book;
}

export interface LineParseEvent {
  type: 'line:parse';
  chapterNumber: number;
  lineIndex: number;
  text: string;
}

export interface SpeechStartEvent {
  type: 'speech:start';
  book: Book;
  speechOptions: SpeechOptions;
}

export interface LineTTSStartEvent {
  type: 'line:tts:start';
  chapterNumber: number;
  lineIndex: number;
}

export interface LineTTSCompleteEvent {
  type: 'line:tts:complete';
  chapterNumber: number;
  lineIndex: number;
  audioFile: string;
}

export interface ChapterMergeStartEvent {
  type: 'chapter:merge:start';
  chapterNumber: number;
  totalFiles: number;
}

export interface ChapterMergeCompleteEvent {
  type: 'chapter:merge:complete';
  chapterNumber: number;
  duration: number;
  audioFile: string;
}

export interface AudiobookAssemblyStartEvent {
  type: 'audiobook:assembly:start';
  totalChapters: number;
}

export interface AudiobookAssemblyCompleteEvent {
  type: 'audiobook:assembly:complete';
  outputPath: string;
  totalDuration: number;
}

export interface ProcessingCompleteEvent {
  type: 'processing:complete';
  outputPath: string;
  stats: {
    totalLines: number;
    totalChapters: number;
    totalDuration: number;
  };
}

export type ProgressEvent =
  | BookParseStartEvent
  | BookParseCompleteEvent
  | LineParseEvent
  | SpeechStartEvent
  | LineTTSStartEvent
  | LineTTSCompleteEvent
  | ChapterMergeStartEvent
  | ChapterMergeCompleteEvent
  | AudiobookAssemblyStartEvent
  | AudiobookAssemblyCompleteEvent
  | ProcessingCompleteEvent;

export type EventListener = (event: ProgressEvent) => void;
