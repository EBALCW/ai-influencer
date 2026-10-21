import { z } from 'zod';
import {
  Constants,
  type GenerationType,
  type PromptCategory,
} from '@ai-influencer/shared';
import { extractVariables, MAX_VARIABLES } from './prompt-template';

// İstemci ve sunucu ortak: form doğrulaması aynı şemayla yapılır.

export const promptCategories = Constants.public.Enums.prompt_category;

export const categoryLabels: Record<PromptCategory, string> = {
  character: 'Karakter',
  video2video: 'Video-to-video',
  short_film: 'Kısa film sahnesi',
  caption: 'Caption',
  research: 'Trend araştırması',
};

/** Üretime gönderilebilen kategoriler ve üretim türü. Caption/araştırma metin görevidir (#48). */
export const generationTypeForCategory: Record<
  PromptCategory,
  GenerationType | null
> = {
  character: 'image',
  video2video: 'video',
  short_film: 'video',
  caption: null,
  research: null,
};

const trMap: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
};

/** Başlıktan soy anahtarı üretir: "Günlük Caption!" → "gunluk-caption". */
export function toPromptKey(title: string): string {
  return (
    title
      .toLocaleLowerCase('tr')
      .replace(/[çğıöşü]/g, (char) => trMap[char] ?? char)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
      .replace(/-+$/g, '') || 'prompt'
  );
}

const variableName = z
  .string()
  .regex(/^[\p{L}_][\p{L}\p{N}_]*$/u, 'Geçersiz değişken adı');

export const variableDefinitionsSchema = z
  .record(variableName, z.object({ default: z.string().max(500).optional() }))
  .refine((value) => Object.keys(value).length <= MAX_VARIABLES, {
    message: `En fazla ${MAX_VARIABLES} değişken kullanılabilir.`,
  });

export type VariableDefinitions = z.infer<typeof variableDefinitionsSchema>;

export const promptVersionSchema = z
  .object({
    category: z.enum(promptCategories),
    key: z
      .string()
      .max(64)
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        'Anahtar küçük harf, rakam ve tire içerebilir.',
      ),
    title: z.string().trim().min(1, 'Başlık gerekli.').max(120),
    body: z.string().trim().min(1, 'Prompt metni gerekli.').max(8000),
    negative: z.string().trim().max(4000).default(''),
    variables: variableDefinitionsSchema.default({}),
    influencerId: z.uuid().nullable(),
    changeNote: z.string().trim().max(500).default(''),
  })
  .superRefine((value, ctx) => {
    const names = extractVariables(value.body);
    if (names.length > MAX_VARIABLES)
      ctx.addIssue({
        code: 'custom',
        path: ['body'],
        message: `En fazla ${MAX_VARIABLES} değişken kullanılabilir.`,
      });
    for (const name of Object.keys(value.variables))
      if (!names.includes(name))
        ctx.addIssue({
          code: 'custom',
          path: ['variables', name],
          message: `"${name}" şablonda kullanılmıyor.`,
        });
  });

export type PromptVersionInput = z.infer<typeof promptVersionSchema>;

export const ratePromptSchema = z.object({
  promptId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
});

export const enqueueGenerationSchema = z.object({
  promptId: z.uuid(),
  influencerId: z.uuid(),
  values: z.record(variableName, z.string().max(2000)),
});

/** Şablonda kullanılan değişkenleri varsayılanlarıyla birlikte tutar, kullanılmayanları atar. */
export function pickVariableDefinitions(
  body: string,
  defaults: Record<string, string | undefined>,
): VariableDefinitions {
  const result: VariableDefinitions = {};
  for (const name of extractVariables(body)) {
    const value = Object.hasOwn(defaults, name) ? defaults[name] : undefined;
    result[name] = value?.trim() ? { default: value.trim() } : {};
  }
  return result;
}

/** jsonb `variables` alanını güvenle okur (bozuk veri arayüzü düşürmesin). */
export function parseVariableDefinitions(value: unknown): VariableDefinitions {
  const parsed = variableDefinitionsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}
