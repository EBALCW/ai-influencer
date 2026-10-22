'use client';
// Panelden yayın (#58): kart üzerinde "Şimdi yayınla" / "Planla", iş durumu ve iptal; sayfa altında
// yayın kuyruğu. Yayını sunucudaki worker yapar; burada yalnız iş açılır/iptal edilir.
import { useState } from 'react';
import { checklistReady } from '@/lib/content/stage-rules';
import { readChecklist } from '@/lib/content/checklist-schema';
import { localInput, localToIso } from '@/lib/content/schedule-rules';
import {
  latestJob,
  parseTags,
  publishStatusLabels,
  type PublishJobView,
} from '@/lib/content/publish';
import type { ContentCard, ContentWorkspace } from '@/lib/content/queries';

const fieldClass =
  'mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent disabled:opacity-70';

const platformNames: Record<string, string> = {
  instagram: 'Instagram Reels',
  youtube: 'YouTube Shorts',
  tiktok: 'TikTok',
};

function when(job: PublishJobView, timezone: string) {
  try {
    return `${localInput(job.scheduled_for, timezone).replace('T', ' ')} · ${timezone}`;
  } catch {
    return job.scheduled_for;
  }
}

export function PublishControls({
  item,
  workspace,
  pending,
  mutate,
}: {
  item: ContentCard;
  workspace: ContentWorkspace;
  pending: boolean;
  mutate: (url: string, method: string, values: unknown) => Promise<boolean>;
}) {
  const canEdit = workspace.role !== 'viewer';
  const job = latestJob(workspace.publishJobs, item.id);
  const open = job && (job.status === 'queued' || job.status === 'processing');
  const account = workspace.accounts.find(
    (a) => a.id === item.target_account_id,
  );
  const hasFinalVideo = workspace.assets.some(
    (a) => a.kind === 'final_video' && item.details.asset_ids.includes(a.id),
  );
  const ready = checklistReady(readChecklist(item.checklist));
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [date, setDate] = useState(() =>
    item.scheduled_at && Date.parse(item.scheduled_at) > Date.now()
      ? localInput(item.scheduled_at, item.timezone)
      : '',
  );
  const [error, setError] = useState('');

  return (
    <div className="mt-3 space-y-2 text-xs" data-testid={`publish-${item.id}`}>
      {job && (
        <p className="rounded-lg border border-line p-2" role="status">
          <span className="font-semibold">
            Yayın: {publishStatusLabels[job.status]}
          </span>
          {' · '}
          {platformNames[job.platform] ?? job.platform}
          {open && ` · ${when(job, item.timezone)}`}
          {job.status === 'processing' &&
            job.attempts > 0 &&
            ` · deneme ${job.attempts}/${job.max_attempts}`}
          {job.error && job.status !== 'published' && (
            <span className="mt-1 block text-muted">{job.error}</span>
          )}
        </p>
      )}
      {canEdit && job?.status === 'queued' && (
        <button
          className="button"
          type="button"
          disabled={pending}
          aria-label={`${item.title} yayınını iptal et`}
          onClick={() =>
            void mutate(`/api/publish-jobs/${job.id}/cancel`, 'POST', {})
          }
        >
          Yayını iptal et
        </button>
      )}
      {canEdit && !open && item.stage !== 'published' && account && (
        <details>
          <summary className="cursor-pointer text-accent">
            Yayınla / planla
          </summary>
          {(!ready || !hasFinalVideo) && (
            <p className="mt-2 text-muted">
              {!ready &&
                'Yayın öncesi kontrol listesi (AI etiketi dahil) tamamlanmalı. '}
              {!hasFinalVideo && 'Karta bir final video bağlayın.'}
            </p>
          )}
          {error && (
            <p className="mt-2 text-text" role="alert">
              {error}
            </p>
          )}
          <form
            className="mt-2 space-y-2"
            aria-label={`${item.title} yayın formu`}
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              const fd = new FormData(event.currentTarget);
              let scheduledAt: string | undefined;
              if (mode === 'schedule') {
                try {
                  scheduledAt = localToIso(date, item.timezone);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Tarih geçersiz.');
                  return;
                }
              }
              void mutate(`/api/content-items/${item.id}/publish`, 'POST', {
                mode,
                ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
                title: String(fd.get('title') ?? ''),
                caption: String(fd.get('caption') ?? ''),
                tags: parseTags(String(fd.get('tags') ?? '')),
              });
            }}
          >
            <p className="text-muted">
              {platformNames[account.platform] ?? account.platform} ·{' '}
              {account.handle}. AI etiketi otomatik açılır.
            </p>
            <label className="block text-muted">
              Başlık
              <input
                className={fieldClass}
                name="title"
                required
                maxLength={100}
                defaultValue={item.title.slice(0, 100)}
              />
            </label>
            <label className="block text-muted">
              Açıklama
              <textarea
                className={fieldClass}
                name="caption"
                maxLength={2200}
              />
            </label>
            <label className="block text-muted">
              Etiketler (virgülle)
              <input className={fieldClass} name="tags" maxLength={1500} />
            </label>
            <fieldset className="flex flex-wrap gap-3">
              <legend className="sr-only">Yayın zamanı</legend>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'now'}
                  onChange={() => setMode('now')}
                />
                Hemen
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'schedule'}
                  onChange={() => setMode('schedule')}
                />
                Planlanan saatte
              </label>
            </fieldset>
            {mode === 'schedule' && (
              <label className="block text-muted">
                Yayın zamanı ({item.timezone})
                <input
                  className={fieldClass}
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            )}
            <button
              className="button button-primary"
              type="submit"
              disabled={pending}
            >
              {mode === 'now' ? 'Şimdi yayınla' : 'Planla'}
            </button>
          </form>
        </details>
      )}
    </div>
  );
}

export function PublishQueue({ workspace }: { workspace: ContentWorkspace }) {
  const titles = new Map(workspace.items.map((i) => [i.id, i]));
  const handles = new Map(workspace.accounts.map((a) => [a.id, a.handle]));
  const jobs = workspace.publishJobs.slice(0, 50);
  return (
    <section className="section-card space-y-3" aria-label="Yayın kuyruğu">
      <div>
        <h2 className="text-lg font-semibold">Yayın kuyruğu</h2>
        <p className="text-sm text-muted">
          Zamanı gelen işler her dakika sunucuda yayınlanır. Hata olursa birkaç
          kez yeniden denenir ve bildirim gönderilir.
        </p>
      </div>
      {jobs.length === 0 ? (
        <p className="text-sm text-muted">Henüz yayın işi yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="p-2">İçerik</th>
                <th className="p-2">Hesap</th>
                <th className="p-2">Durum</th>
                <th className="p-2">Zaman</th>
                <th className="p-2">Not</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const item = titles.get(job.content_item_id);
                return (
                  <tr
                    key={job.id}
                    className="border-t border-line"
                    data-testid={`publish-job-${job.id}`}
                  >
                    <td className="p-2">{item?.title ?? job.title}</td>
                    <td className="p-2">
                      {platformNames[job.platform] ?? job.platform} ·{' '}
                      {handles.get(job.account_id) ?? '—'}
                    </td>
                    <td className="p-2">{publishStatusLabels[job.status]}</td>
                    <td className="p-2">
                      {when(job, item?.timezone ?? 'Europe/Istanbul')}
                    </td>
                    <td className="p-2 text-muted">{job.error ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
