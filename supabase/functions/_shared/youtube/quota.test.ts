import { assertEquals } from '@std/assert';
import {
  estimateRunUnits,
  pacificDate,
  quotaCost,
  secondsUntilQuotaReset,
  YOUTUBE_DAILY_QUOTA,
  YOUTUBE_QUOTA_COST,
} from './quota.ts';

Deno.test('kota birimleri: list çağrıları 1, search 100', () => {
  assertEquals(YOUTUBE_QUOTA_COST['channels.list'], 1);
  assertEquals(YOUTUBE_QUOTA_COST['playlistItems.list'], 1);
  assertEquals(YOUTUBE_QUOTA_COST['videos.list'], 1);
  assertEquals(YOUTUBE_QUOTA_COST['search.list'], 100);
  assertEquals(quotaCost('videos.list', 3), 3);
  assertEquals(YOUTUBE_DAILY_QUOTA, 10_000);
});

Deno.test('estimateRunUnits: README tablosundaki tahminler', () => {
  assertEquals(estimateRunUnits('accounts'), 1);
  assertEquals(estimateRunUnits('posts'), 2); // yeni video yok: kanal + 1 sayfa
  assertEquals(estimateRunUnits('posts', { newVideos: 3 }), 3);
  assertEquals(estimateRunUnits('posts', { newVideos: 120 }), 1 + 3 + 3);
  assertEquals(estimateRunUnits('metrics', { duePosts: 4 }), 4);
});

Deno.test('pacificDate ve kota sıfırlanma süresi (Pasifik gece yarısı)', () => {
  // 22 Eki 2026 05:00 UTC = 21 Eki 22:00 PDT (UTC-7).
  assertEquals(pacificDate(new Date('2026-10-22T05:00:00Z')), '2026-10-21');
  assertEquals(pacificDate(new Date('2026-10-22T08:00:00Z')), '2026-10-22');
  // 06:00 UTC = 23:00 PDT → 1 saat kaldı.
  assertEquals(secondsUntilQuotaReset(new Date('2026-10-22T06:00:00Z')), 3600);
  // Kış saati (PST, UTC-8): 15 Ara 2026 07:30 UTC = 23:30 PST.
  assertEquals(secondsUntilQuotaReset(new Date('2026-12-15T07:30:00Z')), 1800);
});
