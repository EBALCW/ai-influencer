'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { MAX_REPORT_ACTIONS } from '@/lib/reports/weekly';

const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text';

/** Haftalık özetin "gelecek hafta için 1–3 aksiyon" bölümü (#24). */
export function NextActions({
  reportId,
  actions,
  canWrite,
}: {
  reportId: string;
  actions: string[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const items = data.getAll('action').map((value) => String(value));
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: items }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          response.status === 400
            ? 'En fazla 3 aksiyon, her biri en fazla 300 karakter.'
            : (result.error ?? 'Aksiyonlar kaydedilemedi.'),
        );
      setMessage('Aksiyonlar kaydedildi.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Aksiyonlar kaydedilemedi.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="next-actions-title" className="section-card">
      <h2
        className="mb-1 text-base font-semibold text-text"
        id="next-actions-title"
      >
        Gelecek hafta için aksiyonlar
      </h2>
      <p className="mb-3 text-sm text-muted">
        En iyi ve en kötü postlara bakıp 1–3 somut aksiyon yazın. Rapor yeniden
        oluşturulsa da aksiyonlar korunur.
      </p>
      {actions.length ? (
        <ol
          aria-label="Aksiyon listesi"
          className="mb-3 list-decimal pl-5 text-sm text-text"
        >
          {actions.map((action, index) => (
            <li key={index}>{action}</li>
          ))}
        </ol>
      ) : (
        <p className="mb-3 text-sm text-muted">Henüz aksiyon yazılmadı.</p>
      )}
      {canWrite && (
        <form
          aria-label="Aksiyonları düzenle"
          className="grid gap-3 print:hidden"
          onSubmit={onSubmit}
        >
          {Array.from({ length: MAX_REPORT_ACTIONS }, (_, index) => (
            <label className="block text-xs font-medium text-muted" key={index}>
              Aksiyon {index + 1}
              <input
                className={field}
                defaultValue={actions[index] ?? ''}
                maxLength={300}
                name="action"
              />
            </label>
          ))}
          <div className="flex items-center gap-3">
            <button
              className="button button-primary"
              disabled={pending}
              type="submit"
            >
              {pending ? 'Kaydediliyor…' : 'Aksiyonları kaydet'}
            </button>
            {message && (
              <p
                aria-live="polite"
                className="text-sm text-muted"
                role="status"
              >
                {message}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
