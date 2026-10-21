import { notFound } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Kimlik doğrulaması sayfa stream edilmeden önce çalışır; istemciye gerçek 404 döner. */
export default async function PromptLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('prompts')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Prompt doğrulanamadı: ${error.message}`);
  if (!data) notFound();
  return children;
}
