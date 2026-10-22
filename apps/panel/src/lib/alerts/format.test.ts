// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALERT_TYPES } from '@ai-influencer/shared';
import { formatAlert, formatAlertTime } from './format';

const influencer = { name: 'Demo Creator', slug: 'demo-creator' };
const migration = readFileSync(
  join(
    fileURLToPath(new URL('.', import.meta.url)),
    '../../../../../supabase/migrations/20261022210000_notifications.sql',
  ),
  'utf8',
);

describe('uyarı türleri', () => {
  it('TS listesi migration CHECK listesiyle aynı', () => {
    const check = migration.match(
      /alerts_type_known CHECK \(type IN \(([\s\S]*?)\)\)/,
    );
    expect(check).not.toBeNull();
    const sqlTypes = [...check![1]!.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect([...sqlTypes].sort()).toEqual([...ALERT_TYPES].sort());
  });

  it('her tür için push başlığı SQL tarafında da tanımlı', () => {
    for (const type of ALERT_TYPES) {
      expect(migration).toContain(`WHEN '${type}' THEN`);
    }
  });
});

describe('formatAlert', () => {
  it('viral eşik: izlenme ve oran', () => {
    const text = formatAlert({
      type: 'viral_post',
      payload: { platform: 'youtube', views: 9600, ratio: 3.5 },
      influencer,
    });
    expect(text.title).toBe('Viral eşik aşıldı');
    expect(text.message).toContain('YouTube');
    expect(text.message).toContain('9.600');
    expect(text.message).toContain('3,5 katı');
    expect(text.href).toBe('/analytics?inf=demo-creator');
  });

  it('takipçi kilometre taşı', () => {
    const text = formatAlert({
      type: 'follower_milestone',
      payload: { platform: 'instagram', milestone: 10000 },
      influencer,
    });
    expect(text.title).toBe('Takipçi kilometre taşı');
    expect(text.message).toBe(
      'Demo Creator: Instagram hesabı 10.000 takipçiyi geçti.',
    );
  });

  it('token süresi: kalan gün ve dolmuş token', () => {
    expect(
      formatAlert({
        type: 'token_expiring',
        payload: { platform: 'tiktok', days_left: 5 },
        influencer,
      }).message,
    ).toContain('5 gün içinde doluyor');
    const expired = formatAlert({
      type: 'token_expiring',
      payload: { days_left: 0 },
      influencer: null,
    });
    expect(expired.message).toContain('doldu');
    expect(expired.href).toBe('/influencers');
  });

  it('senkronizasyon hatası influencer sayfasına gider', () => {
    const text = formatAlert({
      type: 'sync_failed',
      payload: { platform: 'youtube' },
      influencer,
    });
    expect(text.title).toBe('Senkronizasyon hatası');
    expect(text.href).toBe('/influencers/demo-creator');
  });

  it('bütçe uyarısı ve aşımı yüzdeyi gösterir', () => {
    const warning = formatAlert({
      type: 'budget_warning',
      payload: { month: '2026-10', ratio: 0.8 },
      influencer: null,
    });
    expect(warning.title).toBe('Bütçe uyarı eşiğine ulaştı');
    expect(warning.message).toContain('%80');
    expect(warning.href).toBe('/costs');
    expect(
      formatAlert({
        type: 'budget_exceeded',
        payload: { ratio: '1.05' },
        influencer,
      }).title,
    ).toBe('Bütçe aşıldı');
  });

  it('yayın saati geldi, içerik hazır değil: aşama adı', () => {
    const text = formatAlert({
      type: 'content_not_ready',
      payload: { stage: 'edit' },
      influencer,
    });
    expect(text.message).toContain('“Düzenleme” aşamasında');
    expect(text.href).toBe('/content?inf=demo-creator');
  });

  it('başarısız üretim', () => {
    expect(
      formatAlert({
        type: 'generation_failed',
        payload: { generation_type: 'video' },
        influencer: null,
      }).message,
    ).toBe('Video üretimi başarısız oldu.');
  });

  it('bilinmeyen tür ve bozuk payload çökmez', () => {
    const text = formatAlert({
      type: 'something_else',
      payload: {},
      influencer: null,
    });
    expect(text.title).toBe('Uyarı');
    expect(
      formatAlert({
        type: 'viral_post',
        payload: { views: 'abc', ratio: null },
        influencer: null,
      }).message,
    ).toContain('? izlenme');
  });

  it('payload metni HTML olarak yorumlanmaz, yalnız bilinen alanlar kullanılır', () => {
    const text = formatAlert({
      type: 'sync_failed',
      payload: { platform: '<img src=x onerror=alert(1)>' },
      influencer: null,
    });
    expect(text.message).not.toContain('<img');
  });
});

describe('formatAlertTime', () => {
  it('İstanbul saatine göre biçimler, geçersiz tarih boş döner', () => {
    expect(formatAlertTime('2026-10-22T09:00:00Z')).toContain('12:00');
    expect(formatAlertTime('not-a-date')).toBe('');
  });
});
