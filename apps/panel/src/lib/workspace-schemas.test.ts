import { describe, expect, it } from 'vitest';
import { workspaceUpdateSchema } from './workspace-schemas';

describe('workspace schemas', () => {
  it('adı kırpar', () => {
    expect(workspaceUpdateSchema.parse({ name: '  Stüdyo A  ' })).toEqual({
      name: 'Stüdyo A',
    });
  });

  it.each([
    { name: '' },
    { name: '   ' },
    { name: 'x'.repeat(81) },
    { name: 42 },
    {},
    null,
  ])('geçersiz adı reddeder: %j', (body) => {
    expect(workspaceUpdateSchema.safeParse(body).success).toBe(false);
  });

  it('80 karakteri kabul eder', () => {
    expect(
      workspaceUpdateSchema.safeParse({ name: 'x'.repeat(80) }).success,
    ).toBe(true);
  });
});
