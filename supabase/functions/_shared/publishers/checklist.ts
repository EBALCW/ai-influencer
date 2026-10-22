// public.content_checklist_ready() (migration 20261022130000) ile aynı kural. Worker yayın
// anında check-list'i tekrar doğrular; panelin "tamam" demesine güvenilmez (#58).
// Madde listesi templates/pre-publish-checklist.md ve apps/panel/src/lib/content/checklist-schema.ts
// ile aynıdır; liste değişirse üçü birlikte güncellenir.
export const CHECKLIST_KEYS = [
  'hook_opening',
  'hook_character',
  'hook_pacing',
  'hook_payoff',
  'hook_loop',
  'engagement_reason',
  'engagement_caption',
  'engagement_honesty',
  'quality_format',
  'quality_anatomy',
  'quality_text',
  'quality_silent',
  'quality_audio',
  'quality_cover',
  'ai_disclosure',
  'ai_identity',
  'ai_consent',
  'ai_claims',
  'ai_brands',
  'commercial_disclosure',
  'commercial_tool',
  'commercial_rights',
  'commercial_engagement',
  'commercial_minor',
] as const;

const score = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 3 && v <= 5;

export function checklistReady(checklist: unknown): boolean {
  if (!checklist || typeof checklist !== 'object') return false;
  const c = checklist as Record<string, unknown>;
  const items = c.items;
  if (!items || typeof items !== 'object') return false;
  return (
    c.decision === 'ready' &&
    score(c.hookScore) &&
    score(c.engagementScore) &&
    CHECKLIST_KEYS.every(
      (key) => (items as Record<string, unknown>)[key] === true,
    )
  );
}

/** #32: platformun AI etiketi maddesi işaretli mi. */
export function aiLabelChecked(checklist: unknown): boolean {
  const items = (checklist as { items?: Record<string, unknown> } | null)
    ?.items;
  return !!items && items.ai_disclosure === true;
}
