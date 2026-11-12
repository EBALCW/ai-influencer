'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useState, type FormEvent } from 'react';
import { Film, Plus, Scissors, Send, ShieldCheck } from 'lucide-react';
import { ConfirmDialog, EmptyState, StatCard, Toast } from '@/components/ui';
import type {
  ClipInfluencer,
  ClipItem,
  ClipSourceItem,
  ClipsWorkspace,
} from '@/lib/clips/queries';
import {
  clipSchema,
  clipSourcePatchSchema,
  clipSourceSchema,
  clipStatuses,
  clipStatusLabels,
  MAX_CLIP_SECONDS,
  permissionLabels,
  permissionStatuses,
} from '@/lib/clips/schemas';
import {
  clipUrl,
  formatTimestamp,
  parseTimestamp,
  parseYouTubeVideoId,
} from '@/lib/clips/youtube';

const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text';
const label = 'block text-xs font-medium text-muted';
const badge =
  'inline-flex items-center rounded-full border border-line px-2 py-1 text-xs font-medium text-text';

type Done = (message: string) => void;
type Open =
  | { kind: 'source' }
  | { kind: 'permission' | 'clip' | 'delete-source'; sourceId: string }
  | { kind: 'backlog' | 'delete-clip'; clipId: string }
  | null;

/** API çağrısı; hata durumunda sunucunun mesajıyla `Error` fırlatır. */
async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  if (response.ok) return;
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  throw new Error(result.error ?? 'İşlem tamamlanamadı.');
}

/** Form gönderimi için ortak bekleme/hata durumu. */
function useSubmit(onDone: Done) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => Promise<void>, message: string) {
    setPending(true);
    setError('');
    try {
      await action();
      router.refresh();
      onDone(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'İşlem tamamlanamadı.');
    } finally {
      setPending(false);
    }
  }
  return { pending, error, setError, run };
}

function FormActions({
  pending,
  error,
  submitLabel,
  onCancel,
  disabled,
}: {
  pending: boolean;
  error: string;
  submitLabel: string;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
      <button
        className="button button-primary"
        disabled={pending || disabled}
        type="submit"
      >
        {pending ? 'Kaydediliyor…' : submitLabel}
      </button>
      <button className="button button-quiet" onClick={onCancel} type="button">
        Vazgeç
      </button>
      {error && (
        <p className="text-sm text-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SourceForm({ onDone }: { onDone: Done }) {
  const { pending, error, setError, run } = useSubmit(onDone);
  const [url, setUrl] = useState('');
  const videoId = url ? parseYouTubeVideoId(url) : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '');
    const rawDuration = text('duration').trim();
    const duration = rawDuration ? parseTimestamp(rawDuration) : null;
    if (rawDuration && duration === null)
      return setError('Video süresini dk:sn veya sa:dk:sn olarak girin.');
    const input = {
      video_url: text('video_url'),
      channel_name: text('channel_name'),
      channel_url: text('channel_url'),
      title: text('title'),
      duration_seconds: duration,
      notes: text('notes'),
    };
    const parsed = clipSourceSchema.safeParse(input);
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? 'Form geçersiz.');
    void run(
      () => send('/api/clip-sources', 'POST', input),
      'Kaynak eklendi. Klip aktarmak için izin durumunu işaretleyin.',
    );
  }

  return (
    <form
      aria-label="Kaynak ekle"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={onSubmit}
    >
      <label className={`${label} sm:col-span-2`}>
        YouTube linki
        <input
          className={field}
          maxLength={500}
          name="video_url"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          required
          value={url}
        />
        <span aria-live="polite" className="mt-1 block">
          {videoId
            ? `Video id: ${videoId}`
            : url
              ? 'Bu linkten video id bulunamadı.'
              : 'Video id linkten çıkarılır.'}
        </span>
      </label>
      <label className={label}>
        Video süresi (isteğe bağlı)
        <input
          className={field}
          inputMode="numeric"
          name="duration"
          placeholder="sa:dk:sn"
        />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Video başlığı
        <input className={field} maxLength={300} name="title" required />
      </label>
      <label className={label}>
        Kanal adı
        <input className={field} maxLength={200} name="channel_name" required />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Kanal linki (isteğe bağlı)
        <input
          className={field}
          maxLength={300}
          name="channel_url"
          placeholder="https://www.youtube.com/@…"
        />
      </label>
      <label className={`${label} sm:col-span-2 lg:col-span-3`}>
        Not
        <textarea className={field} maxLength={3000} name="notes" rows={2} />
      </label>
      <FormActions
        error={error}
        onCancel={() => onDone('')}
        pending={pending}
        submitLabel="Kaynağı kaydet"
      />
    </form>
  );
}

function PermissionForm({
  source,
  onDone,
}: {
  source: ClipSourceItem;
  onDone: Done;
}) {
  const { pending, error, setError, run } = useSubmit(onDone);
  const [status, setStatus] = useState(source.permission_status);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      permission_status: status,
      permission_ref: String(data.get('permission_ref') ?? ''),
    };
    const parsed = clipSourcePatchSchema.safeParse(input);
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? 'Form geçersiz.');
    void run(
      () => send(`/api/clip-sources/${source.id}`, 'PATCH', parsed.data),
      'İzin durumu kaydedildi.',
    );
  }

  return (
    <form
      aria-label="İzni işaretle"
      className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={onSubmit}
    >
      <label className={label}>
        İzin durumu
        <select
          className={field}
          onChange={(event) =>
            setStatus(event.target.value as typeof source.permission_status)
          }
          value={status}
        >
          {permissionStatuses.map((item) => (
            <option key={item} value={item}>
              {permissionLabels[item]}
            </option>
          ))}
        </select>
      </label>
      <label className={`${label} sm:col-span-1 lg:col-span-2`}>
        İzin referansı{status === 'granted' ? ' (zorunlu)' : ''}
        <input
          className={field}
          defaultValue={source.permission_ref}
          maxLength={200}
          name="permission_ref"
          placeholder="ör. IZIN-2026-001"
          required={status === 'granted'}
        />
        <span className="mt-1 block">
          Yalnız kısıtlı depodaki izin belgesinin kısa kodu. E-posta, ad veya
          yazışma yazmayın.
        </span>
      </label>
      <FormActions
        error={error}
        onCancel={() => onDone('')}
        pending={pending}
        submitLabel="İzni kaydet"
      />
    </form>
  );
}

function ClipForm({
  source,
  influencers,
  defaultInfluencerId,
  onDone,
}: {
  source: ClipSourceItem;
  influencers: ClipInfluencer[];
  defaultInfluencerId?: string;
  onDone: Done;
}) {
  const { pending, error, setError, run } = useSubmit(onDone);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '');
    const start = parseTimestamp(text('start'));
    const end = parseTimestamp(text('end'));
    if (start === null || end === null)
      return setError('Başlangıç ve bitişi dk:sn olarak girin (ör. 12:05).');
    if (source.duration_seconds !== null && end > source.duration_seconds)
      return setError(
        `Bitiş video süresini (${formatTimestamp(source.duration_seconds)}) aşamaz.`,
      );
    const parsed = clipSchema.safeParse({
      source_id: source.id,
      influencer_id: text('influencer_id') || null,
      title: text('title'),
      hook: text('hook'),
      start_seconds: start,
      end_seconds: end,
      notes: text('notes'),
    });
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? 'Form geçersiz.');
    void run(
      () => send('/api/clips', 'POST', parsed.data),
      'Klip adayı eklendi.',
    );
  }

  return (
    <form
      aria-label="Klip ekle"
      className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={onSubmit}
    >
      <label className={`${label} sm:col-span-2 lg:col-span-1`}>
        Klip başlığı
        <input className={field} maxLength={200} name="title" required />
      </label>
      <label className={label}>
        Başlangıç (dk:sn)
        <input
          className={field}
          inputMode="numeric"
          name="start"
          placeholder="12:05"
          required
        />
      </label>
      <label className={label}>
        Bitiş (dk:sn)
        <input
          className={field}
          inputMode="numeric"
          name="end"
          placeholder="13:00"
          required
        />
        <span className="mt-1 block">
          En fazla {MAX_CLIP_SECONDS} sn
          {source.duration_seconds !== null
            ? ` · video ${formatTimestamp(source.duration_seconds)}`
            : ''}
        </span>
      </label>
      <label className={`${label} sm:col-span-2`}>
        Kanca (isteğe bağlı)
        <input className={field} maxLength={500} name="hook" />
      </label>
      <label className={label}>
        Influencer
        <select
          className={field}
          defaultValue={defaultInfluencerId ?? ''}
          name="influencer_id"
        >
          <option value="">Atanmadı</option>
          {influencers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className={`${label} sm:col-span-2 lg:col-span-3`}>
        Not
        <textarea className={field} maxLength={3000} name="notes" rows={2} />
      </label>
      <FormActions
        error={error}
        onCancel={() => onDone('')}
        pending={pending}
        submitLabel="Klibi kaydet"
      />
    </form>
  );
}

function BacklogPanel({
  clip,
  influencers,
  defaultInfluencerId,
  onDone,
}: {
  clip: ClipItem;
  influencers: ClipInfluencer[];
  defaultInfluencerId?: string;
  onDone: Done;
}) {
  const { pending, error, run } = useSubmit(onDone);
  const fixed = clip.influencer_id;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(
      () =>
        send(`/api/clips/${clip.id}/backlog`, 'POST', {
          influencer_id: fixed
            ? null
            : String(data.get('influencer_id') || '') || null,
        }),
      'Klip içerik backlog’una (Fikir sütunu) aktarıldı.',
    );
  }

  return (
    <form
      aria-label="Backlog'a aktar"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={onSubmit}
    >
      <label className={label}>
        Influencer
        {fixed ? (
          <input
            className={field}
            disabled
            value={clip.influencer?.name ?? 'Atanmış influencer'}
          />
        ) : (
          <select
            className={field}
            defaultValue={defaultInfluencerId ?? influencers[0]?.id}
            name="influencer_id"
            required
          >
            {influencers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </label>
      <p className="self-end text-sm text-muted sm:col-span-1 lg:col-span-2">
        Kart “üçüncü kişi” kaynak türüyle, kanal adı ve izin referansıyla
        açılır.
      </p>
      <FormActions
        disabled={!fixed && !influencers.length}
        error={error}
        onCancel={() => onDone('')}
        pending={pending}
        submitLabel="Fikir kartı oluştur"
      />
    </form>
  );
}

export function ClipsView({
  workspace,
  canWrite,
}: {
  workspace: ClipsWorkspace;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { sources, influencers, selected } = workspace;
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);
  const done: Done = (message) => {
    setOpen(null);
    if (message) setToast({ message, tone: 'success' });
  };
  /** Form dışı tek adımlı işlemler (durum değişikliği, silme). */
  async function act(action: () => Promise<void>, message: string) {
    setBusy(true);
    try {
      await action();
      router.refresh();
      setToast({ message, tone: 'success' });
    } catch (cause) {
      setToast({
        message:
          cause instanceof Error ? cause.message : 'İşlem tamamlanamadı.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
      setOpen(null);
    }
  }

  const clips = sources.flatMap((source) => source.clips);
  const deletingSource =
    open?.kind === 'delete-source'
      ? sources.find((item) => item.id === open.sourceId)
      : undefined;
  const deletingClip =
    open?.kind === 'delete-clip'
      ? clips.find((item) => item.id === open.clipId)
      : undefined;
  const contentHref = (slug?: string) =>
    slug ? `/content?inf=${encodeURIComponent(slug)}` : '/content';

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YAYIN</p>
          <h1>Klipler</h1>
          <p>
            Yayıncı videoları, izin durumu ve klip adayları. Yalnız izni
            verilmiş kaynağın klibi içerik backlog’una aktarılır; video dosyası
            panele yüklenmez.
          </p>
        </div>
        {canWrite && (
          <button
            className="button button-primary"
            onClick={() => setOpen({ kind: 'source' })}
            type="button"
          >
            <Plus size={16} /> Yeni kaynak
          </button>
        )}
      </header>

      {toast && (
        <Toast
          message={toast.message}
          onDismiss={() => setToast(null)}
          tone={toast.tone}
        />
      )}

      <section aria-label="Klip özeti" className="stats-grid">
        <StatCard
          detail="Yayıncı videosu"
          icon={Film}
          label="Kaynak"
          value={String(sources.length)}
        />
        <StatCard
          detail="Aktarıma açık kaynak"
          icon={ShieldCheck}
          label="İzin verildi"
          tone="mint"
          value={String(
            sources.filter((item) => item.permission_status === 'granted')
              .length,
          )}
        />
        <StatCard
          detail="Tüm durumlar"
          icon={Scissors}
          label="Klip"
          tone="blue"
          value={String(clips.length)}
        />
        <StatCard
          detail="Fikir kartı açıldı"
          icon={Send}
          label="Backlog’da"
          value={String(clips.filter((item) => item.content_item_id).length)}
        />
      </section>

      {canWrite && open?.kind === 'source' && (
        <section aria-labelledby="source-form-title" className="section-card">
          <h2 className="mb-3 text-base font-semibold" id="source-form-title">
            Yeni kaynak
          </h2>
          <SourceForm onDone={done} />
        </section>
      )}

      {sources.length === 0 ? (
        <section className="section-card">
          <EmptyState
            description={
              canWrite
                ? 'Henüz kaynak yok. “Yeni kaynak” ile bir YouTube videosu ekleyin, izni işaretleyin ve klip adaylarını girin.'
                : 'Henüz kaynak eklenmedi.'
            }
            title="Klip kaynağı bulunamadı"
          />
        </section>
      ) : (
        sources.map((source) => {
          const granted = source.permission_status === 'granted';
          const noteId = `permission-note-${source.id}`;
          return (
            <article
              aria-label={`Kaynak: ${source.title}`}
              className="section-card"
              key={source.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">
                    <a
                      className="underline"
                      href={source.video_url}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                    >
                      {source.title}
                    </a>
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    YouTube ·{' '}
                    {source.channel_url ? (
                      <a
                        className="underline"
                        href={source.channel_url}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                      >
                        {source.channel_name}
                      </a>
                    ) : (
                      source.channel_name
                    )}
                    {source.duration_seconds !== null
                      ? ` · ${formatTimestamp(source.duration_seconds)}`
                      : ''}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                    <span className={badge}>
                      {permissionLabels[source.permission_status]}
                    </span>
                    {source.permission_ref && (
                      <span>Referans: {source.permission_ref}</span>
                    )}
                    {source.permission_checked_at && (
                      <span>
                        Kayıt: {source.permission_checked_at.slice(0, 10)}
                      </span>
                    )}
                  </p>
                  {source.notes && (
                    <p className="mt-2 text-sm text-muted">{source.notes}</p>
                  )}
                </div>
                {canWrite && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      aria-label={`İzni işaretle: ${source.title}`}
                      className="button button-quiet"
                      onClick={() =>
                        setOpen({ kind: 'permission', sourceId: source.id })
                      }
                      type="button"
                    >
                      İzni işaretle
                    </button>
                    <button
                      aria-label={`Klip ekle: ${source.title}`}
                      className="button button-primary"
                      onClick={() =>
                        setOpen({ kind: 'clip', sourceId: source.id })
                      }
                      type="button"
                    >
                      <Plus size={16} /> Klip ekle
                    </button>
                    <button
                      aria-label={`Kaynağı sil: ${source.title}`}
                      className="button button-quiet"
                      onClick={() =>
                        setOpen({ kind: 'delete-source', sourceId: source.id })
                      }
                      type="button"
                    >
                      Sil
                    </button>
                  </div>
                )}
              </div>

              {canWrite &&
                open?.kind === 'permission' &&
                open.sourceId === source.id && (
                  <PermissionForm onDone={done} source={source} />
                )}
              {canWrite &&
                open?.kind === 'clip' &&
                open.sourceId === source.id && (
                  <ClipForm
                    defaultInfluencerId={selected?.id}
                    influencers={influencers}
                    onDone={done}
                    source={source}
                  />
                )}

              {!granted && (
                <p className="mt-3 text-sm text-muted" id={noteId}>
                  Backlog’a aktarmak için kaynağın izni verilmiş olarak
                  işaretlenmeli.
                </p>
              )}

              {source.clips.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Bu kaynakta henüz klip adayı yok.
                </p>
              ) : (
                <div className="table-scroll mt-3">
                  <table
                    aria-label={`Klipler: ${source.title}`}
                    className="data-table"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Aralık</th>
                        <th scope="col">Klip</th>
                        <th scope="col">Influencer</th>
                        <th scope="col">Durum</th>
                        <th scope="col">Backlog</th>
                      </tr>
                    </thead>
                    <tbody>
                      {source.clips.map((clip) => (
                        <Fragment key={clip.id}>
                          <tr>
                            <td className="whitespace-nowrap">
                              <a
                                className="underline"
                                href={clipUrl(
                                  source.video_url,
                                  clip.start_seconds,
                                )}
                                rel="noopener noreferrer nofollow"
                                target="_blank"
                              >
                                {formatTimestamp(clip.start_seconds)}–
                                {formatTimestamp(clip.end_seconds)}
                              </a>
                              <div className="text-xs text-muted">
                                {clip.end_seconds - clip.start_seconds} sn
                              </div>
                            </td>
                            <td className="max-w-xs">
                              <strong>{clip.title}</strong>
                              {clip.hook && (
                                <div className="text-xs text-muted">
                                  Kanca: {clip.hook}
                                </div>
                              )}
                              {clip.notes && (
                                <div className="text-xs text-muted">
                                  {clip.notes}
                                </div>
                              )}
                            </td>
                            <td>{clip.influencer?.name ?? 'Atanmadı'}</td>
                            <td>
                              {canWrite ? (
                                <select
                                  aria-label={`Durum: ${clip.title}`}
                                  className={field}
                                  disabled={busy}
                                  onChange={(event) =>
                                    void act(
                                      () =>
                                        send(`/api/clips/${clip.id}`, 'PATCH', {
                                          status: event.target.value,
                                        }),
                                      'Klip durumu güncellendi.',
                                    )
                                  }
                                  value={clip.status}
                                >
                                  {clipStatuses.map((item) => (
                                    <option key={item} value={item}>
                                      {clipStatusLabels[item]}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                clipStatusLabels[clip.status]
                              )}
                            </td>
                            <td>
                              <div className="flex flex-wrap items-center gap-2">
                                {clip.content_item_id ? (
                                  <Link
                                    className="text-sm underline"
                                    href={contentHref(
                                      clip.influencer?.slug ?? selected?.slug,
                                    )}
                                  >
                                    İçerik kartına git
                                  </Link>
                                ) : (
                                  canWrite &&
                                  clip.status !== 'rejected' && (
                                    <button
                                      aria-describedby={
                                        granted ? undefined : noteId
                                      }
                                      aria-label={`Backlog'a aktar: ${clip.title}`}
                                      className="button button-primary"
                                      disabled={!granted}
                                      onClick={() =>
                                        setOpen({
                                          kind: 'backlog',
                                          clipId: clip.id,
                                        })
                                      }
                                      type="button"
                                    >
                                      Backlog’a aktar
                                    </button>
                                  )
                                )}
                                {canWrite && (
                                  <button
                                    aria-label={`Klibi sil: ${clip.title}`}
                                    className="button button-quiet"
                                    onClick={() =>
                                      setOpen({
                                        kind: 'delete-clip',
                                        clipId: clip.id,
                                      })
                                    }
                                    type="button"
                                  >
                                    Sil
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {canWrite &&
                            open?.kind === 'backlog' &&
                            open.clipId === clip.id && (
                              <tr>
                                <td colSpan={5}>
                                  <BacklogPanel
                                    clip={clip}
                                    defaultInfluencerId={selected?.id}
                                    influencers={influencers}
                                    onDone={done}
                                  />
                                </td>
                              </tr>
                            )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })
      )}
      {workspace.truncated && (
        <p className="text-sm text-muted">
          İlk {sources.length} kaynak gösteriliyor.
        </p>
      )}

      <ConfirmDialog
        confirmLabel="Kaynağı sil"
        description={`“${deletingSource?.title ?? ''}” ve klip adayları silinir. Backlog’a aktarılmış içerik kartları silinmez.`}
        onCancel={() => setOpen(null)}
        onConfirm={() => {
          if (deletingSource)
            void act(
              () => send(`/api/clip-sources/${deletingSource.id}`, 'DELETE'),
              'Kaynak silindi.',
            );
        }}
        open={!!deletingSource}
        title="Kaynak silinsin mi?"
      />
      <ConfirmDialog
        confirmLabel="Klibi sil"
        description={`“${deletingClip?.title ?? ''}” silinir. Backlog’a aktarılmış içerik kartı silinmez.`}
        onCancel={() => setOpen(null)}
        onConfirm={() => {
          if (deletingClip)
            void act(
              () => send(`/api/clips/${deletingClip.id}`, 'DELETE'),
              'Klip silindi.',
            );
        }}
        open={!!deletingClip}
        title="Klip silinsin mi?"
      />
    </div>
  );
}
