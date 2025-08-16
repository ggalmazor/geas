import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import PQueue from 'https://deno.land/x/p_queue@1.0.1/mod.ts';
import type { TextChunk } from '../processor/mod.ts';
import type { Chapter } from '../converter/mod.ts';
import type { Logger } from '../logger/mod.ts';
import { CommandExecutor } from '../utils/mod.ts';

export interface TTSOptions {
  voice: string;
  outputDir: string;
  concurrency: number;
}

export interface AudioFile {
  filePath: string;
  duration: number;
  chunkIndex?: number;
  chapterIndex?: number;
}

export class PiperTTS {
  private commandExecutor: CommandExecutor;

  constructor(logger: Logger) {
    this.commandExecutor = new CommandExecutor(logger);
  }

  async generateChapterAudio(
    chapters: Chapter[],
    options: TTSOptions,
    shortSilence: AudioFile,
    longSilence: AudioFile,
  ): Promise<void> {
    await ensureDir(options.outputDir);

    console.log(`🎙️  Generating audio with Piper (${options.voice})...`);

    let globalChunkIndex = 0;
    for (const chapter of chapters) {
      if (!chapter.textChunks) continue;

      console.log(`  Chapter ${(chapter.index || 0) + 1}: ${chapter.title || 'Untitled'}`);

      const chapterAudioFiles: AudioFile[] = [];
      const chunks = chapter.textChunks;

      // Create queue with controlled concurrency
      const queue = new PQueue({ concurrency: options.concurrency });

      // Queue all chunk processing tasks
      const results: { audioFile: AudioFile; chunkIndex: number; isFirst: boolean; isLast: boolean }[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) continue;

        const currentGlobalIndex = globalChunkIndex++;
        const isFirst = i === 0;
        const isLast = i === chunks.length - 1;

        console.log(
          `    [${currentGlobalIndex + 1}] Chunk ${chunk.chunkIndex + 1}${isFirst ? ' (Title)' : ''}`,
        );

        // Add task to queue
        queue.add(async () => {
          try {
            const audioFile = await this.generateChunkAudio(chunk, currentGlobalIndex, options);
            results.push({ audioFile, chunkIndex: i, isFirst, isLast });
          } catch (error) {
            throw new Error(`Failed to generate audio for chapter ${chapter.index}, chunk ${chunk.chunkIndex}: ${error}`);
          }
        });
      }

      // Wait for all tasks to complete
      await queue.onIdle();

      // Sort results by chunk index to maintain order
      results.sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Build audio files with silence in the correct order
      for (const result of results) {
        chapterAudioFiles.push(result.audioFile);

        const silence = result.isFirst || result.isLast ? longSilence : shortSilence;
        const silenceFile: AudioFile = {
          filePath: silence.filePath,
          duration: silence.duration,
          chunkIndex: result.audioFile.chunkIndex! + 0.5,
          chapterIndex: result.audioFile.chapterIndex!,
        };
        chapterAudioFiles.push(silenceFile);
      }

      chapter.audioFiles = chapterAudioFiles;
    }
  }

  private async generateChunkAudio(
    chunk: TextChunk,
    globalIndex: number,
    options: TTSOptions,
  ): Promise<AudioFile> {
    const outputFile = join(
      options.outputDir,
      `chunk_${globalIndex.toString().padStart(4, '0')}.wav`,
    );

    const cleanedText = this.normalizeTextForTTS(chunk.text);

    const piperArgs = [
      '--model',
      options.voice,
      '--sentence-silence',
      '0.5',
      '--output-file',
      outputFile,
    ];

    const result = await this.commandExecutor.execute('piper', piperArgs, {
      stdin: cleanedText,
    });

    if (!result.success) {
      throw new Error(`Piper failed: ${result.stderr}`);
    }

    const duration = await this.getAudioDuration(outputFile);

    return {
      filePath: outputFile,
      duration,
      chunkIndex: chunk.chunkIndex,
      chapterIndex: chunk.chapterIndex,
    };
  }

  private async getAudioDuration(filePath: string): Promise<number> {
    const result = await this.commandExecutor.execute('ffprobe', [
      '-v',
      'quiet',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      filePath,
    ]);

    if (!result.success) {
      return 0;
    }

    return parseFloat(result.stdout.trim()) || 0;
  }

  private normalizeTextForTTS(text: string): string {
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
}
