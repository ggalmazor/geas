import { dirname, join, relative } from '@std/path';
import { Logger } from '../logger/logger.ts';
import { CommandExecutor } from '../utils/command.ts';
import { AudioFile } from '../tts/piper.ts';

export class FFmpeg {
  private readonly commandExecutor: CommandExecutor;

  constructor(logger: Logger) {
    this.commandExecutor = new CommandExecutor(logger);
  }

  async generateSilenceFile(
    durationSeconds: number,
    outputPath: string,
    sampleRate: number = 24000,
    channels: number = 1,
  ): Promise<AudioFile> {
    const r = sampleRate ?? 24000;
    const ch = channels ?? 1;
    const channelLayout = ch === 1 ? 'mono' : ch === 2 ? 'stereo' : `${ch}c`;

    const silenceFilePath = join(outputPath, `silence_${durationSeconds}s.wav`);
    const args = [
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=${r}:cl=${channelLayout}`,
      '-t',
      String(durationSeconds),
      '-ar',
      String(r),
      '-ac',
      String(ch),
      '-c:a',
      'pcm_s16le',
      '-y',
      silenceFilePath,
    ];

    const result = await this.commandExecutor.execute('ffmpeg', args);
    if (!result.success) {
      throw new Error(
        `Failed to generate silence (${durationSeconds}s): ${result.stderr}`,
      );
    }
    return { filePath: silenceFilePath, duration: durationSeconds };
  }

  async mergeChapterAudioFiles(
    audioFiles: AudioFile[],
    outputPath: string,
    chapterIndex: number,
  ): Promise<AudioFile> {
    if (audioFiles.length === 0) {
      throw new Error('No audio files provided for chapter merging');
    }

    // Sort by chunk index to ensure proper order
    const sortedFiles = audioFiles.sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0));

    const outputFile = join(outputPath, `chapter_${chapterIndex + 1}.wav`);

    // Create concat file for ffmpeg
    const concatFilePath = join(outputPath, `chapter_${chapterIndex + 1}_concat.txt`);
    const concatContent = sortedFiles
      .map((file) => {
        // Use relative path from the concat file location to the audio file
        const relativePath = relative(dirname(concatFilePath), file.filePath);
        return `file '${relativePath}'`;
      })
      .join('\n');

    await Deno.writeTextFile(concatFilePath, concatContent);

    const args = [
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatFilePath,
      '-c',
      'copy',
      '-y',
      outputFile,
    ];

    const result = await this.commandExecutor.execute('ffmpeg', args);
    if (!result.success) {
      throw new Error(`Failed to merge chapter ${chapterIndex + 1} audio: ${result.stderr}`);
    }

    // Clean up concat file
    await Deno.remove(concatFilePath);

    // Measure actual duration
    const duration = await this.getAudioDuration(outputFile);

    return {
      filePath: outputFile,
      duration,
      chunkIndex: 0,
      chapterIndex,
    };
  }

  async getAudioDuration(filePath: string): Promise<number> {
    const args = [
      '-v',
      'quiet',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      filePath,
    ];

    const result = await this.commandExecutor.execute('ffprobe', args);
    if (!result.success) {
      throw new Error(`Failed to get duration for ${filePath}: ${result.stderr}`);
    }

    const duration = parseFloat(result.stdout.trim());
    if (isNaN(duration)) {
      throw new Error(`Invalid duration value: ${result.stdout.trim()}`);
    }

    return duration;
  }

  async getAudioStreamInfo(
    filePath: string,
  ): Promise<{ sampleRate: number; channels: number }> {
    const args = [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=sample_rate,channels',
      '-of',
      'csv=p=0',
      filePath,
    ];

    const result = await this.commandExecutor.execute('ffprobe', args);
    if (!result.success) {
      return { sampleRate: 24000, channels: 1 };
    }

    const out = result.stdout.trim();
    const parts = out.split(',');
    const sampleRate = parseInt(parts[0] || '24000', 10);
    const channels = parseInt(parts[1] || '1', 10);
    return { sampleRate: sampleRate || 24000, channels: channels || 1 };
  }

  async mergeAudioFiles(
    concatFile: string,
    outputPath: string,
    sampleRate: number,
    channels: number,
  ): Promise<void> {
    const args = [
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatFile,
      '-ar',
      String(sampleRate),
      '-ac',
      String(channels),
      '-c:a',
      'pcm_s16le',
      '-y',
      outputPath,
    ];

    const result = await this.commandExecutor.execute('ffmpeg', args);
    if (!result.success) {
      throw new Error(`ffmpeg concat failed: ${result.stderr}`);
    }
  }

  async addMetadataAndChapters(
    inputPath: string,
    outputPath: string,
    chapterFile: string,
    metadata: { title: string; author: string },
  ): Promise<void> {
    const args = [
      '-i',
      inputPath,
      '-i',
      chapterFile,
      '-map',
      '0',
      '-map_chapters',
      '1',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-metadata',
      `title=${metadata.title}`,
      '-metadata',
      `artist=${metadata.author}`,
      '-metadata',
      `album=${metadata.title}`,
      '-metadata',
      'comment=Generated with geas',
      '-y',
      outputPath,
    ];

    const result = await this.commandExecutor.execute('ffmpeg', args);
    if (!result.success) {
      throw new Error(`ffmpeg metadata failed: ${result.stderr}`);
    }
  }
}
