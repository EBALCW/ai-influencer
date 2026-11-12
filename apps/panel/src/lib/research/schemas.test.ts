import { describe, expect, it } from 'vitest';
import {
  backlogSchema,
  detectPlatform,
  researchQuerySchema,
  trendPatchSchema,
  trendSchema,
} from './schemas';

describe('detectPlatform', () => {
  it('alan adından platformu bulur', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc/')).toBe(
      'instagram',
    );
    expect(detectPlatform('https://instagr.am/p/x')).toBe('instagram');
    expect(detectPlatform('https://vm.tiktok.com/ZM/')).toBe('tiktok');
    expect(detectPlatform('https://youtu.be/abc')).toBe('youtube');
    expect(detectPlatform('https://m.youtube.com/shorts/abc')).toBe('youtube');
    expect(detectPlatform('https://notinstagram.com.evil.example/x')).toBe(
      'other',
    );
    expect(detectPlatform('bozuk')).toBe('other');
  });
});

describe('trendSchema', () => {
  it('platform verilmezse linkten doldurur, varsayılanları uygular', () => {
    expect(
      trendSchema.parse({ url: ' https://www.tiktok.com/@a/video/1 ' }),
    ).toMatchObject({
      url: 'https://www.tiktok.com/@a/video/1',
      platform: 'tiktok',
      influencer_id: null,
      status: 'new',
      format: 'other',
      source: 'manual',
    });
    expect(
      trendSchema.parse({ url: 'https://youtu.be/x', platform: 'other' })
        .platform,
    ).toBe('other');
  });

  it('kötü link, puan ve audit alanını reddeder', () => {
    for (const url of [
      'javascript:alert(1)',
      'ftp://a.example/x',
      'merhaba',
      '',
    ])
      expect(trendSchema.safeParse({ url }).success).toBe(false);
    expect(
      trendSchema.safeParse({ url: 'https://a.example', adaptation_score: 6 })
        .success,
    ).toBe(false);
    expect(
      trendSchema.safeParse({ url: 'https://a.example', created_by: 'x' })
        .success,
    ).toBe(false);
    expect(
      trendSchema.safeParse({
        url: 'https://a.example',
        captured_on: '2026-02-30',
      }).success,
    ).toBe(false);
  });

  it('PATCH used durumunu ve boş gövdeyi kabul etmez', () => {
    expect(trendPatchSchema.safeParse({ status: 'used' }).success).toBe(false);
    expect(trendPatchSchema.safeParse({}).success).toBe(false);
    expect(trendPatchSchema.safeParse({ content_item_id: null }).success).toBe(
      false,
    );
    expect(trendPatchSchema.parse({ status: 'shortlisted' })).toEqual({
      status: 'shortlisted',
    });
  });

  it('backlog gövdesi influencer UUID ister', () => {
    expect(backlogSchema.safeParse({ influencer_id: 'abc' }).success).toBe(
      false,
    );
    expect(backlogSchema.parse({})).toEqual({ influencer_id: null, title: '' });
  });
});

describe('researchQuerySchema', () => {
  it('boş filtreleri yok sayar, varsayılan sıralama puan', () => {
    expect(
      researchQuerySchema.parse({ status: '', min: '', platform: 'tiktok' }),
    ).toEqual({
      sort: 'score',
      platform: 'tiktok',
      status: undefined,
      min: undefined,
    });
    expect(researchQuerySchema.parse({ min: '4' }).min).toBe(4);
    expect(researchQuerySchema.safeParse({ sort: 'x' }).success).toBe(false);
    expect(researchQuerySchema.safeParse({ inf: '../x' }).success).toBe(false);
  });
});
