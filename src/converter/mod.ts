import type { Logger } from '../logger/mod.ts';
import type { AudioFile } from '../tts/mod.ts';
import type { TextChunk } from '../processor/mod.ts';
import { FFmpeg } from '../ffmpeg/ffmpeg.ts';
import { ensureDir } from '@std/fs';

export interface ConversionOptions {
  inputFile: string;
  outputFile: string;
  voice: string;
  logger: Logger;
  concurrency: number;
}

export interface BookMetadata {
  title: string;
  author: string;
  chapters: Chapter[];
}

export interface Chapter {
  title: string | undefined;
  content: string;
  index?: number;
  textChunks?: TextChunk[];
  audioFiles?: AudioFile[];
  duration?: number;
  wordCount?: number;
}

export async function convertEbookToAudio(
  options: ConversionOptions,
): Promise<void> {
  const { parseEbook } = await import('../parser/mod.ts');
  const { TextProcessor } = await import('../processor/mod.ts');

  options.logger.info('Starting EPUB parsing');
  console.log('📖 Parsing ebook...');
  const book = await parseEbook(options.inputFile);

  // Add index to chapters
  book.chapters.forEach((chapter, index) => {
    chapter.index = index;
  });

  options.logger.info('EPUB parsed successfully', {
    title: book.title,
    author: book.author,
    chapterCount: book.chapters.length,
  });

  console.log(`Title: ${book.title}`);
  console.log(`Author: ${book.author}`);
  console.log(`Chapters: ${book.chapters.length}`);

  if (book.chapters.length === 0) {
    throw new Error(
      `No chapters found in EPUB. The file may be corrupted or use an unsupported EPUB structure.`,
    );
  }

  console.log();

  // Process text chunks and associate them with chapters
  const processor = new TextProcessor();
  console.log(`\n📝 Creating text chunks...`);
  processor.populateChapterTextChunks(book.chapters);

  const totalChunks = book.chapters.reduce((sum, ch) => sum + (ch.textChunks?.length || 0), 0);
  console.log(`Created ${totalChunks} text chunks`);

  // Create temp directory for inspection files
  const tempDir = `./temp_${Date.now()}`;
  await ensureDir(tempDir);

  // Save chapter text files for inspection
  await processor.saveChapterTextFiles(book.chapters, tempDir);

  // Calculate metadata for each chapter
  book.chapters.forEach((chapter) => {
    chapter.wordCount = processor.countWords(chapter.content);
  });

  const { PiperTTS } = await import('../tts/mod.ts');
  const { AudiobookAssembler } = await import('../assembly/mod.ts');

  console.log();
  options.logger.info('Starting TTS generation with Piper');
  const tts = new PiperTTS(options.logger);

  const ffmpeg = new FFmpeg(options.logger);
  const longSilence = await ffmpeg.generateSilenceFile(1.5, tempDir);
  const shortSilence = await ffmpeg.generateSilenceFile(0.8, tempDir);

  // Generate audio and associate with chapters
  await tts.generateChapterAudio(
    book.chapters,
    {
      voice: options.voice,
      outputDir: tempDir,
      concurrency: options.concurrency,
    },
    longSilence,
    shortSilence,
  );

  // Merge audio files for each chapter and measure accurate durations
  console.log('🔗 Merging chapter audio files...');
  for (let i = 0; i < book.chapters.length; i++) {
    const chapter = book.chapters[i];
    if (!chapter || !chapter.audioFiles || chapter.audioFiles.length === 0) continue;

    console.log(`  Chapter ${i + 1}: ${chapter.title || 'Untitled'}`);

    const mergedChapterFile = await ffmpeg.mergeChapterAudioFiles(
      chapter.audioFiles,
      tempDir,
      i,
    );

    // Replace chapter's audio files with single merged file
    chapter.audioFiles = [mergedChapterFile];
    chapter.duration = mergedChapterFile.duration;
  }

  const totalAudioFiles = book.chapters.reduce((sum, ch) => sum + (ch.audioFiles?.length || 0), 0);
  options.logger.info('Chapter merging completed', {
    chapterCount: book.chapters.length,
    mergedAudioFiles: totalAudioFiles,
  });

  console.log();
  options.logger.info('Starting audiobook assembly');
  const assembler = new AudiobookAssembler(options.logger);
  await assembler.assembleAudiobook(
    book,
    options.outputFile,
  );

  options.logger.info('Audiobook assembly completed');

  console.log('🧹 Cleaning up temporary files...');

  await assembler.cleanupChapterAudioFiles(book.chapters);

  try {
    await Deno.remove(tempDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}
