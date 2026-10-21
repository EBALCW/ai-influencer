import { expect, it } from 'vitest';
import {
  calendarQuerySchema,
  contentPatchSchema,
  contentSchema,
  slotSchema,
  workspaceQuerySchema,
} from './schemas';

const id = '10000000-0000-4000-8000-000000000001';
it('trend alanlarını ve zaman dilimlerini doğrular, audit alanlarını taşımıyor', () => {
  const base = { influencer_id: id, title: 'Fikir' };
  expect(
    contentSchema.parse({ ...base, created_by: 'someone' }),
  ).not.toHaveProperty('created_by');
  for (const patch of [
    { source_url: 'javascript:alert(1)' },
    { source_views: -1 },
    { adaptation_score: 6 },
    { timezone: 'Unknown/Zone' },
    { asset_ids: [id, id] },
  ])
    expect(contentSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  expect(contentPatchSchema.safeParse({ created_by: id }).success).toBe(false);
  expect(contentPatchSchema.parse({ stage: 'script' })).toEqual({
    stage: 'script',
  });
  expect(workspaceQuerySchema.safeParse({ page: '-1' }).success).toBe(false);
  expect(
    calendarQuerySchema.safeParse({ date: '2026-02-31', tz: 'UTC' }).success,
  ).toBe(false);
  expect(
    calendarQuerySchema.safeParse({
      date: '2026-11-10',
      tz: 'Europe/Istanbul',
      view: 'month',
    }).success,
  ).toBe(true);
  expect(
    slotSchema.safeParse({
      account_id: id,
      weekday: 0,
      local_time: '23:59',
      timezone: 'Europe/Istanbul',
    }).success,
  ).toBe(true);
  expect(
    slotSchema.safeParse({
      account_id: id,
      weekday: 7,
      local_time: '25:00',
      timezone: 'UTC',
    }).success,
  ).toBe(false);
});
