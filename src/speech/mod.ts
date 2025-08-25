import { Book, Chapter } from '../ebook/types.ts';
import { BookNarration, ChapterNarration, SpeechOptions } from './types.ts';
import { generateSilenceFile, getAudioDuration } from './ffmpeg.ts';
import { join } from '@std/path';
import { mergeAudioFiles } from '../utils/ffmpeg.ts';
import { buildTTS } from './tts.ts';
import { events } from '../events/mod.ts';
import { exists } from '@std/fs';
import PQueue from 'npm:p-queue@8.1.0';

export async function readLine(line: string, lineIndex: number, chapterNumber: number, outputFile: string, options: SpeechOptions): Promise<void> {
  events.emit({ type: 'line:tts:start', chapterNumber: chapterNumber, lineIndex: lineIndex });

  if (!(await exists(outputFile)) || (await Deno.stat(outputFile)).size === 0) {
    await buildTTS(options).read(cleanText(line), outputFile, options);
  }

  events.emit({ type: 'line:tts:complete', chapterNumber: chapterNumber, lineIndex: lineIndex, audioFile: outputFile });
}

async function readChapter(chapter: Chapter, tempDir: string, longSilenceFile: string, shortSilenceFile: string, options: SpeechOptions): Promise<ChapterNarration> {
  const chapterAudioFile = join(tempDir, `chapter_${chapter.number}.wav`);

  if (await exists(chapterAudioFile)) {
    const duration = await getAudioDuration(chapterAudioFile);

    events.emit({ type: 'chapter:merge:complete', chapterNumber: chapter.number, duration, audioFile: chapterAudioFile });

    return { ...chapter, duration, audioFile: chapterAudioFile };
  }

  const queue = new PQueue({ concurrency: options.concurrency! });
  const chapterAudioFiles: string[] = (await Promise.all(chapter.lines.map(async (paragraph, index, array) => {
    const lineAudioFile = join(tempDir, `chapter_${chapter.number}_line_${index + 1}.wav`);

    await queue.add(() => readLine(paragraph, index, chapter.number, lineAudioFile, options));

    const silenceFile = index === 0 || index === array.length - 1 ? longSilenceFile : shortSilenceFile;

    return [lineAudioFile, silenceFile];
  }))).flat();

  await mergeAudioFiles(chapterAudioFiles, chapterAudioFile);

  const duration = await getAudioDuration(chapterAudioFile);

  events.emit({ type: 'chapter:merge:complete', chapterNumber: chapter.number, duration, audioFile: chapterAudioFile });

  return { ...chapter, duration, audioFile: chapterAudioFile };
}

export async function readBook(book: Book, tempDir: string, speechOptions: SpeechOptions): Promise<BookNarration> {
  events.emit({ type: 'speech:start', book, speechOptions });

  const longSilenceFile = await generateSilenceFile(1.5, tempDir);
  const shortSilenceFile = await generateSilenceFile(0.8, tempDir);

  const chapterNarrations: ChapterNarration[] = [];
  for (let chapter of book.chapters) {
    const chapterNarration = await readChapter(chapter, tempDir, longSilenceFile, shortSilenceFile, speechOptions);
    chapterNarrations.push(chapterNarration);
  }

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
