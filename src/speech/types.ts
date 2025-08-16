import { Book, Chapter } from '../ebook/types.ts';

export type BookNarration = Book & {
  chapterNarrations: ChapterNarration[];
};

export type ChapterNarration = Chapter & {
  duration: number;
  audioFile: string;
};

export interface PiperSpeechOptions {
  voice: string;
  sentenceSilence: number;
}

// This is just a stub to show how the SpeechOptions is actually a sum type of specific TTS engine options;
export interface BarkSpeechOptions {
  voice: string;
  outputDir: string;
}

export type SpeechOptions = PiperSpeechOptions | BarkSpeechOptions;

interface AudioFile {
  filePath: string;
  duration: number;
  chunkIndex?: number;
  chapterIndex?: number;
}
