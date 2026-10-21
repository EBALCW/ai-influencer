export type BudgetCheck =
  | { allowed: true; remaining: number | null }
  | { allowed: false; remaining: number; reason: 'limit_exceeded' };

/**
 * Yeni bir üretimin kredi limitini aşıp aşmayacağını hesaplar. `limit` null
 * ise sınır yoktur. Limite tam eşit olmak serbesttir, aşmak değildir.
 * Değerler `generations.credits` gibi numeric(12,4) olduğundan karşılaştırma
 * 4 ondalık basamağa yuvarlanarak yapılır (float hatası yüzünden yanlış red olmasın).
 */
export function checkBudget(input: {
  spent: number;
  limit: number | null;
  cost: number;
}): BudgetCheck {
  const { spent, limit, cost } = input;
  for (const [name, value] of [
    ['spent', spent],
    ['cost', cost],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} negatif olmayan bir sayı olmalı`);
    }
  }
  if (limit === null) return { allowed: true, remaining: null };
  if (!Number.isFinite(limit) || limit < 0) {
    throw new RangeError('limit negatif olmayan bir sayı olmalı');
  }

  const scale = 10_000;
  const after = Math.round((spent + cost) * scale);
  const max = Math.round(limit * scale);
  const remaining = Math.max(0, max - Math.round(spent * scale)) / scale;
  if (after > max) {
    return { allowed: false, remaining, reason: 'limit_exceeded' };
  }
  return { allowed: true, remaining: (max - after) / scale };
}
