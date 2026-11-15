'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Makinenin yetkisini kaldırır; kural sunucuda (`revoke_worker`) denetlenir. */
export function RevokeMachineButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function revoke() {
    if (
      !window.confirm(
        `"${name}" makinesinin yetkisi kaldırılsın mı? Makinenin oturumu kapanır, elindeki iş kuyruğa döner.`,
      )
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/workers/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setMessage(data.error ?? 'Yetki kaldırılamadı.');
        return;
      }
      router.refresh();
    } catch {
      setMessage('Yetki kaldırılamadı.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs text-muted" role="status" aria-live="polite">
        {message}
      </span>
      <button
        type="button"
        className="button"
        onClick={() => void revoke()}
        disabled={busy}
        aria-label={`${name} makinesinin yetkisini kaldır`}
      >
        {busy ? 'Kaldırılıyor…' : 'Yetkiyi kaldır'}
      </button>
    </span>
  );
}
