import { assert, assertFalse } from '@std/assert';
import { aiLabelChecked, CHECKLIST_KEYS, checklistReady } from './checklist.ts';

const ready = {
  items: Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true])),
  hookScore: 4,
  engagementScore: 3,
  decision: 'ready',
};

Deno.test('check-list kuralı SQL content_checklist_ready ile aynı', () => {
  assert(checklistReady(ready));
  assertFalse(checklistReady(null));
  assertFalse(checklistReady({}));
  assertFalse(checklistReady({ ...ready, decision: 'review' }));
  assertFalse(checklistReady({ ...ready, hookScore: 2 }));
  assertFalse(
    checklistReady({ ...ready, engagementScore: '4' }),
    'puan sayı olmalı',
  );
  assertFalse(
    checklistReady({
      ...ready,
      items: { ...ready.items, commercial_minor: 'true' },
    }),
    'string true kabul edilmez',
  );
  assertFalse(
    checklistReady({
      ...ready,
      items: { ...ready.items, ai_disclosure: false },
    }),
  );
});

Deno.test('AI etiketi maddesi (#32) ayrıca denetlenir', () => {
  assert(aiLabelChecked(ready));
  assertFalse(aiLabelChecked({ items: { ai_disclosure: 'true' } }));
  assertFalse(aiLabelChecked(null));
});
