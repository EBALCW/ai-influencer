'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireTeamMember } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  enqueueGenerationSchema,
  generationTypeForCategory,
  pickVariableDefinitions,
  promptVersionSchema,
  ratePromptSchema,
  toPromptKey,
} from '@/lib/prompt-schemas';
import { renderTemplate } from '@/lib/prompt-template';

export type PromptActionState = { ok: boolean; message: string } | null;

const fail = (message: string): PromptActionState => ({ ok: false, message });

async function canEdit() {
  const member = await requireTeamMember();
  return member.role !== 'viewer';
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

/** `prefix:<ad>` biçimindeki form alanlarını { ad: değer } nesnesine çevirir. */
function prefixed(formData: FormData, prefix: string) {
  const result: Record<string, string> = {};
  for (const [name, value] of formData.entries())
    if (name.startsWith(prefix) && typeof value === 'string')
      result[name.slice(prefix.length)] = value;
  return result;
}

function dbMessage(error: { code?: string; message: string }) {
  if (error.code === '42501') return 'Bu işlem için düzenleme yetkisi gerekir.';
  if (error.code === '23514')
    return 'Kayıt geçersiz: anahtar, puan veya içerik kurallara uymuyor.';
  return `İşlem tamamlanamadı: ${error.message}`;
}

function withInf(path: string, inf: string) {
  return inf ? `${path}?inf=${encodeURIComponent(inf)}` : path;
}

/** Yeni prompt (v1) veya mevcut soya yeni versiyon. Eski versiyonlar değişmez. */
export async function savePromptVersion(
  _prev: PromptActionState,
  formData: FormData,
): Promise<PromptActionState> {
  if (!(await canEdit()))
    return fail('Bu işlem için düzenleme yetkisi gerekir.');

  const title = text(formData, 'title');
  const body = text(formData, 'body');
  const parsed = promptVersionSchema.safeParse({
    category: text(formData, 'category'),
    key: text(formData, 'key').trim() || toPromptKey(title),
    title,
    body,
    negative: text(formData, 'negative'),
    variables: pickVariableDefinitions(body, prefixed(formData, 'default:')),
    influencerId: text(formData, 'influencerId') || null,
    changeNote: text(formData, 'changeNote'),
  });
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? 'Form geçersiz.');

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  // "Yeni prompt" var olan bir soya sessizce yeni versiyon eklemesin
  if (text(formData, 'mode') !== 'version') {
    let existing = supabase
      .from('prompts')
      .select('id')
      .eq('category', input.category)
      .eq('key', input.key)
      .limit(1);
    existing = input.influencerId
      ? existing.eq('influencer_id', input.influencerId)
      : existing.is('influencer_id', null);
    const { data: found, error: findError } = await existing;
    if (findError) return fail(dbMessage(findError));
    if (found?.length)
      return fail(
        "Bu kapsam ve kategoride aynı başlıkta bir prompt zaten var. Değiştirmek için o prompt'un sayfasından yeni versiyon oluşturun.",
      );
  }

  const { data, error } = await supabase.rpc('create_prompt_version', {
    p_category: input.category,
    p_key: input.key,
    p_title: input.title,
    p_body: input.body,
    p_negative: input.negative,
    p_variables: input.variables,
    p_influencer_id: input.influencerId ?? undefined,
    p_change_note: input.changeNote,
  });
  if (error) return fail(dbMessage(error));
  if (!data?.id) return fail('Prompt kaydedilemedi.');

  revalidatePath('/prompts');
  redirect(withInf(`/prompts/${data.id}`, text(formData, 'inf')));
}

export async function ratePrompt(
  _prev: PromptActionState,
  formData: FormData,
): Promise<PromptActionState> {
  if (!(await canEdit()))
    return fail('Bu işlem için düzenleme yetkisi gerekir.');
  const parsed = ratePromptSchema.safeParse({
    promptId: text(formData, 'promptId'),
    rating: text(formData, 'rating'),
  });
  if (!parsed.success) return fail('Puan 1 ile 5 arasında olmalı.');

  const supabase = await createSupabaseServerClient();
  // RLS reddi hata vermez, 0 satır döner; sessiz "başarı" olmasın diye satırı geri istiyoruz
  const { data, error } = await supabase
    .from('prompts')
    .update({ rating: parsed.data.rating })
    .eq('id', parsed.data.promptId)
    .select('id');
  if (error) return fail(dbMessage(error));
  if (!data?.length)
    return fail('Prompt bulunamadı veya bu işlem için yetkin yok.');

  revalidatePath('/prompts');
  revalidatePath(`/prompts/${parsed.data.promptId}`);
  return { ok: true, message: `Puan kaydedildi: ${parsed.data.rating}/5` };
}

/**
 * Doldurulmuş şablonu üretim kuyruğuna ekler (`generations.status = queued`).
 * Sağlayıcı burada çağrılmaz; kuyruğu işleyen worker #47 ile gelecek.
 */
export async function enqueueGeneration(
  _prev: PromptActionState,
  formData: FormData,
): Promise<PromptActionState> {
  if (!(await canEdit()))
    return fail('Bu işlem için düzenleme yetkisi gerekir.');
  if (!text(formData, 'influencerId'))
    return fail('Üretim için bir influencer seçin.');
  const parsed = enqueueGenerationSchema.safeParse({
    promptId: text(formData, 'promptId'),
    influencerId: text(formData, 'influencerId'),
    values: prefixed(formData, 'value:'),
  });
  if (!parsed.success) return fail('Üretim isteği geçersiz.');

  const supabase = await createSupabaseServerClient();
  const { data: prompt, error: promptError } = await supabase
    .from('prompts')
    .select('id, body, negative, category, influencer_id, version')
    .eq('id', parsed.data.promptId)
    .maybeSingle();
  if (promptError) return fail(dbMessage(promptError));
  if (!prompt) return fail('Prompt bulunamadı.');

  const type = generationTypeForCategory[prompt.category];
  if (!type) return fail('Bu kategori görsel/video üretimine gönderilemez.');
  if (prompt.influencer_id && prompt.influencer_id !== parsed.data.influencerId)
    return fail("Bu prompt yalnızca kendi influencer'ı için kullanılabilir.");

  const rendered = renderTemplate(prompt.body, parsed.data.values);
  if (rendered.missing.length)
    return fail(`Eksik değişken: ${rendered.missing.join(', ')}`);

  const usedValues = Object.fromEntries(
    Object.entries(parsed.data.values).filter(
      ([name]) => !rendered.unused.includes(name),
    ),
  );
  const { data, error } = await supabase
    .from('generations')
    .insert({
      influencer_id: parsed.data.influencerId,
      prompt_id: prompt.id,
      tool: process.env.GENERATION_PROVIDER?.trim() || 'mock',
      type,
      status: 'queued',
      params: {
        prompt: rendered.text,
        negative: prompt.negative,
        variables: usedValues,
        prompt_version: prompt.version,
      },
    })
    .select('id');
  if (error) return fail(dbMessage(error));
  if (!data?.length) return fail('Üretim isteği kaydedilemedi.');

  revalidatePath(`/prompts/${prompt.id}`);
  return {
    ok: true,
    message:
      'Üretim kuyruğa alındı. Kuyruğu işleyen worker (#47) hazır olduğunda işlenecek.',
  };
}
