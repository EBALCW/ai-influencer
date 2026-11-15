// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  JOB_ASSET_ROLES,
  JOB_KINDS,
  JOB_STAGE_STATUSES,
  JOB_STATUSES,
  JOB_TRANSITIONS,
  MODULES,
  PARKED_MODULES,
  TERMINAL_JOB_STATUSES,
  WORKER_CAPABILITIES,
  WORKER_PLATFORMS,
  canCancelJob,
  canRetryJob,
  canTransitionJob,
  isJobKind,
  isJobStatus,
  isModuleId,
  isTerminalJobStatus,
  jobStageKeys,
  type JobKind,
  type JobStatus,
} from '@ai-influencer/shared';

// Listeler sonraki migration'larda yeniden tanımlanabilir; her biri için EN SON tanım denetlenir.
const migrationsDir = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../../../supabase/migrations',
);
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(join(migrationsDir, name), 'utf8'));

function sqlList(pattern: RegExp): string[] {
  const match = migrations
    .map((sql) => sql.match(pattern))
    .filter((found) => found !== null)
    .at(-1);
  expect(match, `migration'da bulunamadı: ${pattern}`).toBeDefined();
  return [...match![1]!.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
}

describe('iş modeli sabitleri migration ile aynı', () => {
  it.each([
    ['modüller', MODULES, /jobs_module_known CHECK \(module IN \(([^)]*)\)\)/],
    [
      'iş durumları',
      JOB_STATUSES,
      /jobs_status_known\s+CHECK \(status IN \(([^)]*)\)\)/,
    ],
    [
      'aşama durumları',
      JOB_STAGE_STATUSES,
      /job_stages_status_known\s+CHECK \(status IN \(([^)]*)\)\)/,
    ],
    [
      'dosya rolleri',
      JOB_ASSET_ROLES,
      /job_assets_role_known\s+CHECK \(role IN \(([^)]*)\)\)/,
    ],
    [
      'makine platformları',
      WORKER_PLATFORMS,
      /platform text NOT NULL CHECK \(platform IN \(([^)]*)\)\)/,
    ],
  ] as const)('%s', (_name, list, pattern) => {
    expect(sqlList(pattern)).toEqual([...list]);
  });

  it('geçiş tablosu jobs_guard trigger yorumundaki tabloyla aynı', () => {
    const guard = migrations
      .filter((sql) => sql.includes('FUNCTION private.jobs_guard()'))
      .at(-1);
    expect(guard).toBeDefined();
    for (const from of JOB_STATUSES) {
      const targets = JOB_TRANSITIONS[from];
      if (targets.length === 0) continue;
      const line = new RegExp(
        `OLD\\.status = '${from}'\\s+AND NEW\\.status IN \\(([^)]*)\\)`,
      );
      const found = guard!.match(line);
      expect(found, `${from} geçişi trigger'da yok`).not.toBeNull();
      const sqlTargets = [...found![1]!.matchAll(/'([a-z_]+)'/g)].map(
        (m) => m[1],
      );
      expect(sqlTargets).toEqual([...targets]);
    }
  });
});

describe('yetenek anahtarları', () => {
  it('her anahtar veritabanındaki yetenek biçimine uyar', () => {
    // jobs_capabilities_valid / production_workers_capabilities_valid CHECK'lerindeki eleman kalıbı.
    const guard = migrations
      .filter((sql) => sql.includes('jobs_capabilities_valid'))
      .at(-1);
    expect(guard).toContain("'^([a-z0-9][a-z0-9_.:-]{0,39}(,|$))*$'");
    for (const capability of WORKER_CAPABILITIES) {
      expect(capability).toMatch(/^[a-z0-9][a-z0-9_.:-]{0,39}$/);
    }
    expect(WORKER_CAPABILITIES.length).toBeLessThanOrEqual(50);
  });
});

describe('durum yardımcıları', () => {
  it('son durumlardan çıkış yok', () => {
    for (const status of TERMINAL_JOB_STATUSES) {
      expect(isTerminalJobStatus(status)).toBe(true);
      expect(JOB_TRANSITIONS[status]).toEqual([]);
      expect(canCancelJob(status)).toBe(false);
    }
    expect(isTerminalJobStatus('running')).toBe(false);
  });

  it('geçerli ve geçersiz geçişler', () => {
    const legal: [JobStatus, JobStatus][] = [
      ['queued', 'running'],
      ['queued', 'cancelled'],
      ['running', 'awaiting_approval'],
      ['running', 'queued'],
      ['running', 'succeeded'],
      ['running', 'failed'],
      ['awaiting_approval', 'queued'],
      ['awaiting_approval', 'succeeded'],
      ['awaiting_approval', 'cancelled'],
    ];
    for (const [from, to] of legal) {
      expect(canTransitionJob(from, to), `${from} → ${to}`).toBe(true);
    }
    const illegal: [JobStatus, JobStatus][] = [
      ['queued', 'succeeded'],
      ['queued', 'awaiting_approval'],
      ['queued', 'failed'],
      ['awaiting_approval', 'running'],
      ['awaiting_approval', 'failed'],
      ['succeeded', 'queued'],
      ['failed', 'running'],
      ['cancelled', 'queued'],
    ];
    for (const [from, to] of illegal) {
      expect(canTransitionJob(from, to), `${from} → ${to}`).toBe(false);
    }
  });

  it('iptal ve yeniden deneme kuralları', () => {
    expect(JOB_STATUSES.filter(canCancelJob)).toEqual([
      'queued',
      'running',
      'awaiting_approval',
    ]);
    expect(JOB_STATUSES.filter(canRetryJob)).toEqual(['failed', 'cancelled']);
  });

  it('tür denetimleri bilinmeyen değeri reddeder', () => {
    expect(isJobStatus('awaiting_approval')).toBe(true);
    expect(isJobStatus('done')).toBe(false);
    expect(isModuleId('clip')).toBe(true);
    expect(isModuleId('podcast')).toBe(false);
    expect(isJobKind('clip.cut')).toBe(true);
    expect(isJobKind('toString')).toBe(false);
  });
});

describe('iş türleri', () => {
  const kinds = Object.keys(JOB_KINDS) as JobKind[];

  it('tür adı modülüyle başlar ve veritabanı biçimine uyar', () => {
    for (const kind of kinds) {
      expect(kind).toMatch(/^[a-z][a-z0-9_]{0,39}\.[a-z][a-z0-9_]{0,39}$/);
      expect(kind.split('.')[0]).toBe(JOB_KINDS[kind].module);
      expect(isModuleId(JOB_KINDS[kind].module)).toBe(true);
    }
  });

  it('aşama adları geçerli, tekil ve en çok 20 tane', () => {
    for (const kind of kinds) {
      const keys = jobStageKeys(kind);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.length).toBeLessThanOrEqual(20);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) {
        expect(key).toMatch(/^[a-z][a-z0-9_]{0,39}$/);
      }
    }
  });

  it('anlatım videosunda senaryo ve final video onay kapısıdır', () => {
    const gates = JOB_KINDS['explainer.render'].stages
      .filter((stage) => 'requires_approval' in stage)
      .map((stage) => stage.key);
    expect(gates).toEqual(['script', 'render']);
  });

  it('park edilen modül için iş türü tanımlı değil', () => {
    for (const kind of kinds) {
      expect(PARKED_MODULES).not.toContain(JOB_KINDS[kind].module);
    }
  });
});
