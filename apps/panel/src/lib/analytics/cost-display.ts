import { formatMoney } from '@/lib/costs/money';
import type { PostCost } from '@/lib/costs/post-cost';

/**
 * Post detayındaki "Maliyet" kartı (#59 `post_cost`). Eksik kur veya veri yoksa
 * 0 yazılmaz; neden açıklanır. `average` dağıtımı tahmin olduğu için belirtilir.
 */
export function postCostDisplay(cost: PostCost | null) {
  if (!cost) return { value: '—', detail: 'Maliyet bilgisi yok' };
  const basis =
    cost.allocation === 'direct'
      ? `Doğrudan: ${cost.generationCount} bağlı üretim`
      : 'Tahmini: yayın ayındaki video başına ortalama';
  if (cost.missingRateCount > 0)
    return {
      value: '—',
      detail: `Eksik kur: ${cost.missingRateCount} kaydın ${cost.currency} kuru tanımlı değil · ${basis}`,
    };
  if (cost.allocation === 'direct' && cost.entryCount === 0)
    return { value: '—', detail: `${basis} · maliyet kaydı yok` };
  if (cost.total === null)
    return { value: '—', detail: `${basis} · hesaplanacak kayıt yok` };
  return { value: formatMoney(cost.total, cost.currency), detail: basis };
}
