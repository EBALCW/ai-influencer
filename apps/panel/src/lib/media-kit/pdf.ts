/**
 * Medya kiti PDF'i. Saf JS (pdf-lib + @pdf-lib/fontkit): headless Chrome veya `canvas` gibi
 * native bağımlılık yok, Windows'ta da derleme gerektirmez. Türkçe karakterler için
 * Geist (SIL OFL, `geist` paketi) gömülür; standart PDF fontları ğ/ş/ı'yı kodlayamaz.
 *
 * Bu modül yalnız `MediaKit`'teki sayıları yazar; hiçbir değer burada hesaplanmaz.
 */
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  NO_DATA,
  formatCount,
  formatDate,
  formatPercent,
  formatPriceRange,
  formatSeconds,
  formatSigned,
  platformLabel,
  type MediaKit,
} from './build';

export type MediaKitFonts = { regular: Uint8Array; bold: Uint8Array };

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const ink = rgb(0.1, 0.1, 0.13);
const muted = rgb(0.36, 0.36, 0.42);
const accent = rgb(0.36, 0.22, 0.75);
const rule = rgb(0.85, 0.85, 0.9);

class Writer {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    readonly regular: PDFFont,
    readonly bold: PDFFont,
  ) {
    this.page = doc.addPage([A4.width, A4.height]);
    this.y = A4.height - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN + 24) {
      this.page = this.doc.addPage([A4.width, A4.height]);
      this.y = A4.height - MARGIN;
    }
  }

  /** Fontta olmayan karakterleri (emoji vb.) atar; PDF'te kutu görünmesin. */
  clean(text: string, font: PDFFont) {
    const supported = new Set(font.getCharacterSet());
    return [...text.replace(/\s+/g, ' ')]
      .filter((char) => supported.has(char.codePointAt(0)!))
      .join('')
      .trim();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const words = this.clean(text, font).split(' ').filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  text(
    value: string,
    options: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
      width?: number;
      gap?: number;
    } = {},
  ) {
    const size = options.size ?? 10.5;
    const font = options.bold ? this.bold : this.regular;
    const x = options.x ?? MARGIN;
    const width = options.width ?? A4.width - x - MARGIN;
    for (const line of this.wrap(value, font, size, width)) {
      this.ensure(size * 1.45);
      this.page.drawText(line, {
        x,
        y: this.y - size,
        size,
        font,
        color: options.color ?? ink,
      });
      this.y -= size * 1.45;
    }
    this.y -= options.gap ?? 0;
  }

  heading(value: string) {
    this.ensure(40);
    this.y -= 10;
    this.text(value, { size: 13, bold: true, color: accent, gap: 2 });
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: A4.width - MARGIN, y: this.y },
      thickness: 0.6,
      color: rule,
    });
    this.y -= 8;
  }

  /** İki sütunlu etiket / değer satırı */
  pair(label: string, value: string) {
    this.ensure(18);
    const top = this.y;
    this.text(label, { color: muted, width: 220 });
    const after = this.y;
    this.y = top;
    this.text(value, { bold: true, x: MARGIN + 240 });
    this.y = Math.min(after, this.y) - 2;
  }

  footer(note: string) {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawText(
        this.clean(
          `${note} · Sayfa ${index + 1}/${pages.length}`,
          this.regular,
        ),
        {
          x: MARGIN,
          y: MARGIN - 18,
          size: 8,
          font: this.regular,
          color: muted,
        },
      );
    });
  }
}

export async function renderMediaKitPdf(
  kit: MediaKit,
  fonts: MediaKitFonts,
  generatedAt: Date = new Date(),
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all([
    doc.embedFont(fonts.regular, { subset: true }),
    doc.embedFont(fonts.bold, { subset: true }),
  ]);
  const title = `${kit.influencer.name} · Medya Kiti`;
  doc.setTitle(title);
  doc.setLanguage('tr-TR');
  doc.setCreator('AI Influencer Studio');
  doc.setProducer('AI Influencer Studio');
  doc.setCreationDate(generatedAt);

  const w = new Writer(doc, regular, bold);
  w.text('MEDYA KİTİ', { size: 9, bold: true, color: accent, gap: 2 });
  w.text(kit.influencer.name, { size: 24, bold: true, gap: 4 });
  if (kit.influencer.niche)
    w.text(`Niş: ${kit.influencer.niche}`, { color: muted, gap: 2 });
  w.text(
    `Veri aralığı: ${formatDate(kit.period.from)} – ${formatDate(kit.period.to)} (son ${kit.period.days} gün, Türkiye saati)`,
    { color: muted, gap: 6 },
  );
  if (kit.influencer.bio) w.text(kit.influencer.bio, { gap: 4 });

  w.heading('AI açıklaması');
  w.text(kit.aiDisclosure, { gap: 2 });

  w.heading('Takipçi');
  w.pair('Toplam takipçi', formatCount(kit.followers.total));
  w.pair(
    `Son ${kit.period.days} günde değişim`,
    formatSigned(kit.followers.change),
  );
  if (kit.followers.accounts.length === 0) w.pair('Bağlı hesap', NO_DATA);
  for (const account of kit.followers.accounts)
    w.pair(
      `${platformLabel(account.platform)} ${account.handle}`,
      account.followers === null
        ? NO_DATA
        : `${formatCount(account.followers)} (${formatDate(account.capturedAt!)} ölçümü)`,
    );

  w.heading('İçerik performansı');
  w.pair('Dönemde yayınlanan içerik', formatCount(kit.content.postCount));
  w.pair('Ölçümü olan içerik', formatCount(kit.content.measuredPostCount));
  w.pair('Ortalama izlenme', formatCount(kit.content.avgViews));
  w.pair('Etkileşim oranı', formatPercent(kit.content.engagementRate));
  w.pair('Ortalama izlenme süresi', formatSeconds(kit.content.avgWatchTimeS));

  w.heading('En iyi içerikler');
  if (kit.topPosts.length === 0) w.text(NO_DATA, { color: muted });
  kit.topPosts.forEach((post, index) => {
    w.text(`${index + 1}. ${post.caption || 'Başlıksız içerik'}`, {
      bold: true,
    });
    w.text(
      `${platformLabel(post.platform)} ${post.handle} · ${formatDate(post.publishedAt)} · ${formatCount(post.views)} izlenme · etkileşim ${formatPercent(post.engagementRate)}`,
      { color: muted, size: 9.5 },
    );
    if (post.url && /^https?:\/\//i.test(post.url))
      w.text(post.url, { color: accent, size: 9 });
    w.y -= 4;
  });

  w.heading('Kitle');
  w.text(
    kit.audience === null
      ? 'Yaş, cinsiyet ve ülke dağılımı: veri yok (platform kitle verisi henüz toplanmıyor).'
      : '',
    { color: muted },
  );

  w.heading('Hizmetler ve fiyat aralıkları');
  w.text(
    kit.pricing.tier
      ? `Kademe: ${kit.pricing.tier} (güncel toplam takipçiye göre)`
      : `Kademe: ${NO_DATA} (takipçi ölçümü yok; fiyat teklif üzerine)`,
    { color: muted, gap: 2 },
  );
  for (const service of kit.pricing.services) {
    w.pair(
      service.label,
      formatPriceRange(service.range, kit.pricing.currency),
    );
    w.text(service.description, { color: muted, size: 9 });
  }
  w.text(kit.pricing.note, { color: muted, size: 9, gap: 2 });

  w.heading('İletişim');
  w.pair('İş birliği e-postası', kit.contact.email ?? NO_DATA);

  w.footer(
    `Oluşturma: ${formatDate(generatedAt.toISOString())} · Kaynak: platform ölçümleri (account_snapshots, metric_snapshots)`,
  );
  return doc.save();
}
