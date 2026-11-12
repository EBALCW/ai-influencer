import { describe, expect, it } from 'vitest';
import {
  CSV_BOM,
  csvCell,
  csvFileName,
  detectCsvSeparator,
  parseCsv,
  toCsv,
} from './csv';

describe('parseCsv', () => {
  it('BOM, tırnaklı ayraç, ikilenmiş tırnak ve çok satırlı alanı okur', () => {
    const text = `${CSV_BOM}a,b,c\r\n"x,y","dedi ""selam""","satır 1\nsatır 2"\r\n3,,\r\n`;
    expect(parseCsv(text)).toEqual([
      { line: 1, cells: ['a', 'b', 'c'] },
      { line: 2, cells: ['x,y', 'dedi "selam"', 'satır 1\nsatır 2'] },
      { line: 4, cells: ['3', '', ''] },
    ]);
  });

  it('Türkçe Excel noktalı virgülünü ve sekmeyi başlıktan seçer', () => {
    expect(detectCsvSeparator('id;tarih;link\n1;2;3')).toBe(';');
    expect(detectCsvSeparator('id\ttarih')).toBe('\t');
    expect(detectCsvSeparator('id,tarih')).toBe(',');
    expect(parseCsv('a;b\n"1;2";3').map((r) => r.cells)).toEqual([
      ['a', 'b'],
      ['1;2', '3'],
    ]);
  });

  it('boş satırları atlar, LF ve CR satır sonlarını kabul eder', () => {
    expect(parseCsv('a,b\n\n1,2\r3,4\n,\n').map((r) => r.line)).toEqual([
      1, 3, 4,
    ]);
  });

  it('toCsv çıktısını geri okur; formül koruması kaldırılır', () => {
    type R = { t: string; n: number };
    const csv = toCsv<R>(
      [
        { header: 'metin', value: (r) => r.t },
        { header: 'sayı', value: (r) => r.n },
      ],
      [
        { t: '=HYPERLINK("x")', n: -5 },
        { t: 'a, "b"\nc', n: 1 },
      ],
    );
    expect(parseCsv(csv).map((r) => r.cells)).toEqual([
      ['metin', 'sayı'],
      ['=HYPERLINK("x")', '-5'],
      ['a, "b"\nc', '1'],
    ]);
  });
});

describe('csvCell', () => {
  it('virgül, tırnak ve yeni satır içeren alanı tırnaklar', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('"alıntı"')).toBe('"""alıntı"""');
    expect(csvCell('satır 1\nsatır 2')).toBe('"satır 1\nsatır 2"');
    expect(csvCell('satır\r\n')).toBe('"satır\r\n"');
    expect(csvCell(' baştaki boşluk')).toBe('" baştaki boşluk"');
    expect(csvCell('düz')).toBe('düz');
  });

  it('formül enjeksiyonunu engeller (= + - @ sekme)', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(
      `"'=HYPERLINK(""http://evil"",""x"")"`,
    );
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('-2+3')).toBe("'-2+3");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('\t=1')).toBe("'\t=1");
    expect(csvCell('=1,2')).toBe(`"'=1,2"`);
    // Ortadaki işaretler dokunulmaz
    expect(csvCell('a=b')).toBe('a=b');
  });

  it('sayı tipindeki negatif değer formül sayılmaz', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(10n)).toBe('10');
  });

  it('boş, mantıksal ve tarih değerleri', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(new Date('2026-09-07T00:00:00Z'))).toBe(
      '2026-09-07T00:00:00.000Z',
    );
  });
});

describe('toCsv', () => {
  type Row = { name: string; caption: string; views: number };
  const columns = [
    { header: 'İsim', value: (r: Row) => r.name },
    { header: 'Açıklama', value: (r: Row) => r.caption },
    { header: 'İzlenme', value: (r: Row) => r.views },
  ];

  it('UTF-8 BOM ile başlar, CRLF kullanır, Türkçe karakterleri korur', () => {
    const csv = toCsv(columns, [
      { name: 'Çağrı Işık', caption: 'Şöyle güzel, öğle', views: 1200 },
      { name: 'Ümit', caption: '=cmd|calc', views: -1 },
    ]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe(
      `${CSV_BOM}İsim,Açıklama,İzlenme\r\n` +
        `Çağrı Işık,"Şöyle güzel, öğle",1200\r\n` +
        `Ümit,'=cmd|calc,-1\r\n`,
    );
    // UTF-8 baytları: BOM EF BB BF
    const bytes = new TextEncoder().encode(csv);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('boş tabloda yalnız başlık yazar', () => {
    expect(toCsv(columns, [])).toBe(`${CSV_BOM}İsim,Açıklama,İzlenme\r\n`);
  });
});

describe('csvFileName', () => {
  it('ASCII ve güvenli dosya adı üretir', () => {
    expect(
      csvFileName(['posts', 'şule-ılık', '2026-09-07', '2026-09-13']),
    ).toBe('posts_sule-ilik_2026-09-07_2026-09-13.csv');
    expect(csvFileName(['../../etc', '"x"'])).toBe('etc_x.csv');
  });
});
