import { z } from 'zod';
import type { PromptCategory } from '@ai-influencer/shared';
import {
  parseVariableDefinitions,
  pickVariableDefinitions,
  promptCategories,
  promptVersionSchema,
  type VariableDefinitions,
} from './prompt-schemas';

/**
 * Prompt içe/dışa aktarma paketi (#46). Saf fonksiyonlar; istemci ve sunucu ortak.
 *
 * Repo public olduğu için prompt'lar repoya commit'lenmez: panel paketi tarayıcıya
 * indirir, aynı dosya başka bir ortamda tekrar yüklenebilir. Influencer'lar ortamlar
 * arasında id'leri farklı olacağı için `slug` ile taşınır.
 */

export const PROMPT_BUNDLE_FORMAT = 'ai-influencer/prompts';
export const PROMPT_BUNDLE_VERSION = 1;
export const MAX_BUNDLE_BYTES = 1_000_000;
export const MAX_BUNDLE_PROMPTS = 200;

export type PromptBundleEntry = {
  category: PromptCategory;
  key: string;
  title: string;
  body: string;
  negative: string;
  variables: VariableDefinitions;
  /** Influencer slug'ı; `null` = global. */
  influencer: string | null;
  changeNote: string;
  /** Dışa aktarıldığı ortamdaki versiyon; içe aktarmada sadece bilgi amaçlı. */
  version?: number;
};

export type PromptBundle = {
  format: typeof PROMPT_BUNDLE_FORMAT;
  version: typeof PROMPT_BUNDLE_VERSION;
  exportedAt: string;
  prompts: PromptBundleEntry[];
};

const envelopeSchema = z.object({
  format: z.literal(PROMPT_BUNDLE_FORMAT),
  version: z.literal(PROMPT_BUNDLE_VERSION),
  exportedAt: z.string().max(64).optional(),
  prompts: z
    .array(z.unknown())
    .min(1, 'Pakette en az bir prompt olmalı.')
    .max(
      MAX_BUNDLE_PROMPTS,
      `Bir pakette en fazla ${MAX_BUNDLE_PROMPTS} prompt olabilir.`,
    ),
});

const entrySchema = z.strictObject({
  category: z.enum(promptCategories),
  key: z.string(),
  title: z.string(),
  body: z.string(),
  negative: z.string().optional(),
  variables: z.unknown().optional(),
  influencer: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Geçersiz influencer slug’ı.')
    .nullable()
    .default(null),
  changeNote: z.string().optional(),
  version: z.number().int().positive().optional(),
});

export type ParsedBundle =
  { ok: true; prompts: PromptBundleEntry[] } | { ok: false; errors: string[] };

const issuePath = (path: PropertyKey[]) =>
  path.map((part) => String(part)).join('.');

/**
 * Yüklenen dosya metnini doğrular. Her prompt, panel formuyla aynı kuralları
 * (`promptVersionSchema`) geçmek zorundadır; tek bir hatalı kayıt tüm paketi reddeder
 * ki yarım içe aktarma olmasın.
 */
export function parsePromptBundle(text: string): ParsedBundle {
  if (new TextEncoder().encode(text).length > MAX_BUNDLE_BYTES)
    return { ok: false, errors: ['Dosya en fazla 1 MB olabilir.'] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Dosya geçerli bir JSON değil.'] };
  }
  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success)
    return {
      ok: false,
      errors: [
        envelope.error.issues.some((issue) => issue.path[0] === 'prompts')
          ? (envelope.error.issues[0]?.message ?? 'Paket geçersiz.')
          : `Dosya bir prompt paketi değil (format: "${PROMPT_BUNDLE_FORMAT}", version: ${PROMPT_BUNDLE_VERSION}).`,
      ],
    };

  const errors: string[] = [];
  const prompts: PromptBundleEntry[] = [];
  const seen = new Set<string>();
  envelope.data.prompts.forEach((raw, index) => {
    const label = `${index + 1}. prompt`;
    const entry = entrySchema.safeParse(raw);
    if (!entry.success) {
      const issue = entry.error.issues[0];
      errors.push(
        `${label}: ${issue?.path.length ? `${issuePath(issue.path)}: ` : ''}${issue?.message ?? 'geçersiz'}`,
      );
      return;
    }
    const value = entry.data;
    const variables =
      value.variables === undefined ? {} : (value.variables as never);
    const checked = promptVersionSchema.safeParse({
      category: value.category,
      key: value.key,
      title: value.title,
      body: value.body,
      negative: value.negative,
      variables,
      influencerId: null,
      changeNote: value.changeNote,
    });
    if (!checked.success) {
      const issue = checked.error.issues[0];
      errors.push(
        `${label}${value.title ? ` (${value.title.slice(0, 60)})` : ''}: ${issue?.message ?? 'geçersiz'}`,
      );
      return;
    }
    const lineage = `${value.influencer ?? ''}/${value.category}/${checked.data.key}`;
    if (seen.has(lineage)) {
      errors.push(
        `${label}: aynı kapsam, kategori ve anahtar pakette birden fazla kez var.`,
      );
      return;
    }
    seen.add(lineage);
    prompts.push({
      category: checked.data.category,
      key: checked.data.key,
      title: checked.data.title,
      body: checked.data.body,
      negative: checked.data.negative,
      // Panel formuyla aynı biçim: şablondaki her değişken bir girdi, varsayılan opsiyonel
      variables: pickVariableDefinitions(
        checked.data.body,
        Object.fromEntries(
          Object.entries(checked.data.variables).map(([name, value]) => [
            name,
            value.default,
          ]),
        ),
      ),
      influencer: value.influencer,
      changeNote: checked.data.changeNote,
      ...(value.version ? { version: value.version } : {}),
    });
  });
  return errors.length ? { ok: false, errors } : { ok: true, prompts };
}

export type ExportablePrompt = {
  category: PromptCategory | null;
  key: string | null;
  title: string | null;
  body: string | null;
  negative: string | null;
  variables: unknown;
  version: number | null;
  change_note: string | null;
  influencer: { slug: string } | null;
};

/** Kütüphanedeki son versiyonlardan indirilebilir paket üretir. */
export function buildPromptBundle(
  rows: ExportablePrompt[],
  exportedAt: Date = new Date(),
): PromptBundle {
  return {
    format: PROMPT_BUNDLE_FORMAT,
    version: PROMPT_BUNDLE_VERSION,
    exportedAt: exportedAt.toISOString(),
    prompts: rows
      .filter(
        (row): row is ExportablePrompt & { category: PromptCategory } =>
          !!row.category && !!row.key && !!row.body,
      )
      .map((row) => ({
        category: row.category,
        key: row.key!,
        title: row.title ?? row.key!,
        body: row.body!,
        negative: row.negative ?? '',
        variables: parseVariableDefinitions(row.variables),
        influencer: row.influencer?.slug ?? null,
        changeNote: row.change_note ?? '',
        ...(row.version ? { version: row.version } : {}),
      })),
  };
}

/** İndirilecek dosyanın adı. `.gitignore` bu kalıbı yok sayar (repo public). */
export function promptBundleFileName(date: Date = new Date()): string {
  return `ai-influencer-prompts-${date.toISOString().slice(0, 10)}.json`;
}

/** Var olan son versiyonla içerik olarak aynıysa yeni versiyon oluşturulmaz. */
export function isSamePromptContent(
  entry: Pick<PromptBundleEntry, 'title' | 'body' | 'negative' | 'variables'>,
  latest: {
    title: string | null;
    body: string | null;
    negative: string | null;
    variables: unknown;
  },
): boolean {
  const sorted = (value: VariableDefinitions) =>
    JSON.stringify(
      Object.keys(value)
        .sort()
        .map((name) => [name, value[name]?.default ?? null]),
    );
  return (
    entry.title === (latest.title ?? '') &&
    entry.body === (latest.body ?? '') &&
    entry.negative === (latest.negative ?? '') &&
    sorted(entry.variables) ===
      sorted(parseVariableDefinitions(latest.variables))
  );
}

/** `/api/prompts/import` yanıtı. */
export type PromptImportResult = {
  created: number;
  unchanged: number;
  failed: Array<{ title: string; message: string }>;
};
