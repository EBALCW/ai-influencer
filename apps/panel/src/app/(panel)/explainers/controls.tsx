'use client';

import { useState } from 'react';
import { ConfirmDialog, Toast } from '@/components/ui';
import { ErrorText, api, useAction } from './shared';

/** Arşivle / arşivden çıkar. Kayıt silinmez; arşivleme onay ister. */
export function ArchiveButton({
  url,
  archived,
  subject,
}: {
  url: string;
  archived: boolean;
  /** "Seri" ya da "Bölüm": onay metninde kullanılır. */
  subject: string;
}) {
  const { pending, error, run } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState('');
  const submit = (next: boolean) =>
    run(
      () => api(url, 'POST', { archived: next }),
      () =>
        setToast(
          next ? `${subject} arşivlendi.` : `${subject} arşivden çıkarıldı.`,
        ),
    );
  return (
    <>
      <button
        className="button button-quiet"
        disabled={pending}
        onClick={() => (archived ? void submit(false) : setConfirm(true))}
        type="button"
      >
        {archived ? 'Arşivden çıkar' : 'Arşivle'}
      </button>
      <ErrorText>{error}</ErrorText>
      <ConfirmDialog
        confirmLabel="Arşivle"
        description={`${subject} silinmez; listelerde gizlenir ve istediğiniz zaman arşivden çıkarabilirsiniz.`}
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          void submit(true);
        }}
        open={confirm}
        title={`${subject} arşivlensin mi?`}
      />
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </>
  );
}

/** Bölümü başka seriye ya da seri dışına (tekil video) taşır. Yalnız üretim başlamadan. */
export function MoveEpisode({
  episodeId,
  title,
  currentSeriesId,
  options,
}: {
  episodeId: string;
  title: string;
  currentSeriesId: string | null;
  options: Array<{ id: string; name: string }>;
}) {
  const { pending, error, run } = useAction();
  const [target, setTarget] = useState('');
  const [toast, setToast] = useState('');
  const targets = options.filter((option) => option.id !== currentSeriesId);
  if (targets.length === 0 && currentSeriesId === null) return null;
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!target) return;
        void run(
          () =>
            api(`/api/explainers/episodes/${episodeId}/move`, 'POST', {
              series_id: target === 'standalone' ? null : target,
            }),
          () => {
            setTarget('');
            setToast(
              target === 'standalone'
                ? 'Bölüm seriden çıkarıldı; artık tekil video.'
                : 'Bölüm taşındı ve yeni serinin sıradaki numarasını aldı.',
            );
          },
        );
      }}
    >
      <select
        aria-label={`“${title}” için hedef`}
        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-text"
        onChange={(event) => setTarget(event.target.value)}
        value={target}
      >
        <option value="">Taşı…</option>
        {currentSeriesId !== null && (
          <option value="standalone">Tekil video yap (seriden çıkar)</option>
        )}
        {targets.map((option) => (
          <option key={option.id} value={option.id}>
            Seri: {option.name}
          </option>
        ))}
      </select>
      {target && (
        <button className="button" disabled={pending} type="submit">
          {pending ? 'Taşınıyor…' : 'Taşı'}
        </button>
      )}
      <ErrorText>{error}</ErrorText>
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </form>
  );
}
