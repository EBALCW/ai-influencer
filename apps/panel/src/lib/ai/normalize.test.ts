import { describe, expect, it } from 'vitest';
import {
  countEmoji,
  normalizeCaption,
  normalizeHashtags,
  normalizePersona,
} from './normalize';

describe('normalizeHashtags', () => {
  it('# ekler, temizler, tekrarları atar ve 5 ile sınırlar', () => {
    expect(
      normalizeHashtags([
        'yapayzeka',
        '#YapayZeka',
        '  #şehir hayatı ',
        '##ai',
        '!!!',
        'a1',
        'b2',
        'c3',
        'd4',
      ]),
    ).toEqual(['#yapayzeka', '#şehirhayatı', '#ai', '#a1', '#b2']);
  });
});

describe('countEmoji', () => {
  it('emojileri sayar', () => {
    expect(countEmoji('Merhaba 🤖 dünya ☕✨')).toBe(3);
    expect(countEmoji('Emoji yok')).toBe(0);
  });
});

describe('normalizeCaption', () => {
  it('kurallara uyan caption uyarısız döner', () => {
    const { suggestion, warnings } = normalizeCaption({
      caption: ' Bugün 14 sekme açtım. ☕ ',
      hashtags: ['ai', 'teknoloji', 'günlük'],
      cta: ' Senin rekorun kaç? ',
    });
    expect(suggestion).toEqual({
      caption: 'Bugün 14 sekme açtım. ☕',
      hashtags: ['#ai', '#teknoloji', '#günlük'],
      cta: 'Senin rekorun kaç?',
    });
    expect(warnings).toEqual([]);
  });

  it('fazla emoji, az hashtag ve uzun metin için uyarı verir', () => {
    const { warnings } = normalizeCaption({
      caption: `${'a'.repeat(301)} 🤖🤖🤖`,
      hashtags: ['ai'],
      cta: 'Ne düşünüyorsun?',
    });
    expect(warnings).toHaveLength(3);
  });
});

describe('normalizePersona', () => {
  it('listeleri sınırlar ve uzun bio için uyarır', () => {
    const many = ['1', '2', '3', '4', '5', '6', '7'];
    const { suggestion, warnings } = normalizePersona({
      bio: 'b'.repeat(151),
      personality: many,
      tone: { do: many, dont: many },
      sampleCaptions: many,
      hookTraits: many,
    });
    expect(suggestion.personality).toHaveLength(5);
    expect(suggestion.tone.do).toHaveLength(5);
    expect(suggestion.sampleCaptions).toHaveLength(5);
    expect(suggestion.hookTraits).toHaveLength(4);
    expect(warnings).toEqual(['Bio 150 karakteri aşıyor.']);
  });
});
