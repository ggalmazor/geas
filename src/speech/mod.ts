import { Book, Chapter } from '../ebook/types.ts';
import { BookNarration, ChapterNarration, SpeechOptions } from './types.ts';
import { generateSilenceFile, getAudioDuration } from './ffmpeg.ts';
import { join } from '@std/path';
import { mergeAudioFiles } from '../utils/ffmpeg.ts';
import { buildTTS } from './tts.ts';
import { LineState, ProgressMatrix } from '../utils/progress.ts';
import PQueue from 'npm:p-queue';

export async function read(book: Book, tempDir: string, options: SpeechOptions, progress?: ProgressMatrix): Promise<BookNarration> {
  const tts = buildTTS(options);
  const queue = new PQueue({ concurrency: options.concurrency });

  console.log(`🎙️  Generating audio with TTS... (concurrency: ${(options.concurrency)})`);

  const longSilence = await generateSilenceFile(1.5, tempDir);
  const shortSilence = await generateSilenceFile(0.8, tempDir);

  const chuchu: Promise<ChapterNarration>[] = book.chapters.map(async (chapter: Chapter): Promise<ChapterNarration> => {
    const audioFiles: string[] = await Promise.all(chapter.lines.map(async (paragraph: string, index: number): Promise<string> => {
      const outputFile = join(tempDir, `chapter_${chapter.number}_paragraph_${index + 1}.wav`);

      await queue.add(async () => {
        await tts.read(cleanText(paragraph), outputFile, options);
        if (progress) {
          progress.updateLineState(chapter.number, index, LineState.TTS_GENERATED);
        }
      });

      return outputFile;
    }));

    const audioFilesWithSilences = audioFiles.flatMap((audioFile, index, array) => {
      return [audioFile, index === 0 || index === array.length - 1 ? longSilence : shortSilence];
    });

    const audioFile = join(tempDir, `chapter_${chapter.number}.wav`);
    await mergeAudioFiles(audioFilesWithSilences, audioFile);

    const duration = await getAudioDuration(audioFile);

    if (progress) {
      progress.updateChapterState(chapter.number, LineState.CHAPTER_MERGED);
    }

    return { ...chapter, duration, audioFile };
  });

  const chapterNarrations = await Promise.all<ChapterNarration>(chuchu);

  return { ...book, chapterNarrations };
}

function cleanText(text: string): string {
  return text
    // Normalize whitespace and line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    // Fix common punctuation issues that cause TTS problems
    .replace(/([.!?])\s*\n\s*/g, '$1 ') // Join sentences that were split
    .replace(/([a-z])([A-Z])/g, '$1. $2') // Add periods between sentences missing them
    // Clean up quotes and apostrophes
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    // Remove or fix problematic characters
    .replace(/[^\w\s.,!?;:()'"-]/g, '') // Remove special characters that confuse TTS
    // Ensure proper sentence endings
    .replace(/([a-zA-Z0-9])\s*$/, '$1.') // Add period if text doesn't end with punctuation
    .trim();
}
