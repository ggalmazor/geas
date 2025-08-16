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
}

export class ProgressMatrix {
  private lines: LineProgress[] = [];
  private display: string[][] = [];
  private maxWidth: number;

  constructor(chapters: Array<{ number: number; lines: string[] }>) {
    // Detect terminal width, fallback to 80 if not available
    this.maxWidth = this.getTerminalWidth();

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
          });
        }
      }
    }
    this.updateDisplay();
  }

  private getTerminalWidth(): number {
    try {
      // Try to get terminal size from Deno
      if (Deno.consoleSize) {
        return Deno.consoleSize().columns || 80;
      }

      // Fallback: try environment variables
      const columns = Deno.env.get('COLUMNS');
      if (columns) {
        const width = parseInt(columns, 10);
        if (!isNaN(width) && width > 0) {
          return width;
        }
      }

      // Default fallback
      return 80;
    } catch {
      // If all fails, use safe default
      return 80;
    }
  }

  updateLineState(chapterNumber: number, lineIndex: number, state: LineState): void {
    const line = this.lines.find((l) => l.chapterNumber === chapterNumber && l.lineIndex === lineIndex);
    if (line) {
      line.state = state;
      this.updateDisplay();
      this.render();
    }
  }

  updateChapterState(chapterNumber: number, state: LineState): void {
    const chapterLines = this.lines.filter((l) => l.chapterNumber === chapterNumber);
    for (const line of chapterLines) {
      line.state = state;
    }
    this.updateDisplay();
    this.render();
  }

  updateAllState(state: LineState): void {
    for (const line of this.lines) {
      line.state = state;
    }
    this.updateDisplay();
    this.render();
  }

  private updateDisplay(): void {
    this.display = [];
    let currentRow: string[] = [];

    // Each emoji takes roughly 2 characters width in terminal
    const maxNodesPerRow = Math.floor(this.maxWidth / 2);

    for (let i = 0; i < this.lines.length; i++) {
      if (currentRow.length >= maxNodesPerRow) {
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
    // Clear screen and move cursor to top
    if (typeof Deno !== 'undefined' && Deno.stdout) {
      const encoder = new TextEncoder();
      Deno.stdout.writeSync(encoder.encode('\x1b[2J\x1b[H'));
    }

    console.log('📊 Processing Progress Matrix');
    console.log('⬜ Pending  🟦 Parsed  🟨 TTS Generated  🟩 Chapter Merged  🟪 Final Audiobook');
    console.log('═'.repeat(this.maxWidth));

    for (const row of this.display) {
      console.log(row.join(''));
    }

    console.log('═'.repeat(this.maxWidth));

    // Show statistics
    const stats = this.getStats();
    console.log(`Total: ${stats.total} | Parsed: ${stats.parsed} | TTS: ${stats.tts} | Chapter: ${stats.chapter} | Complete: ${stats.complete}`);
    console.log();
  }

  private getStats() {
    const total = this.lines.length;
    const parsed = this.lines.filter((l) => l.state !== LineState.PENDING).length;
    const tts = this.lines.filter((l) => l.state === LineState.TTS_GENERATED || l.state === LineState.CHAPTER_MERGED || l.state === LineState.AUDIOBOOK_MERGED).length;
    const chapter = this.lines.filter((l) => l.state === LineState.CHAPTER_MERGED || l.state === LineState.AUDIOBOOK_MERGED).length;
    const complete = this.lines.filter((l) => l.state === LineState.AUDIOBOOK_MERGED).length;

    return { total, parsed, tts, chapter, complete };
  }

  showSummary(): void {
    const stats = this.getStats();
    console.log(`\n✨ Processing Complete!`);
    console.log(`📚 Processed ${stats.total} text segments across ${new Set(this.lines.map((l) => l.chapterNumber)).size} chapters`);
    console.log(`🎵 Generated ${stats.complete} audio segments for final audiobook`);
  }
}
