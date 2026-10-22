import { describe, expect, it } from 'vitest';
import {
  applyLibraryPrompt,
  getPromptTemplate,
  loadPromptTemplate,
} from './prompts';

describe('prompt library bridge (#46)', () => {
  it('falls back to the built-in template without a source', async () => {
    expect(await loadPromptTemplate('caption')).toBe(
      getPromptTemplate('caption'),
    );
  });

  it('replaces only the instructions with the library version', async () => {
    const template = await loadPromptTemplate('caption', async () => ({
      id: 'abc',
      version: 3,
      body: 'Kütüphane talimatı',
    }));
    const builtin = getPromptTemplate('caption');
    expect(template).toMatchObject({
      id: 'prompt:abc',
      version: 3,

      effort: builtin.effort,
    });
    expect(template.system).toContain('Kütüphane talimatı');
    expect(template.system).toContain('kurgusal');
    expect(template.buildUserMessage).toBe(builtin.buildUserMessage);
  });

  it('keeps the built-in template when the library is empty or fails', async () => {
    const builtin = getPromptTemplate('persona');
    expect(
      applyLibraryPrompt(builtin, { id: 'x', version: 1, body: '  ' }),
    ).toBe(builtin);
    await expect(
      loadPromptTemplate('persona', async () => {
        throw new Error('db down');
      }),
    ).rejects.toThrow('db down');
  });
});
