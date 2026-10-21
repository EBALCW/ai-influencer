import { describe, expect, it } from 'vitest';
import { getPanelGreeting } from '@ai-influencer/shared';

describe('panel greeting', () => {
  it('shows the Turkish workspace label', () => {
    expect(getPanelGreeting()).toBe('Ekip çalışma alanı');
  });
});
