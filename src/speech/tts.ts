import { PiperSpeechOptions, SpeechOptions } from './types.ts';
import { PiperTTS } from './tts/piper.ts';

export interface TTS {
  read(text: string, outputPath: string, options: SpeechOptions): Promise<void>;
}

function isPiperSpeechOptions(opts: SpeechOptions): opts is PiperSpeechOptions {
  return 'voice' in opts && 'sentenceSilence' in opts;
}

export function buildTTS(options: SpeechOptions): TTS {
  if (isPiperSpeechOptions(options)) {
    return new PiperTTS();
  }

  throw new Error(`No parser for options ${options}`);
}
