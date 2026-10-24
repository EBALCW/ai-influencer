'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Learning } from '@/lib/analytics/queries';
import { formatDateTime } from '@/lib/analytics/metrics';

const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text';

/** Tarihli öğrenim notları: liste herkese, ekleme formu editor/owner'a. */
export function LearningPanel({
  learnings,
  canWrite,
  postId,
  influencerId,
  emptyHint,
}: {
  learnings: Learning[];
  canWrite: boolean;
  postId?: string;
  influencerId?: string;
  emptyHint: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const canAdd = canWrite && Boolean(postId || influencerId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const tags = String(data.get('tags') ?? '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/learnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: String(data.get('body') ?? ''),
          postId,
          influencerId: postId ? undefined : influencerId,
          tags,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          response.status === 400
            ? 'Öğrenim metni boş olamaz (en fazla 2000 karakter, 10 etiket).'
            : (result.error ?? 'Öğrenim kaydedilemedi.'),
        );
      form.reset();
      setMessage('Öğrenim kaydedildi.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Öğrenim kaydedilemedi.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="section-card" aria-labelledby="learnings-title">
      <h2 id="learnings-title" className="text-base font-semibold">
        Öğrenimler
      </h2>
      {learnings.length ? (
        <ul
          aria-label="Öğrenim listesi"
          className="mt-3 grid list-none gap-3 p-0"
        >
          {learnings.map((learning) => (
            <li
              key={learning.id}
              className="rounded-lg border border-line bg-surface-raised p-3"
            >
              <p className="whitespace-pre-wrap text-sm text-text">
                {learning.body}
              </p>
              <p className="mt-2 text-xs text-muted">
                <time dateTime={learning.created_at}>
                  {formatDateTime(learning.created_at)}
                </time>
                {learning.tags.length > 0 && ` · ${learning.tags.join(', ')}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{emptyHint}</p>
      )}
      {canAdd && (
        <form
          aria-label="Öğrenim ekle"
          className="mt-4 grid gap-3"
          onSubmit={onSubmit}
        >
          <label className="block text-xs font-medium text-muted">
            Öğrenim notu
            <textarea
              className={field}
              maxLength={2000}
              name="body"
              required
              rows={3}
            />
          </label>
          <label className="block text-xs font-medium text-muted">
            Etiketler (virgülle, isteğe bağlı)
            <input className={field} name="tags" />
          </label>
          <div className="flex items-center gap-3">
            <button
              className="button button-primary"
              disabled={pending}
              type="submit"
            >
              {pending ? 'Kaydediliyor…' : 'Öğrenim ekle'}
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
