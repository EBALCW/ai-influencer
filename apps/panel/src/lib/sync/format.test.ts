import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  isSyncRequestResult,
  jobLabel,
  platformLabel,
  statusLabel,
  syncRequestSchema,
} from './format';

describe('sync format', () => {
  it('etiketler bilinmeyen değeri olduğu gibi gösterir', () => {
    expect(jobLabel('metrics')).toBe('Metrik snapshot');
    expect(jobLabel('comments')).toBe('Yorumlar');
    expect(jobLabel('comment_reply')).toBe('Yorum yanıtı');
    expect(statusLabel('partial')).toBe('Kısmi');
    expect(platformLabel('youtube')).toBe('YouTube');
    expect(platformLabel(null)).toBe('—');
    expect(jobLabel('x')).toBe('x');
  });

  it('süre biçimi', () => {
    const start = '2026-10-22T10:00:00Z';
    expect(formatDuration(start, null)).toBeNull();
    expect(formatDuration(start, '2026-10-22T10:00:12Z')).toBe('12 sn');
    expect(formatDuration(start, '2026-10-22T10:03:05Z')).toBe('3 dk 5 sn');
    expect(formatDuration(start, '2026-10-22T10:02:00Z')).toBe('2 dk');
    expect(formatDuration(start, '2026-10-22T09:00:00Z')).toBeNull();
  });

  it('istek şeması: uuid ya da boş; fazladan alan reddedilir', () => {
    expect(syncRequestSchema.safeParse({}).success).toBe(true);
    expect(
      syncRequestSchema.safeParse({
        accountId: '0f3c2a8e-1b2c-4d5e-8f90-123456789abc',
      }).success,
    ).toBe(true);
    expect(syncRequestSchema.safeParse({ accountId: 'x' }).success).toBe(false);
    expect(syncRequestSchema.safeParse({ job: 'metrics' }).success).toBe(false);
  });

  it('RPC sonucu doğrulanır', () => {
    expect(isSyncRequestResult('queued')).toBe(true);
    expect(isSyncRequestResult('toString')).toBe(false);
    expect(isSyncRequestResult(null)).toBe(false);
  });
});
