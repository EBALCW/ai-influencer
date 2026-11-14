// Süreç çalıştırma ve dosya sistemi yoklamaları. Her çağrının süre sınırı vardır ve stdin
// kapalıdır: girdi bekleyen ya da asılı kalan araç denetimi kilitleyemez.
import { spawn } from 'node:child_process';
import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';

export interface RunResult {
  /** Süreç başladı, süresinde bitti ve 0 ile çıktı. */
  ok: boolean;
  code: number | null;
  /** stdout + stderr (bazı araçlar sürümü stderr'e yazar). */
  output: string;
  timedOut: boolean;
}

const MAX_OUTPUT = 2_000_000;

export function run(
  file: string,
  args: readonly string[],
  options: { timeoutMs?: number; env?: Record<string, string> } = {},
): Promise<RunResult> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    const finish = (result: Omit<RunResult, 'output'>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...result, output });
    };

    // Node, Windows'ta .cmd/.bat dosyasını kabuksuz çalıştırmaz; cmd.exe üzerinden çağrılır.
    // Argümanlar bu dosyadaki sabitlerdir, kullanıcı girdisi içermez.
    const batch = process.platform === 'win32' && /\.(cmd|bat)$/i.test(file);
    let child;
    try {
      child = batch
        ? spawn(
            process.env.ComSpec ?? 'cmd.exe',
            ['/d', '/s', '/c', `""${file}" ${args.join(' ')}"`],
            {
              stdio: ['ignore', 'pipe', 'pipe'],
              windowsHide: true,
              windowsVerbatimArguments: true,
              env: { ...process.env, ...options.env },
            },
          )
        : spawn(file, [...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            env: { ...process.env, ...options.env },
          });
    } catch {
      resolve({ ok: false, code: null, output: '', timedOut: false });
      return;
    }

    const timer = setTimeout(() => {
      // Borular açık kalsa bile beklenmez: süreç öldürülür, akışlar bırakılır
      try {
        child.kill('SIGKILL');
      } catch {
        // süreç zaten bitmiş olabilir
      }
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.unref();
      finish({ ok: false, code: null, timedOut: true });
    }, timeoutMs);

    const collect = (chunk: Buffer) => {
      if (output.length < MAX_OUTPUT) output += chunk.toString('utf8');
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.on('error', () => finish({ ok: false, code: null, timedOut: false }));
    child.on('close', (code) =>
      finish({ ok: code === 0, code, timedOut: false }),
    );
  });
}

export function isFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    // Windows "uygulama yürütme takma adları" stat ile okunamaz ama çalıştırılabilir
    try {
      return process.platform === 'win32' && lstatSync(file).isSymbolicLink();
    } catch {
      return false;
    }
  }
}

export function isDirectory(dir: string): boolean {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

export function fileSize(file: string): number | null {
  try {
    const stat = statSync(file);
    return stat.isFile() ? stat.size : null;
  } catch {
    return null;
  }
}

export function listDir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

export function readText(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

export function readJson(file: string): Record<string, unknown> | null {
  const text = readText(file);
  if (text === null) return null;
  try {
    const data: unknown = JSON.parse(text);
    return data !== null && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
