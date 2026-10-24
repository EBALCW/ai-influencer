import { describe, expect, it } from 'vitest';
import {
  canReplyOn,
  commentPatchSchema,
  inboxQuerySchema,
  leadRequestSchema,
  replyRequestSchema,
} from './schemas';

describe('gelen kutusu filtreleri', () => {
  it('varsayılanlar: tümü, son 7 gün, platform/post yok', () => {
    expect(inboxQuerySchema.parse({})).toEqual({
      inf: undefined,
      platform: undefined,
      view: 'all',
      days: 7,
      post: undefined,
    });
  });
  it('geçerli değerler okunur', () => {
    expect(
      inboxQuerySchema.parse({
        inf: 'demo-creator',
        platform: 'youtube',
        view: 'brand',
        days: '30',
        post: '30000000-0000-4000-8000-000000000001',
      }),
    ).toEqual({
      inf: 'demo-creator',
      platform: 'youtube',
      view: 'brand',
      days: 30,
      post: '30000000-0000-4000-8000-000000000001',
    });
  });
  it('geçersiz değer hata değil, varsayılana düşer', () => {
    expect(
      inboxQuerySchema.parse({
        inf: 'x'.repeat(200),
        platform: 'myspace',
        view: 'drop table',
        days: '365',
        post: "1' or 1=1",
      }),
    ).toEqual({
      inf: undefined,
      platform: undefined,
      view: 'all',
      days: 7,
      post: undefined,
    });
  });
});

describe('yazma şemaları', () => {
  it('durum: yalnız new/read/hidden; replied ve ek alan reddedilir', () => {
    expect(commentPatchSchema.safeParse({ status: 'hidden' }).success).toBe(
      true,
    );
    expect(commentPatchSchema.safeParse({ status: 'replied' }).success).toBe(
      false,
    );
    expect(
      commentPatchSchema.safeParse({ status: 'read', brand_deal_id: 'x' })
        .success,
    ).toBe(false);
  });
  it('yanıt: kırpılır, 1–1000 karakter', () => {
    expect(replyRequestSchema.parse({ body: '  Selam  ' })).toEqual({
      body: 'Selam',
    });
    expect(replyRequestSchema.safeParse({ body: ' ' }).success).toBe(false);
    expect(
      replyRequestSchema.safeParse({ body: 'a'.repeat(1000) }).success,
    ).toBe(true);
    expect(
      replyRequestSchema.safeParse({ body: 'a'.repeat(1001) }).success,
    ).toBe(false);
  });
  it('lead: marka id’si ya da yeni ad (ikisi birden değil)', () => {
    expect(leadRequestSchema.safeParse({ brandName: 'X' }).success).toBe(true);
    expect(
      leadRequestSchema.safeParse({
        brandId: '10000000-0000-4000-8000-0000000000b1',
      }).success,
    ).toBe(true);
    expect(leadRequestSchema.safeParse({}).success).toBe(false);
    expect(
      leadRequestSchema.safeParse({
        brandName: 'X',
        brandId: '10000000-0000-4000-8000-0000000000b1',
      }).success,
    ).toBe(false);
  });
  it('panelden yanıt: Instagram ve YouTube; TikTok yok', () => {
    expect(canReplyOn('instagram')).toBe(true);
    expect(canReplyOn('youtube')).toBe(true);
    expect(canReplyOn('tiktok')).toBe(false);
  });
});
