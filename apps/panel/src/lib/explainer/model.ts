import {
  EPISODE_STATUS_LABELS,
  JOB_KINDS,
  MIN_SOURCES_PER_CLAIM,
  VISUAL_ROUTE_CAPABILITY,
  WORKER_OFFLINE_AFTER_SECONDS,
  isEpisodeStatus,
  requiresApprovedScript,
  type EpisodeStatus,
  type FactNote,
  type FactSource,
  type JobKind,
  type JobStageStatus,
  type JobStatus,
  type TopicSuggestionStatus,
  type VisualRoute,
} from '@ai-influencer/shared';

/**
 * Anlatım ekranlarının saf mantığı (#217, #218 arayüzü): durum etiketi ve tonu, kaynak notu
 * taslağı, üretim için gereken yetenekler. Arayüz ve API aynı fonksiyonları kullanır.
 */

/** Rozet tonu: renk tek başına anlam taşımaz, etiket her zaman yazılıdır. */
export type Tone = 'neutral' | 'attention' | 'progress' | 'done' | 'muted';

const STATUS_TONES: Record<EpisodeStatus, Tone> = {
  draft: 'neutral',
  script_ready: 'attention',
  script_approved: 'done',
  in_production: 'progress',
  ready_for_review: 'attention',
  approved: 'done',
  published: 'done',
  archived: 'muted',
};

/** Bölüm durumunun Türkçe etiketi, tonu ve "şimdi ne yapılmalı" ipucu. */
const STATUS_NEXT: Record<EpisodeStatus, string> = {
  draft: 'Senaryoyu ve kaynak notlarını yazın.',
  script_ready: 'Senaryoyu okuyup onaylayın.',
  script_approved: 'Üretime gönderebilirsiniz.',
  in_production: 'Üretim sürüyor; aşamaları izleyin.',
  ready_for_review: 'Video hazır; inceleyip onaylayın.',
  approved: 'Video onaylı; yayına hazır.',
  published: 'Yayınlandı.',
  archived: 'Arşivde; geri alınabilir.',
};

export function episodeStatusView(status: string): {
  label: string;
  tone: Tone;
  next: string;
} {
  if (!isEpisodeStatus(status))
    return { label: 'Bilinmiyor', tone: 'muted', next: '' };
  return {
    label: EPISODE_STATUS_LABELS[status],
    tone: STATUS_TONES[status],
    next: STATUS_NEXT[status],
  };
}

/** Bölüm sayfasındaki akış şeridi: adımlar ve durumun şu an hangi adımda olduğu. */
export const EPISODE_STEPS = [
  'Senaryo',
  'Senaryo onayı',
  'Üretim',
  'Video onayı',
  'Yayın',
] as const;

const STATUS_STEP: Record<EpisodeStatus, number> = {
  draft: 0,
  script_ready: 1,
  script_approved: 2,
  in_production: 2,
  ready_for_review: 3,
  approved: 4,
  published: EPISODE_STEPS.length,
  archived: -1,
};

/**
 * Durumun beklediği adımın sırası: öncekiler tamamlanmıştır. Yayınlanmış bölümde bütün adımlar
 * tamam (`EPISODE_STEPS.length`); arşivde ya da bilinmeyen durumda `-1` (şerit işaretlenmez).
 */
export function currentStep(status: string): number {
  return isEpisodeStatus(status) ? STATUS_STEP[status] : -1;
}

export const SUGGESTION_STATUS_LABELS: Record<TopicSuggestionStatus, string> = {
  new: 'Karar bekliyor',
  picked: 'Seçildi',
  rejected: 'Elendi',
};

// ── Kaynak notları ──────────────────────────────────────────────────────────

export type SourceDraft = { title: string; url: string; primary: boolean };
export type FactNoteDraft = {
  claim: string;
  sources: SourceDraft[];
  note: string;
  cautious_wording: string;
};

export const emptySource = (): SourceDraft => ({
  title: '',
  url: '',
  primary: false,
});
export const emptyFactNote = (): FactNoteDraft => ({
  claim: '',
  sources: [emptySource(), emptySource()],
  note: '',
  cautious_wording: '',
});

export function toFactNoteDrafts(notes: unknown): FactNoteDraft[] {
  if (!Array.isArray(notes)) return [];
  return notes.flatMap((raw): FactNoteDraft[] => {
    if (!raw || typeof raw !== 'object') return [];
    const note = raw as Partial<FactNote>;
    return [
      {
        claim: typeof note.claim === 'string' ? note.claim : '',
        sources: (Array.isArray(note.sources) ? note.sources : []).map(
          (source: FactSource) => ({
            title: typeof source?.title === 'string' ? source.title : '',
            url: typeof source?.url === 'string' ? source.url : '',
            primary: source?.primary === true,
          }),
        ),
        note: typeof note.note === 'string' ? note.note : '',
        cautious_wording:
          typeof note.cautious_wording === 'string'
            ? note.cautious_wording
            : '',
      },
    ];
  });
}

const isBlankSource = (source: SourceDraft) =>
  source.title.trim() === '' && source.url.trim() === '';

/**
 * Taslağı kaydedilecek biçime çevirir: boş kaynak satırları ve tamamen boş iddialar atılır,
 * boş isteğe bağlı alanlar gönderilmez. Veritabanı kaynak sayısını bu diziden sayar; bu yüzden
 * boş satır "kaynak" sayılmamalıdır.
 */
export function normalizeFactNotes(
  drafts: readonly FactNoteDraft[],
): FactNote[] {
  return drafts.flatMap((draft): FactNote[] => {
    const sources = draft.sources.filter((source) => !isBlankSource(source));
    const claim = draft.claim.trim();
    const note = draft.note.trim();
    const cautious = draft.cautious_wording.trim();
    if (!claim && !sources.length && !note && !cautious) return [];
    return [
      {
        claim,
        sources: sources.map((source) => ({
          ...(source.title.trim() ? { title: source.title.trim() } : {}),
          ...(source.url.trim() ? { url: source.url.trim() } : {}),
          ...(source.primary ? { primary: true } : {}),
        })),
        ...(note ? { note } : {}),
        ...(cautious ? { cautious_wording: cautious } : {}),
      },
    ];
  });
}

/** Bu iddianın kaç kaynağı eksik? (Veritabanı kuralı: iddia başına en az iki kaynak.) */
export function missingSources(draft: FactNoteDraft): number {
  const filled = draft.sources.filter(
    (source) => !isBlankSource(source),
  ).length;
  return Math.max(0, MIN_SOURCES_PER_CLAIM - filled);
}

/** Bağlantı olarak yalnız http(s) adresi gösterilir; diğer her şey düz metindir. */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

// ── Üretim ──────────────────────────────────────────────────────────────────

/** Onaylı senaryo isteyen (üretim) iş türleri; sunucudaki sabit tanımdan türer. */
export const PRODUCTION_JOB_KINDS = (
  Object.keys(JOB_KINDS) as JobKind[]
).filter((kind) => requiresApprovedScript(kind));

export const JOB_KIND_LABELS: Partial<Record<JobKind, string>> = {
  'explainer.render': 'Video üretimi (ses, altyazı, görsel, render)',
};

export const STAGE_LABELS: Record<string, string> = {
  research: 'Araştırma',
  draft: 'Senaryo taslağı',
  voice: 'Seslendirme',
  captions: 'Altyazı',
  visuals: 'Görseller',
  render: 'Render ve video onayı',
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'Sırada',
  running: 'Üretiliyor',
  awaiting_approval: 'Onay bekliyor',
  succeeded: 'Tamamlandı',
  failed: 'Hata',
  cancelled: 'İptal edildi',
};

export const STAGE_STATUS_LABELS: Record<JobStageStatus, string> = {
  pending: 'Bekliyor',
  running: 'Çalışıyor',
  succeeded: 'Bitti',
  failed: 'Hata',
  skipped: 'Atlandı',
};

export function stageKeys(kind: JobKind): string[] {
  return JOB_KINDS[kind].stages.map((stage) => stage.key);
}

/** Aşamanın makinede istediği yetenek. Görsel aşamalar seçilen yola bağlıdır. */
function stageCapability(stage: string, route: VisualRoute): string | null {
  if (stage === 'voice') return 'voice.edge-tts';
  if (stage === 'captions') return 'captions.burn';
  if (stage === 'visuals' || stage === 'render')
    return VISUAL_ROUTE_CAPABILITY[route];
  return null;
}

/**
 * İşin makineden istediği yetenekler: `stopAt`'e kadar olan aşamalarınkiler. Yolun üretim
 * aşaması henüz yoksa (`VISUAL_ROUTE_CAPABILITY` → null) ve iş o aşamaya uzanıyorsa `null`
 * döner: iş açılmaz.
 */
export function requiredCapabilities(
  kind: JobKind,
  route: VisualRoute,
  stopAt: string | null,
): string[] | null {
  const keys = stageKeys(kind);
  const end = stopAt ? keys.indexOf(stopAt) : keys.length - 1;
  if (end < 0) return null;
  const capabilities = new Set<string>();
  for (const stage of keys.slice(0, end + 1)) {
    const capability = stageCapability(stage, route);
    if (capability === null && (stage === 'visuals' || stage === 'render'))
      return null;
    if (capability) capabilities.add(capability);
  }
  return [...capabilities];
}

export type WorkerRow = {
  name: string;
  capabilities: string[];
  last_seen_at: string | null;
  revoked_at: string | null;
};

export type MachineReadiness =
  | { state: 'none' }
  | { state: 'offline'; total: number }
  | { state: 'missing_capability'; online: number; missing: string[] }
  | { state: 'ready'; machines: string[] };

/** Bu işi şu an alabilecek bir makine var mı? (Kalp atışı 90 sn, yetenekler alt küme.) */
export function machineReadiness(
  workers: readonly WorkerRow[],
  required: readonly string[],
  now: Date,
): MachineReadiness {
  const active = workers.filter((worker) => !worker.revoked_at);
  if (active.length === 0) return { state: 'none' };
  const threshold = now.getTime() - WORKER_OFFLINE_AFTER_SECONDS * 1000;
  const online = active.filter(
    (worker) =>
      worker.last_seen_at !== null &&
      new Date(worker.last_seen_at).getTime() >= threshold,
  );
  if (online.length === 0) return { state: 'offline', total: active.length };
  const able = online.filter((worker) =>
    required.every((capability) => worker.capabilities.includes(capability)),
  );
  if (able.length > 0)
    return { state: 'ready', machines: able.map((worker) => worker.name) };
  const everything = new Set(online.flatMap((worker) => worker.capabilities));
  return {
    state: 'missing_capability',
    online: online.length,
    missing: required.filter((capability) => !everything.has(capability)),
  };
}
