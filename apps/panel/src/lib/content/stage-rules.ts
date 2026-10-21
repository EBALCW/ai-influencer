import { checklistKeys, type ContentChecklist } from './checklist-schema';

export const stages = [
  ['idea', 'Fikir'],
  ['script', 'Senaryo'],
  ['production', 'Üretim'],
  ['qc', 'QC'],
  ['edit', 'Edit'],
  ['scheduled', 'Planlandı'],
  ['published', 'Yayında'],
] as const;
export type ContentStage = (typeof stages)[number][0];

export function checklistReady(checklist: ContentChecklist): boolean {
  return (
    checklist.decision === 'ready' &&
    (checklist.hookScore ?? 0) >= 3 &&
    (checklist.engagementScore ?? 0) >= 3 &&
    checklistKeys.every((key) => checklist.items[key] === true)
  );
}
export function stageRule(stage: ContentStage, checklist: ContentChecklist) {
  if (stage === 'scheduled' || stage === 'published') {
    return checklistReady(checklist)
      ? { ok: true as const, stage }
      : {
          ok: false as const,
          error:
            'Planlamak için tüm yayın öncesi kontrolleri tamamlayın ve iki puanı en az 3 yapın.',
        };
  }
  const lowScore = [checklist.hookScore, checklist.engagementScore].some(
    (score) => score !== null && score < 3,
  );
  return { ok: true as const, stage: lowScore ? ('edit' as const) : stage };
}
