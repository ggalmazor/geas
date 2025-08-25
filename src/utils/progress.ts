import { formatDuration } from './time.ts';

export enum LineState {
  PENDING = '⬜', // Not processed
  PARSED = '🟦', // Text parsed
  TTS_GENERATED = '🟨', // Audio generated
  CHAPTER_MERGED = '🟩', // Merged into chapter
  AUDIOBOOK_MERGED = '🟪', // Final audiobook
}

export interface LineProgress {
  chapterNumber: number;
  lineIndex: number;
  state: LineState;
  text: string;
  wordCount: number;
}

export class ProgressMatrix {
  private lines: LineProgress[] = [];
  private display: string[][] = [];
  private maxWidth: number;
  private lastUpdate = 0;
  private updateThrottle = 200; // milliseconds
  private startTime: number;
  private ttsStartTime?: number;

  constructor(chapters: Array<{ number: number; lines: string[] }>) {
    this.maxWidth = this.getTerminalWidth();
    this.startTime = Date.now();

    // Initialize all lines as pending
    for (const chapter of chapters) {
      for (let i = 0; i < chapter.lines.length; i++) {
        const line = chapter.lines[i];
        if (line) {
          this.lines.push({
            chapterNumber: chapter.number,
            lineIndex: i,
            state: LineState.PENDING,
            text: line.substring(0, 50) + (line.length > 50 ? '...' : ''),
            wordCount: this.countWords(line),
          });
        }
      }
    }

    this.updateDisplay();
    this.render();
  }

  private getTerminalWidth(): number {
    try {
      if (Deno.consoleSize) {
        return Deno.consoleSize().columns || 80;
      }
      const columns = Deno.env.get('COLUMNS');
      if (columns) {
        const width = parseInt(columns, 10);
        if (!isNaN(width) && width > 0) {
          return width;
        }
      }
      return 80;
    } catch {
      return 80;
    }
  }

  updateLineState(chapterNumber: number, lineIndex: number, state: LineState): void {
    const line = this.lines.find((l) => l.chapterNumber === chapterNumber && l.lineIndex === lineIndex);
    if (line) {
      line.state = state;
      this.throttledUpdate();
    }
  }

  updateChapterState(chapterNumber: number, state: LineState): void {
    const chapterLines = this.lines.filter((l) => l.chapterNumber === chapterNumber);
    for (const line of chapterLines) {
      line.state = state;
    }
    this.throttledUpdate();
  }

  updateAllState(state: LineState): void {
    for (const line of this.lines) {
      line.state = state;
    }
    this.updateDisplay();
    this.render();
  }

  startTtsTimer(): void {
    this.ttsStartTime = Date.now();
  }

  private throttledUpdate(): void {
    const now = Date.now();
    if (now - this.lastUpdate > this.updateThrottle) {
      this.updateDisplay();
      this.render();
      this.lastUpdate = now;
    }
  }

  private updateDisplay(): void {
    this.display = [];
    let currentRow: string[] = [];

    // Each emoji is roughly 2 characters wide
    const nodesPerRow = Math.floor(this.maxWidth / 2);

    for (let i = 0; i < this.lines.length; i++) {
      if (currentRow.length >= nodesPerRow) {
        this.display.push([...currentRow]);
        currentRow = [];
      }
      const line = this.lines[i];
      if (line) {
        currentRow.push(line.state);
      }
    }

    if (currentRow.length > 0) {
      this.display.push(currentRow);
    }
  }

  private render(): void {
    // Clear screen and move to top
    console.clear();

    console.log('📊 Processing Progress Matrix');
    console.log('⬜ Pending  🟦 Parsed  🟨 TTS Generated  🟩 Chapter Merged  🟪 Final Audiobook');
    console.log('─'.repeat(this.maxWidth));

    for (const row of this.display) {
      console.log(row.join(''));
    }

    console.log('─'.repeat(this.maxWidth));

    // Show statistics with time estimation
    const stats = this.getStats();
    const wordStats = this.getWordStats();
    const timeInfo = this.getTimeEstimation();
    console.log(`Total: ${stats.total} | Parsed: ${stats.parsed} | TTS: ${stats.tts} | Chapter: ${stats.chapter} | Complete: ${stats.complete}`);
    console.log(`📝 Words: ${wordStats.processedWords.toLocaleString()}/${wordStats.totalWords.toLocaleString()} processed`);
    console.log(`⏱️  ${timeInfo.elapsed} elapsed${timeInfo.estimate ? ` | ${timeInfo.estimate} remaining` : ''}`);
    console.log();
  }

  private getStats() {
    const total = this.lines.length;
    const parsed = this.lines.filter((l) => l.state !== LineState.PENDING).length;
    const tts = this.lines.filter((l) =>
      l.state === LineState.TTS_GENERATED ||
      l.state === LineState.CHAPTER_MERGED ||
      l.state === LineState.AUDIOBOOK_MERGED
    ).length;
    const chapter = this.lines.filter((l) =>
      l.state === LineState.CHAPTER_MERGED ||
      l.state === LineState.AUDIOBOOK_MERGED
    ).length;
    const complete = this.lines.filter((l) => l.state === LineState.AUDIOBOOK_MERGED).length;

    return { total, parsed, tts, chapter, complete };
  }

  private getTimeEstimation(): { elapsed: string; estimate?: string } {
    const now = Date.now();
    const elapsed = formatDuration((now - this.startTime) / 1000);

    // Only estimate if we have TTS progress and enough data points
    const stats = this.getStats();
    const wordStats = this.getWordStats();
    if (!this.ttsStartTime || stats.tts < 3) {
      return { elapsed };
    }

    const ttsElapsed = (now - this.ttsStartTime) / 1000;
    const ttsRate = wordStats.processedWords / ttsElapsed; // words per second
    const remainingWords = wordStats.totalWords - wordStats.processedWords;

    if (ttsRate > 0 && remainingWords > 0) {
      const estimatedTtsTime = remainingWords / ttsRate;
      // Add some buffer for assembly (roughly 10% of TTS time)
      const totalEstimated = estimatedTtsTime * 1.1;
      return {
        elapsed,
        estimate: formatDuration(totalEstimated),
      };
    }

    return { elapsed };
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
  }

  private getWordStats(): { totalWords: number; processedWords: number } {
    const totalWords = this.lines.reduce((sum, line) => sum + line.wordCount, 0);
    const processedWords = this.lines
      .filter((line) =>
        line.state === LineState.TTS_GENERATED ||
        line.state === LineState.CHAPTER_MERGED ||
        line.state === LineState.AUDIOBOOK_MERGED
      )
      .reduce((sum, line) => sum + line.wordCount, 0);

    return { totalWords, processedWords };
  }

  showSummary(): void {
    const stats = this.getStats();
    const timeInfo = this.getTimeEstimation();
    console.log(`\n✨ Processing Complete!`);
    console.log(`📚 Processed ${stats.total} text segments across ${new Set(this.lines.map((l) => l.chapterNumber)).size} chapters`);
    console.log(`🎵 Generated ${stats.complete} audio segments for final audiobook`);
    console.log(`⏱️  Total time: ${timeInfo.elapsed}`);
  }
}
