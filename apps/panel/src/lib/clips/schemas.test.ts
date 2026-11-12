import { describe, expect, it } from 'vitest';
import {
  clipBacklogSchema,
  clipPatchSchema,
  clipSchema,
  clipSourcePatchSchema,
  clipSourceSchema,
  clipsQuerySchema,
} from './schemas';

const SOURCE = '80000000-0000-4000-8000-000000000001';

describe('clipSourceSchema', () => {
  it('linki kanonik biçime çevirir, video id ve varsayılanları doldurur', () => {
    expect(
      clipSourceSchema.parse({
        video_url: ' https://youtu.be/demoClip001?si=x ',
        channel_name: '  Demo Kanal ',
        title: 'Demo yayın',
      }),
    ).toEqual({
      platform: 'youtube',
      video_id: 'demoClip001',
      video_url: 'https://www.youtube.com/watch?v=demoClip001',
      channel_name: 'Demo Kanal',
      channel_url: null,
      title: 'Demo yayın',
      duration_seconds: null,
      notes: '',
    });
  });

  it('YouTube dışı link, boş alan, kötü kanal linki ve istemci alanlarını reddeder', () => {
    const base = {
      video_url: 'https://www.youtube.com/watch?v=demoClip001',
      channel_name: 'Demo Kanal',
      title: 'Demo yayın',
    };
    for (const body of [
      { ...base, video_url: 'https://example.invalid/watch?v=demoClip001' },
      { ...base, video_url: 'javascript:alert(1)' },
      { ...base, channel_name: '   ' },
      { ...base, title: '' },
      { ...base, channel_url: 'http://www.youtube.com/@demo' },
      { ...base, channel_url: 'https://example.invalid/@demo' },
      { ...base, duration_seconds: 0 },
      { ...base, duration_seconds: 1.5 },
      { ...base, permission_status: 'granted' },
      { ...base, created_by: 'spoof' },
      { ...base, video_id: 'spoofSpoof1' },
    ])
      expect(
        clipSourceSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    expect(
      clipSourceSchema.parse({
        ...base,
        channel_url: 'https://www.youtube.com/@demo',
        duration_seconds: 3600,
      }),
    ).toMatchObject({
      channel_url: 'https://www.youtube.com/@demo',
      duration_seconds: 3600,
    });
    expect(
      clipSourceSchema.parse({ ...base, channel_url: '' }).channel_url,
    ).toBe(null);
  });
});

describe('clipSourcePatchSchema', () => {
  it('“izin verildi” için aynı istekte dolu referans ister', () => {
    for (const body of [
      { permission_status: 'granted' },
      { permission_status: 'granted', permission_ref: '   ' },
      { permission_status: 'approved', permission_ref: 'IZIN-1' },
      {},
      { video_url: 'https://www.youtube.com/watch?v=demoClip002' },
      { permission_checked_by: SOURCE },
    ])
      expect(
        clipSourcePatchSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    expect(
      clipSourcePatchSchema.parse({
        permission_status: 'granted',
        permission_ref: ' IZIN-2026-001 ',
      }),
    ).toEqual({
      permission_status: 'granted',
      permission_ref: 'IZIN-2026-001',
    });
    expect(
      clipSourcePatchSchema.parse({
        permission_status: 'denied',
        permission_ref: '',
      }),
    ).toEqual({ permission_status: 'denied', permission_ref: '' });
  });

  it('referansta e-posta kabul etmez', () => {
    const result = clipSourcePatchSchema.safeParse({
      permission_status: 'granted',
      permission_ref: 'izin: kisi@example.invalid',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/e-posta/);
  });
});

describe('clipSchema', () => {
  const base = {
    source_id: SOURCE,
    title: 'Demo klip',
    start_seconds: 90,
    end_seconds: 150,
  };

  it('varsayılanları uygular, boş kancayı null yapar', () => {
    expect(clipSchema.parse({ ...base, hook: '  ' })).toEqual({
      ...base,
      influencer_id: null,
      hook: null,
      notes: '',
    });
    expect(clipSchema.parse({ ...base, hook: ' Kanca ' }).hook).toBe('Kanca');
  });

  it('aralık kurallarını denetler (bitiş > başlangıç, en fazla 180 sn)', () => {
    expect(
      clipSchema.safeParse({ ...base, start_seconds: 0, end_seconds: 180 })
        .success,
    ).toBe(true);
    for (const range of [
      { start_seconds: 0, end_seconds: 181 },
      { start_seconds: 30, end_seconds: 30 },
      { start_seconds: 40, end_seconds: 30 },
      { start_seconds: -1, end_seconds: 30 },
      { start_seconds: 1.5, end_seconds: 30 },
    ])
      expect(
        clipSchema.safeParse({ ...base, ...range }).success,
        JSON.stringify(range),
      ).toBe(false);
  });

  it('istemciden durum, kart bağlantısı veya audit alanı almaz', () => {
    for (const extra of [
      { status: 'rendered' },
      { content_item_id: SOURCE },
      { created_by: SOURCE },
    ])
      expect(clipSchema.safeParse({ ...base, ...extra }).success).toBe(false);
    expect(clipSchema.safeParse({ ...base, title: ' ' }).success).toBe(false);
    expect(clipSchema.safeParse({ ...base, source_id: 'x' }).success).toBe(
      false,
    );
  });
});

describe('clipPatchSchema', () => {
  it('durum değişikliğini ve birlikte gönderilen aralığı kabul eder', () => {
    expect(clipPatchSchema.parse({ status: 'approved' })).toEqual({
      status: 'approved',
    });
    expect(
      clipPatchSchema.parse({ start_seconds: 10, end_seconds: 70 }),
    ).toEqual({ start_seconds: 10, end_seconds: 70 });
    for (const body of [
      {},
      { status: 'used' },
      { start_seconds: 10 },
      { end_seconds: 70 },
      { start_seconds: 10, end_seconds: 400 },
      { content_item_id: SOURCE },
      { source_id: SOURCE },
    ])
      expect(
        clipPatchSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
  });
});

describe('clipBacklogSchema / clipsQuerySchema', () => {
  it('hedef influencer isteğe bağlıdır; bilinmeyen alan reddedilir', () => {
    expect(clipBacklogSchema.parse({})).toEqual({ influencer_id: null });
    expect(clipBacklogSchema.safeParse({ influencer_id: 'x' }).success).toBe(
      false,
    );
    expect(clipBacklogSchema.safeParse({ title: 'x' }).success).toBe(false);
  });

  it('inf yalnız slug biçiminde olabilir', () => {
    expect(clipsQuerySchema.parse({ inf: 'demo-creator' }).inf).toBe(
      'demo-creator',
    );
    expect(clipsQuerySchema.parse({}).inf).toBeUndefined();
    expect(clipsQuerySchema.safeParse({ inf: '../x' }).success).toBe(false);
  });
});
