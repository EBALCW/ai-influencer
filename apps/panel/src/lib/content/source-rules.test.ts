// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  producerOf,
  scorerIsProducer,
  sourceDetailsError,
  sourceTypeLabels,
  sourceTypes,
} from './source-rules';

const a = '10000000-0000-4000-8000-00000000000a';
const b = '10000000-0000-4000-8000-00000000000b';

describe('v2v kaynak kuralları (#145)', () => {
  it('dört politika kodu ve etiketi var', () => {
    expect(sourceTypes).toEqual([
      'own',
      'stock',
      'open_license',
      'third_party',
    ]);
    for (const t of sourceTypes) expect(sourceTypeLabels[t]).toBeTruthy();
  });
  it('kendi referansı dışında sahip ve lisans/izin zorunlu', () => {
    const empty = { source_owner: '', source_license: '' };
    expect(sourceDetailsError({ source_type: null, ...empty })).toBeNull();
    expect(sourceDetailsError({ source_type: 'own', ...empty })).toBeNull();
    for (const t of ['stock', 'open_license', 'third_party'] as const) {
      expect(sourceDetailsError({ source_type: t, ...empty })).not.toBeNull();
      expect(
        sourceDetailsError({
          source_type: t,
          source_owner: '@kanal',
          source_license: '  ',
        }),
      ).not.toBeNull();
      expect(
        sourceDetailsError({
          source_type: t,
          source_owner: '@kanal',
          source_license: 'izin: depo/1',
        }),
      ).toBeNull();
    }
  });
});

describe('puanlayan ≠ üreten (#22)', () => {
  it('üreten sorumludur; atanmamışsa kartı açan', () => {
    expect(producerOf({ assignee_id: b, created_by: a })).toBe(b);
    expect(producerOf({ assignee_id: null, created_by: a })).toBe(a);
  });
  it('puanlayan üretenle aynıysa engellenir, bilinmiyorsa engellenmez', () => {
    expect(
      scorerIsProducer({
        checklist_scored_by: a,
        assignee_id: null,
        created_by: a,
      }),
    ).toBe(true);
    expect(
      scorerIsProducer({
        checklist_scored_by: a,
        assignee_id: b,
        created_by: a,
      }),
    ).toBe(false);
    expect(
      scorerIsProducer({
        checklist_scored_by: b,
        assignee_id: b,
        created_by: a,
      }),
    ).toBe(true);
    expect(
      scorerIsProducer({
        checklist_scored_by: null,
        assignee_id: null,
        created_by: a,
      }),
    ).toBe(false);
  });
});
