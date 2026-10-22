'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { AiSuggestion } from '@/components/ai-suggestion';
import { EmptyState, Toast } from '@/components/ui';
import { platformLabels } from '@/lib/analytics/links';
import type { ReplyTemplate } from '@/lib/brands/templates';
import { REPLY_MAX_LENGTH } from '@/lib/ai/schemas';
import type { InboxComment, InboxData } from '@/lib/inbox/queries';
import {
  canReplyOn,
  commentStatusLabels,
  inboxDays,
  inboxViewLabels,
  inboxViews,
  replyStatusLabels,
  type InboxQuery,
} from '@/lib/inbox/schemas';
import {
  brandRequest,
  fieldClass,
  labelClass,
  useMutation,
} from '../brands/request';

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

type Mutation = ReturnType<typeof useMutation>;

function withInf(path: string, slug: string | undefined) {
  return slug ? `${path}?inf=${encodeURIComponent(slug)}` : path;
}

export function InboxView({
  data,
  query,
  canEdit,
  templates,
}: {
  data: InboxData;
  query: InboxQuery;
  canEdit: boolean;
  templates: ReplyTemplate[];
}) {
  const mutation = useMutation();
  const slug = data.influencer?.slug;

  const href = (changes: Partial<Record<keyof InboxQuery, string>>) => {
    const params = new URLSearchParams();
    const next: Record<string, string | undefined> = {
      inf: slug,
      platform: query.platform,
      view: query.view === 'all' ? undefined : query.view,
      days: query.days === 7 ? undefined : String(query.days),
      post: query.post,
      ...changes,
    };
    for (const [key, value] of Object.entries(next))
      if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/inbox?${qs}` : '/inbox';
  };

  return (
    <div className="page-stack">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YAYIN</p>
          <h1>Gelen kutusu</h1>
          <p>
            {data.influencer
              ? `${data.influencer.name} · `
              : 'Tüm influencer’lar · '}
            Instagram ve YouTube yorumları tek listede.{' '}
            {data.newCount > 0
              ? `${data.newCount} yeni yorum.`
              : 'Yeni yorum yok.'}
          </p>
        </div>
      </header>

      <section className="section-card" aria-label="Filtreler">
        <nav aria-label="Yorum görünümü" className="flex flex-wrap gap-2">
          {inboxViews.map((view) => (
            <Link
              key={view}
              aria-current={view === query.view ? 'page' : undefined}
              className={
                view === query.view
                  ? 'button button-primary'
                  : 'button button-quiet'
              }
              href={href({ view: view === 'all' ? '' : view })}
            >
              {inboxViewLabels[view]}
            </Link>
          ))}
        </nav>
        <form
          method="get"
          action="/inbox"
          aria-label="Yorum filtreleri"
          className="mt-3 flex flex-wrap items-end gap-3"
        >
          {slug && <input type="hidden" name="inf" value={slug} />}
          {query.view !== 'all' && (
            <input type="hidden" name="view" value={query.view} />
          )}
          {query.post && <input type="hidden" name="post" value={query.post} />}
          <label className={labelClass}>
            Platform
            <select
              name="platform"
              defaultValue={query.platform ?? ''}
              className={fieldClass}
            >
              <option value="">Tümü</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
            </select>
          </label>
          <label className={labelClass}>
            Dönem
            <select
              name="days"
              defaultValue={String(query.days)}
              className={fieldClass}
            >
              {inboxDays.map((d) => (
                <option key={d} value={d}>
                  Son {d} gün
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button">
            Filtrele
          </button>
        </form>
        {data.postFilter && (
          <p className="mt-3 text-sm text-muted">
            Yalnız bu postun yorumları:{' '}
            <span className="text-text">
              {data.postFilter.caption || 'Başlıksız post'}
            </span>{' '}
            <Link className="underline" href={href({ post: '' })}>
              Post filtresini kaldır
            </Link>
          </p>
        )}
      </section>

      <section className="section-card" aria-labelledby="comments-title">
        <h2 id="comments-title" className="mb-3 text-base font-semibold">
          Yorumlar
        </h2>
        {data.comments.length === 0 ? (
          <EmptyState
            title="Yorum yok"
            description="Bu filtrelerle yorum bulunmuyor. Yorumlar bağlı hesaplardan yarım saatte bir çekilir (son 7 günün postları)."
          />
        ) : (
          <ul className="space-y-3" aria-label="Yorum listesi">
            {data.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                canEdit={canEdit}
                templates={templates}
                brands={data.brands}
                mutation={mutation}
              />
            ))}
          </ul>
        )}
        {data.truncated && (
          <p className="mt-3 text-sm text-muted">
            En yeni 100 yorum gösteriliyor. Daha eskileri için filtreleri
            daraltın.
          </p>
        )}
        <p className="mt-3 text-xs text-muted">
          Yorum yazarlarının yalnız görünen adı saklanır; yorumlar 90 gün sonra
          silinir. Gizlemek yorumu yalnız panelde gizler, platformda değil.
        </p>
      </section>

      {mutation.message && (
        <Toast
          message={mutation.message.text}
          tone={mutation.message.error ? 'error' : 'success'}
          onDismiss={mutation.clearMessage}
        />
      )}
    </div>
  );
}

function CommentItem({
  comment,
  canEdit,
  templates,
  brands,
  mutation,
}: {
  comment: InboxComment;
  canEdit: boolean;
  templates: ReplyTemplate[];
  brands: InboxData['brands'];
  mutation: Mutation;
}) {
  const [panel, setPanel] = useState<'reply' | 'lead' | null>(null);
  const slug = comment.influencer.slug;
  const author = comment.authorName || 'Adsız kullanıcı';
  const reply = comment.reply;
  const replyActive = reply && reply.status !== 'failed';
  const setStatus = (status: 'new' | 'read' | 'hidden', done: string) =>
    void mutation.run(
      () => brandRequest(`/api/comments/${comment.id}`, 'PATCH', { status }),
      done,
    );

  return (
    <li
      aria-label={`${author} yorumu`}
      className="rounded-xl border border-line p-4"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="soft-badge">{platformLabels[comment.platform]}</span>
        <span className="font-semibold text-text">{author}</span>
        <span className="text-muted">
          {timeFormat.format(new Date(comment.publishedAt))}
        </span>
        <span className="soft-badge">
          {commentStatusLabels[comment.status]}
        </span>
        {comment.isBrandInquiry && (
          <span className="soft-badge">İş birliği fırsatı</span>
        )}
        <span className="text-muted">
          {comment.influencer.name} · {comment.account.handle}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-text">{comment.text}</p>

      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        <Link
          className="underline"
          href={withInf(`/analytics/posts/${comment.post.id}`, slug)}
        >
          Post detayı
        </Link>
        <Link
          className="underline"
          href={`/inbox?inf=${encodeURIComponent(slug)}&post=${comment.post.id}`}
        >
          Bu postun yorumları
        </Link>
        {comment.post.url && (
          <a
            className="underline"
            href={comment.post.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Platformda aç
          </a>
        )}
        {comment.brandDealId && (
          <Link
            className="underline"
            href={withInf(`/brands/${comment.brandDealId}`, slug)}
          >
            Lead’e git
          </Link>
        )}
      </div>

      {reply && (
        <p className="mt-2 text-sm text-muted" role="status">
          Yanıt: {replyStatusLabels[reply.status] ?? reply.status}
          {reply.status === 'failed' && reply.error ? ` (${reply.error})` : ''}
          {' · '}
          <span className="text-text">{reply.body}</span>
        </p>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canReplyOn(comment.platform) && !replyActive && (
            <button
              type="button"
              className="button button-primary"
              aria-expanded={panel === 'reply'}
              onClick={() => setPanel(panel === 'reply' ? null : 'reply')}
            >
              Yanıtla
            </button>
          )}
          {comment.status === 'new' && (
            <button
              type="button"
              className="button"
              disabled={mutation.pending}
              onClick={() => setStatus('read', 'Okundu olarak işaretlendi.')}
            >
              Okundu işaretle
            </button>
          )}
          {comment.status === 'read' && (
            <button
              type="button"
              className="button button-quiet"
              disabled={mutation.pending}
              onClick={() => setStatus('new', 'Okunmadı olarak işaretlendi.')}
            >
              Okunmadı işaretle
            </button>
          )}
          {comment.status === 'hidden' ? (
            <button
              type="button"
              className="button button-quiet"
              disabled={mutation.pending}
              onClick={() => setStatus('read', 'Yorum tekrar listede.')}
            >
              Gizlemeyi kaldır
            </button>
          ) : (
            <button
              type="button"
              className="button button-quiet"
              disabled={mutation.pending}
              onClick={() => setStatus('hidden', 'Yorum panelde gizlendi.')}
            >
              Gizle
            </button>
          )}
          {!comment.brandDealId && (
            <button
              type="button"
              className="button button-quiet"
              aria-expanded={panel === 'lead'}
              onClick={() => setPanel(panel === 'lead' ? null : 'lead')}
            >
              Lead oluştur
            </button>
          )}
        </div>
      )}

      {canEdit && panel === 'reply' && (
        <ReplyForm
          comment={comment}
          templates={templates}
          mutation={mutation}
          onDone={() => setPanel(null)}
        />
      )}
      {canEdit && panel === 'lead' && (
        <LeadForm
          comment={comment}
          brands={brands}
          mutation={mutation}
          onDone={() => setPanel(null)}
        />
      )}
    </li>
  );
}

function ReplyForm({
  comment,
  templates,
  mutation,
  onDone,
}: {
  comment: InboxComment;
  templates: ReplyTemplate[];
  mutation: Mutation;
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Metin kutusu label'ın içinde olursa erişilebilir adı yazılan metni de içerir;
  // açık id/htmlFor ile ad hep "Yanıt" kalır.
  const replyId = useId();
  const language = comment.influencer.language === 'en' ? 'en' : 'tr';

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Çift tıklama: istemci kilidi + sunucuda yorum başına tek etkin yanıt.
    if (sending || !text.trim()) return;
    setSending(true);
    const ok = await mutation.run(
      () =>
        brandRequest(`/api/comments/${comment.id}/reply`, 'POST', {
          body: text,
        }),
      'Yanıt gönderim sırasına alındı.',
    );
    setSending(false);
    if (ok) onDone();
  }

  return (
    <form
      aria-label="Yanıt formu"
      className="mt-3 space-y-3 rounded-xl border border-line p-3"
      onSubmit={(e) => void submit(e)}
    >
      {templates.length > 0 && (
        <label className={labelClass}>
          Şablon
          <select
            className={fieldClass}
            defaultValue=""
            onChange={(e) => {
              const t = templates.find((x) => x.title === e.target.value);
              if (t) setText(t.body);
            }}
          >
            <option value="">Şablon seç…</option>
            {templates.map((t) => (
              <option key={t.title} value={t.title}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={labelClass} htmlFor={replyId}>
        Yanıt
      </label>
      <textarea
        id={replyId}
        className={fieldClass}
        rows={3}
        maxLength={REPLY_MAX_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="text-xs text-muted">
        {text.length}/{REPLY_MAX_LENGTH} · Yanıt yalnız “Yanıtı gönder”e
        bastığınızda, karakterin hesabından gönderilir.
      </p>
      <AiSuggestion
        influencerId={comment.influencer.id}
        tasks={['reply']}
        requestFor={() => ({
          task: 'reply',
          input: { commentId: comment.id, language },
        })}
        onApply={(result) => {
          if (result.task === 'reply') setText(result.suggestion.reply);
        }}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="button button-primary"
          disabled={sending || mutation.pending || !text.trim()}
        >
          {sending ? 'Gönderiliyor…' : 'Yanıtı gönder'}
        </button>
        <button type="button" className="button button-quiet" onClick={onDone}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}

function LeadForm({
  comment,
  brands,
  mutation,
  onDone,
}: {
  comment: InboxComment;
  brands: InboxData['brands'];
  mutation: Mutation;
  onDone: () => void;
}) {
  const [brandId, setBrandId] = useState('');
  const [brandName, setBrandName] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const ok = await mutation.run(
      () =>
        brandRequest(
          `/api/comments/${comment.id}/lead`,
          'POST',
          brandId ? { brandId } : { brandName },
        ),
      'Lead oluşturuldu; Markalar sayfasında Lead aşamasında.',
    );
    if (ok) onDone();
  }

  return (
    <form
      aria-label="Lead formu"
      className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-line p-3"
      onSubmit={(e) => void submit(e)}
    >
      <label className={labelClass}>
        Var olan marka
        <select
          className={fieldClass}
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
        >
          <option value="">Yeni marka…</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {!brandId && (
        <label className={labelClass}>
          Yeni marka adı
          <input
            className={fieldClass}
            maxLength={120}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
        </label>
      )}
      <button
        type="submit"
        className="button button-primary"
        disabled={mutation.pending || (!brandId && !brandName.trim())}
      >
        Lead’i kaydet
      </button>
      <button type="button" className="button button-quiet" onClick={onDone}>
        Vazgeç
      </button>
    </form>
  );
}
