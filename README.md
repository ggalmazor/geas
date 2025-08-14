# geas

Convert EPUB ebooks into chapterized audiobooks (M4A) using Piper TTS and FFmpeg. Built with Deno.

Geas parses an EPUB, splits its content into natural chunks, generates speech via Piper, then assembles a single .m4a file with chapter markers and embedded metadata (title/author/album).

## Features

- EPUB parsing (OPF + spine order) and robust XHTML text extraction
- Text processing into paragraph-sized chunks
- TTS generation using Piper
- Smart silences between chunks (0.8s) and at chapter ends (1.5s)
- Chapterized M4A output with metadata (title, author, album) via FFmpeg
- Simple CLI with logging to ./logs

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

  deno run start <input.epub>

**Choose output and voice**

  ```
  deno run start book.epub -o audiobook.m4a -v ./en_US-ljspeech-high.onnx
  ```

**Help**

  deno run src/cli.ts --help

**CLI options**
- `-o, --output <path>`   Output audiobook file (default: `<input_basename>.m4a`)
- `-v, --voice <name>`    Piper voice model (ID or path). Default: `en_US-ljspeech-high`
- `-h, --help`            Show help

## What it does under the hood

1. Parse EPUB
  - Locates container.xml → OPF → manifest + spine order
  - Extracts chapters by following spine; parses XHTML; collects text

2. Create text chunks
  - Splits by paragraphs to keep natural phrasing
  - Estimates reading time for a rough duration estimate

3. Generate audio with Piper 
  - Calls `piper --model <voice> --sentence-silence 0.5 --output-file <chunk.wav>` for each chunk
  - Measures each chunk duration with `ffprobe`

4. Assemble audiobook
  - Pre-generates 0.8s and 1.5s silence WAVs at the detected sample rate/channels
  - Creates an ffmpeg concat list with chunk WAVs + silences
  - Merges into a single temp WAV, then transcodes to M4A (AAC 128k)
  - Adds chapter markers and metadata (title/author/album)
  - Cleans up temp files

**Output**
- A single `.m4a` file with chapters and metadata
- Logs written to `./logs/geas.log` and `./logs/commands.log`

## Examples

- Convert ebook
  
  ```
  deno run start ./examples/my-book.epub -v ./en_US-ljspeech-high.onnx
  ```

- Use another local voice
  
  ```
  deno run start ./book.epub -o ./out/my-book.m4a -v ./en_US-amy-medium.onnx
  ```

- Use a Piper-installed voice identifier (if supported by your piper build)
  
  ```
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
- `src/cli.ts`            CLI entry point, argument parsing
- `src/parser/*`          EPUB parsing and text extraction
- `src/processor/*`       Chunking, reading time estimation
- `src/tts/piper.ts`      Piper integration and chunk audio generation
- `src/assembly/*`        Concatenation, metadata, chapters via FFmpeg
- `src/utils/command.ts`  External command executor with logging
- `src/logger/*`          File-based logging
