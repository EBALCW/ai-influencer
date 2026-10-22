import { describe, expect, it } from 'vitest';
import {
  bestIndex,
  checkpointLabel,
  engagementRate,
  firstWave,
  median,
  performanceScore,
  primaryScore,
  scoreTone,
  segmentKeyLabel,
  segmentTables,
  type Checkpoint,
} from './metrics';

const cp = (
  hours: number,
  views: number | null,
  med: number | null,
  measured = 5,
): Checkpoint => ({ hours, views, median: med, average: med, measured });

describe('median', () => {
  it('boş veya sadece ölçümsüz değerlerde null', () => {
    expect(median([])).toBeNull();
    expect(median([null, undefined])).toBeNull();
  });
  it('tek değer kendisidir', () => {
    expect(median([7])).toBe(7);
  });
  it('tek sayıda değerde ortadaki', () => {
    expect(median([30, 10, 20])).toBe(20);
  });
  it('çift sayıda değerde ortadaki ikisinin ortalaması', () => {
    expect(median([100, 1000, 200, 300])).toBe(250);
  });
  it('null değerleri sıfır saymaz', () => {
    expect(median([null, 4, 8])).toBe(6);
  });
});

describe('performanceScore', () => {
  it('post / medyan oranını iki haneye yuvarlar', () => {
    expect(performanceScore(50, 250)).toBe(0.2);
    expect(performanceScore(500, 300)).toBe(1.67);
  });
  it('ölçüm veya kıyas yoksa, medyan 0 ise null', () => {
    expect(performanceScore(null, 10)).toBeNull();
    expect(performanceScore(10, null)).toBeNull();
    expect(performanceScore(10, 0)).toBeNull();
  });
  it('tonu eşiklere göre belirler', () => {
    expect(scoreTone(1.2)).toBe('above');
    expect(scoreTone(0.8)).toBe('near');
    expect(scoreTone(0.79)).toBe('below');
    expect(scoreTone(null)).toBe('unknown');
  });
});

describe('primaryScore', () => {
  it('24 sa varsa onu kullanır', () => {
    expect(
      primaryScore([cp(1, 5, 20), cp(24, 50, 250), cp(72, 90, 100)]),
    ).toEqual({ hours: 24, score: 0.2 });
  });
  it('24 sa yoksa en geç ölçülmüş kontrol noktasına düşer', () => {
    expect(
      primaryScore([cp(1, 30, 20), cp(5, 60, 30), cp(24, null, 250)]),
    ).toEqual({ hours: 5, score: 2 });
  });
  it('kıyas grubu küçükse skor vermez', () => {
    expect(primaryScore([cp(24, 50, 250, 2)])).toBeNull();
  });
});

describe('firstWave', () => {
  it('5 sa ölçümü eşik altındaysa işaretler', () => {
    expect(firstWave([cp(1, 50, 20), cp(5, 8, 40)])).toEqual({
      status: 'below',
      hours: 5,
      ratio: 0.2,
    });
  });
  it('5 sa yoksa 1 sa ölçümüne bakar', () => {
    expect(firstWave([cp(1, 15, 20), cp(5, null, 40)])).toEqual({
      status: 'passed',
      hours: 1,
      ratio: 0.75,
    });
  });
  it('erken ölçüm yoksa beklemede', () => {
    expect(firstWave([cp(24, 10, 20)]).status).toBe('pending');
  });
  it('kıyas yetersizse karar vermez', () => {
    expect(firstWave([cp(1, 5, 20, 1)]).status).toBe('insufficient');
    expect(firstWave([cp(1, 5, null)]).status).toBe('insufficient');
  });
});

describe('segmentTables', () => {
  const segments = [
    {
      dimension: 'hook_type',
      key: 'soru',
      posts: 3,
      measured: 3,
      median: 100,
      average: 116.67,
    },
    {
      dimension: 'hook_type',
      key: '',
      posts: 3,
      measured: 3,
      median: 1000,
      average: 3766.33,
    },
    {
      dimension: 'format',
      key: 'short_video',
      posts: 3,
      measured: 0,
      median: null,
      average: null,
    },
    {
      dimension: 'publish_hour',
      key: 'morning',
      posts: 1,
      measured: 1,
      median: 50,
      average: 50,
    },
    {
      dimension: 'bilinmeyen',
      key: 'x',
      posts: 1,
      measured: 1,
      median: 1,
      average: 1,
    },
  ];

  it('en az 3 boyut üretir ve bilinmeyen boyutu atlar', () => {
    const tables = segmentTables(segments, 250);
    expect(tables.map((t) => t.dimension)).toEqual([
      'hook_type',
      'format',
      'publish_hour',
      'duration',
      'platform',
    ]);
    expect(
      tables.flatMap((t) => t.rows).some((r) => r.dimension === 'bilinmeyen'),
    ).toBe(false);
  });
  it('satırları medyana göre sıralar, genel medyana göre endeks verir', () => {
    const [hook] = segmentTables(segments, 250);
    expect(hook!.rows.map((r) => [r.label, r.index])).toEqual([
      ['Belirtilmemiş', 4],
      ['soru', 0.4],
    ]);
  });
  it('ölçümsüz segmentte endeks yok, boş boyut boş liste', () => {
    const tables = segmentTables(segments, 250);
    expect(tables[1]!.rows[0]).toMatchObject({
      label: 'Kısa video',
      index: null,
    });
    expect(tables[3]!.rows).toEqual([]);
  });
  it('genel medyan yoksa endeks hesaplanmaz', () => {
    expect(segmentTables(segments, null)[0]!.rows[0]!.index).toBeNull();
  });
  it('etiketler', () => {
    expect(segmentKeyLabel('publish_hour', 'evening')).toBe('Akşam (18–24)');
    expect(segmentKeyLabel('duration', 'lt15')).toBe('15 sn altı');
    expect(segmentKeyLabel('hook_type', 'merak')).toBe('merak');
  });
});

describe('yardımcılar', () => {
  it('kontrol noktası etiketleri', () => {
    expect([1, 5, 24, 72, 168].map(checkpointLabel)).toEqual([
      '1 sa',
      '5 sa',
      '24 sa',
      '3 gün',
      '7 gün',
    ]);
  });
  it('etkileşim oranı, izlenme 0 ise null', () => {
    expect(
      engagementRate({
        views: 200,
        likes: 10,
        comments: 5,
        shares: 3,
        saves: 2,
      }),
    ).toBe(0.1);
    expect(
      engagementRate({ views: 0, likes: 1, comments: 0, shares: 0, saves: 0 }),
    ).toBeNull();
  });
  it('en iyi sütun; eşitlik veya tek ölçümde yok', () => {
    expect(bestIndex([10, 30, null, 20])).toBe(1);
    expect(bestIndex([30, 30])).toBeNull();
    expect(bestIndex([null, 5])).toBeNull();
  });
});
