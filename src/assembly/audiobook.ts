import { dirname, join } from '@std/path';
import { ensureDir } from '@std/fs';
import type { AudioFile } from '../tts/mod.ts';
import type { Logger } from '../logger/mod.ts';
import { CommandExecutor } from '../utils/mod.ts';
import type { BookMetadata, Chapter } from '../converter/mod.ts';

export interface ChapterMarker {
  title: string;
  startTime: number;
}

export class AudiobookAssembler {
  private commandExecutor: CommandExecutor;

  constructor(logger: Logger) {
    this.commandExecutor = new CommandExecutor(logger);
  }

  assembleAudiobook(
    metadata: BookMetadata,
    outputPath: string,
  ): Promise<void> {
    // Extract all audio files from chapters
    const audioFiles: AudioFile[] = [];
    metadata.chapters.forEach((chapter) => {
      if (chapter.audioFiles) {
        audioFiles.push(...chapter.audioFiles);
      }
    });

    return this.assembleAudiobookFromFiles(audioFiles, metadata, outputPath);
  }

  async assembleAudiobookFromFiles(
    audioFiles: AudioFile[],
    metadata: BookMetadata,
    outputPath: string,
  ): Promise<void> {
    console.log('🎵 Assembling audiobook...');

    await ensureDir(dirname(outputPath));

    const sortedFiles = audioFiles.sort((a, b) => a.chapterIndex! - b.chapterIndex! || a.chunkIndex! - b.chunkIndex!);

    // Determine audio stream parameters from the first chunk
    const firstFile = sortedFiles[0];
    const { sampleRate, channels } = firstFile ? await this.getAudioStreamInfo(firstFile.filePath) : { sampleRate: 24000, channels: 1 };

    const chapterMarkers = this.calculateChapterMarkers(sortedFiles, metadata);

    const tempConcatFile = join(dirname(outputPath), 'concat_list.txt');
    await this.createConcatFile(
      sortedFiles,
      tempConcatFile,
    );

    try {
      await this.mergeAudioFiles(
        tempConcatFile,
        outputPath,
        sampleRate,
        channels,
      );
      await this.addMetadataAndChapters(outputPath, metadata, chapterMarkers);
      console.log(`✓ Audiobook assembled: ${outputPath}`);
    } finally {
      try {
        await Deno.remove(tempConcatFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private calculateChapterMarkers(
    audioFiles: AudioFile[],
    metadata: BookMetadata,
  ): ChapterMarker[] {
    const markers: ChapterMarker[] = [];
    let currentTime = 0;
    let currentChapter = -1;

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const next = audioFiles[i + 1];
      if (!file) continue;

      if (file.chapterIndex !== currentChapter) {
        const chapterTitle = metadata.chapters[file.chapterIndex!]?.title ||
          `Chapter ${file.chapterIndex! + 1}`;

        markers.push({
          title: chapterTitle,
          startTime: currentTime,
        });

        currentChapter = file.chapterIndex!;
      }

      // Add current audio duration
      currentTime += file.duration;

      // Add 1.5s silence at the end of each chapter (even at end of book)
      const isEndOfChapter = !next || next.chapterIndex !== file.chapterIndex;
      if (isEndOfChapter) {
        currentTime += 1.5;
      }

      // Add 0.8s silence between each chunk except after the last chunk
      if (next) {
        currentTime += 0.8;
      }
    }

    return markers;
  }

  private async createConcatFile(
    audioFiles: AudioFile[],
    concatFilePath: string,
  ): Promise<void> {
    const lines: string[] = [];

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      if (!file) continue;

      lines.push(`file '${file.filePath}'`);
    }

    await Deno.writeTextFile(concatFilePath, lines.join('\n'));
  }

  private async mergeAudioFiles(
    concatFile: string,
    outputPath: string,
    sampleRate: number,
    channels: number,
  ): Promise<void> {
    console.log('  Merging audio files...');

    const result = await this.commandExecutor.execute('ffmpeg', [
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
      outputPath.replace('.m4a', '_temp.wav'),
    ]);

    if (!result.success) {
      throw new Error(`ffmpeg concat failed: ${result.stderr}`);
    }
  }

  private async getAudioStreamInfo(
    filePath: string,
  ): Promise<{ sampleRate: number; channels: number }> {
    const result = await this.commandExecutor.execute('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=sample_rate,channels',
      '-of',
      'csv=p=0',
      filePath,
    ]);

    if (!result.success) {
      return { sampleRate: 24000, channels: 1 };
    }

    const out = result.stdout.trim();
    // Expecting "sample_rate,channels" as numbers
    const parts = out.split(',');
    const sampleRate = parseInt(parts[0] || '24000', 10);
    const channels = parseInt(parts[1] || '1', 10);
    return { sampleRate: sampleRate || 24000, channels: channels || 1 };
  }

  private async addMetadataAndChapters(
    outputPath: string,
    metadata: BookMetadata,
    chapterMarkers: ChapterMarker[],
  ): Promise<void> {
    console.log('  Adding metadata and chapters...');

    const tempWav = outputPath.replace('.m4a', '_temp.wav');
    const chapterFile = outputPath.replace('.m4a', '_chapters.txt');

    await this.createChapterFile(chapterMarkers, chapterFile);

    try {
      const ffmpegArgs = [
        '-i',
        tempWav,
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
        `comment=Generated with geas`,
        '-y',
        outputPath,
      ];

      const result = await this.commandExecutor.execute('ffmpeg', ffmpegArgs);

      if (!result.success) {
        throw new Error(`ffmpeg metadata failed: ${result.stderr}`);
      }
    } finally {
      try {
        await Deno.remove(tempWav);
        await Deno.remove(chapterFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private async createChapterFile(
    markers: ChapterMarker[],
    filePath: string,
  ): Promise<void> {
    const ffmetadataContent = [
      ';FFMETADATA1',
      '',
    ];

    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      if (!marker) continue;

      const nextMarker = markers[i + 1];

      const startMs = Math.floor(marker.startTime * 1000);
      const endMs = nextMarker ? Math.floor(nextMarker.startTime * 1000) : 999999999;

      ffmetadataContent.push(
        '[CHAPTER]',
        'TIMEBASE=1/1000',
        `START=${startMs}`,
        `END=${endMs}`,
        `title=${marker.title}`,
        '',
      );
    }

    await Deno.writeTextFile(filePath, ffmetadataContent.join('\n'));
  }

  async cleanupChapterAudioFiles(chapters: Chapter[]): Promise<void> {
    console.log('🧹 Cleaning up temporary files...');

    for (const chapter of chapters) {
      if (chapter.audioFiles) {
        for (const file of chapter.audioFiles) {
          try {
            await Deno.remove(file.filePath);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }
  }
}
