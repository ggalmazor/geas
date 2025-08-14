import type { Logger } from '../logger/mod.ts';

export interface ConversionOptions {
  inputFile: string;
  outputFile: string;
  voice: string;
  logger: Logger;
}

export interface BookMetadata {
  title: string;
  author: string;
  chapters: Chapter[];
}

export interface Chapter {
  title: string | undefined;
  content: string;
}

export async function convertEbookToAudio(
  options: ConversionOptions,
): Promise<void> {
  const { parseEbook } = await import('../parser/mod.ts');
  const { TextProcessor } = await import('../processor/mod.ts');

  options.logger.info('Starting EPUB parsing');
  console.log('📖 Parsing ebook...');
  const book = await parseEbook(options.inputFile);

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

  const processor = new TextProcessor();
  console.log(`\n📝 Creating text chunks...`);
  const chunks = processor.createTextChunks(book.chapters);
  console.log(`Created ${chunks.length} text chunks`);

  const totalMinutes = processor.estimateReadingTime(
    book.chapters.map((ch) => ch.content).join(' '),
  );
  console.log(
    `Estimated audio length: ~${totalMinutes} minutes`,
  );

  const { PiperTTS } = await import('../tts/mod.ts');
  const { AudiobookAssembler } = await import('../assembly/mod.ts');

  console.log();
  options.logger.info('Starting TTS generation with Piper');
  const tts = new PiperTTS(options.logger);
  const tempDir = `./temp_${Date.now()}`;

  const audioFiles = await tts.generateAudio(chunks, {
    voice: options.voice,
    outputDir: tempDir,
  });

  options.logger.info('TTS generation completed', {
    audioFileCount: audioFiles.length,
  });

  console.log();
  options.logger.info('Starting audiobook assembly');
  const assembler = new AudiobookAssembler(options.logger);
  await assembler.assembleAudiobook(
    audioFiles,
    book,
    options.outputFile,
  );

  options.logger.info('Audiobook assembly completed');

  console.log('🧹 Cleaning up temporary files...');

  await assembler.cleanupAudioFiles(audioFiles);

  try {
    await Deno.remove(tempDir, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}
