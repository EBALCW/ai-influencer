import { describe, expect, it } from 'vitest';
import {
  latestJob,
  parseTags,
  PUBLISH_JOB_COLUMNS,
  publishBlocker,
  publishRequestSchema,
  type PublishJobView,
} from './publish';

const job = (id: string, created_at: string, content_item_id = 'c1') =>
  ({ id, created_at, content_item_id, status: 'queued' }) as PublishJobView;

describe('yayın yardımcıları (#58)', () => {
  it('upload oturum adresi panel sorgusunda seçilmez', () => {
    expect(PUBLISH_JOB_COLUMNS.split(',')).not.toContain('provider_upload_url');
    expect(PUBLISH_JOB_COLUMNS).not.toContain('*');
  });
  it('kartın en yeni işini seçer', () => {
    const jobs = [
      job('a', '2026-10-22T09:00:00Z'),
      job('b', '2026-10-22T10:00:00Z'),
      job('x', '2026-10-23T00:00:00Z', 'c2'),
    ];
    expect(latestJob(jobs, 'c1')?.id).toBe('b');
    expect(latestJob(jobs, 'none')).toBeNull();
  });
  it('etiket metnini temizler', () => {
    expect(parseTags(' #ai, günlük ,, ai ')).toEqual(['ai', 'günlük']);
  });
  it('istek şeması mod ve zamanı tutarlı ister', () => {
    expect(
      publishRequestSchema.safeParse({ mode: 'now', title: 'a' }).success,
    ).toBe(true);
    expect(
      publishRequestSchema.safeParse({ mode: 'schedule', title: 'a' }).success,
    ).toBe(false);
    expect(
      publishRequestSchema.safeParse({
        mode: 'now',
        title: 'a',
        scheduled_at: '2026-11-01T10:00:00Z',
      }).success,
    ).toBe(false);
  });
  it('veritabanı engelini HTTP koduna çevirir', () => {
    expect(
      publishBlocker({ code: '23514', hint: 'checklist_incomplete' })?.status,
    ).toBe(422);
    expect(
      publishBlocker({ code: '23505', hint: 'already_queued' })?.status,
    ).toBe(409);
    expect(
      publishBlocker({ code: '23514', hint: 'source_missing' })?.message,
    ).toMatch(/kaynak bilgisi/);
    expect(
      publishBlocker({ code: '23514', hint: 'scorer_is_producer' })?.status,
    ).toBe(422);
    expect(publishBlocker({ code: '23514', hint: 'unknown' })).toBeNull();
    expect(publishBlocker({ code: '42501' })).toBeNull();
  });
});
