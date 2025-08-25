#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { parseArgs } from '@std/cli';
import { basename } from '@std/path';
import { ensureDir, exists } from '@std/fs';
import * as ebook from './ebook/mod.ts';
import * as speech from './speech/mod.ts';
import * as audiobook from './audiobook/mod.ts';
import { ConsoleProgressListener, events, MatrixProgressListener } from './events/mod.ts';
import { SpeechOptions } from './speech/types.ts';

interface Args {
  input?: string;
  output?: string;
  voice?: string;
  concurrency?: number;
  matrix?: boolean;
  help?: boolean;
  resume?: string;
  replacements?: string;
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
    -r, --replacements <file>     JSON file with text replacements (default: none)
    -h, --help                    Show this help

TROUBLESHOOTING OPTIONS:
    --resume <temp-dir>           Resume book conversion from temp directory

EXAMPLES:
    geas book.epub -o audiobook.m4a -v en_US-ljspeech-high -c 4 --matrix
    geas book.epub --resume ./temp_1234567890
    geas book.epub -r replacements.json
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

async function loadReplacements(replacementsFile?: string): Promise<Record<string, string>> {
  if (!replacementsFile) {
    return {};
  }

  if (!(await exists(replacementsFile))) {
    showError(`Replacements file does not exist: ${replacementsFile}`);
  }

  try {
    const content = await Deno.readTextFile(replacementsFile);
    const replacements = JSON.parse(content);

    if (typeof replacements !== 'object' || replacements === null) {
      showError('Replacements file must contain a JSON object');
    }

    // Validate that all values are strings
    for (const [key, value] of Object.entries(replacements)) {
      if (typeof value !== 'string') {
        showError(`Invalid replacement value for "${key}": must be a string`);
      }
    }

    return replacements as Record<string, string>;
  } catch (error) {
    showError(`Failed to parse replacements file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function generateAudiobook(outputFile: string, inputFile: string, tempDir: string, replacements: Record<string, string>, speechOptions: SpeechOptions) {
  const book = await ebook.parse(inputFile, tempDir, replacements);
  const bookNarration = await speech.readBook(book, tempDir, speechOptions);
  await audiobook.assemble(bookNarration, tempDir, outputFile);

  // Calculate final stats
  const totalLines = book.chapters.reduce((sum, chapter) => sum + chapter.lines.length, 0);
  const totalDuration = bookNarration.chapterNarrations.reduce((sum, chapter) => sum + chapter.duration, 0);

  events.emit({
    type: 'processing:complete',
    outputPath: outputFile,
    stats: {
      totalLines,
      totalChapters: book.chapters.length,
      totalDuration,
    },
  });
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    alias: {
      o: 'output',
      v: 'voice',
      c: 'concurrency',
      m: 'matrix',
      r: 'replacements',
      h: 'help',
    },
    boolean: ['help', 'matrix'],
    string: ['output', 'voice', 'resume', 'replacements'],
    default: {
      voice: 'en_US-ljspeech-high',
      concurrency: 6,
      matrix: false,
    },
  }) as Args;

  if (args.help) {
    showHelp();
    return;
  }

  const inputFile = args._[0];
  if (!inputFile) {
    showError('Input file is required');
  }

  const replacements = await loadReplacements(args.replacements);
  const speechOptions = {
    concurrency: args.concurrency!,
    voice: args.voice!,
    sentenceSilence: 0.8,
    replacements,
  };
  const outputFile = args.output || `${basename(inputFile, '.epub')}.m4a`;
  const useMatrix = args.matrix!;
  const tempDir = args.resume ? args.resume! : `./temp_${new Date().toISOString().replace(/[:.\-\s]/g, '')}`;
  await ensureDir(tempDir);

  const consoleListener = new ConsoleProgressListener(useMatrix);
  const matrixListener = useMatrix ? new MatrixProgressListener() : null;
  const unsubscribeConsole = events.subscribe((event) => consoleListener.listen(event));
  const unsubscribeMatrix = matrixListener ? events.subscribe((event) => matrixListener.listen(event)) : null;

  try {
    await generateAudiobook(outputFile, inputFile, tempDir, replacements, speechOptions);
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  } finally {
    // Clean up temporary directory

    // Clean up event listeners
    unsubscribeConsole();
    if (unsubscribeMatrix) unsubscribeMatrix();
  }
}

if (import.meta.main) {
  await main();
}
