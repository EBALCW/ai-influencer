'use client';
import { AiSuggestion, suggestionText } from '@/components/ai-suggestion';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { EmptyState, Toast } from '@/components/ui';
import { checklistGroups, readChecklist } from '@/lib/content/checklist-schema';
import { contentSchema, type ContentInput } from '@/lib/content/schemas';
import { localInput, localToIso } from '@/lib/content/schedule-rules';
import { stages, type ContentStage } from '@/lib/content/stage-rules';
import type { ContentCard, ContentWorkspace } from '@/lib/content/queries';

export const fieldClass =
  'mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-70';
export const labelClass = 'block text-sm text-muted';
export function contentHref(
  path: string,
  slug: string,
  params: Record<string, string> = {},
) {
  const query = new URLSearchParams(params);
  if (slug) query.set('inf', slug);
  return `${path}${query.size ? `?${query}` : ''}`;
}
export async function contentRequest(
  url: string,
  method: string,
  values?: unknown,
) {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(values !== undefined ? { body: JSON.stringify(values) } : {}),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'İşlem tamamlanamadı.');
}
export function ContentPagination({
  workspace,
  path,
  params = {},
}: {
  workspace: ContentWorkspace;
  path: string;
  params?: Record<string, string>;
}) {
  return (
    <nav
      aria-label="İçerik sayfaları"
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted"
    >
      <span>
        {workspace.count} kayıt · sayfa {workspace.page} /{' '}
        {Math.max(1, Math.ceil(workspace.count / 100))}
      </span>
      <div className="flex gap-2">
        {workspace.page > 1 && (
          <Link
            className="button"
            href={contentHref(path, workspace.slug, {
              ...params,
              page: String(workspace.page - 1),
            })}
          >
            Önceki kayıtlar
          </Link>
        )}
        {workspace.page * 100 < workspace.count && (
          <Link
            className="button"
            href={contentHref(path, workspace.slug, {
              ...params,
              page: String(workspace.page + 1),
            })}
          >
            Sonraki kayıtlar
          </Link>
        )}
      </div>
    </nav>
  );
}
export function ContentBoard({ workspace }: { workspace: ContentWorkspace }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<ContentCard | null | undefined>(
    undefined,
  );
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const canEdit = workspace.role !== 'viewer';
  const pending = busy || refreshing;
  async function mutate(url: string, method: string, values: unknown) {
    setBusy(true);
    setMessage(null);
    try {
      await contentRequest(url, method, values);
      setMessage({ text: 'İçerik güncellendi.', error: false });
      startTransition(() => router.refresh());
      return true;
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : 'İşlem tamamlanamadı.',
        error: true,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function move(item: ContentCard, stage: ContentStage) {
    if (!canEdit || pending) return;
    const order = Math.min(
      2147483647,
      Math.max(
        0,
        ...workspace.items
          .filter((i) => i.stage === stage)
          .map((i) => i.sort_order),
      ) + 1,
    );
    await mutate(`/api/content-items/${item.id}`, 'PATCH', {
      stage,
      sort_order: order,
      expected_updated_at: item.updated_at,
    });
  }
  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">İÇERİK OPERASYONU</p>
          <h1>İçerik akışı</h1>
          <p>
            Fikri geliştirin, yayın kontrollerini tamamlayın ve hesabın yayın
            planına taşıyın.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="button"
            href={contentHref('/calendar', workspace.slug)}
          >
            Yayın takvimi
          </Link>
          {canEdit && workspace.influencers.length > 0 && (
            <button
              className="button button-primary"
              onClick={() => setEditing(null)}
              type="button"
            >
              Yeni içerik
            </button>
          )}
        </div>
      </header>
      {message && (
        <Toast
          message={message.text}
          tone={message.error ? 'error' : 'success'}
          onDismiss={() => setMessage(null)}
        />
      )}
      {editing !== undefined && (
        <ContentEditor
          key={editing?.id ?? 'new'}
          workspace={workspace}
          item={editing}
          pending={pending}
          onClose={() => setEditing(undefined)}
          onSave={async (values) => {
            const ok = await mutate(
              editing
                ? `/api/content-items/${editing.id}`
                : '/api/content-items',
              editing ? 'PATCH' : 'POST',
              values,
            );
            if (ok) setEditing(undefined);
          }}
        />
      )}
      {!canEdit && (
        <p className="text-sm text-muted">
          Salt okunur görünüm. İçerikleri ve yayın kontrollerini
          inceleyebilirsiniz.
        </p>
      )}
      <div
        className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7"
        aria-label="Aşama özeti"
      >
        {stages.map(([key, label]) => (
          <div
            className="rounded-xl border border-line bg-surface p-3"
            key={key}
          >
            <span className="text-xs text-muted">{label}</span>
            <strong className="mt-1 block text-xl">
              {workspace.items.filter((item) => item.stage === key).length}
            </strong>
          </div>
        ))}
      </div>
      {workspace.count === 0 && (
        <EmptyState
          title="Henüz içerik yok"
          description={
            workspace.influencers.length
              ? 'Bir trend bağlantısıyla başlayın veya ilk içerik fikrinizi ekleyin.'
              : 'İçerik eklemek için önce bir influencer oluşturun.'
          }
          action={
            canEdit && workspace.influencers.length === 0 ? (
              <Link className="button" href="/influencers/new">
                Influencer oluştur
              </Link>
            ) : undefined
          }
        />
      )}
      <div className="overflow-x-auto pb-3" aria-busy={pending}>
        <div className="grid min-w-[1540px] grid-cols-7 gap-3">
          {stages.map(([stage, label]) => (
            <section
              key={stage}
              aria-label={`${label} sütunu`}
              className="min-h-64 rounded-2xl border border-line bg-surface-raised p-3"
              onDragOver={(event) => {
                if (canEdit && !pending) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData(
                  'application/x-content-id',
                );
                const item = workspace.items.find((i) => i.id === id);
                if (item) void move(item, stage);
              }}
            >
              <h2 className="mb-3 text-sm font-semibold">{label}</h2>
              <div className="space-y-3">
                {workspace.items
                  .filter((item) => item.stage === stage)
                  .map((item) => (
                    <article
                      key={item.id}
                      data-testid={`content-card-${item.id}`}
                      draggable={canEdit && !pending}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          'application/x-content-id',
                          item.id,
                        );
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      className="rounded-xl border border-line bg-surface p-3 text-sm shadow-sm"
                    >
                      <button
                        className="text-left font-semibold text-text hover:underline"
                        onClick={() => setEditing(item)}
                        type="button"
                      >
                        {item.title}
                      </button>
                      <p className="mt-2 text-xs text-muted">
                        {item.format}{' '}
                        {item.hook_type ? `· ${item.hook_type}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {workspace.accounts.find(
                          (a) => a.id === item.target_account_id,
                        )?.handle ?? 'Hedef hesap seçilmedi'}
                      </p>
                      {item.assignee_id && (
                        <p className="mt-1 text-xs text-muted">
                          Sorumlu: {item.assignee_id.slice(0, 8)}
                        </p>
                      )}
                      {item.scheduled_at && (
                        <p className="mt-2 text-xs">
                          {localInput(item.scheduled_at, item.timezone).replace(
                            'T',
                            ' ',
                          )}{' '}
                          · {item.timezone}
                        </p>
                      )}
                      {item.source_url && (
                        <a
                          className="mt-2 block text-xs text-accent underline"
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Kaynak trend
                        </a>
                      )}
                      <p className="mt-2 text-xs text-muted">
                        {item.details.asset_ids.length} asset ·{' '}
                        {item.details.generation_ids.length} üretim
                      </p>
                      {item.details.warnings.map((w) => (
                        <p
                          className="mt-2 rounded-lg border border-line p-2 text-xs"
                          role="status"
                          key={w}
                        >
                          {w}
                        </p>
                      ))}
                      {item.details.posts.map((post) => (
                        <p key={post.id} className="mt-2 text-xs">
                          İzlenme:{' '}
                          {post.views?.toLocaleString('tr-TR') ??
                            'Henüz ölçülmedi'}
                          {post.url && /^https?:\/\//i.test(post.url) && (
                            <a
                              className="ml-2 text-accent underline"
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Post
                            </a>
                          )}
                        </p>
                      ))}
                      <label className="mt-3 block text-xs text-muted">
                        Aşamayı değiştir
                        <select
                          aria-label={`${item.title} aşaması`}
                          className={fieldClass}
                          value={item.stage}
                          disabled={!canEdit || pending}
                          onChange={(event) =>
                            void move(item, event.target.value as ContentStage)
                          }
                        >
                          {stages.map(([key, text]) => (
                            <option key={key} value={key}>
                              {text}
                            </option>
                          ))}
                        </select>
                      </label>
                      {canEdit && item.target_account_id && (
                        <details className="mt-3 text-xs">
                          <summary className="cursor-pointer text-accent">
                            Yayınlanmış postu eşleştir
                          </summary>
                          <form
                            className="mt-2 space-y-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const fd = new FormData(event.currentTarget);
                              void mutate(
                                `/api/content-items/${item.id}/post`,
                                'POST',
                                { post_id: fd.get('post_id') },
                              );
                            }}
                          >
                            <label>
                              Yayınlanmış post
                              <select
                                aria-label={`${item.title} postu`}
                                className={fieldClass}
                                name="post_id"
                                required
                                defaultValue=""
                              >
                                <option value="" disabled>
                                  Post seçin
                                </option>
                                {workspace.posts
                                  .filter(
                                    (p) =>
                                      p.account_id === item.target_account_id &&
                                      (!p.content_item_id ||
                                        p.content_item_id === item.id),
                                  )
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.published_at?.slice(0, 16)} ·{' '}
                                      {p.id.slice(0, 8)}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <button
                              className="button"
                              disabled={pending}
                              type="submit"
                            >
                              Eşleştir ve yayında yap
                            </button>
                          </form>
                          <p className="mt-2 text-muted">
                            Önce kartın checklist’ini kaydedin. Son 200
                            yayınlanmış post listelenir.
                          </p>
                        </details>
                      )}
                    </article>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <ContentPagination workspace={workspace} path="/content" />
    </div>
  );
}

function ContentEditor({
  workspace,
  item,
  pending,
  onClose,
  onSave,
}: {
  workspace: ContentWorkspace;
  item: ContentCard | null;
  pending: boolean;
  onClose: () => void;
  onSave: (values: unknown) => Promise<void>;
}) {
  const selectedInfluencer =
    workspace.influencers.find((i) => i.slug === workspace.slug)?.id ?? '';
  const [values, setValues] = useState<ContentInput>(() => {
    const initial = contentSchema.parse(
      item
        ? {
            ...item,
            checklist: readChecklist(item.checklist),
            asset_ids: item.details.asset_ids,
            generation_ids: item.details.generation_ids,
          }
        : {
            influencer_id:
              selectedInfluencer ||
              workspace.influencers[0]?.id ||
              '00000000-0000-0000-0000-000000000000',
            title: 'Yeni içerik',
          },
    );
    return item ? initial : { ...initial, title: '' };
  });
  const [date, setDate] = useState(
    item?.scheduled_at ? localInput(item.scheduled_at, item.timezone) : '',
  );
  const [error, setError] = useState('');
  const readonly = workspace.role === 'viewer';
  const set = <K extends keyof ContentInput>(key: K, value: ContentInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  function toggle(
    key: 'asset_ids' | 'generation_ids',
    id: string,
    checked: boolean,
  ) {
    set(
      key,
      checked
        ? [...(values[key] ?? []), id]
        : (values[key] ?? []).filter((x) => x !== id),
    );
  }
  return (
    <section
      className="section-card space-y-4"
      aria-label={item ? 'İçerik düzenleme' : 'Yeni içerik formu'}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {item ? 'İçerik ayrıntıları' : 'Yeni içerik fikri'}
        </h2>
        <button className="button" onClick={onClose} type="button">
          Kapat
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-text">
          {error}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          try {
            const parsed = contentSchema.safeParse({
              ...values,
              scheduled_at: date ? localToIso(date, values.timezone) : null,
            });
            if (!parsed.success) {
              setError('Alanları ve yayın checklist’ini kontrol edin.');
              return;
            }
            void onSave({
              ...parsed.data,
              ...(item ? { expected_updated_at: item.updated_at } : {}),
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Tarih geçersiz.');
          }
        }}
      >
        <fieldset disabled={readonly || pending} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={labelClass}>
              Başlık
              <input
                className={fieldClass}
                value={values.title}
                required
                maxLength={200}
                onChange={(e) => set('title', e.target.value)}
              />
            </label>
            <label className={labelClass}>
              Influencer
              <select
                aria-label="Influencer"
                className={fieldClass}
                value={values.influencer_id}
                disabled={!!item}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    influencer_id: e.target.value,
                    target_account_id: null,
                    asset_ids: [],
                    generation_ids: [],
                  }))
                }
              >
                {workspace.influencers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Format
              <input
                className={fieldClass}
                required
                maxLength={60}
                value={values.format}
                onChange={(e) => set('format', e.target.value)}
              />
            </label>
            <label className={labelClass}>
              Kanca türü
              <input
                className={fieldClass}
                maxLength={200}
                value={values.hook_type ?? ''}
                onChange={(e) => set('hook_type', e.target.value || null)}
              />
            </label>
            <label className={labelClass}>
              Aşama
              <select
                aria-label="Aşama"
                className={fieldClass}
                value={values.stage}
                onChange={(e) => set('stage', e.target.value as ContentStage)}
              >
                {stages.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Sorumlu
              <select
                aria-label="Sorumlu"
                className={fieldClass}
                value={values.assignee_id ?? ''}
                onChange={(e) => set('assignee_id', e.target.value || null)}
              >
                <option value="">Atanmadı</option>
                {workspace.members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.role} · {m.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Hedef hesap
              <select
                aria-label="Hedef hesap"
                className={fieldClass}
                value={values.target_account_id ?? ''}
                onChange={(e) =>
                  set('target_account_id', e.target.value || null)
                }
              >
                <option value="">Seçin</option>
                {workspace.accounts
                  .filter((a) => a.influencer_id === values.influencer_id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.platform} · {a.handle}
                    </option>
                  ))}
              </select>
            </label>
            <label className={labelClass}>
              Yayın zamanı
              <input
                className={fieldClass}
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className={labelClass}>
              Saat dilimi
              <input
                className={fieldClass}
                required
                value={values.timezone}
                onChange={(e) => set('timezone', e.target.value)}
                placeholder="Europe/Istanbul"
              />
            </label>
            <label className={labelClass}>
              Kaynak trend bağlantısı
              <input
                className={fieldClass}
                type="url"
                maxLength={2000}
                value={values.source_url}
                onChange={(e) => set('source_url', e.target.value)}
              />
            </label>
            <label className={labelClass}>
              Kaynak izlenme
              <input
                className={fieldClass}
                type="number"
                min={0}
                step={1}
                max={Number.MAX_SAFE_INTEGER}
                value={values.source_views ?? ''}
                onChange={(e) =>
                  set(
                    'source_views',
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
              />
            </label>
            <label className={labelClass}>
              Uyarlama puanı (1–5)
              <input
                className={fieldClass}
                type="number"
                min={1}
                max={5}
                value={values.adaptation_score ?? ''}
                onChange={(e) =>
                  set(
                    'adaptation_score',
                    e.target.value === '' ? null : Number(e.target.value),
                  )
                }
              />
            </label>
            <label className={labelClass}>
              Sütun içi sıra
              <input
                className={fieldClass}
                type="number"
                min={0}
                step={1}
                value={values.sort_order}
                onChange={(e) => set('sort_order', Number(e.target.value))}
              />
            </label>
          </div>
          <label className={labelClass}>
            Neden viral?
            <textarea
              className={fieldClass}
              maxLength={3000}
              value={values.viral_reason}
              onChange={(e) => set('viral_reason', e.target.value)}
            />
          </label>
          <label className={labelClass}>
            Notlar
            <textarea
              className={fieldClass}
              maxLength={10000}
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            {(['asset_ids', 'generation_ids'] as const).map((key) => (
              <fieldset
                key={key}
                className="max-h-44 overflow-y-auto rounded-xl border border-line p-3"
              >
                <legend className="text-sm font-medium">
                  {key === 'asset_ids' ? 'Bağlı asset’ler' : 'Bağlı üretimler'}{' '}
                  (son 200)
                </legend>
                {(key === 'asset_ids'
                  ? workspace.assets
                  : workspace.generations
                )
                  .filter((m) => m.influencer_id === values.influencer_id)
                  .map((m) => (
                    <label
                      key={m.id}
                      className="mb-2 flex gap-2 text-xs text-muted"
                    >
                      <input
                        type="checkbox"
                        checked={(values[key] ?? []).includes(m.id)}
                        onChange={(e) => toggle(key, m.id, e.target.checked)}
                      />
                      {'kind' in m
                        ? `${m.kind} · ${m.version_tag ?? ''}`
                        : `${m.type} · ${m.status}`}{' '}
                      · {m.id.slice(0, 8)}
                    </label>
                  ))}
                {(values[key] ?? [])
                  .filter(
                    (id) =>
                      !(
                        key === 'asset_ids'
                          ? workspace.assets
                          : workspace.generations
                      ).some((m) => m.id === id),
                  )
                  .map((id) => (
                    <label
                      className="mb-2 flex gap-2 text-xs text-muted"
                      key={id}
                    >
                      <input
                        checked
                        type="checkbox"
                        onChange={(e) => toggle(key, id, e.target.checked)}
                      />
                      {id}
                    </label>
                  ))}
              </fieldset>
            ))}
          </div>
          {!readonly && (
            <AiSuggestion
              influencerId={values.influencer_id}
              tasks={['caption', 'script', 'weekly']}
              disabled={pending}
              requestFor={(task) =>
                task === 'caption'
                  ? {
                      task: 'caption',
                      input: {
                        persona: {
                          name:
                            workspace.influencers.find(
                              (i) => i.id === values.influencer_id,
                            )?.name ?? '',
                          niche:
                            workspace.influencers.find(
                              (i) => i.id === values.influencer_id,
                            )?.niche || 'Niş belirtilmedi',
                        },
                        topic: values.title,
                        format: values.format,
                        language: 'tr',
                      },
                    }
                  : task === 'script'
                    ? {
                        task: 'script',
                        input: {
                          topic: values.title,
                          durationSeconds: 30,
                          language: 'tr',
                        },
                      }
                    : { task: 'weekly', input: { language: 'tr' } }
              }
              onApply={(result) => {
                const next = [values.notes, suggestionText(result)]
                  .filter(Boolean)
                  .join('\n\n');
                if (next.length > 10000)
                  throw new Error(
                    'Notlar 10.000 karakteri aşacak. Önce mevcut notları kısaltın.',
                  );
                set('notes', next);
              }}
            />
          )}
          <div className="space-y-4">
            <h3 className="text-base font-semibold">
              Yayın öncesi kontrol listesi
            </h3>
            {checklistGroups.map((group) => (
              <fieldset
                key={group.title}
                className="space-y-3 rounded-xl border border-line p-4"
              >
                <legend className="px-1 text-sm font-semibold">
                  {group.title}
                </legend>
                {group.items.map(([key, text]) => (
                  <label
                    className="flex items-start gap-3 text-sm text-muted"
                    key={key}
                  >
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={values.checklist.items[key] === true}
                      onChange={(e) =>
                        set('checklist', {
                          ...values.checklist,
                          items: {
                            ...values.checklist.items,
                            [key]: e.target.checked,
                          },
                        })
                      }
                    />
                    {text}
                  </label>
                ))}
                {group.score && (
                  <label className={labelClass}>
                    {group.title} puanı (1–5)
                    <input
                      className={fieldClass}
                      type="number"
                      min={1}
                      max={5}
                      value={values.checklist[group.score] ?? ''}
                      onChange={(e) =>
                        set('checklist', {
                          ...values.checklist,
                          [group.score!]:
                            e.target.value === ''
                              ? null
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
              </fieldset>
            ))}
          </div>
          <label className={labelClass}>
            Yayın kararı
            <select
              aria-label="Yayın kararı"
              className={fieldClass}
              value={values.checklist.decision}
              onChange={(e) =>
                set('checklist', {
                  ...values.checklist,
                  decision: e.target
                    .value as ContentInput['checklist']['decision'],
                })
              }
            >
              <option value="review">
                Hukuk/marka/platform kontrolü bekliyor
              </option>
              <option value="rework">Düzeltmeye geri gönder</option>
              <option value="ready">Yayına hazır</option>
            </select>
          </label>
          <p className="text-xs text-muted">
            İki puandan biri 3’ün altındaysa içerik Edit’e döner. Planlamak için
            tüm maddeler, en az 3 puan, hedef hesap ve yayın zamanı gerekir.
            Yayında aşamasına geçmek için post eşleştirin.
          </p>
          {!readonly && (
            <button className="button button-primary" type="submit">
              {pending ? 'Kaydediliyor…' : 'İçeriği kaydet'}
            </button>
          )}
        </fieldset>
      </form>
    </section>
  );
}
