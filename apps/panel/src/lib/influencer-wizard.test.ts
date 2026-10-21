import { describe, expect, it } from 'vitest';
import {
  buildCharacterPrompt,
  influencerDraftSchema,
  slugifyInfluencerName,
} from './influencer-wizard';
import { toPersonaInput } from './persona';

describe('influencer wizard helpers', () => {
  it('converts Turkish names into stable URL slugs', () => {
    expect(slugifyInfluencerName('Çağrı Şahin')).toBe('cagri-sahin');
    expect(slugifyInfluencerName('  ')).toBe('');
  });

  it('accepts only lowercase URL-safe slugs and language tags', () => {
    const valid = influencerDraftSchema.safeParse({
      name: 'Mina',
      slug: 'mina-yilmaz',
      niche: 'Moda',
      language: 'tr',
    });
    const invalid = influencerDraftSchema.safeParse({
      name: 'Mina',
      slug: 'Mina Yılmaz',
      niche: '',
      language: 'Türkçe',
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it('builds a prompt from saved persona fields without inventing values', () => {
    const persona = toPersonaInput(null);
    persona.appearance.hair = 'kıvırcık kahverengi';
    persona.appearance.eyes = 'ela';
    const prompt = buildCharacterPrompt('Mina', persona);
    expect(prompt).toContain('Mina adlı AI influencer karakteri.');
    expect(prompt).toContain('saç: kıvırcık kahverengi');
    expect(prompt).not.toContain('ten:');
  });
});
