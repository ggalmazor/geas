import { join } from '@std/path/join';
import { extname } from '@std/path/extname';
import { dirname } from '@std/path/dirname';
import { basename } from '@std/path/basename';
import { executeCommand } from './command.ts';

export async function mergeAudioFiles(
  paths: string[],
  outputPath: string,
  sampleRate: number = 24000,
  channels: number = 1,
): Promise<void> {
  const baseNameWithoutExtension = basename(outputPath).slice(0, -1 * extname(outputPath).length);
  const concatFilePath = join(dirname(outputPath), `concat_files_${baseNameWithoutExtension}.txt`);
  await Deno.writeTextFile(concatFilePath, paths.map((path) => `file '${basename(path)}'`).join('\n'));

  const outputExt = extname(outputPath).toLowerCase();
  const codec = outputExt === '.m4a' ? 'aac' : 'pcm_s16le';

  const args = [
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatFilePath,
    '-ar',
    String(sampleRate),
    '-ac',
    String(channels),
    '-c:a',
    codec,
    '-y',
    outputPath,
  ];

  await executeCommand('ffmpeg', args);
}
