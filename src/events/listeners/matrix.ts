import type { ProgressEvent } from '../types.ts';
import { LineState, ProgressMatrix } from '../../utils/progress.ts';

export class MatrixProgressListener {
  private matrix?: ProgressMatrix;
  private bookStructure: Array<{ number: number; lines: string[] }> = [];
  private allLinesCollected = false;

  constructor() {}

  listen(event: ProgressEvent): void {
    switch (event.type) {
      case 'book:parse:complete':
        // Prepare to collect line events
        this.bookStructure = [];
        this.allLinesCollected = false;
        break;

      case 'line:parse':
        if (!this.allLinesCollected) {
          // Build the book structure as we receive line events
          let chapter = this.bookStructure.find((c) => c.number === event.chapterNumber);
          if (!chapter) {
            chapter = { number: event.chapterNumber, lines: [] };
            this.bookStructure.push(chapter);
            // Sort chapters by number
            this.bookStructure.sort((a, b) => a.number - b.number);
          }
          chapter.lines[event.lineIndex] = event.text;
        }
        break;

      case 'speech:start':
        // Now we have all the lines, initialize the matrix
        if (!this.matrix && this.bookStructure.length > 0) {
          this.matrix = new ProgressMatrix(this.bookStructure);
          this.allLinesCollected = true;

          // Mark all lines as parsed
          for (const chapter of this.bookStructure) {
            for (let i = 0; i < chapter.lines.length; i++) {
              this.matrix.updateLineState(chapter.number, i, LineState.PARSED);
            }
          }
        }
        break;

      case 'line:tts:complete':
        this.matrix?.updateLineState(event.chapterNumber, event.lineIndex, LineState.TTS_GENERATED);
        break;

      case 'chapter:merge:complete':
        this.matrix?.updateChapterState(event.chapterNumber, LineState.CHAPTER_MERGED);
        break;

      case 'audiobook:assembly:complete':
        this.matrix?.updateAllState(LineState.AUDIOBOOK_MERGED);
        break;

      case 'processing:complete':
        this.matrix?.showSummary();
        break;
    }
  }
}
