import { executeCommand } from '../utils/command.ts';
import { BookNarration } from '../speech/types.ts';
import { dirname } from '@std/path/dirname';
import { join } from '@std/path/join';

interface ChapterMarker {
  title: string;
  startTime: number;
  endTime: number;
}

export async function addMetadataAndChapters(
  bookNarration: BookNarration,
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const markers = calculateChapterMarkers(bookNarration);
  const chaptersFile = join(dirname(inputPath), `chapters.txt`);
  await createChapterFile(markers, chaptersFile);

  const args = [
    '-i',
    inputPath,
    '-i',
    chaptersFile,
    '-map',
    '0',
    '-map_chapters',
    '1',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-metadata',
    `title=${bookNarration.title}`,
    '-metadata',
    `artist=${bookNarration.author}`,
    '-metadata',
    `album=${bookNarration.title}`,
    '-metadata',
    'comment=Generated with geas',
    '-y',
    outputPath,
  ];

  await executeCommand('ffmpeg', args);
}

export async function createChapterFile(markers: ChapterMarker[], outputPath: string): Promise<void> {
  const ffmetadataHeader = [';FFMETADATA1'];
  const ffmetadataChapters = markers.map(renderFFMetadataChapter);

  await Deno.writeTextFile(outputPath, ffmetadataHeader.concat(ffmetadataChapters).join('\n\n'));
}

function calculateChapterMarkers(bookNarration: BookNarration): ChapterMarker[] {
  let startTime = 0;
  let endTime = 0;

  return bookNarration.chapterNarrations.map((chapterNarration) => {
    endTime = startTime + chapterNarration.duration;
    const marker = {
      title: chapterNarration.title,
      startTime: startTime,
      endTime: endTime,
    };

    startTime = endTime;

    return marker;
  });
}

function renderFFMetadataChapter(marker: ChapterMarker): string {
  return [
    '[CHAPTER]',
    'TIMEBASE=1/1000',
    `START=${Math.floor(marker.startTime * 1000)}`,
    `END=${Math.floor(marker.endTime * 1000)}`,
    `title=${marker.title}`,
  ].join('\n');
}
