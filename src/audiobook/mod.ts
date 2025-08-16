import { join } from '@std/path/join';
import { BookNarration } from '../speech/types.ts';
import { addMetadataAndChapters } from './ffmpeg.ts';
import { mergeAudioFiles } from '../utils/ffmpeg.ts';
import { basename } from '@std/path';
import { progressEmitter } from '../events/mod.ts';

export async function assemble(bookNarration: BookNarration, tempDir: string, outputPath: string): Promise<void> {
  progressEmitter.emit({
    type: 'audiobook:assembly:start',
    totalChapters: bookNarration.chapterNarrations.length,
  });

  const tempAudiobookFile = join(tempDir, 'temp_audiobook.m4a');
  await mergeAudioFiles(bookNarration.chapterNarrations.map((chapterNarration) => basename(chapterNarration.audioFile)), tempAudiobookFile);

  await addMetadataAndChapters(bookNarration, tempAudiobookFile, outputPath);

  // Calculate total duration
  const totalDuration = bookNarration.chapterNarrations.reduce((sum, chapter) => sum + chapter.duration, 0);

  progressEmitter.emit({
    type: 'audiobook:assembly:complete',
    outputPath,
    totalDuration,
  });
}
