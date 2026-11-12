import { describe, expect, it } from 'vitest';
import { CSV_BOM, toCsv } from '@/lib/reports/csv';
import {
  parseCount,
  parseDate,
  parseDuration,
  parseTrendCsv,
  TREND_CSV_HEADERS,
  trendCsvColumns,
  type TrendCsvSource,
} from './csv';

const influencers = new Map([
  ['demo-creator', '10000000-0000-4000-8000-000000000001'],
]);
const header =
  'id,tarih,platform,link,hesap,izlenme,beğeni,yorum,süre_sn,format,kanca_ilk_3sn,ses_müzik,neden_viral,uyarlama_fikri,uyarlama_puanı (1-5),maliyet_tahmini (düşük/orta/yüksek),durum (yeni/seçildi/üretildi/elendi)';

describe('parseTrendCsv', () => {
  it('issue #10 başlıklarını ve Türkçe değerleri okur', () => {
    const csv = `${CSV_BOM}${header}\r\n1,24.10.2026,,https://www.instagram.com/reel/abc/,@hesap,"1,2M",15K,1.200,0:45,kısa_film,Soru,Ses adı,Twist,Karakterle uyarla,5,düşük,seçildi\r\n`;
    const result = parseTrendCsv(csv, influencers);
    expect(result).toMatchObject({ ok: true, errors: [] });
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      line: 2,
      input: {
        url: 'https://www.instagram.com/reel/abc/',
        platform: 'instagram',
        influencer_id: null,
        captured_on: '2026-10-24',
        account_handle: '@hesap',
        views: 1_200_000,
        likes: 15_000,
        comments: 1200,
        duration_s: 45,
        format: 'short_film',
        hook: 'Soru',
        sound: 'Ses adı',
        why_viral: 'Twist',
        adaptation_idea: 'Karakterle uyarla',
        adaptation_score: 5,
        cost_estimate: 'low',
        status: 'shortlisted',
        source: 'manual',
        notes: '',
      },
    });
  });

  it('Excel noktalı virgül ayracı, büyük harfli başlık ve influencer slug', () => {
    const csv =
      'LINK;Format;Durum;Kaynak;Influencer;Not\nhttps://vm.tiktok.com/x;DANS;Elendi;claude;demo-creator;a';
    const result = parseTrendCsv(csv, influencers);
    if (!result.ok) throw new Error(result.error);
    expect(result.rows[0]?.input).toMatchObject({
      platform: 'tiktok',
      format: 'dance',
      status: 'rejected',
      source: 'claude',
      influencer_id: '10000000-0000-4000-8000-000000000001',
      notes: 'a',
    });
  });

  it('hatalı satırları satır numarasıyla raporlar, geçerli satırları korur', () => {
    const csv = [
      'link,izlenme,uyarlama_puanı,format,influencer,tarih',
      'https://youtu.be/ok,100,4,meme,,2026-10-01',
      'javascript:alert(1),,,,,',
      'https://youtube.com/shorts/x,çok,9,uçan,yok-boyle,31.02',
      ',,,,,',
      '"https://instagram.com/p/1",,,,,',
    ].join('\n');
    const result = parseTrendCsv(csv, influencers);
    if (!result.ok) throw new Error(result.error);
    expect(result.rows.map((row) => row.line)).toEqual([2, 6]);
    expect(result.errors.map((error) => error.line)).toEqual([3, 4]);
    expect(result.errors[0]?.message).toMatch(/link/);
    const bad = result.errors[1]!.message;
    expect(bad).toMatch(/Influencer bulunamadı: "yok-boyle"/);
    expect(bad).toMatch(/Sayı okunamadı/);
    expect(bad).toMatch(/Uyarlama puanı/);
    expect(bad).toMatch(/Format tanınmadı/);
  });

  it('geçersiz takvim tarihini reddeder', () => {
    const result = parseTrendCsv(
      'link,tarih\nhttps://a.example/x,2026-02-31',
      influencers,
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.errors[0]?.message).toMatch(/tarih/);
  });

  it('dosya düzeyindeki hatalar: boş dosya, link sütunu yok', () => {
    expect(parseTrendCsv('', influencers)).toEqual({
      ok: false,
      error: 'Dosya boş.',
    });
    const missing = parseTrendCsv('tarih,hesap\n1,2', influencers);
    expect(missing.ok).toBe(false);
  });

  it('bilinmeyen sütunları bildirir ve yok sayar', () => {
    const result = parseTrendCsv(
      'link,gizli\nhttps://a.example/x,1',
      influencers,
    );
    expect(result).toMatchObject({ ok: true, ignoredColumns: ['gizli'] });
  });

  it('dışa aktarılan dosya aynen geri okunur (round-trip)', () => {
    const source: TrendCsvSource = {
      id: '70000000-0000-4000-8000-000000000001',
      captured_on: '2026-10-20',
      platform: 'instagram',
      url: 'https://www.instagram.com/reel/abc/',
      account_handle: '@demo',
      views: 1200,
      likes: null,
      comments: 3,
      duration_s: 18,
      format: 'lip_sync',
      hook: '=yalnız metin',
      sound: 'ses, "tırnaklı"',
      why_viral: 'satır 1\nsatır 2',
      adaptation_idea: 'fikir',
      adaptation_score: 4,
      cost_estimate: 'high',
      status: 'used',
      source: 'claude',
      notes: '',
      influencer_slug: 'demo-creator',
    };
    const csv = toCsv(trendCsvColumns, [source]);
    expect(csv.startsWith(`${CSV_BOM}${TREND_CSV_HEADERS.join(',')}\r\n`)).toBe(
      true,
    );
    const result = parseTrendCsv(csv, influencers);
    if (!result.ok) throw new Error(result.error);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]?.input).toMatchObject({
      url: source.url,
      captured_on: '2026-10-20',
      hook: '=yalnız metin',
      sound: 'ses, "tırnaklı"',
      why_viral: 'satır 1\nsatır 2',
      format: 'lip_sync',
      cost_estimate: 'high',
      status: 'used',
      source: 'claude',
      influencer_id: '10000000-0000-4000-8000-000000000001',
      likes: null,
    });
  });
});

describe('alan çözücüler', () => {
  it('parseCount kısaltmaları ve binlik ayraçları okur', () => {
    expect(parseCount('')).toBeNull();
    expect(parseCount('12500')).toBe(12500);
    expect(parseCount('12.500')).toBe(12500);
    expect(parseCount('1 200 000')).toBe(1_200_000);
    expect(parseCount('3,4 bin')).toBe(3400);
    expect(parseCount('1.5m')).toBe(1_500_000);
    expect(() => parseCount('1.5')).toThrow();
    expect(() => parseCount('-3')).toThrow();
  });
  it('parseDuration ve parseDate', () => {
    expect(parseDuration('1:05')).toBe(65);
    expect(parseDuration('30')).toBe(30);
    expect(() => parseDuration('30s')).toThrow();
    expect(parseDate('')).toBeUndefined();
    expect(parseDate('5/9/2026')).toBe('2026-09-05');
    expect(() => parseDate('2026/09/05')).toThrow();
  });
});
