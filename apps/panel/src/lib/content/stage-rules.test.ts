// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checklistGroups,
  checklistKeys,
  checklistSchema,
} from './checklist-schema';
import { checklistReady, stageRule } from './stage-rules';

export const readyChecklist = () =>
  checklistSchema.parse({
    items: Object.fromEntries(checklistKeys.map((key) => [key, true])),
    hookScore: 3,
    engagementScore: 4,
    decision: 'ready',
  });
describe('yayın aşama kuralları', () => {
  it('şablondaki beş bölüm ve tüm maddeleri içerir', () => {
    const template = readFileSync(
      new URL(
        '../../../../../templates/pre-publish-checklist.md',
        import.meta.url,
      ),
      'utf8',
    );
    expect(checklistGroups).toHaveLength(5);
    expect(checklistKeys).toHaveLength(24);
    for (const group of checklistGroups)
      for (const [, text] of group.items) expect(template).toContain(text);
  });
  it('her madde, iki puan ve yayına hazır kararı olmadan planlamayı reddeder', () => {
    expect(checklistReady(readyChecklist())).toBe(true);
    for (const key of checklistKeys) {
      const c = readyChecklist();
      c.items[key] = false;
      expect(stageRule('scheduled', c).ok).toBe(false);
    }
    expect(
      stageRule('published', { ...readyChecklist(), decision: 'review' }).ok,
    ).toBe(false);
    expect(
      stageRule('scheduled', { ...readyChecklist(), hookScore: null }).ok,
    ).toBe(false);
    expect(
      stageRule('scheduled', { ...readyChecklist(), engagementScore: 2 }).ok,
    ).toBe(false);
  });
  it('düşük puan kartı edit’e gönderir, henüz puanlanmamış fikir normal kalır', () => {
    expect(stageRule('qc', { ...readyChecklist(), hookScore: 2 })).toEqual({
      ok: true,
      stage: 'edit',
    });
    expect(stageRule('idea', checklistSchema.parse({}))).toEqual({
      ok: true,
      stage: 'idea',
    });
    expect(stageRule('scheduled', readyChecklist())).toEqual({
      ok: true,
      stage: 'scheduled',
    });
  });
});
