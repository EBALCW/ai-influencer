// Anlatım modülü: seri ve tekil video modeli (#216, docs/adr/0004-moduler-panel.md → Karar 1).
// Listeler `20261115120000_explainer_series.sql` içindeki CHECK kısıtlarıyla aynıdır; panel testi
// (apps/panel/src/lib/explainer/explainer-model.test.ts) iki tarafın ayrışmadığını denetler.
// Bu dosya başka dosya içe aktarmaz: hem panel (bundler) hem makine programı (Node) doğrudan okur.

/** Video türü: gerçekten olmuş bir olay ya da bir mekanizma ("nasıl çalışır"). */
export const EXPLAINER_KINDS = ['event', 'how_it_works'] as const;
export type ExplainerKind = (typeof EXPLAINER_KINDS)[number];

export const EXPLAINER_KIND_LABELS: Record<ExplainerKind, string> = {
  event: 'Olay',
  how_it_works: 'Nasıl çalışır',
};

/** Görsel yollar (docs/scope-v1.md → Anlatım videoları). */
export const VISUAL_ROUTES = [
  'skia',
  'hyperframes',
  'blender',
  'stock',
  'meme',
] as const;
export type VisualRoute = (typeof VISUAL_ROUTES)[number];

export const VISUAL_ROUTE_LABELS: Record<VisualRoute, string> = {
  skia: 'Skia 2B çizim',
  hyperframes: 'Stil paketi (HyperFrames)',
  blender: 'Blender 3B kesit',
  stock: 'Stok görüntülü',
  meme: 'Arka plan görüntülü meme',
};

/**
 * Yolun makinede gerektirdiği yetenek (`WORKER_CAPABILITIES` anahtarı). `null`: yolun üretim
 * aşaması henüz yok (#223, #224); yetenek anahtarı o issue'da eklenir.
 */
export const VISUAL_ROUTE_CAPABILITY: Record<VisualRoute, string | null> = {
  skia: 'render.skia',
  hyperframes: 'render.hyperframes',
  blender: 'render.blender',
  stock: null,
  meme: null,
};

/**
 * Kanıt düzeyi (`find-ideas` kuralı): konunun kısa videoda işlediğine dair örnek.
 * `proven`: örnek, kanalının yakın tarihli ortancasının en az 3 katı izlenmiş.
 * Olguların doğruluğu hakkında bir şey söylemez; iki kaynak kuralı ayrıdır.
 */
export const EVIDENCE_LEVELS = [
  'proven',
  'format_example',
  'original',
] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const EVIDENCE_LEVEL_LABELS: Record<EvidenceLevel, string> = {
  proven: 'Kanıtlı',
  format_example: 'Format örneği',
  original: 'Özgün',
};

export const SERIES_STATUSES = ['active', 'archived'] as const;
export type SeriesStatus = (typeof SERIES_STATUSES)[number];

export const TOPIC_SUGGESTION_STATUSES = ['new', 'picked', 'rejected'] as const;
export type TopicSuggestionStatus = (typeof TOPIC_SUGGESTION_STATUSES)[number];

/**
 * Bölüm durumu. Veritabanında yazılmaz, hesaplanır (`private.episode_status`): senaryo, senaryo
 * onayı, bölümün üretim işleri, yayın ve arşiv alanlarından türer.
 */
export const EPISODE_STATUSES = [
  'draft',
  'script_ready',
  'script_approved',
  'in_production',
  'ready_for_review',
  'approved',
  'published',
  'archived',
] as const;
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

export const EPISODE_STATUS_LABELS: Record<EpisodeStatus, string> = {
  draft: 'Taslak',
  script_ready: 'Senaryo onay bekliyor',
  script_approved: 'Senaryo onaylı',
  in_production: 'Üretiliyor',
  ready_for_review: 'Video inceleme bekliyor',
  approved: 'Video onaylı',
  published: 'Yayınlandı',
  archived: 'Arşivde',
};

/** Gerçek olaylar için hassasiyet işaretleri (anlatım skill'i → "Gerçek olaylarda hassasiyet"). */
export const SENSITIVITY_FLAGS = [
  'real_event',
  'loss_of_life',
  'injury',
  'minors',
  'crime',
  'ongoing_investigation',
  'private_individuals',
] as const;
export type SensitivityFlag = (typeof SENSITIVITY_FLAGS)[number];

export const SENSITIVITY_FLAG_LABELS: Record<SensitivityFlag, string> = {
  real_event: 'Gerçek olay',
  loss_of_life: 'Can kaybı',
  injury: 'Yaralanma',
  minors: 'Reşit olmayanlar',
  crime: 'Suç',
  ongoing_investigation: 'Süren soruşturma',
  private_individuals: 'Kamuya mal olmamış kişiler',
};

/**
 * Senaryo onayı gerektirmeyen (ön hazırlık) iş türleri: konu araştırması ve senaryo taslağı.
 * Bunların dışındaki her `explainer.*` türü üretim işidir; veritabanı (`private.jobs_episode_gate`)
 * bölümsüz ya da onaysız senaryoyla açılmasını reddeder.
 */
// Anlatım işlerinin aşamaları istemciden alınmaz: tür ne ise aşamalar odur
// (`private.explainer_job_stages`; `JOB_KINDS` içindeki `explainer.*` tanımlarıyla aynıdır).
export const EXPLAINER_PRE_APPROVAL_JOB_KINDS = [
  'explainer.topics',
  'explainer.script',
] as const;

/**
 * Ön hazırlık işinin isteyemeyeceği yetenek önekleri (ses, altyazı, render, klip, yayın).
 * Veritabanı (`private.explainer_pre_approval_capabilities_ok`) aynı kuralı uygular.
 */
export const EXPLAINER_PRODUCTION_CAPABILITY_PREFIXES = [
  'voice',
  'captions',
  'render',
  'clip',
  'publish',
] as const;

/** Bu yetenek bir ön hazırlık işinde istenebilir mi? */
export function isPreApprovalCapability(capability: string): boolean {
  return !EXPLAINER_PRODUCTION_CAPABILITY_PREFIXES.some((prefix) =>
    capability.startsWith(`${prefix}.`),
  );
}

/** Bu iş türü onaylı senaryo ister mi? Anlatım modülü dışındaki türler için `false`. */
export function requiresApprovedScript(kind: string): boolean {
  return (
    kind.startsWith('explainer.') &&
    !(EXPLAINER_PRE_APPROVAL_JOB_KINDS as readonly string[]).includes(kind)
  );
}

/** Veritabanındaki boyut sınırları (CHECK kısıtları ve trigger'lar). */
export const EXPLAINER_LIMITS = {
  seriesName: 120,
  theme: 2000,
  prompt: 2000,
  title: 200,
  summary: 2000,
  hook: 500,
  visualIdea: 2000,
  scriptText: 20000,
  factNotes: 200,
  claim: 1000,
  sourcesPerClaim: 10,
  suggestionsPerRequest: 20,
  sourceCandidates: 10,
  sensitivityNote: 1000,
  rejectionReason: 500,
} as const;

/** Bir iddianın kaynağı. `title` ve `url`'den en az biri dolu olmalı. */
export type FactSource = {
  readonly title?: string;
  readonly url?: string;
  /** Birincil kaynak mı (resmî rapor, kurumun açıklaması, hakemli yayın)? */
  readonly primary?: boolean;
};

/** `episodes.fact_notes` elemanı: iddia → kaynaklar. */
export type FactNote = {
  readonly claim: string;
  readonly sources?: readonly FactSource[];
  readonly note?: string;
  /** Kaynaklar ayrışıyorsa önerilen temkinli ifade (#218). */
  readonly cautious_wording?: string;
};

/** Bir iddia en az bu kadar kaynak ister. */
export const MIN_SOURCES_PER_CLAIM = 2;

/** İddianın kaynağı eksik mi? (`episodes.unsourced_claim_count` aynı kuralı sayar.) */
export function isUndersourced(note: FactNote): boolean {
  return (note.sources?.length ?? 0) < MIN_SOURCES_PER_CLAIM;
}

export function unsourcedClaimCount(notes: readonly FactNote[]): number {
  return notes.filter(isUndersourced).length;
}

/**
 * Kaynak eksiği var mı? Varsa `approve_episode_script()` ancak eksik bilerek kabul edilirse
 * (`p_acknowledge_fact_gaps`) onay verir.
 */
export function hasFactGaps(notes: readonly FactNote[]): boolean {
  return notes.length === 0 || unsourcedClaimCount(notes) > 0;
}

/** `create_topic_request()` / `add_topic_suggestions()` öneri elemanı. */
export type TopicSuggestionInput = {
  readonly title: string;
  readonly summary?: string;
  readonly hook?: string;
  readonly visual_idea?: string;
  readonly kind?: ExplainerKind;
  readonly evidence_level?: EvidenceLevel;
  readonly evidence_detail?: Readonly<Record<string, unknown>>;
  readonly source_candidates?: readonly FactSource[];
  readonly sensitivity_note?: string;
};

/** Serinin varsayılanları (`create_series` / `update_series`). */
export type SeriesSettings = {
  readonly theme?: string;
  readonly kind?: ExplainerKind | null;
  readonly visual_route?: VisualRoute | null;
  readonly style_key?: string | null;
  readonly voice_provider?: string | null;
  readonly voice_name?: string | null;
  readonly voice_rate?: string | null;
  readonly caption_style?: Readonly<Record<string, unknown>>;
  readonly language?: string;
  readonly default_params?: Readonly<Record<string, unknown>>;
};

/**
 * İşe alınırken dondurulan parametreler (`enqueue_episode_job` → `jobs.params` ve
 * `episodes.params_snapshot`). Sıra: seri varsayılanı → bölümde üstüne yazılan → çağrıdaki ek.
 */
export type EpisodeJobParams = {
  readonly episode: {
    readonly id: string;
    readonly number: number | null;
    readonly title: string;
    readonly kind: ExplainerKind;
    readonly language: string;
    readonly script_version: number;
  };
  readonly series: {
    readonly id: string;
    readonly name: string;
    readonly theme: string;
  } | null;
  readonly visual_route: VisualRoute | null;
  readonly style_key: string | null;
  readonly voice: {
    readonly provider: string | null;
    readonly name: string | null;
    readonly rate: string | null;
  };
  readonly caption_style: Readonly<Record<string, unknown>>;
  readonly params: Readonly<Record<string, unknown>>;
};

export function isExplainerKind(value: string): value is ExplainerKind {
  return (EXPLAINER_KINDS as readonly string[]).includes(value);
}

export function isVisualRoute(value: string): value is VisualRoute {
  return (VISUAL_ROUTES as readonly string[]).includes(value);
}

export function isEvidenceLevel(value: string): value is EvidenceLevel {
  return (EVIDENCE_LEVELS as readonly string[]).includes(value);
}

export function isEpisodeStatus(value: string): value is EpisodeStatus {
  return (EPISODE_STATUSES as readonly string[]).includes(value);
}

/**
 * Senaryo değiştirilebilir mi? Üretim açıkken (sırada, çalışıyor, inceleme bekliyor), yayından
 * sonra ve arşivde veritabanı reddeder. Değişiklik onayı siler ve yeni sürüm açar.
 */
export function canEditScript(status: EpisodeStatus): boolean {
  return (
    status === 'draft' ||
    status === 'script_ready' ||
    status === 'script_approved' ||
    status === 'approved'
  );
}

/** Senaryo onaylanabilir mi? (Yazılmış ve henüz onaylanmamış.) */
export function canApproveScript(status: EpisodeStatus): boolean {
  return status === 'script_ready';
}

/** Üretim başlatılabilir mi? (Senaryo onaylı; `approved` bölümde yeni bir sürüm üretilebilir.) */
export function canStartProduction(status: EpisodeStatus): boolean {
  return status === 'script_approved' || status === 'approved';
}

/** Bölüm başka seriye taşınabilir mi? (Yalnız üretim başlamadan.) */
export function canMoveEpisode(status: EpisodeStatus): boolean {
  return (
    status === 'draft' ||
    status === 'script_ready' ||
    status === 'script_approved'
  );
}

/** "Bölüm 3"; tekil videoda (numara yok) `null`. */
export function episodeLabel(episodeNumber: number | null): string | null {
  return episodeNumber === null ? null : `Bölüm ${episodeNumber}`;
}

const TOPIC_KEY_FOLD: Readonly<Record<string, string>> = {
  İ: 'i',
  I: 'i',
  Ş: 's',
  Ğ: 'g',
  Ü: 'u',
  Ö: 'o',
  Ç: 'c',
  ı: 'i',
  ş: 's',
  ğ: 'g',
  ü: 'u',
  ö: 'o',
  ç: 'c',
  Â: 'a',
  â: 'a',
  Î: 'i',
  î: 'i',
  Û: 'u',
  û: 'u',
};

/**
 * Başlığın karşılaştırma anahtarı; veritabanındaki `internal.topic_key()` ile aynı kural
 * (`title_key` kolonu, `find_similar_topics`). Yazarken anlık "benzer konu" ipucu içindir;
 * kesin sonuç RPC'den gelir.
 */
export function topicKey(title: string): string {
  return Array.from(title)
    .slice(0, 300)
    .map((char) => TOPIC_KEY_FOLD[char] ?? char)
    .join('')
    .replace(/[A-Z]/g, (char) => char.toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
