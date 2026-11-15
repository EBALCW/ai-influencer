// Konsol çıktısı: Türkçe, satır başına bir olay, alanlar `anahtar=değer`. `--json` ile satır
// başına bir JSON nesnesi. Her metin ve alan yazılmadan önce sırlardan arındırılır (redact.ts).
import { redactText, redactValue, type RedactOptions } from './redact.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_LABELS: Record<LogLevel, string> = {
  debug: 'ayrıntı',
  info: 'bilgi',
  warn: 'uyarı',
  error: 'hata',
};
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** Bellekteki bir sırrı (ör. yenileme token'ı) maskelenecekler listesine ekler. */
  addSecret(secret: string): void;
  child(fields: LogFields): Logger;
}

export interface LoggerOptions {
  json?: boolean;
  level?: LogLevel;
  home?: string;
  write?: (line: string) => void;
  now?: () => Date;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string')
    return /^[\w.:%/~@+-]+$/u.test(value) ? value : JSON.stringify(value);
  if (value === undefined) return '';
  return JSON.stringify(value);
}

export function formatLine(
  time: Date,
  level: LogLevel,
  message: string,
  fields: LogFields,
): string {
  const clock = time.toISOString().slice(11, 19);
  const pairs = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${formatValue(value)}`);
  return [
    `${clock} ${LEVEL_LABELS[level].padEnd(7)} ${message}`,
    ...pairs,
  ].join('  ');
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const secrets: string[] = [];
  const write = options.write ?? ((line: string) => console.log(line));
  const now = options.now ?? (() => new Date());
  const minimum = LEVEL_ORDER[options.level ?? 'info'];

  const build = (base: LogFields): Logger => {
    const emit = (level: LogLevel, message: string, fields?: LogFields) => {
      if (LEVEL_ORDER[level] < minimum) return;
      const redact: RedactOptions = { home: options.home, secrets };
      const clean = redactValue({ ...base, ...fields }, redact) as LogFields;
      const text = redactText(message, redact);
      const time = now();
      write(
        options.json
          ? JSON.stringify({
              zaman: time.toISOString(),
              seviye: level,
              mesaj: text,
              ...clean,
            })
          : formatLine(time, level, text, clean),
      );
    };
    return {
      debug: (message, fields) => emit('debug', message, fields),
      info: (message, fields) => emit('info', message, fields),
      warn: (message, fields) => emit('warn', message, fields),
      error: (message, fields) => emit('error', message, fields),
      addSecret: (secret) => {
        if (secret && !secrets.includes(secret)) secrets.push(secret);
      },
      child: (fields) => build({ ...base, ...fields }),
    };
  };
  return build({});
}

/** Testler ve sessiz çalıştırma için. */
export function createMemoryLogger(): Logger & { lines: string[] } {
  const lines: string[] = [];
  const logger = createLogger({
    json: true,
    level: 'debug',
    write: (line) => lines.push(line),
  });
  return Object.assign(logger, { lines });
}
