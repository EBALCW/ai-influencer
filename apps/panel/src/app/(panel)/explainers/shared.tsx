'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  EPISODE_STATUS_LABELS,
  episodeLabel,
  isEpisodeStatus,
  topicKey,
} from '@ai-influencer/shared';
import {
  SUGGESTION_STATUS_LABELS,
  episodeStatusView,
  safeHttpUrl,
  type Tone,
} from '@/lib/explainer/model';

export const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text';
export const label = 'block text-xs font-medium text-muted';
export const hint = 'mt-1 block text-xs font-normal text-muted';
export const card = 'rounded-xl border border-line bg-surface-raised p-4';

const tones: Record<Tone, string> = {
  neutral: 'border-line text-text',
  attention: 'border-accent text-accent',
  progress: 'border-accent text-text',
  done: 'border-mint text-mint',
  muted: 'border-line text-muted',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Bölüm durumu: yazılı Türkçe etiket + ton (renk tek başına anlam taşımaz). */
export function StatusBadge({ status }: { status: string }) {
  const view = episodeStatusView(status);
  return (
    <Badge tone={view.tone}>
      <span className="sr-only">Durum: </span>
      {view.tone === 'progress' && <span aria-hidden="true">●</span>}
      {view.label}
    </Badge>
  );
}

/** İki kaynaktan azı olan iddia sayısı; kaynak notu hiç yoksa ayrıca söylenir. */
export function FactGapBadge({
  unsourced,
  hasNotes,
  hasScript,
}: {
  unsourced: number;
  hasNotes: boolean;
  hasScript: boolean;
}) {
  if (unsourced > 0)
    return <Badge tone="attention">⚠ {unsourced} kaynağı eksik iddia</Badge>;
  if (hasScript && !hasNotes)
    return <Badge tone="attention">⚠ Kaynak notu yok</Badge>;
  return null;
}

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});
export function formatDate(value: string) {
  return dateFormat.format(new Date(value));
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

/** API çağrısı; hata durumunda sunucunun Türkçe mesajı ve (varsa) koduyla `ApiError` fırlatır. */
export async function api<T = unknown>(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  if (!response.ok)
    throw new ApiError(
      result.error ?? 'İşlem tamamlanamadı.',
      response.status,
      result.code,
    );
  return result as T;
}

/** Form gönderimi için ortak bekleme / hata durumu. Başarıda sayfa verisi tazelenir. */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function run<T>(
    action: () => Promise<T>,
    onDone?: (result: T) => void,
  ): Promise<void> {
    setPending(true);
    setError('');
    try {
      const result = await action();
      router.refresh();
      onDone?.(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İşlem tamamlanamadı.');
    } finally {
      setPending(false);
    }
  }
  return { pending, error, setError, run };
}

export function ErrorText({ children }: { children: string }) {
  if (!children) return null;
  return (
    <p className="text-sm text-text" role="alert">
      {children}
    </p>
  );
}

/** Kullanıcının girdiği kaynak: adres yalnız http(s) ise bağlantı, değilse düz metin. */
export function SourceLink({
  source,
}: {
  source: { title?: unknown; url?: unknown; primary?: unknown };
}) {
  const href = safeHttpUrl(source.url);
  const title =
    typeof source.title === 'string' && source.title.trim()
      ? source.title.trim()
      : null;
  const text =
    title ?? (typeof source.url === 'string' ? source.url : 'Kaynak');
  return (
    <span className="break-words">
      {href ? (
        <a
          className="text-accent underline"
          href={href}
          rel="noopener noreferrer"
          target="_blank"
        >
          {text}
        </a>
      ) : (
        <span>{text}</span>
      )}
      {source.primary === true && (
        <span className="ml-1 text-xs text-muted">(birincil)</span>
      )}
    </span>
  );
}

export type SimilarTopic = {
  source: string;
  id: string;
  title: string;
  status: string;
  series_id: string | null;
  episode_number: number | null;
  match: string;
  created_at: string;
};

export async function fetchSimilar(
  title: string,
  exclude?: { episodeId?: string; suggestionId?: string },
): Promise<SimilarTopic[]> {
  if (topicKey(title) === '') return [];
  const query = new URLSearchParams({ title: title.trim().slice(0, 200) });
  if (exclude?.episodeId) query.set('exclude', exclude.episodeId);
  const { similar } = await api<{ similar: SimilarTopic[] }>(
    `/api/explainers/similar?${query}`,
  );
  return similar.filter((item) => item.id !== exclude?.suggestionId);
}

/** Başlık yazılırken (kısa gecikmeyle) benzer konuları arar. Hata olursa uyarı gösterilmez. */
export function useSimilarTopics(title: string, episodeId?: string) {
  const [similar, setSimilar] = useState<SimilarTopic[]>([]);
  const key = topicKey(title);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(
      () => {
        if (key === '') return setSimilar([]);
        fetchSimilar(title, { episodeId })
          .then((items) => {
            if (!cancelled) setSimilar(items);
          })
          .catch(() => {
            if (!cancelled) setSimilar([]);
          });
      },
      key === '' ? 0 : 400,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Anahtar aynıysa (yalnız büyük/küçük harf ya da noktalama değişti) yeniden sorulmaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, episodeId]);
  return similar;
}

function similarStatus(item: SimilarTopic) {
  if (item.source === 'episode')
    return isEpisodeStatus(item.status)
      ? EPISODE_STATUS_LABELS[item.status]
      : 'Video';
  return `Öneri · ${
    SUGGESTION_STATUS_LABELS[
      item.status as keyof typeof SUGGESTION_STATUS_LABELS
    ] ?? 'bilinmiyor'
  }`;
}

/** Engellemeyen uyarı: benzer bölüm ve öneriler (#202). */
export function SimilarTopics({ items }: { items: SimilarTopic[] }) {
  if (items.length === 0) return null;
  return (
    <div
      aria-label="Benzer konular"
      className="rounded-lg border border-accent bg-surface p-3 text-sm text-text"
      role="status"
    >
      <p className="m-0 font-medium">
        ⚠ Benzer {items.length} konu var. Engel değil; aynı videoyu iki kez
        yapmamak için bakın.
      </p>
      <ul className="mt-2 mb-0 list-none space-y-1 p-0">
        {items.map((item) => (
          <li key={`${item.source}:${item.id}`}>
            {item.source === 'episode' ? (
              <Link
                className="text-accent underline"
                href={`/explainers/episodes/${item.id}`}
              >
                {item.title}
              </Link>
            ) : (
              <span>{item.title}</span>
            )}
            <span className="text-muted">
              {' · '}
              {item.match === 'exact' ? 'aynı başlık' : 'benzer başlık'}
              {' · '}
              {similarStatus(item)}
              {item.episode_number !== null &&
                ` · ${episodeLabel(item.episode_number)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
