import { join } from '@std/path/join';
import { BookNarration } from '../speech/types.ts';
import { addMetadataAndChapters } from './ffmpeg.ts';
import { mergeAudioFiles } from '../utils/ffmpeg.ts';
import { basename } from '@std/path';

export async function assemble(bookNarration: BookNarration, tempDir: string, outputPath: string): Promise<void> {
  console.log('🎵 Assembling audiobook...');

  const tempAudiobookFile = join(tempDir, 'temp_audiobook.m4a');
  await mergeAudioFiles(bookNarration.chapterNarrations.map((chapterNarration) => basename(chapterNarration.audioFile)), tempAudiobookFile);
  await addMetadataAndChapters(bookNarration, tempAudiobookFile, outputPath);
}
