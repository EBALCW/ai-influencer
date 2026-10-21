import type { GenerationStatus } from '@ai-influencer/shared';

const transitions: Record<GenerationStatus, readonly GenerationStatus[]> = {
  queued: ['running', 'succeeded', 'failed', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function isTerminal(status: GenerationStatus): boolean {
  return transitions[status].length === 0;
}

/**
 * Durum geriye gidemez ve terminal durumdan çıkılamaz. Aynı durumun tekrar
 * gelmesi (ör. iki kez "running" okunması) geçerli sayılır.
 */
export function canTransition(
  from: GenerationStatus,
  to: GenerationStatus,
): boolean {
  return from === to || transitions[from].includes(to);
}

export function assertTransition(
  from: GenerationStatus,
  to: GenerationStatus,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Geçersiz üretim durumu geçişi: ${from} → ${to}`);
  }
}
