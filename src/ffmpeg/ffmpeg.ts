import { join } from '@std/path';
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
}
