// Ortak üretim işi modeli (#201, docs/adr/0004-moduler-panel.md → Karar 1-3).
// Listeler `20261115100000_production_jobs.sql` içindeki CHECK kısıtlarıyla aynıdır; panel testi
// (apps/panel/src/lib/jobs/job-model.test.ts) iki tarafın ayrışmadığını denetler.
// Bu dosya başka dosya içe aktarmaz: hem panel (bundler) hem makine programı (Node) doğrudan okur.

/** Panel modülleri. Veritabanında `jobs.module` (text + CHECK). */
export const MODULES = ['influencer', 'explainer', 'clip'] as const;
export type ModuleId = (typeof MODULES)[number];

/** Park edilen modüller (docs/scope-v1.md): altyapısı durur, v1'de iş açılmaz. */
export const PARKED_MODULES: readonly ModuleId[] = ['influencer'];

export function isModuleId(value: string): value is ModuleId {
  return (MODULES as readonly string[]).includes(value);
}

/** İş durumları: sırada, üretiliyor, onay bekliyor, hazır, hata, iptal. */
export const JOB_STATUSES = [
  'queued',
  'running',
  'awaiting_approval',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  'succeeded',
  'failed',
  'cancelled',
];

/**
 * Geçerli iş durumu geçişleri. Kaynak `private.jobs_guard()` trigger'ıdır; bu tablo yalnız
 * arayüzün (ör. hangi düğme gösterilir) aynı kuralı okuması içindir. `awaiting_approval`'dan
 * `queued` / `succeeded`'a yalnız onaydan sonra geçilir.
 */
export const JOB_TRANSITIONS: Readonly<
  Record<JobStatus, readonly JobStatus[]>
> = {
  queued: ['running', 'cancelled'],
  running: ['queued', 'awaiting_approval', 'succeeded', 'failed', 'cancelled'],
  awaiting_approval: ['queued', 'succeeded', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

/** İptal istenebilir mi? (Biten iş iptal edilemez.) */
export function canCancelJob(status: JobStatus): boolean {
  return !isTerminalJobStatus(status);
}

/** Yeniden denenebilir mi? (Yalnız hata ya da iptal; yeni iş `retry_of` ile açılır.) */
export function canRetryJob(status: JobStatus): boolean {
  return status === 'failed' || status === 'cancelled';
}

export const JOB_STAGE_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'skipped',
] as const;
export type JobStageStatus = (typeof JOB_STAGE_STATUSES)[number];

/** İş ↔ dosya bağının rolü (`job_assets.role`). */
export const JOB_ASSET_ROLES = [
  'input',
  'audio',
  'captions',
  'frame',
  'preview',
  'final',
  'other',
] as const;
export type JobAssetRole = (typeof JOB_ASSET_ROLES)[number];

/** Üretim makinesinin platformu (`production_workers.platform`, Node `process.platform`). */
export const WORKER_PLATFORMS = ['darwin', 'win32', 'linux'] as const;
export type WorkerPlatform = (typeof WORKER_PLATFORMS)[number];

/** Bu kadar saniye kalp atışı gelmeyen makine çevrimdışı sayılır (ADR 0004 → Karar 3). */
export const WORKER_OFFLINE_AFTER_SECONDS = 90;

/** `enqueue_job()`'a verilen aşama tanımı. */
export type JobStageDefinition = {
  readonly key: string;
  readonly requires_approval?: boolean;
};

/**
 * İş türleri ve aşamaları (`jobs.kind` = `<modül>.<iş>`). Aşama sırası ve onay kapıları işe
 * alınırken `job_stages`'e yazılır ve sonradan değişmez. Başlangıç tanımıdır: aşamaların içi
 * modül issue'larında (#218-#220, #226, #227) doldurulurken liste oradan güncellenir.
 *
 * Anlatım modülü (#216): senaryo onayı işin aşaması değil, bölümün kendisindedir
 * (`approve_episode_script`). `explainer.topics` ve `explainer.script` ön hazırlık işleridir;
 * diğer her `explainer.*` türü üretim işidir, yalnız `enqueue_episode_job` ile ve onaylı
 * senaryoyla açılır, son aşaması video onayıdır (bkz. `explainer.ts`).
 * `explainer.*` aşamaları veritabanında SABİTTİR (`private.explainer_job_stages`): istemci
 * aşama listesi veremez, tanımsız tür açılamaz. Buradaki tanım o fonksiyonla birebir aynı olmalı
 * (explainer-model.test.ts denetler); değişiklik yeni migration + bu liste birlikte yapılır.
 */
export const JOB_KINDS = {
  'explainer.topics': {
    module: 'explainer',
    stages: [{ key: 'research' }],
  },
  'explainer.script': {
    module: 'explainer',
    stages: [{ key: 'research' }, { key: 'draft' }],
  },
  'explainer.render': {
    module: 'explainer',
    stages: [
      { key: 'voice' },
      { key: 'captions' },
      { key: 'visuals' },
      { key: 'render', requires_approval: true },
    ],
  },
  'clip.preview': {
    module: 'clip',
    stages: [{ key: 'fetch' }, { key: 'moments' }, { key: 'quality' }],
  },
  'clip.cut': {
    module: 'clip',
    stages: [
      { key: 'cut' },
      { key: 'captions' },
      { key: 'render', requires_approval: true },
    ],
  },
  // Sahte iş (#211): üretim makinesinin iş döngüsünü uçtan uca dener; gerçek render yapmaz.
  // Klip modülünde: anlatım türlerinin aşamaları sunucuda sabittir (#216), bu türünki serbesttir.
  'clip.selftest': {
    module: 'clip',
    stages: [
      { key: 'prepare' },
      { key: 'review', requires_approval: true },
      { key: 'finish' },
    ],
  },
} as const satisfies Record<
  string,
  { module: ModuleId; stages: readonly JobStageDefinition[] }
>;
export type JobKind = keyof typeof JOB_KINDS;

export function isJobKind(value: string): value is JobKind {
  return Object.hasOwn(JOB_KINDS, value);
}

/** Türün aşama anahtarları, sırasıyla. */
export function jobStageKeys(kind: JobKind): string[] {
  return JOB_KINDS[kind].stages.map((stage) => stage.key);
}

/**
 * Bir iş türünü çalıştırabilen makinenin bildirdiği yetenek (`kind:<tür>`). `claim_job` yalnız
 * yeteneklere bakar; işi açan taraf bu anahtarı `required_capabilities`'e ekler ki iş, o türün
 * işleyicisi olmayan bir makineye verilmesin.
 */
export function jobKindCapability(kind: JobKind): string {
  const capability = `kind:${kind}`;
  if (!/^[a-z0-9][a-z0-9_.:-]{0,39}$/.test(capability))
    throw new Error(`Yetenek anahtarı çok uzun: ${capability}`);
  return capability;
}
