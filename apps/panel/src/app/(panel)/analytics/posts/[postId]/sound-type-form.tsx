'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

const options = [
  ['', 'Belirtilmemiş'],
  ['trend', 'Trend ses'],
  ['original', 'Orijinal ses'],
] as const;

/** Ses türü platform API'lerinden gelmez; ekip post detayından girer (#24/#25 segmenti). */
export function SoundTypeForm({
  postId,
  value,
  canWrite,
}: {
  postId: string;
  value: 'trend' | 'original' | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const label = options.find(([key]) => key === (value ?? ''))?.[1];

  if (!canWrite) return <span>{label}</span>;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = String(new FormData(event.currentTarget).get('soundType'));
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soundType: raw || null }),
      });
      if (!response.ok) throw new Error('Ses türü kaydedilemedi.');
      setMessage('Kaydedildi.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Ses türü kaydedilemedi.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-label="Ses türü"
      className="flex flex-wrap items-center gap-2"
      onSubmit={onSubmit}
    >
      <label className="sr-only" htmlFor="sound-type">
        Ses türü seç
      </label>
      <select
        className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-text"
        defaultValue={value ?? ''}
        id="sound-type"
        name="soundType"
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
      <button className="button button-quiet" disabled={pending} type="submit">
        {pending ? 'Kaydediliyor…' : 'Ses türünü kaydet'}
      </button>
      {message && (
        <span aria-live="polite" className="text-xs text-muted" role="status">
          {message}
        </span>
      )}
    </form>
  );
}
