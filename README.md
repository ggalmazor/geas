# geas

Convert EPUB ebooks into chapterized audiobooks (M4A) using Piper TTS and FFmpeg. Built with Deno.

Geas parses an EPUB, splits its content into natural chunks, generates speech via Piper with parallel processing, then assembles a single .m4a file with chapter markers and embedded metadata.

## Features

- **EPUB Parsing**: Robust XHTML text extraction with DOM-based parsing
- **Parallel TTS Generation**: Configurable concurrency for faster processing
- **Chapterized M4A output**
- **Progress visualization modes**: 
  - Enhanced console output with detailed progress tracking
  - Matrix visualization showing real-time processing state

## Requirements

You need the following installed and available on PATH:

- Deno 2.4.+ (https://deno.com)
- FFmpeg and FFprobe (https://ffmpeg.org)
- Piper CLI (https://github.com/rhasspy/piper)
- A Piper voice model (.onnx) and its config (.onnx.json)

Notes about Piper voice argument (-v/--voice):

- You can pass either a model identifier recognized by your Piper installation, or a path to a local .onnx file.
- When passing a local .onnx, Piper looks for a matching .onnx.json config next to it (same basename). The included models already follow this naming.

## Install

You can run directly with Deno (no compile step required):

- Clone this repo
- Ensure requirements above are installed
- use the project task

  ```
  deno run start -- <args>
  ```

## Usage

**Basic**

```
deno run start <input.epub>
```

**Choose output and voice**

```
deno run start book.epub -o audiobook.m4a -v ./en_US-ljspeech-high.onnx
```

**Parallel processing with matrix visualization**

```
deno run start book.epub --matrix -c 8
```

**Help**

deno run src/cli.ts --help

**CLI options**

- `-o, --output <path>` Output audiobook file (default: `<input_basename>.m4a`)
- `-v, --voice <name>` Piper voice model (ID or path). Default: `en_US-ljspeech-high`
- `-c, --concurrency <num>` Number of concurrent TTS tasks (default: 6)
- `-m, --matrix` Show visual progress matrix (default: false)
- `-h, --help` Show help

## Progress Visualization

Geas offers two distinct progress modes to track your audiobook conversion:

### Enhanced Console Mode (Default)
```
📖 Parsing ebook: book.epub
Title: The Algebraist
Author: Iain M. Banks
Chapters: 9
Total lines: 79

🎙️ Generating speech with TTS (concurrency: 6)...
  📝 Processing chapter 1...
    Progress: 10/79 lines (13%)
  ✓ Chapter 1 complete (45.2s)

📀 Assembling audiobook from 9 chapters...
  ✓ Final audiobook assembled

✨ Audiobook created: book.m4a
📊 Final stats:
  📚 9 chapters processed
  📝 79 text segments converted
  🎵 2h 15m 30s total duration
```

### Matrix Visualization Mode (`--matrix`)
```
📊 Processing Progress Matrix
⬜ Pending  🟦 Parsed  🟨 TTS Generated  🟩 Chapter Merged  🟪 Final Audiobook
────────────────────────────────────────────────────────────────────────────────
🟩🟩🟩🟩🟨🟨🟦🟦🟦⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜
────────────────────────────────────────────────────────────────────────────────
Total: 79 | Parsed: 35 | TTS: 15 | Chapter: 4 | Complete: 0
```

Each dot represents a text segment flowing through the processing pipeline in real-time.

## What it does under the hood

### 1. Parse EPUB
- Locates container.xml → OPF → manifest + spine order  
- Extracts chapters using DOM-based XHTML parsing
- Emits parsing events for progress tracking

### 2. Generate Speech (Parallel Processing)
- Configurable concurrency with p-queue for optimal performance
- Calls Piper TTS for each text segment in parallel
- Automatic silence generation (0.8s between chunks, 1.5s after the chapter's title and between chapters)
- Real-time progress tracking per line and chapter

### 3. Chapter Assembly
- Merges audio files with silences using FFmpeg
- Measures accurate chapter durations with ffprobe
- Automatic codec selection (PCM for WAV, AAC for M4A)

### 4. Final Audiobook Assembly
- Combines all chapters into single M4A file
- Adds chapter markers with precise timestamps
- Embeds metadata (title, author, album)
- Event-driven progress completion

**Output**

- A single `.m4a` file with chapters and metadata
- Logs written to `./logs/geas.log` and `./logs/commands.log`

## Examples

**Convert ebook with default settings**
```bash
deno run start ./my-book.epub
```

**High-performance conversion with custom voice**
```bash
deno run start ./book.epub -o ./audiobooks/my-book.m4a -v ./en_US-amy-medium.onnx -c 8
```

**Matrix visualization for large books**
```bash
deno run start ./large-book.epub --matrix -c 6
```

**Use a Piper-installed voice identifier**
```bash
deno run start ./book.epub -v en_US-ljspeech-high
```

## Logs and troubleshooting

**Logs**

- App logs: ./logs/geas.log
- External commands (piper/ffmpeg/ffprobe): ./logs/commands.log

**Common issues**

- Piper not found: ensure `piper` is installed and on PATH
- FFmpeg/ffprobe not found: install FFmpeg suite and ensure both executables are on PATH
- Model/config mismatch: if you pass a .onnx, ensure a same-named .onnx.json exists next to it
- Empty or few chapters: some EPUBs use unusual structures; ensure the EPUB is valid

## Development

Prereqs: Deno installed

Tasks

- Type check: `deno run check`
- Format: `deno run fmt`
- Tests: `deno run test`

Code map (high-level)

- `src/cli.ts` CLI entry point, argument parsing
- `src/parser/*` EPUB parsing and text extraction
- `src/processor/*` Chunking, reading time estimation
- `src/tts/piper.ts` Piper integration and chunk audio generation
- `src/assembly/*` Concatenation, metadata, chapters via FFmpeg
- `src/utils/command.ts` External command executor with logging
- `src/logger/*` File-based logging
