#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { parseArgs } from '@std/cli';
import { basename } from '@std/path';
import { ConversionOptions, convertEbookToAudio } from './converter/mod.ts';
import { Logger } from './logger/mod.ts';

interface Args {
  concurrency?: string;
  input?: string;
  output?: string;
  voice?: string;
  help?: boolean;
  _: string[];
}

const HELP_TEXT = `
geas - Convert ebooks to audiobooks

USAGE:
    geas <input.epub> [options]

OPTIONS:
    -c, --concurrency <value>     Concurrency value (default: 6)
    -o, --output <path>           Output audiobook file (default: input basename + .m4a)
    -v, --voice <name>            Piper voice model name (default: en_US-ljspeech-high)
    -h, --help                    Show this help

EXAMPLES:
    geas book.epub --sample
    geas book.epub -o audiobook.m4a -v en_US-ljspeech-high
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
      c: 'concurrency',
      o: 'output',
      v: 'voice',
      h: 'help',
    },
    boolean: ['help'],
    string: ['output', 'voice', 'concurrency'],
    default: {
      concurrency: '6',
      voice: 'en_US-ljspeech-high',
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

  try {
    logger.info('Starting geas conversion', {
      inputFile,
      outputFile,
      voice,
    });

    console.log(`Converting "${inputFile}" to audiobook...`);
    console.log(`Output: ${outputFile}`);
    console.log(`Voice: ${voice}`);
    console.log();

    const conversionOptions: ConversionOptions = {
      inputFile,
      outputFile,
      voice,
      logger,
      concurrency: parseInt(args.concurrency!),
    };

    await convertEbookToAudio(conversionOptions);

    logger.info('Conversion completed successfully', { outputFile });
    console.log(`\n✓ Audiobook created: ${outputFile}`);
  } catch (error) {
    logger.error('Conversion failed', error);
    showError(error instanceof Error ? error.message : String(error));
  }
}

if (import.meta.main) {
  await main();
}
