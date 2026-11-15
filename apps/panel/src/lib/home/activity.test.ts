import { describe, expect, it } from 'vitest';
import {
  episodeActivity,
  machineLabel,
  mergeActivity,
  summarizeMachines,
  type ActivityItem,
} from './activity';

const item = (id: string, at: string): ActivityItem => ({
  id,
  module: 'clip',
  title: id,
  detail: '',
  status: '',
  href: '/clips',
  at,
});

describe('son üretimler (#200)', () => {
  it('modül listelerini tarihe göre birleştirir ve sınırlar', () => {
    const merged = mergeActivity(
      [
        [item('a', '2026-11-10T10:00:00Z'), item('b', '2026-11-12T10:00:00Z')],
        [item('c', '2026-11-11T10:00:00Z')],
        [],
      ],
      2,
    );
    expect(merged.map((entry) => entry.id)).toEqual(['b', 'c']);
  });

  it('aynı andaki kayıtları kimliğe göre kararlı sıralar', () => {
    const at = '2026-11-10T10:00:00Z';
    expect(
      mergeActivity([[item('z', at)], [item('a', at)]]).map((e) => e.id),
    ).toEqual(['a', 'z']);
  });

  it('bölümü seri ve numarasıyla, tekil videoyu etiketiyle gösterir', () => {
    const base = {
      id: '1',
      title: 'Planör nasıl uçar',
      status: 'script_ready',
      updated_at: '2026-11-10T10:00:00Z',
    };
    expect(
      episodeActivity({ ...base, episode_number: 3, series: { name: 'Uçuş' } }),
    ).toMatchObject({
      module: 'explainer',
      detail: 'Uçuş · Bölüm 3',
      status: 'Senaryo onay bekliyor',
      href: '/explainers/episodes/1',
    });
    expect(
      episodeActivity({ ...base, episode_number: null, series: null }).detail,
    ).toBe('Tekil video');
  });
});

describe('makine durumu', () => {
  const now = new Date('2026-11-15T12:00:00Z');
  it('iptal edilen makineyi saymaz, 90 saniyeden eski kalp atışını çevrimdışı sayar', () => {
    const summary = summarizeMachines(
      [
        { last_seen_at: '2026-11-15T11:59:30Z', revoked_at: null },
        { last_seen_at: '2026-11-15T11:50:00Z', revoked_at: null },
        { last_seen_at: null, revoked_at: null },
        {
          last_seen_at: '2026-11-15T11:59:59Z',
          revoked_at: '2026-11-15T11:00:00Z',
        },
      ],
      now,
    );
    expect(summary).toEqual({ total: 3, online: 1 });
    expect(machineLabel(summary)).toBe('1 üretim makinesi çevrimiçi');
  });

  it('makine yokken ve hepsi çevrimdışıyken ayrı mesaj verir', () => {
    expect(machineLabel({ total: 0, online: 0 })).toBe(
      'Üretim makinesi bağlı değil',
    );
    expect(machineLabel({ total: 2, online: 0 })).toBe(
      'Üretim makinesi çevrimdışı',
    );
  });
});
