import { join } from '@std/path/join';
import { BookNarration } from '../speech/types.ts';
import { addMetadataAndChapters } from './ffmpeg.ts';
import { mergeAudioFiles } from '../utils/ffmpeg.ts';
import { basename } from '@std/path';
import { LineState, ProgressMatrix } from '../utils/progress.ts';

export async function assemble(bookNarration: BookNarration, tempDir: string, outputPath: string, progress?: ProgressMatrix): Promise<void> {
  const tempAudiobookFile = join(tempDir, 'temp_audiobook.m4a');
  await mergeAudioFiles(bookNarration.chapterNarrations.map((chapterNarration) => basename(chapterNarration.audioFile)), tempAudiobookFile);

  await addMetadataAndChapters(bookNarration, tempAudiobookFile, outputPath);

  if (progress) {
    progress.updateAllState(LineState.AUDIOBOOK_MERGED);
    progress.showSummary();
  }
}
