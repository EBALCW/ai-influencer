import { describe, expect, it } from 'vitest';
import {
  parseCaptionList,
  parseTagList,
  personaInputSchema,
  toPersonaInput,
  toPersonaPayload,
  type PersonaRow,
} from './persona';

const row = {
  bio: 'Bio',
  tone: 'samimi',
  hook_traits: ['mavi saç'],
  sample_captions: ['Bugün buradayım, ya sen?'],
  personality: { adjectives: ['meraklı'], legacy_key: 'korunmalı' },
  audience: {
    age_range: '18-24',
    interests: ['ai'],
    description: 'Öğrenciler',
    region: 'TR',
  },
  appearance: { hair: 'mavi', tattoo: 'yok' },
} as unknown as PersonaRow;

describe('persona şeması ve eşleme', () => {
  it('satırı form değerlerine çevirir', () => {
    expect(toPersonaInput(row)).toMatchObject({
      bio: 'Bio',
      adjectives: ['meraklı'],
      hookTraits: ['mavi saç'],
      sampleCaptions: ['Bugün buradayım, ya sen?'],
      audience: {
        ageRange: '18-24',
        interests: ['ai'],
        description: 'Öğrenciler',
      },
      appearance: { hair: 'mavi', eyes: '' },
      changeNote: '',
    });
  });

  it('persona yoksa boş form döner', () => {
    expect(toPersonaInput(null)).toMatchObject({
      bio: '',
      adjectives: [],
      hookTraits: [],
    });
  });

  it('kayıtta bilinmeyen jsonb anahtarlarını korur', () => {
    const input = { ...toPersonaInput(row), adjectives: ['cesur'] };
    const payload = toPersonaPayload(input, row);
    expect(payload.p_personality).toEqual({
      adjectives: ['cesur'],
      legacy_key: 'korunmalı',
    });
    expect(payload.p_audience).toMatchObject({
      region: 'TR',
      age_range: '18-24',
    });
    expect(payload.p_appearance).toMatchObject({ tattoo: 'yok', hair: 'mavi' });
  });

  it('versiyon numarası, is_current veya created_by göndermez', () => {
    const payload = toPersonaPayload(toPersonaInput(row), row);
    expect(Object.keys(payload).sort()).toEqual([
      'p_appearance',
      'p_audience',
      'p_bio',
      'p_change_note',
      'p_hook_traits',
      'p_personality',
      'p_sample_captions',
      'p_tone',
    ]);
  });

  it('sınırları aşan girdiyi reddeder', () => {
    const valid = toPersonaInput(row);
    expect(personaInputSchema.safeParse(valid).success).toBe(true);
    expect(
      personaInputSchema.safeParse({ ...valid, changeNote: 'x'.repeat(501) })
        .success,
    ).toBe(false);
    expect(
      personaInputSchema.safeParse({
        ...valid,
        hookTraits: Array(11).fill('a'),
      }).success,
    ).toBe(false);
    expect(
      personaInputSchema.safeParse({ ...valid, adjectives: [''] }).success,
    ).toBe(false);
  });

  it('virgüllü listeyi temizler', () => {
    expect(parseTagList(' a, b , ,c,')).toEqual(['a', 'b', 'c']);
  });

  it('caption listesini satırlara göre ayrıştırır ve sınırları uygular', () => {
    expect(
      parseCaptionList('  Bugün buradayım, ya sen?  \\n\\nYeni bir gün.'),
    ).toEqual(['Bugün buradayım, ya sen?', 'Yeni bir gün.']);
    const valid = { ...toPersonaInput(row), sampleCaptions: ['Örnek caption'] };
    expect(personaInputSchema.safeParse(valid).success).toBe(true);
    expect(
      personaInputSchema.safeParse({
        ...valid,
        sampleCaptions: Array.from(
          { length: 11 },
          (_, index) => `Caption ${index}`,
        ),
      }).success,
    ).toBe(false);
    expect(
      personaInputSchema.safeParse({
        ...valid,
        sampleCaptions: ['x'.repeat(2201)],
      }).success,
    ).toBe(false);
  });
});
