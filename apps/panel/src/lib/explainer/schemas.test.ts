import { describe, expect, it } from 'vitest';
import {
  episodeCreateSchema,
  episodeJobParamsSchema,
  episodePatchSchema,
  factNotesSchema,
  scriptApprovalSchema,
  scriptSaveSchema,
  seriesCreateSchema,
  seriesPatchSchema,
  seriesSettingsSchema,
  topicRequestSchema,
  topicSuggestionsSchema,
} from './schemas';

const uuid = 'd2160000-0000-4000-8000-000000000001';

describe('seri şemaları', () => {
  it('geçerli ayarları kabul eder, adı kırpar', () => {
    const parsed = seriesCreateSchema.parse({
      name: '  Nasıl Çalışır?  ',
      settings: {
        theme: 'Mekanizmalar',
        kind: 'how_it_works',
        visual_route: 'hyperframes',
        style_key: 'blueprint-01',
        voice_provider: 'edge-tts',
        voice_name: 'tr-TR-AhmetNeural',
        voice_rate: '+8%',
        caption_style: { max_words: 6 },
        language: 'tr',
        default_params: { duration: 60 },
      },
    });
    expect(parsed.name).toBe('Nasıl Çalışır?');
    expect(parsed.settings.visual_route).toBe('hyperframes');
    expect(seriesCreateSchema.parse({ name: 'Yalın' }).settings).toEqual({});
  });

  it.each([
    ['bilinmeyen yol', { visual_route: 'veo' }],
    ['bilinmeyen tür', { kind: 'vlog' }],
    ['hız biçimi', { voice_rate: 'hızlı' }],
    ['dil biçimi', { language: 'türkçe' }],
    ['stil anahtarı', { style_key: 'Büyük Harf' }],
    ['çalışma alanı gönderilemez', { workspace_id: uuid }],
    ['durum gönderilemez', { status: 'archived' }],
    ['sayaç gönderilemez', { next_episode_number: 9 }],
    ['fazla büyük parametre', { default_params: { x: 'a'.repeat(17000) } }],
    ['fazla büyük altyazı stili', { caption_style: { x: 'a'.repeat(9000) } }],
  ])('reddeder: %s', (_name, settings) => {
    expect(seriesSettingsSchema.safeParse(settings).success).toBe(false);
  });

  it('yama en az bir alan ister; null isteğe bağlı alanı temizler', () => {
    expect(seriesPatchSchema.safeParse({}).success).toBe(false);
    expect(seriesPatchSchema.parse({ voice_rate: null })).toEqual({
      voice_rate: null,
    });
    expect(seriesPatchSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
});

describe('istek ve öneri şemaları', () => {
  it('kısa isteği ve önerileri kabul eder', () => {
    const parsed = topicRequestSchema.parse({
      prompt: ' havacılıkla ilgili video fikri ',
      series_id: uuid,
      suggestions: [
        {
          title: 'Planör motorsuz nasıl saatlerce uçar?',
          summary: 'Planör çekilir, sonra süzülür.',
          hook: 'Bu uçağın motoru yok.',
          visual_idea: 'kanat kesiti; süzülme üçgeni',
          kind: 'how_it_works',
          evidence_level: 'proven',
          evidence_detail: { views: 900000, median: 200000 },
          source_candidates: [
            { title: 'NASA Glenn Gliders', primary: true },
            { url: 'https://example.invalid/fai' },
          ],
        },
      ],
    });
    expect(parsed.prompt).toBe('havacılıkla ilgili video fikri');
    expect(parsed.suggestions).toHaveLength(1);
    expect(topicRequestSchema.parse({ prompt: 'x' }).suggestions).toEqual([]);
  });

  it('en çok 20 öneri; durum ve karar alanları gönderilemez', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ title: `Konu ${i}` }));
    expect(topicSuggestionsSchema.safeParse(many).success).toBe(false);
    expect(
      topicSuggestionsSchema.safeParse([{ title: 'x', status: 'picked' }])
        .success,
    ).toBe(false);
    expect(
      topicSuggestionsSchema.safeParse([
        { title: 'x', evidence_level: 'viral' },
      ]).success,
    ).toBe(false);
    expect(
      topicSuggestionsSchema.safeParse([
        { title: 'x', source_candidates: [{ primary: true }] },
      ]).success,
    ).toBe(false);
    expect(topicRequestSchema.safeParse({ prompt: '   ' }).success).toBe(false);
  });
});

describe('bölüm şemaları', () => {
  it('tekil video seri istemez', () => {
    expect(
      episodeCreateSchema.parse({ title: ' Köprü ', kind: 'event' }),
    ).toEqual({ title: 'Köprü', kind: 'event' });
    expect(episodeCreateSchema.safeParse({ title: '' }).success).toBe(false);
    expect(
      episodeCreateSchema.safeParse({ title: 'x', episode_number: 7 }).success,
    ).toBe(false);
  });

  it('yama: üstüne yazma alanları; onay, durum ve numara gönderilemez', () => {
    expect(
      episodePatchSchema.parse({
        voice_name: 'tr-TR-EmelNeural',
        caption_style: null,
        params: { fps: 24 },
      }),
    ).toEqual({
      voice_name: 'tr-TR-EmelNeural',
      caption_style: null,
      params: { fps: 24 },
    });
    for (const forbidden of [
      { status: 'approved' },
      { script_approved_at: '2026-11-15T00:00:00Z' },
      { script_approved_by: uuid },
      { episode_number: 1 },
      { series_id: uuid },
      { workspace_id: uuid },
      { script_text: 'x' },
    ]) {
      expect(episodePatchSchema.safeParse(forbidden).success).toBe(false);
    }
    expect(episodePatchSchema.safeParse({}).success).toBe(false);
  });
});

describe('senaryo şemaları', () => {
  it('kaynak notu: iddia zorunlu, kaynak adı ya da adresi gerekli', () => {
    const parsed = factNotesSchema.parse([
      {
        claim: ' Planör 1 km alçalırken 40-50 km yol alır ',
        sources: [
          { title: 'NASA Glenn', url: 'https://example.invalid/nasa' },
          { title: 'FAI' },
        ],
      },
      { claim: 'Kaynağı henüz yok' },
    ]);
    expect(parsed[0]!.claim).toBe('Planör 1 km alçalırken 40-50 km yol alır');
    expect(parsed[1]!.sources).toEqual([]);
    expect(factNotesSchema.safeParse([{ sources: [] }]).success).toBe(false);
    expect(
      factNotesSchema.safeParse([{ claim: 'c', sources: [{ primary: true }] }])
        .success,
    ).toBe(false);
    expect(
      factNotesSchema.safeParse([
        { claim: 'c', sources: [{ url: 'javascript:alert(1)//' }] },
      ]).success,
    ).toBe(false);
    expect(
      factNotesSchema.safeParse(
        Array.from({ length: 201 }, (_, i) => ({ claim: `iddia ${i}` })),
      ).success,
    ).toBe(false);
  });

  it('kayıt: metin sınırı, bilinen hassasiyet işaretleri', () => {
    expect(
      scriptSaveSchema.parse({
        script_text: 'Bu uçağın motoru yok.',
        sensitivity_flags: ['real_event', 'loss_of_life'],
        expected_version: 2,
      }).sensitivity_flags,
    ).toEqual(['real_event', 'loss_of_life']);
    expect(
      scriptSaveSchema.safeParse({ script_text: 'a'.repeat(20001) }).success,
    ).toBe(false);
    expect(
      scriptSaveSchema.safeParse({
        script_text: 'x',
        sensitivity_flags: ['gossip'],
      }).success,
    ).toBe(false);
    expect(
      scriptSaveSchema.safeParse({ script_text: 'x', script_approved_at: 'x' })
        .success,
    ).toBe(false);
  });

  it('onay: sürüm zorunlu, onaylayan kimliği gönderilemez', () => {
    expect(scriptApprovalSchema.parse({ script_version: 3 })).toEqual({
      script_version: 3,
      acknowledge_fact_gaps: false,
    });
    expect(scriptApprovalSchema.safeParse({}).success).toBe(false);
    expect(
      scriptApprovalSchema.safeParse({ script_version: 1, approved_by: uuid })
        .success,
    ).toBe(false);
  });
});

describe('dondurulmuş iş parametreleri', () => {
  it('seride ve tekil videoda veritabanının yazdığı biçimi okur', () => {
    const base = {
      episode: {
        id: uuid,
        number: 1,
        title: 'Planör nasıl uçar?',
        kind: 'how_it_works',
        language: 'tr',
        script_version: 5,
      },
      series: { id: uuid, name: 'Nasıl Çalışır?', theme: 'Mekanizmalar' },
      visual_route: 'hyperframes',
      style_key: 'blueprint-01',
      voice: { provider: 'edge-tts', name: 'tr-TR-EmelNeural', rate: null },
      caption_style: { max_words: 5 },
      params: { duration: 60, fps: 24 },
    };
    expect(episodeJobParamsSchema.parse(base).series?.name).toBe(
      'Nasıl Çalışır?',
    );
    const single = episodeJobParamsSchema.parse({
      ...base,
      episode: { ...base.episode, number: null },
      series: null,
      visual_route: null,
      style_key: null,
      voice: { provider: null, name: null, rate: null },
      caption_style: {},
      params: {},
    });
    expect(single.series).toBeNull();
    expect(single.episode.number).toBeNull();
  });
});
