import { describe, expect, it } from 'vitest';
import {
  EPISODE_STATUSES,
  EPISODE_STATUS_LABELS,
  hasFactGaps,
  unsourcedClaimCount,
} from '@ai-influencer/shared';
import {
  EPISODE_STEPS,
  PRODUCTION_JOB_KINDS,
  currentStep,
  emptyFactNote,
  episodeStatusView,
  machineReadiness,
  missingSources,
  normalizeFactNotes,
  requiredCapabilities,
  safeHttpUrl,
  toFactNoteDrafts,
  type FactNoteDraft,
} from './model';
import { factNotesSchema } from './schemas';

describe('bölüm durumu etiketi', () => {
  it('her durumun Türkçe etiketi, tonu ve sıradaki adımı vardır', () => {
    for (const status of EPISODE_STATUSES) {
      const view = episodeStatusView(status);
      expect(view.label).toBe(EPISODE_STATUS_LABELS[status]);
      expect(view.next).not.toBe('');
    }
    expect(episodeStatusView('script_ready')).toMatchObject({
      label: 'Senaryo onay bekliyor',
      tone: 'attention',
    });
    expect(episodeStatusView('in_production').tone).toBe('progress');
    expect(episodeStatusView('archived').tone).toBe('muted');
  });

  it('akış şeridi: her durum beklediği adımı gösterir', () => {
    expect(EPISODE_STEPS[currentStep('draft')]).toBe('Senaryo');
    expect(EPISODE_STEPS[currentStep('script_ready')]).toBe('Senaryo onayı');
    expect(EPISODE_STEPS[currentStep('script_approved')]).toBe('Üretim');
    expect(EPISODE_STEPS[currentStep('in_production')]).toBe('Üretim');
    expect(EPISODE_STEPS[currentStep('ready_for_review')]).toBe('Video onayı');
    expect(EPISODE_STEPS[currentStep('approved')]).toBe('Yayın');
    expect(currentStep('published')).toBe(EPISODE_STEPS.length);
    expect(currentStep('archived')).toBe(-1);
    expect(currentStep('yok')).toBe(-1);
  });

  it('bilinmeyen durum ham değeri göstermez', () => {
    expect(episodeStatusView('<script>')).toEqual({
      label: 'Bilinmiyor',
      tone: 'muted',
      next: '',
    });
  });
});

const draft = (
  claim: string,
  sources: Array<[string, string]>,
  extra: Partial<FactNoteDraft> = {},
): FactNoteDraft => ({
  claim,
  sources: sources.map(([title, url]) => ({ title, url, primary: false })),
  note: '',
  cautious_wording: '',
  ...extra,
});

describe('kaynak notu taslağı', () => {
  it('boş kaynak satırı kaynak sayılmaz: sayım veritabanı tanımıyla aynıdır', () => {
    const drafts = [
      draft('İki kaynaklı', [
        ['Rapor', 'https://example.org/rapor'],
        ['Kurum açıklaması', ''],
      ]),
      draft('Bir dolu bir boş satır', [
        ['Rapor', ''],
        ['', '  '],
      ]),
      draft('Kaynaksız', []),
    ];
    const notes = normalizeFactNotes(drafts);
    // Veritabanı: jsonb_array_length(sources) < 2 olan iddialar.
    expect(notes.map((note) => note.sources?.length)).toEqual([2, 1, 0]);
    expect(unsourcedClaimCount(notes)).toBe(2);
    expect(hasFactGaps(notes)).toBe(true);
    expect(drafts.map(missingSources)).toEqual([0, 1, 2]);
    expect(factNotesSchema.safeParse(notes).success).toBe(true);
  });

  it('tamamen boş iddia satırını atar, boş isteğe bağlı alanı göndermez', () => {
    const notes = normalizeFactNotes([
      emptyFactNote(),
      draft(
        '  Kırpılır  ',
        [
          [' A ', ''],
          ['', ' https://example.org/b '],
        ],
        { cautious_wording: ' Rapora göre ' },
      ),
    ]);
    expect(notes).toEqual([
      {
        claim: 'Kırpılır',
        sources: [{ title: 'A' }, { url: 'https://example.org/b' }],
        cautious_wording: 'Rapora göre',
      },
    ]);
    expect(hasFactGaps(notes)).toBe(false);
  });

  it('hiç iddia yoksa kaynak eksiği sayılır (boş not onayı engeller)', () => {
    expect(hasFactGaps(normalizeFactNotes([]))).toBe(true);
    expect(hasFactGaps(normalizeFactNotes([emptyFactNote()]))).toBe(true);
  });

  it('kayıtlı notu taslağa çevirir ve bozuk veriyi yok sayar', () => {
    const stored = [
      {
        claim: 'İddia',
        sources: [{ title: 'A', url: 'https://example.org', primary: true }],
        cautious_wording: 'Temkinli',
      },
      'bozuk',
      null,
    ];
    const drafts = toFactNoteDrafts(stored);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      claim: 'İddia',
      cautious_wording: 'Temkinli',
      sources: [{ title: 'A', url: 'https://example.org', primary: true }],
    });
    expect(normalizeFactNotes(drafts)).toEqual([stored[0]]);
    expect(toFactNoteDrafts({})).toEqual([]);
  });
});

describe('kaynak bağlantısı', () => {
  it('yalnız http(s) adresi bağlantı olur', () => {
    expect(safeHttpUrl('https://example.org/a?b=1')).toBe(
      'https://example.org/a?b=1',
    );
    expect(safeHttpUrl(' http://example.org ')).toBe('http://example.org/');
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      '//example.org',
      'example.org',
      'https://',
      '',
      null,
      42,
    ])
      expect(safeHttpUrl(bad)).toBeNull();
  });
});

describe('üretim yetenekleri', () => {
  it('üretim türü onaylı senaryo isteyen sabit türlerden gelir', () => {
    expect(PRODUCTION_JOB_KINDS).toEqual(['explainer.render']);
  });

  it('tam üretim ses, altyazı ve yolun render yeteneğini ister', () => {
    expect(
      requiredCapabilities('explainer.render', 'hyperframes', null),
    ).toEqual(['voice.edge-tts', 'captions.burn', 'render.hyperframes']);
    expect(requiredCapabilities('explainer.render', 'blender', null)).toContain(
      'render.blender',
    );
  });

  it('kısmi üretim yalnız o aşamaya kadarki yetenekleri ister', () => {
    expect(requiredCapabilities('explainer.render', 'skia', 'voice')).toEqual([
      'voice.edge-tts',
    ]);
    expect(
      requiredCapabilities('explainer.render', 'skia', 'captions'),
    ).toEqual(['voice.edge-tts', 'captions.burn']);
  });

  it('üretim aşaması olmayan yol görsel aşamaya uzanamaz, bilinmeyen aşama reddedilir', () => {
    expect(requiredCapabilities('explainer.render', 'stock', null)).toBeNull();
    expect(
      requiredCapabilities('explainer.render', 'meme', 'visuals'),
    ).toBeNull();
    expect(
      requiredCapabilities('explainer.render', 'stock', 'captions'),
    ).toEqual(['voice.edge-tts', 'captions.burn']);
    expect(requiredCapabilities('explainer.render', 'skia', 'yok')).toBeNull();
  });
});

describe('makine hazır mı', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  const worker = (
    name: string,
    capabilities: string[],
    seen: string | null,
    revoked: string | null = null,
  ) => ({ name, capabilities, last_seen_at: seen, revoked_at: revoked });
  const need = ['voice.edge-tts', 'render.skia'];

  it('makine yok / çevrimdışı / yetenek eksik / hazır', () => {
    expect(machineReadiness([], need, now)).toEqual({ state: 'none' });
    expect(
      machineReadiness(
        [worker('eski', need, '2026-11-15T11:00:00Z', '2026-11-15T11:30:00Z')],
        need,
        now,
      ),
    ).toEqual({ state: 'none' });
    expect(
      machineReadiness(
        [worker('mac', need, '2026-11-15T11:50:00Z')],
        need,
        now,
      ),
    ).toEqual({ state: 'offline', total: 1 });
    expect(
      machineReadiness(
        [worker('mac', ['voice.edge-tts'], '2026-11-15T11:59:30Z')],
        need,
        now,
      ),
    ).toEqual({
      state: 'missing_capability',
      online: 1,
      missing: ['render.skia'],
    });
    expect(
      machineReadiness(
        [
          worker('mac', [...need, 'captions.burn'], '2026-11-15T11:59:30Z'),
          worker('pc', ['voice.edge-tts'], '2026-11-15T11:59:50Z'),
        ],
        need,
        now,
      ),
    ).toEqual({ state: 'ready', machines: ['mac'] });
  });
});
