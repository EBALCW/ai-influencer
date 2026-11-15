// Yerel durum dosyaları (sır içermez): eşlenen makinenin kimliği ve "çalışıyor" kilidi.
// Sır yalnız işletim sistemi kasasındadır.
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export interface WorkerState {
  /** Kasa hesabı (Supabase sunucu adı): başka ortamın kaydı karışmasın. */
  account: string;
  workerId: string;
  name: string;
  pairedAt: string;
}

const STATE_FILE = 'worker.json';
const LOCK_FILE = 'worker.lock';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readState(dir: string, account: string): WorkerState | null {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path.join(dir, STATE_FILE), 'utf8'));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const state = raw as Record<string, unknown>;
  if (
    state.account !== account ||
    typeof state.workerId !== 'string' ||
    !UUID.test(state.workerId) ||
    typeof state.name !== 'string' ||
    typeof state.pairedAt !== 'string'
  )
    return null;
  return {
    account,
    workerId: state.workerId,
    name: state.name.slice(0, 80),
    pairedAt: state.pairedAt,
  };
}

export function writeState(dir: string, state: WorkerState): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(
    path.join(dir, STATE_FILE),
    `${JSON.stringify(state, null, 2)}\n`,
    {
      mode: 0o600,
    },
  );
}

export function clearState(dir: string): void {
  rmSync(path.join(dir, STATE_FILE), { force: true });
}

export class LockError extends Error {
  override name = 'LockError';
  readonly pid: number;
  constructor(pid: number) {
    super(`Üretim makinesi programı zaten çalışıyor (süreç ${pid}).`);
    this.pid = pid;
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: süreç var ama başka kullanıcıya ait
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function lockHolder(dir: string): number | null {
  try {
    const pid = Number(readFileSync(path.join(dir, LOCK_FILE), 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 && alive(pid) ? pid : null;
  } catch {
    return null;
  }
}

/**
 * Aynı kasadaki token'ı iki süreç birden yenilerse Supabase oturumu "yeniden kullanım" sayıp
 * kapatabilir. Bu yüzden oturuma dokunan her komut tek başına çalışır.
 */
export function acquireLock(
  dir: string,
  pid = process.pid,
): { release(): void } {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, LOCK_FILE);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = openSync(file, 'wx', 0o600);
      writeFileSync(handle, String(pid));
      closeSync(handle);
      let released = false;
      return {
        release() {
          if (released) return;
          released = true;
          rmSync(file, { force: true });
        },
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const holder = lockHolder(dir);
      if (holder !== null && holder !== pid) throw new LockError(holder);
      // Eski süreç ölmüş: kilit kalıntısı silinir ve bir kez daha denenir
      rmSync(file, { force: true });
    }
  }
  throw new Error('Kilit dosyası oluşturulamadı.');
}
