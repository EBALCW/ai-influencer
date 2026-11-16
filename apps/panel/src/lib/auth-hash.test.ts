import { describe, expect, it } from 'vitest';
import { authHashErrorMessage, parseAuthHash } from './auth-hash';

describe('parseAuthHash', () => {
  it('davet bağlantısındaki oturumu okur', () => {
    expect(
      parseAuthHash(
        '#access_token=aaa.bbb.ccc&expires_in=3600&refresh_token=rrr&token_type=bearer&type=invite',
      ),
    ).toEqual({
      kind: 'session',
      accessToken: 'aaa.bbb.ccc',
      refreshToken: 'rrr',
    });
  });

  it('süresi dolmuş bağlantıyı hata olarak okur', () => {
    expect(
      parseAuthHash(
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
      ),
    ).toEqual({ kind: 'error', code: 'otp_expired' });
  });

  it('eksik ya da ilgisiz hash için null döner', () => {
    expect(parseAuthHash('')).toBeNull();
    expect(parseAuthHash(null)).toBeNull();
    expect(parseAuthHash('#bolum')).toBeNull();
    expect(parseAuthHash('#access_token=yalniz-biri')).toBeNull();
  });

  it('hata kodunu sınırlar', () => {
    const parsed = parseAuthHash(`#error_code=${'x'.repeat(500)}`);
    expect(parsed?.kind === 'error' && parsed.code.length).toBe(60);
  });
});

describe('authHashErrorMessage', () => {
  it('süresi dolan bağlantıyı açıklar, diğerlerinde genel mesaj verir', () => {
    expect(authHashErrorMessage('otp_expired')).toMatch(/süresi dolmuş/);
    expect(authHashErrorMessage('baska')).toMatch(/doğrulanamadı/);
  });
});
