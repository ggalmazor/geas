#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { parseArgs } from '@std/cli';
import { basename } from '@std/path';
import { convertEbookToAudio } from './converter/mod.ts';
import { Logger } from './logger/mod.ts';

interface Args {
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
      o: 'output',
      v: 'voice',
      h: 'help',
    },
    boolean: ['help'],
    string: ['output', 'voice'],
    default: {
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

  const outputFile = args.output ||
    `${basename(inputFile, '.epub')}.m4a`;

  const voice = args.voice || 'en_US-ljspeech-high';

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

    await convertEbookToAudio({
      inputFile,
      outputFile,
      voice,
      logger,
    });

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
