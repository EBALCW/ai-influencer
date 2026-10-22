'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/ui';
import type { QueueItem } from '@/lib/generation-queries';
import {
  isActiveStatus,
  modeLabels,
  statusLabels,
  type GenerationMode,
} from '@/lib/generation-queue';

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

const REFRESH_MS = 10_000;

export function QueueList({
  items,
  canEdit,
  isOwner,
  inf,
}: {
  items: QueueItem[];
  canEdit: boolean;
  isOwner: boolean;
  inf: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; budget?: string }>();
  const hasActive = items.some((item) => isActiveStatus(item.status));

  // Kuyrukta iş varken liste kendini tazeler
  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [hasActive, router]);

  async function act(
    id: string,
    action: 'cancel' | 'retry',
    overrideBudget = false,
  ) {
    setBusy(id);
    setMessage(undefined);
    try {
      const res = await fetch(`/api/generations/${id}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'retry' ? { overrideBudget } : {}),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        pending?: boolean;
      };
      if (!res.ok) {
        setMessage({
          text: body.error ?? 'İşlem tamamlanamadı.',
          budget: res.status === 402 && isOwner ? id : undefined,
        });
        return;
      }
      setMessage({
        text:
          action === 'retry'
            ? 'Üretim yeniden kuyruğa alındı.'
            : body.pending
              ? 'İptal isteği gönderildi; sağlayıcıdaki iş iptal ediliyor.'
              : 'Üretim iptal edildi.',
      });
      router.refresh();
    } catch {
      setMessage({ text: 'İşlem tamamlanamadı.' });
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <section className="section-card section-empty-card">
        <EmptyState
          title="Henüz üretim yok"
          description="Prompt kütüphanesinden bir şablonu doldurup üretime gönderdiğinizde işler burada listelenir."
        />
      </section>
    );
  }

  const infQuery = inf ? `?inf=${encodeURIComponent(inf)}` : '';

  return (
    <section aria-label="Üretim kuyruğu" className="section-card space-y-3">
      {!canEdit && (
        <p className="text-sm text-muted">
          Görüntüleme yetkiniz var; iptal ve yeniden deneme editor ister.
        </p>
      )}
      {message && (
        <div className="flex flex-wrap items-center gap-3" role="status">
          <p className="text-sm text-text">{message.text}</p>
          {message.budget && (
            <button
              className="button"
              disabled={busy !== null}
              onClick={() => void act(message.budget!, 'retry', true)}
              type="button"
            >
              Bütçe onayıyla yeniden dene
            </button>
          )}
        </div>
      )}
      <ul className="space-y-2">
        {items.map((item) => {
          const title = item.promptTitle ?? 'Prompt’suz üretim';
          const label = `${title} (${dateFormat.format(new Date(item.created_at))})`;
          return (
            <li
              aria-label={label}
              className="rounded-xl border border-line p-3"
              key={item.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-text">
                    {item.prompt_id ? (
                      <Link
                        className="underline"
                        href={`/prompts/${item.prompt_id}${infQuery}`}
                      >
                        {title}
                      </Link>
                    ) : (
                      title
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {item.influencer?.name ?? 'Bilinmeyen influencer'} ·{' '}
                    {modeLabels[item.mode as GenerationMode] ?? item.mode} ·{' '}
                    <time dateTime={item.created_at}>
                      {dateFormat.format(new Date(item.created_at))}
                    </time>
                    {item.retry_of && ' · yeniden deneme'}
                    {item.credits !== null && ` · ${item.credits} kredi`}
                  </p>
                  <p className="text-sm text-text">
                    <span className="font-medium" data-status={item.status}>
                      {statusLabels[item.status]}
                    </span>
                    {item.status === 'queued' && item.attempts > 0 && (
                      <span className="text-muted">
                        {' '}
                        · deneme {item.attempts}/{item.max_attempts}
                      </span>
                    )}
                    {item.cancel_requested_at &&
                      isActiveStatus(item.status) && (
                        <span className="text-muted"> · iptal bekleniyor</span>
                      )}
                  </p>
                  {isActiveStatus(item.status) && (
                    <progress
                      aria-label={`${title} ilerleme`}
                      className="h-2 w-48"
                      max={100}
                      value={item.progress}
                    />
                  )}
                  {item.error && (
                    <p className="text-xs text-muted">Hata: {item.error}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {item.status === 'succeeded' &&
                    item.output_asset_id &&
                    item.influencer && (
                      <Link
                        className="text-xs text-accent-strong underline"
                        href={`/influencers/${item.influencer.slug}/assets${infQuery}`}
                      >
                        Medya kütüphanesinde gör
                      </Link>
                    )}
                  {canEdit && isActiveStatus(item.status) && (
                    <button
                      aria-label={`${label} üretimini iptal et`}
                      className="button"
                      disabled={busy !== null || !!item.cancel_requested_at}
                      onClick={() => void act(item.id, 'cancel')}
                      type="button"
                    >
                      İptal et
                    </button>
                  )}
                  {canEdit &&
                    (item.status === 'failed' ||
                      item.status === 'cancelled') && (
                      <button
                        aria-label={`${label} üretimini yeniden dene`}
                        className="button"
                        disabled={busy !== null}
                        onClick={() => void act(item.id, 'retry')}
                        type="button"
                      >
                        Yeniden dene
                      </button>
                    )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
