'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  VISUAL_ROUTE_LABELS,
  WORKER_CAPABILITY_LABELS,
  canCancelJob,
  canStartProduction,
  isEpisodeStatus,
  isJobKind,
  isJobStatus,
  isTerminalJobStatus,
  isVisualRoute,
  isWorkerCapability,
  type JobKind,
} from '@ai-influencer/shared';
import { Toast } from '@/components/ui';
import {
  JOB_KIND_LABELS,
  JOB_STATUS_LABELS,
  PRODUCTION_JOB_KINDS,
  STAGE_LABELS,
  STAGE_STATUS_LABELS,
  machineReadiness,
  requiredCapabilities,
  stageKeys,
  type MachineReadiness,
} from '@/lib/explainer/model';
import type { EpisodeDetail, EpisodeJob } from '@/lib/explainer/queries';
import { episodeJobSchema } from '@/lib/explainer/schemas';
import {
  Badge,
  ErrorText,
  api,
  field,
  formatDate,
  hint,
  label,
  useAction,
} from './shared';

const REFRESH_MS = 10_000;

/** Makineler sayfası: eşleme ve makine listesi orada yönetilir. */
export const MACHINES_HREF = '/production';

const capabilityLabel = (capability: string) =>
  isWorkerCapability(capability)
    ? WORKER_CAPABILITY_LABELS[capability]
    : capability;

function machineText(readiness: MachineReadiness): {
  ok: boolean;
  text: string;
} {
  switch (readiness.state) {
    case 'none':
      return {
        ok: false,
        text: 'Üretim makinesi bağlı değil. İş sıraya girer ve bir makine bağlanınca başlar.',
      };
    case 'offline':
      return {
        ok: false,
        text: `Üretim makinesi çevrimdışı (${readiness.total} kayıtlı makine). İş sırada bekler; makine açılınca başlar.`,
      };
    case 'missing_capability':
      return {
        ok: false,
        text: `Çevrimiçi makinede eksik yetenek var: ${readiness.missing
          .map(capabilityLabel)
          .join(', ')}. İş, yeteneği olan bir makine bağlanana kadar bekler.`,
      };
    case 'ready':
      return {
        ok: true,
        text: `Hazır makine: ${readiness.machines.join(', ')}.`,
      };
  }
}

function JobCard({
  job,
  episodeId,
  canWrite,
  current,
}: {
  job: EpisodeJob;
  episodeId: string;
  canWrite: boolean;
  current: boolean;
}) {
  const { pending, error, run } = useAction();
  const status = isJobStatus(job.status) ? job.status : 'queued';
  return (
    <article
      aria-label={`Üretim işi, ${formatDate(job.created_at)}`}
      className="grid gap-3 rounded-xl border border-line bg-surface-raised p-4"
    >
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <strong>
          {isJobKind(job.kind)
            ? (JOB_KIND_LABELS[job.kind] ?? job.kind)
            : 'Üretim işi'}
        </strong>
        <Badge
          tone={
            status === 'succeeded'
              ? 'done'
              : status === 'failed' || status === 'awaiting_approval'
                ? 'attention'
                : isTerminalJobStatus(status)
                  ? 'muted'
                  : 'progress'
          }
        >
          <span className="sr-only">İş durumu: </span>
          {JOB_STATUS_LABELS[status]}
        </Badge>
        {!current && <Badge tone="muted">Eski senaryo sürümü</Badge>}
        <span className="text-xs text-muted">
          Senaryo sürümü {job.episode_script_version ?? '—'} ·{' '}
          {formatDate(job.created_at)}
          {job.stop_at
            ? ` · “${STAGE_LABELS[job.stop_at] ?? job.stop_at}” aşamasında durur`
            : ''}
        </span>
        {canWrite && canCancelJob(status) && (
          <button
            className="button button-quiet ml-auto"
            disabled={pending || job.cancel_requested_at !== null}
            onClick={() =>
              void run(() =>
                api(
                  `/api/explainers/episodes/${episodeId}/jobs/${job.id}/cancel`,
                  'POST',
                ),
              )
            }
            type="button"
          >
            {job.cancel_requested_at ? 'İptal isteniyor…' : 'İşi iptal et'}
          </button>
        )}
      </header>
      <ol
        aria-label="Aşamalar"
        className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4"
      >
        {job.stages.map((stage) => (
          <li
            className="rounded-lg border border-line bg-surface p-3 text-sm"
            key={stage.key}
          >
            <span className="block font-medium text-text">
              {stage.seq}. {STAGE_LABELS[stage.key] ?? stage.key}
            </span>
            <span className="block text-xs text-muted">
              {STAGE_STATUS_LABELS[
                stage.status as keyof typeof STAGE_STATUS_LABELS
              ] ?? 'Bilinmiyor'}
              {stage.status === 'running' ? ` · %${stage.progress}` : ''}
              {stage.requires_approval
                ? stage.approved_at
                  ? ' · onaylandı'
                  : ' · onay ister'
                : ''}
            </span>
            {stage.detail && (
              <span className="mt-1 block text-xs break-words text-muted">
                {stage.detail}
              </span>
            )}
            {stage.error && (
              <span className="mt-1 block text-xs break-words text-text">
                Hata: {stage.error}
              </span>
            )}
          </li>
        ))}
      </ol>
      {job.error && (
        <p className="m-0 text-sm break-words text-text">
          Hata
          {job.failed_stage
            ? ` (${STAGE_LABELS[job.failed_stage] ?? job.failed_stage})`
            : ''}
          : {job.error}
        </p>
      )}
      <ErrorText>{error}</ErrorText>
    </article>
  );
}

/**
 * Üretim (#201 iş modeli): neye ihtiyaç var (onaylı senaryo, görsel yol, makine), "Üretime
 * gönder" ve bölümün işlerinin aşama aşama durumu (salt okunur; makine yazar). İş açıkken sayfa
 * kendini tazeler.
 */
export function ProductionPanel({
  detail,
  canWrite,
}: {
  detail: EpisodeDetail;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { episode, series, jobs, workers } = detail;
  const { pending, error, setError, run } = useAction();
  const [kind, setKind] = useState<JobKind>(PRODUCTION_JOB_KINDS[0]!);
  const [stopAt, setStopAt] = useState('');
  const [toast, setToast] = useState('');
  const hasActive = jobs.some(
    (job) => isJobStatus(job.status) && !isTerminalJobStatus(job.status),
  );

  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => router.refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [hasActive, router]);

  const status = isEpisodeStatus(episode.status) ? episode.status : 'draft';
  const routeValue = episode.visual_route ?? series?.visual_route ?? null;
  const route = routeValue && isVisualRoute(routeValue) ? routeValue : null;
  const capabilities = route
    ? requiredCapabilities(kind, route, stopAt || null)
    : null;
  // Makine durumu sunucunun render anındaki saate göre değil, tarayıcıdaki ana göre hesaplanır.
  const [now] = useState(() => new Date());
  const machine = machineText(
    machineReadiness(workers, capabilities ?? [], now),
  );
  const scriptOk = canStartProduction(status);
  const checks: Array<{ ok: boolean; text: string }> = [
    {
      ok:
        scriptOk || status === 'in_production' || status === 'ready_for_review',
      text: scriptOk
        ? `Senaryo onaylı (sürüm ${episode.script_version}).`
        : status === 'in_production' || status === 'ready_for_review'
          ? 'Senaryo onaylı; bu sürümün üretimi sürüyor.'
          : 'Onaylı senaryo gerekli: önce senaryoyu yazıp onaylayın.',
    },
    {
      ok: capabilities !== null,
      text: !route
        ? 'Görsel yol seçilmedi: bölüm ayarlarından ya da seriden seçin.'
        : capabilities === null
          ? `“${VISUAL_ROUTE_LABELS[route]}” yolunun üretim aşaması henüz yok; başka bir yol seçin.`
          : `Görsel yol: ${VISUAL_ROUTE_LABELS[route]}${
              episode.visual_route ? '' : ' (seriden)'
            }.`,
    },
    machine,
  ];
  const canSend = canWrite && scriptOk && capabilities !== null;

  function send() {
    const parsed = episodeJobSchema.safeParse({
      kind,
      stop_at: stopAt || null,
    });
    if (!parsed.success) return setError('Geçersiz seçim.');
    void run(
      () =>
        api(`/api/explainers/episodes/${episode.id}/jobs`, 'POST', parsed.data),
      () =>
        setToast(
          machine.ok
            ? 'Üretim işi sıraya alındı.'
            : 'Üretim işi sıraya alındı; bir üretim makinesi bağlanınca başlayacak.',
        ),
    );
  }

  return (
    <section aria-labelledby="episode-production" className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SES · ALTYAZI · GÖRSEL · RENDER</p>
          <h2 id="episode-production">Üretim</h2>
        </div>
        <Link className="button button-quiet" href={MACHINES_HREF}>
          Üretim makineleri
        </Link>
      </div>
      <ul
        aria-label="Üretim için gerekenler"
        className="mt-4 mb-0 grid list-none gap-2 p-0 text-sm"
      >
        {checks.map((check) => (
          <li className="flex items-start gap-2" key={check.text}>
            <span
              aria-hidden="true"
              className={check.ok ? 'text-mint' : 'text-accent'}
            >
              {check.ok ? '✓' : '⚠'}
            </span>
            <span>
              <span className="sr-only">
                {check.ok ? 'Tamam: ' : 'Eksik: '}
              </span>
              {check.text}
            </span>
          </li>
        ))}
      </ul>

      {canWrite && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className={label}>
            Ne üretilecek
            <select
              className={field}
              onChange={(event) => setKind(event.target.value as JobKind)}
              value={kind}
            >
              {PRODUCTION_JOB_KINDS.map((value) => (
                <option key={value} value={value}>
                  {JOB_KIND_LABELS[value] ?? value}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Nereye kadar
            <select
              className={field}
              onChange={(event) => setStopAt(event.target.value)}
              value={stopAt}
            >
              <option value="">Sonuna kadar (video onayına)</option>
              {stageKeys(kind)
                .slice(0, -1)
                .map((stage) => (
                  <option key={stage} value={stage}>
                    Yalnız “{STAGE_LABELS[stage] ?? stage}” aşamasına kadar
                  </option>
                ))}
            </select>
          </label>
          <button
            className="button button-primary mt-0!"
            disabled={!canSend || pending}
            onClick={send}
            type="button"
          >
            {pending ? 'Gönderiliyor…' : 'Üretime gönder'}
          </button>
          <span className={`${hint} sm:col-span-3`}>
            {canSend
              ? 'Gönderdiğiniz anda stil, ses ve altyazı ayarları bu iş için dondurulur; sonraki değişiklikler bu işi etkilemez. Kısmi üretim (ör. yalnız ses) videoyu onaya getirmez.'
              : status === 'in_production' || status === 'ready_for_review'
                ? 'Bu sürümün üretimi sürüyor. Yeni iş için önce mevcut işin bitmesini bekleyin ya da iptal edin.'
                : 'Yukarıdaki eksikler tamamlanınca düğme açılır.'}
          </span>
        </div>
      )}
      <ErrorText>{error}</ErrorText>

      <h3 className="mt-5 mb-2 text-sm font-semibold text-text">
        Üretim işleri
      </h3>
      {jobs.length === 0 ? (
        <p className="m-0 text-sm text-muted">
          Bu bölüm için henüz üretim işi yok.
        </p>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <JobCard
              canWrite={canWrite}
              current={job.episode_script_version === episode.script_version}
              episodeId={episode.id}
              job={job}
              key={job.id}
            />
          ))}
        </div>
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </section>
  );
}
