// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildMediaKit } from './build';
import { renderMediaKitPdf } from './pdf';

vi.mock('server-only', () => ({}));
const { loadMediaKitFonts } = await import('./fonts');

describe('renderMediaKitPdf', () => {
  it('Türkçe karakter ve emoji içeren kiti geçerli bir PDF olarak üretir', async () => {
    const kit = buildMediaKit({
      asOf: '2026-10-20T00:00:00Z',
      influencer: {
        name: 'Şule Ğİ',
        slug: 'sule',
        niche: 'yaşam',
        bio: 'Işıl ışıl bir gün ✨ '.repeat(30),
      },
      accounts: [{ id: 'a', platform: 'instagram', handle: '@sule' }],
      accountSnapshots: [],
      posts: Array.from({ length: 3 }, (_, i) => ({
        id: `p${i}`,
        account_id: 'a',
        caption: `Gönderi ${i} 🎉`,
        url: 'https://example.invalid/p',
        published_at: '2026-10-10T10:00:00Z',
      })),
      metricSnapshots: Array.from({ length: 3 }, (_, i) => ({
        post_id: `p${i}`,
        captured_at: '2026-10-11T10:00:00Z',
        views: 100 * (i + 1),
        likes: 5,
        comments: 1,
        shares: 0,
        saves: 0,
        avg_watch_time_s: null,
      })),
    });
    const bytes = await renderMediaKitPdf(
      kit,
      await loadMediaKitFonts(),
      new Date('2026-10-20T08:00:00Z'),
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe('Şule Ğİ · Medya Kiti');
  });
});
