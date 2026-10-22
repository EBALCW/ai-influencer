import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseReplyTemplates } from './templates';

describe('parseReplyTemplates', () => {
  it('## başlıklarını şablona çevirir, girişi ve ### alt başlıkları ayırmaz', () => {
    const md = [
      '# Başlık',
      'Giriş metni',
      '## İlk',
      '',
      'Merhaba',
      '### Not',
      'devam',
      '## Boş',
      '',
      '## İkinci ##',
      'Satır\r',
    ].join('\n');
    expect(parseReplyTemplates(md)).toEqual([
      { title: 'İlk', body: 'Merhaba\n### Not\ndevam' },
      { title: 'İkinci', body: 'Satır' },
    ]);
  });

  it('repodaki şablon dosyası 5 şablon içerir (#29)', () => {
    const file = join(
      process.cwd(),
      '..',
      '..',
      'templates',
      'brand-replies.md',
    );
    const templates = parseReplyTemplates(readFileSync(file, 'utf8'));
    expect(templates.map((t) => t.title)).toEqual([
      'İlk temas',
      'Fiyat bildirimi',
      'Nazik ret',
      'Takip (follow-up)',
      'Ücretsiz ürün teklifi',
    ]);
  });
});
