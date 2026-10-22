'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export const fieldClass =
  'mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-70';
export const labelClass = 'block text-sm text-muted';

export async function brandRequest(
  url: string,
  method: string,
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? 'İşlem tamamlanamadı.');
  return data;
}

/** Yazma isteği + sayfa yenileme + durum mesajı (tek kalıp, her form aynı davranır). */
export function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  async function run(
    action: () => Promise<unknown>,
    done: string,
  ): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ text: done, error: false });
      startTransition(() => router.refresh());
      return true;
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'İşlem tamamlanamadı.',
        error: true,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    pending: busy || refreshing,
    message,
    clearMessage: () => setMessage(null),
    run,
  };
}
