'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type SelftestJob = {
  id: string;
  status: string;
  currentStage: string | null;
  progress: number;
  createdAt: string;
  error: string | null;
};

const statusLabels: Record<string, string> = {
  queued: 'Sırada',
  running: 'Çalışıyor',
  awaiting_approval: 'Onay bekliyor',
  succeeded: 'Hazır',
  failed: 'Hata',
  cancelled: 'İptal',
};
const stageLabels: Record<string, string> = {
  prepare: 'hazırlık',
  review: 'çıktı',
  finish: 'kapanış',
};

async function post(path: string) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: response.ok, error: data.error };
}

/**
 * Deneme işi: makinenin kuyruktan iş alıp yürüttüğünü uçtan uca gösterir. Gerçek render yapmaz.
 * İş sürerken liste birkaç saniyede bir yenilenir.
 */
export function SelftestPanel({
  jobs,
  canRun,
}: {
  jobs: SelftestJob[];
  canRun: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const active = jobs.some((job) =>
    ['queued', 'running', 'awaiting_approval'].includes(job.status),
  );

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [active, router]);

  async function act(path: string, failure: string, success: string) {
    setBusy(true);
    setMessage('');
    try {
      const result = await post(path);
      setMessage(result.ok ? success : (result.error ?? failure));
      if (result.ok) router.refresh();
    } catch {
      setMessage(failure);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      {canRun && (
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() =>
            void act(
              '/api/workers/selftest',
              'Deneme işi açılamadı.',
              'Deneme işi kuyruğa alındı. Çalışan bir makine birkaç saniye içinde alır.',
            )
          }
        >
          Deneme işi gönder
        </button>
      )}
      <p className="text-sm text-muted" role="status" aria-live="polite">
        {message}
      </p>
      {jobs.length > 0 && (
        <ul className="space-y-2 text-sm" aria-label="Deneme işleri">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3"
            >
              <span className="font-medium">
                {statusLabels[job.status] ?? job.status}
              </span>
              <span className="text-muted">
                {job.currentStage
                  ? `aşama: ${stageLabels[job.currentStage] ?? job.currentStage}`
                  : ''}{' '}
                · %{job.progress}
              </span>
              <span className="text-muted">{job.createdAt}</span>
              {job.error && job.status === 'failed' && (
                <span className="text-muted">{job.error}</span>
              )}
              {canRun && job.status === 'awaiting_approval' && (
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      `/api/workers/selftest/${job.id}/approve`,
                      'Aşama onaylanamadı.',
                      'Onaylandı. Makine son aşamayı yürütecek.',
                    )
                  }
                >
                  Çıktıyı onayla
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
