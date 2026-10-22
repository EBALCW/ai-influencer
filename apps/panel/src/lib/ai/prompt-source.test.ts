import { expect, it } from 'vitest';
import { generationTypeForCategory, toPromptKey } from '@/lib/prompt-schemas';
import { aiTaskPromptLineage } from './prompt-source';

it('her AI görevi panelde "AI <Görev>" başlığıyla oluşturulabilen sabit bir soya eşlenir', () => {
  expect(toPromptKey('AI Persona')).toBe(aiTaskPromptLineage.persona.key);
  expect(toPromptKey('AI Caption')).toBe(aiTaskPromptLineage.caption.key);
  expect(toPromptKey('AI Script')).toBe(aiTaskPromptLineage.script.key);
  expect(toPromptKey('AI Weekly')).toBe(aiTaskPromptLineage.weekly.key);
  expect(toPromptKey('AI Reply')).toBe(aiTaskPromptLineage.reply.key);
  const keys = Object.values(aiTaskPromptLineage).map(
    (lineage) => `${lineage.category}/${lineage.key}`,
  );
  expect(new Set(keys).size).toBe(keys.length);
  // Kategoriler enum'da var (eşleme şema değişikliği gerektirmez)
  for (const { category } of Object.values(aiTaskPromptLineage))
    expect(category in generationTypeForCategory).toBe(true);
});
