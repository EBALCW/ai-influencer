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
    expect(checklistKeys).toHaveLength(25);
    expect(new Set(checklistKeys).size).toBe(25);
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
  it('3–5 hashtag / caption maddesi (#22) zorunlu ve SQL/worker listeleriyle aynı', () => {
    const c = readyChecklist();
    c.items.engagement_hashtags = false;
    expect(checklistReady(c)).toBe(false);
    const migration = readFileSync(
      new URL(
        '../../../../../supabase/migrations/20261024100000_content_source_fields.sql',
        import.meta.url,
      ),
      'utf8',
    );
    const worker = readFileSync(
      new URL(
        '../../../../../supabase/functions/_shared/publishers/checklist.ts',
        import.meta.url,
      ),
      'utf8',
    );
    for (const key of checklistKeys) {
      expect(migration).toContain(`'${key}'`);
      expect(worker).toContain(`'${key}'`);
    }
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
