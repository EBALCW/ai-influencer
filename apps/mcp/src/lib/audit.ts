// Yerel denetim kaydı: her araç çağrısı kırpılmış biçimde bir JSONL dosyasına yazılır.
// Kayıtta serbest metin, token ya da adres YOKTUR; argümanların yalnız türü ve uzunluğu, kimlikler
// ve kısa sabitler bulunur (lib/redact.ts). Dosya kullanıcının kendi durum klasöründe, yalnız
// kullanıcının okuyabileceği izinlerle durur. Bu kayıt yereldir ve kullanıcı silebilir: ekip
// düzeyinde, değiştirilemez kayıt için veritabanı tablosu takip migration'ında gelir
// (docs/mcp-panel.md → "Takip migration'ı").
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  renameSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { redactArgs, type RedactedValue } from './redact.ts';

export type AuditEntry = {
  readonly tool: string;
  readonly kind: 'read' | 'write';
  /** `basladi`: yazma aracı çalışmadan önce; `bitti`: sonuç. */
  readonly phase: 'basladi' | 'bitti';
  readonly outcome?: 'ok' | 'hata';
  readonly code?: string;
  readonly ms?: number;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly args: unknown;
};

export type AuditRecord = {
  readonly ts: string;
  readonly tool: string;
  readonly kind: 'read' | 'write';
  readonly phase: 'basladi' | 'bitti';
  readonly outcome?: 'ok' | 'hata';
  readonly code?: string;
  readonly ms?: number;
  readonly user?: string;
  /** Oturum kimliğinin ilk 8 karakteri (kayıtları eşlemek için yeter, oturumu ele vermez). */
  readonly session?: string;
  readonly args: RedactedValue;
};

export interface AuditLog {
  /** Kaydı yazar; yazılamazsa hata fırlatır (çağıran yazma aracını durdurur). */
  record(entry: AuditEntry): void;
}

export function toAuditRecord(entry: AuditEntry, now: Date): AuditRecord {
  return {
    ts: now.toISOString(),
    tool: entry.tool,
    kind: entry.kind,
    phase: entry.phase,
    ...(entry.outcome ? { outcome: entry.outcome } : {}),
    ...(entry.code ? { code: entry.code } : {}),
    ...(entry.ms === undefined ? {} : { ms: Math.round(entry.ms) }),
    ...(entry.userId ? { user: entry.userId } : {}),
    ...(entry.sessionId ? { session: entry.sessionId.slice(0, 8) } : {}),
    args: redactArgs(entry.args),
  };
}

export function defaultStateDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  if (env.AI_INFLUENCER_MCP_STATE_DIR) return env.AI_INFLUENCER_MCP_STATE_DIR;
  const name = 'ai-influencer-mcp';
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', name);
  }
  if (platform === 'win32') {
    return join(env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), name);
  }
  return join(env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), name);
}

const MAX_BYTES = 5 * 1024 * 1024;

export function createFileAuditLog(
  dir: string = defaultStateDir(),
  now: () => Date = () => new Date(),
): AuditLog & { readonly file: string } {
  const file = join(dir, 'denetim.jsonl');
  let prepared = false;
  return {
    file,
    record(entry) {
      if (!prepared) {
        mkdirSync(dir, { recursive: true, mode: 0o700 });
        prepared = true;
      }
      try {
        if (statSync(file).size > MAX_BYTES) renameSync(file, `${file}.1`);
      } catch {
        // dosya henüz yok
      }
      appendFileSync(file, `${JSON.stringify(toAuditRecord(entry, now()))}\n`, {
        mode: 0o600,
      });
      try {
        chmodSync(file, 0o600);
      } catch {
        // Windows'ta POSIX izinleri uygulanmaz; klasör kullanıcının profilindedir.
      }
    },
  };
}

/** Testler için. */
export function createMemoryAuditLog(
  now: () => Date = () => new Date(),
): AuditLog & {
  readonly records: AuditRecord[];
} {
  const records: AuditRecord[] = [];
  return {
    records,
    record(entry) {
      records.push(toAuditRecord(entry, now()));
    },
  };
}
