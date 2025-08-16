import { join } from '@std/path';
import { executeCommand } from '../utils/command.ts';

export async function generateSilenceFile(
  durationSeconds: number,
  outputPath: string,
  sampleRate: number = 24000,
  channels: number = 1,
): Promise<string> {
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

  const result = await executeCommand('ffmpeg', args);
  if (!result.success) {
    throw new Error(`Failed to generate silence (${durationSeconds}s): ${result.stderr}`);
  }
  return silenceFilePath;
}

export async function getAudioDuration(path: string): Promise<number> {
  const args = [
    '-v',
    'quiet',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    path,
  ];

  const result = await executeCommand('ffprobe', args);

  return parseFloat(result.stdout.trim());
}
