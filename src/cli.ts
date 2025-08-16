#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { parseArgs } from '@std/cli';
import { basename, join } from '@std/path';
import { ensureDir } from '@std/fs';
import * as ebook from './ebook/mod.ts';
import * as speech from './speech/mod.ts';
import * as audiobook from './audiobook/mod.ts';
import { Logger } from './logger/mod.ts';
import { ProgressMatrix } from './utils/progress.ts';

interface Args {
  input?: string;
  output?: string;
  voice?: string;
  concurrency?: number;
  matrix?: boolean;
  help?: boolean;
  _: string[];
}

const HELP_TEXT = `
geas - Convert ebooks to audiobooks

USAGE:
    geas <input.epub> [options]

OPTIONS:
    -o, --output <path>           Output audiobook file (default: input basename + .m4a)
    -v, --voice <name>            Piper voice model name (default: en_US-ljspeech-high)
    -c, --concurrency <num>       Number of concurrent TTS tasks (default: 6)
    -m, --matrix                  Show visual progress matrix (default: false)
    -h, --help                    Show this help

EXAMPLES:
    geas book.epub --sample
    geas book.epub -o audiobook.m4a -v en_US-ljspeech-high -c 4 --matrix
`;

function showHelp(): void {
  console.log(HELP_TEXT);
  Deno.exit(0);
}

function showError(message: string): never {
  console.error(`Error: ${message}`);
  console.error('Use --help for usage information');
  Deno.exit(1);
}

async function main(): Promise<void> {
  const logger = await Logger.getInstance();

  const args = parseArgs(Deno.args, {
    alias: {
      o: 'output',
      v: 'voice',
      c: 'concurrency',
      m: 'matrix',
      h: 'help',
    },
    boolean: ['help', 'matrix'],
    string: ['output', 'voice'],
    default: {
      voice: 'en_US-ljspeech-high',
      concurrency: 6,
      matrix: false,
    },
  }) as Args;

  if (args.help) {
    showHelp();
  }

  const inputFile = args._[0];
  if (!inputFile) {
    showError('Input file is required');
  }

  const outputFile = args.output || `${basename(inputFile, '.epub')}.m4a`;

  const voice = args.voice!;
  const concurrency = args.concurrency!;
  const useMatrix = args.matrix!;

  try {
    logger.info('Starting geas conversion', {
      inputFile,
      outputFile,
      voice,
      concurrency,
      matrix: useMatrix,
    });

    console.log(`Converting "${inputFile}" to audiobook...`);
    console.log(`Output: ${outputFile}`);
    console.log(`Voice: ${voice}`);
    console.log(`Concurrency: ${concurrency}`);
    if (useMatrix) {
      console.log(`Progress Matrix: enabled`);
    }
    console.log();

    // Create temporary directory for processing
    const tempDir = `./temp_${Date.now()}`;
    await ensureDir(tempDir);

    try {
      console.log('📖 Parsing ebook...');
      const book = await ebook.parse(inputFile);
      console.log(`Title: ${book.title}`);
      console.log(`Author: ${book.author}`);
      console.log(`Chapters: ${book.chapters.length}`);
      console.log();

      // Initialize progress matrix if enabled
      const progress = useMatrix ? new ProgressMatrix(book.chapters) : undefined;

      // Parse with progress tracking
      await ebook.parse(inputFile, progress);

      await Promise.all(book.chapters.map((chapter) => {
        return Deno.writeTextFile(join(tempDir, `chapter_${chapter.number}.txt`), chapter.lines.join('\n'));
      }));

      if (!useMatrix) {
        console.log('🎙️ Generating speech...');
      }

      const speechOptions = {
        concurrency,
        voice,
        sentenceSilence: 0.8,
      };

      const bookNarration = await speech.read(book, tempDir, speechOptions, progress);

      if (!useMatrix) {
        console.log('📀 Assembling audiobook...');
      }

      await audiobook.assemble(bookNarration, tempDir, outputFile, progress);

      logger.info('Conversion completed successfully', { outputFile });
      console.log(`✓ Audiobook created: ${outputFile}`);
    } finally {
      // Clean up temporary directory
    }
  } catch (error) {
    logger.error('Conversion failed', error);
    showError(error instanceof Error ? error.message : String(error));
  }
}

if (import.meta.main) {
  await main();
}
