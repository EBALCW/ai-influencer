/**
 * Post analitiği için saf hesaplar (#55). Medyan/ortalama gibi toplamlar
 * veritabanında (`post_analytics`, `post_segments`) hesaplanır; burada yalnız
 * gelen özet değerlerden skor, işaret ve tablo satırları üretilir.
 */

export const CHECKPOINT_HOURS = [1, 5, 24, 72, 168] as const;
export type CheckpointHours = (typeof CHECKPOINT_HOURS)[number];

export function isCheckpointHours(value: number): value is CheckpointHours {
  return (CHECKPOINT_HOURS as readonly number[]).includes(value);
}

export function checkpointLabel(hours: number) {
  return hours >= 48 && hours % 24 === 0 ? `${hours / 24} gün` : `${hours} sa`;
}

export type Checkpoint = {
  hours: number;
  views: number | null;
  median: number | null;
  average: number | null;
  measured: number;
};

/** Ölçülmemiş (null) değerler yok sayılır. Hiç değer yoksa null. */
export function median(values: ReadonlyArray<number | null | undefined>) {
  const sorted = values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Performans skoru = postun değeri / kıyas medyanı. 1 = hesabın tipik postu. */
export function performanceScore(
  views: number | null | undefined,
  baseline: number | null | undefined,
) {
  if (views == null || baseline == null || baseline <= 0) return null;
  return Math.round((views / baseline) * 100) / 100;
}

export type ScoreTone = 'above' | 'near' | 'below' | 'unknown';

export function scoreTone(score: number | null): ScoreTone {
  if (score === null) return 'unknown';
  if (score >= 1.2) return 'above';
  if (score >= 0.8) return 'near';
  return 'below';
}

export const scoreToneLabels: Record<ScoreTone, string> = {
  above: 'Hesap medyanının üstünde',
  near: 'Hesap medyanına yakın',
  below: 'Hesap medyanının altında',
  unknown: 'Kıyas için yeterli ölçüm yok',
};

/** En az bu kadar ölçülmüş kıyas postu yoksa skor anlamlı sayılmaz. */
export const MIN_BASELINE_POSTS = 3;

/**
 * Ana skor: tercihen 24 sa; yoksa ölçümü ve yeterli kıyası olan en geç kontrol
 * noktası. Hiçbiri yoksa null.
 */
export function primaryScore(
  checkpoints: readonly Checkpoint[],
  minBaseline = MIN_BASELINE_POSTS,
) {
  const usable = checkpoints.filter(
    (c) => c.views !== null && c.median !== null && c.measured >= minBaseline,
  );
  const pick =
    usable.find((c) => c.hours === 24) ??
    [...usable].sort((a, b) => b.hours - a.hours)[0];
  if (!pick) return null;
  return {
    hours: pick.hours,
    score: performanceScore(pick.views, pick.median),
  };
}

export const FIRST_WAVE_THRESHOLD = 0.5;

export type FirstWave =
  | { status: 'below' | 'passed'; hours: number; ratio: number }
  | { status: 'pending' | 'insufficient'; hours: null; ratio: null };

/**
 * İlk test dalgası: platform yeni postu önce küçük bir kitleye gösterir. İlk 1–5
 * saatte izlenme hesap medyanının `threshold` katının altındaysa post işaretlenir.
 * Ölçülmüş en geç erken kontrol noktası (5 sa, yoksa 1 sa) belirleyicidir.
 */
export function firstWave(
  checkpoints: readonly Checkpoint[],
  threshold = FIRST_WAVE_THRESHOLD,
  minBaseline = MIN_BASELINE_POSTS,
): FirstWave {
  const early = checkpoints
    .filter((c) => c.hours <= 5 && c.views !== null)
    .sort((a, b) => b.hours - a.hours);
  if (!early.length) return { status: 'pending', hours: null, ratio: null };
  const judged = early.find(
    (c) => c.median !== null && c.median > 0 && c.measured >= minBaseline,
  );
  if (!judged) return { status: 'insufficient', hours: null, ratio: null };
  const ratio = performanceScore(judged.views, judged.median)!;
  return {
    status: ratio < threshold ? 'below' : 'passed',
    hours: judged.hours,
    ratio,
  };
}

export type SnapshotMetrics = {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
};

/** Etkileşim oranı = (beğeni + yorum + paylaşım + kayıt) / izlenme. */
export function engagementRate(snapshot: SnapshotMetrics | null | undefined) {
  if (!snapshot || snapshot.views <= 0) return null;
  const interactions =
    snapshot.likes + snapshot.comments + snapshot.shares + snapshot.saves;
  return interactions / snapshot.views;
}

/** Karşılaştırmada en yüksek değerin sütunu; eşitlik veya veri yoksa null. */
export function bestIndex(values: ReadonlyArray<number | null | undefined>) {
  let best: number | null = null;
  let bestValue = -Infinity;
  let tie = false;
  values.forEach((value, index) => {
    if (value == null) return;
    if (value > bestValue) {
      best = index;
      bestValue = value;
      tie = false;
    } else if (value === bestValue) tie = true;
  });
  const measured = values.filter((v) => v != null).length;
  return measured < 2 || tie ? null : best;
}

// --- Segment analizi --------------------------------------------------------

export const SEGMENT_DIMENSIONS = [
  'hook_type',
  'format',
  'publish_hour',
  'duration',
  'platform',
] as const;
export type SegmentDimension = (typeof SEGMENT_DIMENSIONS)[number];

export const segmentDimensionLabels: Record<SegmentDimension, string> = {
  hook_type: 'Kanca türü',
  format: 'Format',
  publish_hour: 'Yayın saati',
  duration: 'Süre',
  platform: 'Platform',
};

const fixedKeyLabels: Partial<
  Record<SegmentDimension, Record<string, string>>
> = {
  publish_hour: {
    night: 'Gece (00–06)',
    morning: 'Sabah (06–12)',
    afternoon: 'Öğleden sonra (12–18)',
    evening: 'Akşam (18–24)',
  },
  duration: {
    lt15: '15 sn altı',
    '15to30': '15–30 sn',
    '30to60': '30–60 sn',
    gte60: '60 sn ve üstü',
  },
  platform: { instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok' },
  format: { short_video: 'Kısa video' },
};

export function segmentKeyLabel(dimension: SegmentDimension, key: string) {
  if (!key) return 'Belirtilmemiş';
  return fixedKeyLabels[dimension]?.[key] ?? key;
}

export type SegmentAggregate = {
  dimension: string;
  key: string;
  posts: number;
  measured: number;
  median: number | null;
  average: number | null;
};

export type SegmentRow = SegmentAggregate & {
  label: string;
  /** Segment medyanı / genel medyan */
  index: number | null;
};

/**
 * Veritabanından gelen segment toplamlarını boyut başına tabloya çevirir.
 * Satırlar medyana göre (büyükten küçüğe, ölçümsüzler sonda) sıralanır.
 * Bilinmeyen boyutlar atlanır, her boyut boş olsa da listelenir.
 */
export function segmentTables(
  segments: readonly SegmentAggregate[],
  overallMedian: number | null,
) {
  return SEGMENT_DIMENSIONS.map((dimension) => {
    const rows: SegmentRow[] = segments
      .filter((s) => s.dimension === dimension)
      .map((s) => ({
        ...s,
        label: segmentKeyLabel(dimension, s.key),
        index: performanceScore(s.median, overallMedian),
      }))
      .sort((a, b) => {
        if (a.median === null && b.median === null)
          return a.label.localeCompare(b.label, 'tr');
        if (a.median === null) return 1;
        if (b.median === null) return -1;
        return b.median - a.median || a.label.localeCompare(b.label, 'tr');
      });
    return { dimension, label: segmentDimensionLabels[dimension], rows };
  });
}

// --- Biçimlendirme -----------------------------------------------------------

const integer = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

export function formatCount(value: number | null | undefined) {
  return value == null ? '—' : integer.format(value);
}

export function formatRatio(value: number | null | undefined) {
  return value == null ? '—' : `${decimal.format(value)}×`;
}

export function formatPercent(value: number | null | undefined) {
  return value == null ? '—' : `%${decimal.format(value * 100)}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(value));
}
