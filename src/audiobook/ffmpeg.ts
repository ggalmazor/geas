import { executeCommand } from '../utils/command.ts';
import { BookNarration, ChapterNarration } from '../speech/types.ts';
import { dirname } from '@std/path/dirname';
import { join } from '@std/path/join';

interface ChapterMarker {
  title: string;
  startTime: number;
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
  const ffmetadataContent = [';FFMETADATA1', ''];

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

  await Deno.writeTextFile(outputPath, ffmetadataContent.join('\n'));
}

function calculateChapterMarkers(bookNarration: BookNarration): ChapterMarker[] {
  let currentTime = 0;

  return bookNarration.chapterNarrations.map((chapterNarration: ChapterNarration) => {
    const marker = {
      title: chapterNarration.title,
      startTime: currentTime,
    };

    currentTime += chapterNarration.duration;

    return marker;
  });
}
