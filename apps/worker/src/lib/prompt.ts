// Uçbirimden girdi okuma. Gizli girdi (parola, giriş bağlantısı) ekrana yansıtılmaz.
import type { Readable, Writable } from 'node:stream';
import { AbortedError } from './errors.ts';
import type { Prompter } from './login.ts';

type Input = Readable & {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
};

const MAX_INPUT = 8192;

/**
 * Satır okur. `hidden` ise ve girdi bir uçbirimse ham kipe geçilir (yankı kapanır); uçbirim
 * değilse (boru) zaten yankı yoktur. Ctrl+C girişi iptal eder.
 */
function readLine(
  input: Input,
  output: Writable,
  question: string,
  hidden: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const raw = Boolean(hidden && input.isTTY && input.setRawMode);
    let value = '';
    const finish = (error: Error | null) => {
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
      if (raw) {
        input.setRawMode?.(false);
        output.write('\n');
      }
      input.pause();
      if (error) reject(error);
      else resolve(value);
    };
    const onEnd = () => finish(null);
    const onError = (error: Error) => finish(error);
    const onData = (chunk: Buffer | string) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003')
          return finish(new AbortedError('Giriş iptal edildi.'));
        if (char === '\r' || char === '\n') return finish(null);
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ' && value.length < MAX_INPUT) value += char;
      }
    };
    output.write(question);
    if (raw) input.setRawMode?.(true);
    input.on('data', onData);
    input.on('end', onEnd);
    input.on('error', onError);
    input.resume();
  });
}

export function createPrompter(input: Input, output: Writable): Prompter {
  return {
    ask: (question) => readLine(input, output, question, false),
    askHidden: (question) => readLine(input, output, question, true),
  };
}
