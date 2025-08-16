import type { ProgressEvent } from '../types.ts';

export class ConsoleProgressListener {
  private currentChapter = 0;
  private chaptersProcessed = 0;
  private totalChapters = 0;
  private linesProcessed = 0;
  private totalLines = 0;
  private matrixMode = false;

  constructor(matrixMode = false) {
    this.matrixMode = matrixMode;
  }

  listen(event: ProgressEvent): void {
    switch (event.type) {
      case 'book:parse:start':
        if (!this.matrixMode) {
          console.log(`📖 Parsing ebook: ${event.filePath}`);
        }
        break;

      case 'book:parse:complete':
        if (!this.matrixMode) {
          console.log(`Title: ${event.book.title}`);
          console.log(`Author: ${event.book.author}`);
          console.log(`Chapters: ${event.book.chapters}`);
          console.log(`Total lines: ${event.book.totalLines}`);
          console.log();
        }
        this.totalChapters = event.book.chapters;
        this.totalLines = event.book.totalLines;
        break;

      case 'speech:start':
        if (!this.matrixMode) {
          console.log(`🎙️ Generating speech with TTS (concurrency: ${event.concurrency})...`);
        }
        break;

      case 'chapter:merge:start':
        if (!this.matrixMode && event.chapterNumber !== this.currentChapter) {
          this.currentChapter = event.chapterNumber;
          console.log(`  📝 Processing chapter ${event.chapterNumber}...`);
        }
        break;

      case 'line:tts:complete':
        this.linesProcessed++;
        // Show progress every 10 lines to avoid spam
        if (!this.matrixMode && (this.linesProcessed % 10 === 0 || this.linesProcessed === this.totalLines)) {
          if (typeof Deno !== 'undefined' && Deno.stdout) {
            const encoder = new TextEncoder();
            const progress = `    Progress: ${this.linesProcessed}/${this.totalLines} lines (${Math.round(this.linesProcessed / this.totalLines * 100)}%)\r`;
            Deno.stdout.writeSync(encoder.encode(progress));
          }
        }
        break;

      case 'chapter:merge:complete':
        this.chaptersProcessed++;
        if (!this.matrixMode) {
          console.log(`\n  ✓ Chapter ${event.chapterNumber} complete (${event.duration.toFixed(1)}s)`);
        }
        break;

      case 'audiobook:assembly:start':
        if (!this.matrixMode) {
          console.log(`\n📀 Assembling audiobook from ${event.totalChapters} chapters...`);
        }
        break;

      case 'audiobook:assembly:complete':
        if (!this.matrixMode) {
          console.log(`  ✓ Final audiobook assembled`);
          console.log(`  📄 Total duration: ${this.formatDuration(event.totalDuration)}`);
        }
        break;

      case 'processing:complete':
        console.log(`\n✨ Audiobook created: ${event.outputPath}`);
        console.log(`📊 Final stats:`);
        console.log(`  📚 ${event.stats.totalChapters} chapters processed`);
        console.log(`  📝 ${event.stats.totalLines} text segments converted`);
        console.log(`  🎵 ${this.formatDuration(event.stats.totalDuration)} total duration`);
        break;
    }
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }
}
