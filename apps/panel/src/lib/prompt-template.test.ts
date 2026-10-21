import { describe, expect, it } from 'vitest';
import {
  extractVariables,
  renderTemplate,
  renderTemplateStrict,
  TemplateError,
} from './prompt-template';

describe('extractVariables', () => {
  it('returns unique names in order of first appearance', () => {
    expect(
      extractVariables(
        '{{outfit}} giyen karakter, {{location}}; yine {{outfit}}',
      ),
    ).toEqual(['outfit', 'location']);
  });

  it('supports Turkish letters and inner whitespace', () => {
    expect(extractVariables('{{ kıyafet }} · {{şehir_adı}}')).toEqual([
      'kıyafet',
      'şehir_adı',
    ]);
  });

  it('ignores escaped and invalid placeholders', () => {
    expect(extractVariables('\\{{kacis}} {{1sayi}} {{a-b}} {{ok}}')).toEqual([
      'ok',
    ]);
  });
});

describe('renderTemplate', () => {
  it('fills every occurrence of a variable', () => {
    const result = renderTemplate('{{ad}} ve yine {{ ad }}', { ad: 'Mina' });
    expect(result).toEqual({
      text: 'Mina ve yine Mina',
      missing: [],
      unused: [],
    });
  });

  it('keeps missing and blank variables as placeholders and reports them', () => {
    const result = renderTemplate('{{outfit}} @ {{location}}', {
      outfit: '   ',
    });
    expect(result.text).toBe('{{outfit}} @ {{location}}');
    expect(result.missing).toEqual(['outfit', 'location']);
  });

  it('reports values that the template does not use', () => {
    expect(renderTemplate('{{a}}', { a: '1', fazla: '2' }).unused).toEqual([
      'fazla',
    ]);
  });

  it('turns an escaped placeholder into literal braces', () => {
    expect(renderTemplate('\\{{ad}} = {{ad}}', { ad: 'X' }).text).toBe(
      '{{ad}} = X',
    );
  });

  it('does not interpret values as template syntax', () => {
    expect(renderTemplate('{{a}}', { a: '{{b}} $& $1' }).text).toBe(
      '{{b}} $& $1',
    );
  });

  it('does not read inherited object properties', () => {
    const result = renderTemplate('{{__proto__}} {{toString}}', {});
    expect(result.missing).toEqual(['__proto__', 'toString']);
  });

  it('leaves text without variables untouched', () => {
    expect(renderTemplate('Sade metin {{ }}', {}).text).toBe(
      'Sade metin {{ }}',
    );
  });
});

describe('renderTemplateStrict', () => {
  it('returns the text when all variables are filled', () => {
    expect(renderTemplateStrict('{{a}}-{{b}}', { a: '1', b: '2' })).toBe('1-2');
  });

  it('throws TemplateError listing the missing variables', () => {
    expect(() => renderTemplateStrict('{{a}} {{b}}', { a: '1' })).toThrow(
      TemplateError,
    );
    try {
      renderTemplateStrict('{{a}} {{b}}', {});
    } catch (error) {
      expect((error as TemplateError).missing).toEqual(['a', 'b']);
    }
  });
});
