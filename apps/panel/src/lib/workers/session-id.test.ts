// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sessionIdFromAccessToken } from './session-id';

function jwt(claims: unknown) {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part(claims)}.imza`;
}

describe('sessionIdFromAccessToken', () => {
  const sessionId = '5e560000-0000-4000-8000-0000000000a1';

  it('session_id claim’ini okur', () => {
    expect(sessionIdFromAccessToken(jwt({ session_id: sessionId }))).toBe(
      sessionId,
    );
  });

  it.each([
    ['claim yok', jwt({ sub: 'x' })],
    ['uuid değil', jwt({ session_id: 'x' })],
    ['metin değil', jwt({ session_id: 42 })],
    ['bozuk token', 'a.b'],
    ['boş', ''],
  ])('%s → null', (_name, token) => {
    expect(sessionIdFromAccessToken(token)).toBeNull();
  });
});
