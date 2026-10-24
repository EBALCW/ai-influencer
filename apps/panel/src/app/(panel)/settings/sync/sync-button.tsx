'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** "Şimdi senkronize et": yalnız owner/editor'a gösterilir; yetki sunucuda ayrıca denetlenir. */
export function SyncNowButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function run() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      setMessage(data.message ?? data.error ?? 'Senkronizasyon başlatılamadı.');
      if (response.ok) router.refresh();
    } catch {
      setMessage('Senkronizasyon başlatılamadı.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="button"
        onClick={() => void run()}
        disabled={busy}
      >
        {busy ? 'İstek gönderiliyor…' : 'Şimdi senkronize et'}
      </button>
      <p className="text-sm text-muted" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
