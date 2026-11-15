// İşleyici kaydı: iş türü + aşama adı → işleyici. Her türün parametre şeması vardır; `params`
// veridir: şemadan geçmeden işleyiciye ulaşmaz, komut satırına katılmaz, talimat sayılmaz.
import {
  JOB_ASSET_ROLES,
  JOB_KINDS,
  isJobKind,
  jobKindCapability,
  jobStageKeys,
  type JobAssetRole,
  type JobKind,
} from '@ai-influencer/shared/jobs';
import type { z } from 'zod';
import type { Logger } from './log.ts';
import type { RunOptions, RunOutcome } from './spawn.ts';

export { JOB_KINDS, jobKindCapability };

export interface StageContext<P> {
  jobId: string;
  kind: JobKind;
  stage: string;
  /** Şemadan geçmiş parametreler. */
  params: P;
  /** Bu iş için ayrılmış geçici klasör (tam yol). */
  workDir: string;
  /** İptal ya da kapanışta tetiklenir; işleyici çalışmayı bırakmalıdır. */
  signal: AbortSignal;
  log: Logger;
  /** İlerleme (0-100) ve kısa not. Seyreltilerek gönderilir; kirayı da uzatır. */
  progress(percent: number, detail?: string): void;
  /** Alt süreç: kabuksuz, stdin kapalı, süre sınırlı; iptalde süreç ağacı öldürülür. */
  run(
    file: string,
    args: readonly string[],
    options: Omit<RunOptions, 'cwd' | 'signal'> & { cwd?: string },
  ): Promise<RunOutcome>;
  /** Küçük bir çıktıyı `productions` bucket'ına yükler ve işe bağlar. */
  attach(output: {
    fileName: string;
    body: Uint8Array;
    contentType: string;
    role: JobAssetRole;
  }): Promise<void>;
}

/** Aşamanın kısa çıktı özeti (`job_stages.output`, en çok 8 KB). Sır yazılmaz. */
export type StageOutput = Record<string, unknown>;

export type StageHandler<P> = (
  context: StageContext<P>,
) => Promise<StageOutput | void>;

export interface JobKindHandlers<P> {
  kind: JobKind;
  params: z.ZodType<P>;
  stages: Record<string, StageHandler<P>>;
}

export interface RegistryEntry {
  kind: JobKind;
  parse(
    params: unknown,
  ): { ok: true; value: unknown } | { ok: false; issues: string[] };
  handler: StageHandler<unknown>;
}

export interface Registry {
  find(kind: string, stage: string): RegistryEntry | null;
  kinds(): JobKind[];
  /** Makinenin bildireceği `kind:<tür>` yetenekleri. */
  capabilities(): string[];
}

/** Parametre tipi silinmiş tanım: kayıt farklı türleri bir arada tutar. */
export type AnyJobKind = JobKindHandlers<unknown>;

/** Tür güvenli tanım yardımcısı: işleyiciler şemanın çıktı tipini görür. */
export function defineJobKind<P>(definition: JobKindHandlers<P>): AnyJobKind {
  return definition as unknown as AnyJobKind;
}

/** Kayıt sırasında denetlenir: tür bilinen bir tür olmalı ve aşamaları ortak tanımla aynı olmalı. */
export function createRegistry(definitions: readonly AnyJobKind[]): Registry {
  const byKind = new Map<JobKind, AnyJobKind>();
  for (const definition of definitions) {
    if (!isJobKind(definition.kind))
      throw new Error(`Bilinmeyen iş türü: ${String(definition.kind)}`);
    if (byKind.has(definition.kind))
      throw new Error(`İş türü iki kez kaydedildi: ${definition.kind}`);
    const expected = jobStageKeys(definition.kind);
    const actual = Object.keys(definition.stages);
    if (
      expected.length !== actual.length ||
      expected.some((key) => !Object.hasOwn(definition.stages, key))
    )
      throw new Error(
        `${definition.kind}: işleyiciler aşama tanımıyla uyuşmuyor (beklenen ${expected.join(', ')}).`,
      );
    byKind.set(definition.kind, definition);
  }
  return {
    find(kind, stage) {
      if (!isJobKind(kind)) return null;
      const definition = byKind.get(kind);
      if (!definition || !Object.hasOwn(definition.stages, stage)) return null;
      const handler = definition.stages[stage];
      if (!handler) return null;
      return {
        kind,
        handler,
        parse(params) {
          const parsed = definition.params.safeParse(params);
          if (parsed.success) return { ok: true, value: parsed.data };
          // Yalnız alan yolu ve kural: girilen değer hata metnine taşınmaz
          return {
            ok: false,
            issues: parsed.error.issues
              .slice(0, 5)
              .map(
                (issue) => `${issue.path.join('.') || '(kök)'}: ${issue.code}`,
              ),
          };
        },
      };
    },
    kinds: () => [...byKind.keys()],
    capabilities: () => [...byKind.keys()].map(jobKindCapability),
  };
}

const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export function isSafeFileName(name: string): boolean {
  return FILE_NAME.test(name) && !name.includes('..');
}

export function isJobAssetRole(role: string): role is JobAssetRole {
  return (JOB_ASSET_ROLES as readonly string[]).includes(role);
}

/** Aşama çıktısı veritabanı sınırına (8 KB, nesne) uyuyor mu? */
export function validateStageOutput(output: unknown): StageOutput | null {
  if (output === undefined || output === null) return {};
  if (typeof output !== 'object' || Array.isArray(output)) return null;
  let text: string;
  try {
    text = JSON.stringify(output);
  } catch {
    return null;
  }
  return Buffer.byteLength(text, 'utf8') <= 8000
    ? (JSON.parse(text) as StageOutput)
    : null;
}
