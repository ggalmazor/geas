import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import type { TextChunk } from '../processor/mod.ts';
import type { Chapter } from '../converter/mod.ts';
import type { Logger } from '../logger/mod.ts';
import { CommandExecutor } from '../utils/mod.ts';

export interface TTSOptions {
  voice: string;
  outputDir: string;
  speakingRate?: number;
  noiseScale?: number;
  lengthScale?: number;
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

      for (let i = 0; i < chapter.textChunks.length; i++) {
        const chunk = chapter.textChunks[i];
        if (!chunk) continue;

        console.log(
          `    [${globalChunkIndex + 1}] Chunk ${chunk.chunkIndex + 1}${i === 0 ? ' (Title)' : ''}`,
        );

        try {
          const audioFile = await this.generateChunkAudio(chunk, globalChunkIndex, options);
          chapterAudioFiles.push(audioFile);

          globalChunkIndex++;

          const silence = i === 0 || i === chapter.textChunks.length - 1 ? longSilence : shortSilence;
          const silenceFile: AudioFile = {
            filePath: silence.filePath,
            duration: silence.duration,
            chunkIndex: chunk.chunkIndex + 0.5,
            chapterIndex: chunk.chapterIndex,
          };
          chapterAudioFiles.push(silenceFile);

          globalChunkIndex++;
        } catch (error) {
          throw new Error(`Failed to generate audio for chapter ${chapter.index}, chunk ${chunk.chunkIndex}: ${error}`);
        }
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

    const piperArgs = [
      '--model',
      options.voice,
      '--sentence-silence',
      '0.5',
      '--output-file',
      outputFile,
    ];

    if (options.speakingRate) {
      piperArgs.push('--speaking-rate', options.speakingRate.toString());
    }

    if (options.noiseScale) {
      piperArgs.push('--noise-scale', options.noiseScale.toString());
    }

    if (options.lengthScale) {
      piperArgs.push('--length-scale', options.lengthScale.toString());
    }

    const result = await this.commandExecutor.execute('piper', piperArgs, {
      stdin: chunk.text,
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
}
