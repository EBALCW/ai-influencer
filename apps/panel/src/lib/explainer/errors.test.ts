import { describe, expect, it } from 'vitest';
import { GENERIC_ERROR, mapExplainerError } from './errors';

describe('anlatım RPC hata eşlemesi', () => {
  it('iyimser kilit çakışmasını 409 ve istemci koduyla döndürür', () => {
    const mapped = mapExplainerError({
      code: '55000',
      hint: 'version_conflict',
      message: 'Senaryo bu arada değişti (sürüm 4).',
    });
    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe('version_conflict');
    expect(mapped.message).toMatch(/başka biri değiştirdi/);
  });

  it('kaynak eksiğini bilerek kabul isteyen hatayı ayırır', () => {
    expect(
      mapExplainerError({ code: '23514', hint: 'fact_gaps', message: 'x' }),
    ).toMatchObject({ status: 422, code: 'fact_gaps' });
  });

  it.each([
    ['42501', '', 403, /yetki/],
    ['P0002', '', 404, /bulunamadı/],
    ['42501', 'worker_session', 403, /makinesi/],
    ['55000', 'episode_in_production', 409, /iptal/],
    ['55000', 'series_archived', 409, /arşiv/],
    ['55000', 'already_picked', 409, /zaten seçildi/],
    ['22023', 'too_many_suggestions', 422, /20/],
    ['22023', 'kind_required', 422, /Tür/],
    ['42501', 'script_approval_required', 409, /onaylanmadan/],
  ])('%s / %s → %i', (code, hint, status, pattern) => {
    const mapped = mapExplainerError({ code, hint, message: 'ham' });
    expect(mapped.status).toBe(status);
    expect(mapped.message).toMatch(pattern);
  });

  it('seri adı tekrarını anlaşılır mesaja çevirir', () => {
    expect(
      mapExplainerError({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "series_workspace_name_key"',
      }),
    ).toEqual({ status: 409, message: 'Bu adda bir seri zaten var.' });
  });

  it('veritabanının kendi Türkçe mesajını geçirir, ham SQL mesajını geçirmez', () => {
    expect(
      mapExplainerError({
        code: '54000',
        message: 'Çalışma alanı başına en çok 500 seri açılabilir.',
      }).message,
    ).toBe('Çalışma alanı başına en çok 500 seri açılabilir.');
    for (const message of [
      'new row for relation "episodes" violates check constraint "episodes_language_valid"',
      'null value in column "kind" of relation "topic_suggestions" violates not-null constraint',
      'invalid input syntax for type uuid: "x"',
    ]) {
      const mapped = mapExplainerError({ code: '23514', message });
      expect(mapped.message).toBe('Kayıt kurallara uymuyor.');
      expect(mapped.message).not.toMatch(/relation|constraint|uuid/);
    }
  });

  it('tanınmayan hata genel mesaja düşer ve ayrıntı sızdırmaz', () => {
    expect(
      mapExplainerError({ code: 'XX000', message: 'internal error at 0x1f' }),
    ).toEqual({ status: 500, message: GENERIC_ERROR });
    expect(mapExplainerError({})).toEqual({
      status: 500,
      message: GENERIC_ERROR,
    });
  });
});
