import { isAlertType } from '@ai-influencer/shared';

/** Panelde gösterilen uyarı. Metin payload'daki id/sayılardan arayüzde üretilir. */
export type AlertItem = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  read: boolean;
  influencer: { name: string; slug: string } | null;
};

export type FormattedAlert = { title: string; message: string; href: string };

const platforms: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

const stages: Record<string, string> = {
  idea: 'Fikir',
  script: 'Senaryo',
  production: 'Üretim',
  qc: 'Kalite kontrol',
  edit: 'Düzenleme',
  scheduled: 'Planlandı',
  published: 'Yayında',
};

const numberFormat = new Intl.NumberFormat('tr-TR');

function num(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

function count(value: unknown) {
  const n = num(value);
  return n === null ? '?' : numberFormat.format(n);
}

function platform(payload: Record<string, unknown>) {
  const key = typeof payload.platform === 'string' ? payload.platform : '';
  return platforms[key] ?? 'Sosyal';
}

function withInf(path: string, slug: string | undefined) {
  return slug ? `${path}?inf=${encodeURIComponent(slug)}` : path;
}

/** Uyarı türüne göre başlık, açıklama ve ilgili panel sayfası. Bilinmeyen tür genel metin alır. */
export function formatAlert(
  alert: Pick<AlertItem, 'type' | 'payload' | 'influencer'>,
): FormattedAlert {
  const p = alert.payload ?? {};
  const slug = alert.influencer?.slug;
  const who = alert.influencer ? `${alert.influencer.name}: ` : '';
  const type = isAlertType(alert.type) ? alert.type : null;

  switch (type) {
    case 'viral_post': {
      const ratio = num(p.ratio);
      return {
        title: 'Viral eşik aşıldı',
        message: `${who}${platform(p)} postu ilk saatte ${count(p.views)} izlenmeye ulaştı${
          ratio === null
            ? ''
            : `, hesap ortalamasının ${ratio.toLocaleString('tr-TR')} katı`
        }.`,
        href: withInf('/analytics', slug),
      };
    }
    case 'follower_milestone':
      return {
        title: 'Takipçi kilometre taşı',
        message: `${who}${platform(p)} hesabı ${count(p.milestone)} takipçiyi geçti.`,
        href: withInf('/analytics', slug),
      };
    case 'token_expiring': {
      const days = num(p.days_left);
      const when =
        days === null
          ? 'yakında doluyor'
          : days <= 0
            ? 'doldu'
            : `${days} gün içinde doluyor`;
      return {
        title: 'Token süresi doluyor',
        message: `${who}${platform(p)} bağlantısının süresi ${when}. Hesabı yeniden bağlayın.`,
        href: slug
          ? `/influencers/${encodeURIComponent(slug)}`
          : '/influencers',
      };
    }
    case 'sync_failed':
      return {
        title: 'Senkronizasyon hatası',
        message: `${who}${platform(p)} hesabının verileri alınamadı.`,
        href: slug
          ? `/influencers/${encodeURIComponent(slug)}`
          : '/influencers',
      };
    case 'budget_warning':
    case 'budget_exceeded': {
      const ratio = num(p.ratio);
      const percent =
        ratio === null
          ? ''
          : ` (%${Math.round(ratio * 100).toLocaleString('tr-TR')})`;
      const month = typeof p.month === 'string' ? `${p.month} ` : '';
      return {
        title:
          type === 'budget_exceeded'
            ? 'Bütçe aşıldı'
            : 'Bütçe uyarı eşiğine ulaştı',
        message: `${who}${month}bütçesinin ${
          type === 'budget_exceeded' ? 'tamamı aşıldı' : 'uyarı eşiği geçildi'
        }${percent}.`,
        href: withInf('/costs', slug),
      };
    }
    case 'content_not_ready': {
      const stage = typeof p.stage === 'string' ? stages[p.stage] : undefined;
      return {
        title: 'Yayın saati geldi, içerik hazır değil',
        message: `${who}Planlanan içerik${
          stage ? ` hâlâ “${stage}” aşamasında` : ' henüz planlanmadı'
        }.`,
        href: withInf('/content', slug),
      };
    }
    case 'generation_failed':
      return {
        title: 'Üretim başarısız',
        message: `${who}${p.generation_type === 'video' ? 'Video' : 'Görsel'} üretimi başarısız oldu.`,
        href: withInf('/production', slug),
      };
    default:
      return {
        title: 'Uyarı',
        message: `${who}Yeni bir uyarı var.`,
        href: '/notifications',
      };
  }
}

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Istanbul',
});

export function formatAlertTime(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
}
