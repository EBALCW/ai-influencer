import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { aiSettingsSchema, type AiSettings } from './settings-schema';

export async function readAiSettings(): Promise<AiSettings | null> {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'ai')
    .maybeSingle();
  if (error) throw new Error('AI ayarları okunamadı.');
  const parsed = aiSettingsSchema.safeParse(data?.value);
  return parsed.success ? parsed.data : null;
}
export async function getAiConfig(): Promise<
  (AiSettings & { apiKey: string }) | null
> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const settings = await readAiSettings();
  return settings ? { ...settings, apiKey } : null;
}
