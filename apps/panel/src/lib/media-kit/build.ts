/**
 * Medya kiti veri toplama (#60). Saf fonksiyon: girdi veritabanından okunan ham satırlardır,
 * hiçbir sayı tahmin edilmez. Veri yoksa ilgili alan `null` olur ve kitte "veri yok" yazar.
 *
 * Kurallar (dashboard #54 ile aynı yaklaşım):
 * - Takipçi: hesap başına `asOf` anına kadarki son `account_snapshots` ölçümü. Bir hesap
 *   ölçümsüzse toplam null (eksik hesabı 0 saymak takipçiyi olduğundan az gösterir).
 * - Takipçi değişimi: dönem başındaki son ölçümle fark; bir hesabın başlangıç ölçümü yoksa null.
 * - İçerik metrikleri: dönemde yayınlanan postların `asOf`'a kadarki son `metric_snapshots`
 *   ölçümü. Ölçümü olmayan post ortalamaya girmez, sayısı ayrıca döner.
 * - Etkileşim oranı: (beğeni + yorum + paylaşım + kaydetme) / izlenme × 100, izlenmeye göre ağırlıklı.
 * - Kitle demografisi şemada yok (#50/#51 gelene kadar) → her zaman null.
 * - Hizmetler ve fiyat aralıkları (#28) sabittir; aralık toplam takipçiye göre seçilir. Rakamlar
 *   piyasa araştırmasına dayalı başlangıç tahminleridir (docs/monetization.md), kesin fiyat değildir.
 * - İletişim e-postası veritabanında değil, sunucu ortam değişkeninde (MEDIA_KIT_CONTACT_EMAIL) durur.
 */

export const MEDIA_KIT_WINDOW_DAYS = 30;
export const MEDIA_KIT_TOP_POSTS = 3;

export const AI_DISCLOSURE =
  'Bu karakter yapay zekâ ile oluşturulmuş kurgusal bir karakterdir. İçerikler AI araçlarıyla üretilir ve her paylaşımda platformun AI içerik açıklaması kullanılır; sponsorlu paylaşımlarda ise içerik başında, kaydırmadan görünen “Reklam” ibaresi yer alır.';

/**
 * Medya kitindeki hizmetler. `factor`: sponsorlu Reels aralığına göre alt/üst çarpan
 * (gerekçe: docs/monetization.md → Fiyat aralıkları).
 */
export const MEDIA_KIT_SERVICES = [
  {
    key: 'sponsored_reel',
    label: 'Sponsorlu Reels / kısa video',
    description:
      'Markaya özel 20–45 sn dikey video; Instagram Reels, TikTok ve YouTube Shorts.',
    factor: [1, 1],
  },
  {
    key: 'product_placement',
    label: 'Ürün yerleştirme',
    description:
      'Karakterin hikâyesine doğal biçimde yerleşen ürün; videonun ana konusu ürün değildir.',
    factor: [0.6, 0.8],
  },
  {
    key: 'series',
    label: 'Seri içerik (3 video)',
    description:
      'Aynı kampanya için 3 bölümlük mini hikâye; tek tek fiyata göre paket indirimi.',
    factor: [2.4, 2.7],
  },
  {
    key: 'story',
    label: 'Hikâye paylaşımı',
    description: 'Instagram hikâyesi (3 kare) ve bağlantı çıkartması.',
    factor: [0.3, 0.4],
  },
] as const;

/** Toplam takipçi kademesine göre sponsorlu Reels başlangıç aralığı (USD, tahmin). */
export const MEDIA_KIT_PRICE_TIERS: ReadonlyArray<{
  label: string;
  minFollowers: number;
  reel: readonly [number, number] | null;
}> = [
  { label: '0–10 B takipçi', minFollowers: 0, reel: [50, 150] },
  { label: '10–50 B takipçi', minFollowers: 10_000, reel: [150, 500] },
  { label: '50–100 B takipçi', minFollowers: 50_000, reel: [500, 1000] },
  { label: '100–500 B takipçi', minFollowers: 100_000, reel: [1000, 3000] },
  { label: '500 B+ takipçi', minFollowers: 500_000, reel: null },
];

export const MEDIA_KIT_PRICE_CURRENCY = 'USD';

export const MEDIA_KIT_PRICE_NOTE =
  'Aralıklar başlangıç tahminidir, kesin fiyat değildir. Nihai teklif brief, kullanım hakkı, münhasırlık ve revizyon sayısına göre verilir; TL teklifte günün kuru kullanılır.';

export type MediaKitPricing = {
  /** Takipçi kademesi; takipçi verisi yoksa null */
  tier: string | null;
  currency: string;
  note: string;
  services: Array<{
    key: string;
    label: string;
    description: string;
    /** null: takipçi verisi yok veya kademe "teklif üzerine" */
    range: [number, number] | null;
  }>;
};

const roundPrice = (value: number) =>
  value < 100 ? Math.round(value / 5) * 5 : Math.round(value / 10) * 10;

/** Toplam takipçiye göre hizmet fiyat aralıkları. Takipçi bilinmiyorsa aralık verilmez. */
export function buildPricing(followers: number | null): MediaKitPricing {
  const tier =
    followers === null
      ? null
      : ([...MEDIA_KIT_PRICE_TIERS]
          .reverse()
          .find((item) => followers >= item.minFollowers) ?? null);
  return {
    tier: tier?.label ?? null,
    currency: MEDIA_KIT_PRICE_CURRENCY,
    note: MEDIA_KIT_PRICE_NOTE,
    services: MEDIA_KIT_SERVICES.map((service) => ({
      key: service.key,
      label: service.label,
      description: service.description,
      range: tier?.reel
        ? [
            roundPrice(tier.reel[0] * service.factor[0]),
            roundPrice(tier.reel[1] * service.factor[1]),
          ]
        : null,
    })),
  };
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Ortam değişkenindeki iletişim adresini doğrular; boş veya geçersizse null. */
export function parseContactEmail(
  raw: string | undefined | null,
): string | null {
  const value = raw?.trim() ?? '';
  return value.length <= 254 && EMAIL.test(value) ? value : null;
}

export type MediaKitInput = {
  asOf: string;
  /** İletişim e-postası (MEDIA_KIT_CONTACT_EMAIL); yoksa kitte "veri yok" yazar. */
  contactEmail?: string | null;
  windowDays?: number;
  influencer: {
    name: string;
    slug: string;
    niche: string | null;
    bio: string | null;
  };
  accounts: Array<{ id: string; platform: string; handle: string }>;
  accountSnapshots: Array<{
    account_id: string;
    captured_at: string;
    followers: number;
  }>;
  posts: Array<{
    id: string;
    account_id: string;
    caption: string;
    url: string | null;
    published_at: string | null;
  }>;
  metricSnapshots: Array<{
    post_id: string;
    captured_at: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    avg_watch_time_s: number | string | null;
  }>;
};

export type MediaKit = {
  influencer: MediaKitInput['influencer'];
  period: { from: string; to: string; days: number };
  aiDisclosure: string;
  followers: {
    total: number | null;
    change: number | null;
    accounts: Array<{
      platform: string;
      handle: string;
      followers: number | null;
      capturedAt: string | null;
    }>;
  };
  content: {
    postCount: number;
    measuredPostCount: number;
    avgViews: number | null;
    engagementRate: number | null;
    avgWatchTimeS: number | null;
  };
  topPosts: Array<{
    caption: string;
    url: string | null;
    platform: string;
    handle: string;
    publishedAt: string;
    views: number;
    engagementRate: number | null;
  }>;
  audience: null;
  pricing: MediaKitPricing;
  contact: { email: string | null };
};

const ms = (iso: string) => new Date(iso).getTime();

function latestBefore<T extends { captured_at: string }>(
  rows: T[],
  limit: number,
): T | null {
  let best: T | null = null;
  for (const row of rows) {
    const at = ms(row.captured_at);
    if (at <= limit && (!best || at > ms(best.captured_at))) best = row;
  }
  return best;
}

const engagementOf = (m: {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}) => Number(m.likes) + Number(m.comments) + Number(m.shares) + Number(m.saves);

function rate(engagement: number, views: number): number | null {
  return views > 0 ? Math.round((engagement / views) * 10000) / 100 : null;
}

export function buildMediaKit(input: MediaKitInput): MediaKit {
  const days = input.windowDays ?? MEDIA_KIT_WINDOW_DAYS;
  const end = ms(input.asOf);
  if (Number.isNaN(end)) throw new RangeError('Geçersiz asOf');
  const start = end - days * 24 * 60 * 60 * 1000;

  const snapshotsByAccount = new Map<
    string,
    MediaKitInput['accountSnapshots']
  >();
  for (const row of input.accountSnapshots) {
    const list = snapshotsByAccount.get(row.account_id) ?? [];
    list.push(row);
    snapshotsByAccount.set(row.account_id, list);
  }

  const accounts = input.accounts.map((account) => {
    const rows = snapshotsByAccount.get(account.id) ?? [];
    const latest = latestBefore(rows, end);
    const baseline = latestBefore(rows, start);
    return { account, latest, baseline };
  });
  const allMeasured =
    accounts.length > 0 && accounts.every((item) => item.latest);
  const total = allMeasured
    ? accounts.reduce((acc, item) => acc + Number(item.latest!.followers), 0)
    : null;
  const allBaselines = allMeasured && accounts.every((item) => item.baseline);
  const change =
    total !== null && allBaselines
      ? total -
        accounts.reduce(
          (acc, item) => acc + Number(item.baseline!.followers),
          0,
        )
      : null;

  const accountById = new Map(input.accounts.map((item) => [item.id, item]));
  const metricsByPost = new Map<string, MediaKitInput['metricSnapshots']>();
  for (const row of input.metricSnapshots) {
    const list = metricsByPost.get(row.post_id) ?? [];
    list.push(row);
    metricsByPost.set(row.post_id, list);
  }

  const posts = input.posts.filter((post) => {
    if (!post.published_at || !accountById.has(post.account_id)) return false;
    const at = ms(post.published_at);
    return at > start && at <= end;
  });
  const measured = posts.flatMap((post) => {
    const latest = latestBefore(metricsByPost.get(post.id) ?? [], end);
    return latest ? [{ post, metric: latest }] : [];
  });

  const views = measured.reduce(
    (acc, item) => acc + Number(item.metric.views),
    0,
  );
  const engagement = measured.reduce(
    (acc, item) => acc + engagementOf(item.metric),
    0,
  );
  // Saniyeler binde bir hassasiyetle tamsayıya çevrilir (float toplama hatası yuvarlamayı bozmasın)
  const watchTimes = measured
    .map((item) => item.metric.avg_watch_time_s)
    .filter((value): value is number | string => value !== null)
    .map((value) => Math.round(Number(value) * 1000));

  const topPosts = [...measured]
    .sort(
      (a, b) =>
        Number(b.metric.views) - Number(a.metric.views) ||
        ms(b.post.published_at!) - ms(a.post.published_at!),
    )
    .slice(0, MEDIA_KIT_TOP_POSTS)
    .map(({ post, metric }) => {
      const account = accountById.get(post.account_id)!;
      return {
        caption: post.caption,
        url: post.url,
        platform: account.platform,
        handle: account.handle,
        publishedAt: post.published_at!,
        views: Number(metric.views),
        engagementRate: rate(engagementOf(metric), Number(metric.views)),
      };
    });

  return {
    influencer: input.influencer,
    period: {
      from: new Date(start).toISOString(),
      to: new Date(end).toISOString(),
      days,
    },
    aiDisclosure: AI_DISCLOSURE,
    followers: {
      total,
      change,
      accounts: accounts.map(({ account, latest }) => ({
        platform: account.platform,
        handle: account.handle,
        followers: latest ? Number(latest.followers) : null,
        capturedAt: latest?.captured_at ?? null,
      })),
    },
    content: {
      postCount: posts.length,
      measuredPostCount: measured.length,
      avgViews: measured.length ? Math.round(views / measured.length) : null,
      engagementRate: rate(engagement, views),
      avgWatchTimeS: watchTimes.length
        ? Math.round(
            watchTimes.reduce((acc, value) => acc + value, 0) /
              watchTimes.length /
              100,
          ) / 10
        : null,
    },
    topPosts,
    audience: null,
    pricing: buildPricing(total),
    contact: { email: parseContactEmail(input.contactEmail) },
  };
}

const platformLabels: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};
export const platformLabel = (platform: string) =>
  platformLabels[platform] ?? platform;

export const NO_DATA = 'veri yok';

export function formatCount(value: number | null): string {
  return value === null
    ? NO_DATA
    : new Intl.NumberFormat('tr-TR').format(value);
}

export function formatSigned(value: number | null): string {
  if (value === null) return NO_DATA;
  const text = new Intl.NumberFormat('tr-TR').format(Math.abs(value));
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : '0';
}

export function formatPercent(value: number | null): string {
  return value === null
    ? NO_DATA
    : `%${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
}

export function formatSeconds(value: number | null): string {
  return value === null
    ? NO_DATA
    : `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value)} sn`;
}

/** Fiyat aralığı: "150–500 USD"; aralık yoksa "teklif üzerine". */
export function formatPriceRange(
  range: readonly [number, number] | null,
  currency: string,
): string {
  if (!range) return 'teklif üzerine';
  const format = new Intl.NumberFormat('tr-TR').format;
  return `${format(range[0])}–${format(range[1])} ${currency}`;
}

/** ISO zaman damgasını Türkiye saatiyle gg.aa.yyyy olarak yazar. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}
