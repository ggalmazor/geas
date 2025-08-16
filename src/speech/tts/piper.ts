import { PiperSpeechOptions } from '../types.ts';
import { executeCommand } from '../../utils/command.ts';
import { TTS } from '../tts.ts';

export class PiperTTS implements TTS {
  async read(text: string, outputPath: string, options: PiperSpeechOptions) {
    const piperArgs = [
      '--model',
      options.voice,
      '--sentence-silence',
      '0.5',
      '--output-file',
      outputPath,
    ];

    await executeCommand('piper', piperArgs, {
      stdin: text,
    });
  }
}
