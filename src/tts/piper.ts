import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import type { TextChunk } from '../processor/mod.ts';
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
  chunkIndex: number;
  chapterIndex: number;
}

export class PiperTTS {
  private commandExecutor: CommandExecutor;

  constructor(logger: Logger) {
    this.commandExecutor = new CommandExecutor(logger);
  }

  async generateAudio(
    chunks: TextChunk[],
    options: TTSOptions,
  ): Promise<AudioFile[]> {
    await ensureDir(options.outputDir);

    const audioFiles: AudioFile[] = [];
    console.log(`🎙️  Generating audio with Piper (${options.voice})...`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;

      const progress = `${i + 1}/${chunks.length}`;

      console.log(
        `  [${progress}] Chapter ${chunk.chapterIndex + 1}, Chunk ${chunk.chunkIndex + 1}`,
      );

      try {
        const audioFile = await this.generateChunkAudio(chunk, i, options);
        audioFiles.push(audioFile);
      } catch (error) {
        throw new Error(`Failed to generate audio for chunk ${i}: ${error}`);
      }
    }

    return audioFiles;
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
