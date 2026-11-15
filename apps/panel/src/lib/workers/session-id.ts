const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Erişim token'ındaki `session_id` claim'i. İmza burada doğrulanmaz: token az önce Supabase
 * Auth'tan bu süreçte alındı; değer ayrıca veritabanında `auth.sessions` ile karşılaştırılır.
 */
export function sessionIdFromAccessToken(accessToken: string): string | null {
  const payload = accessToken.split('.')[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    const sessionId =
      claims && typeof claims === 'object'
        ? (claims as Record<string, unknown>).session_id
        : null;
    return typeof sessionId === 'string' && UUID.test(sessionId)
      ? sessionId
      : null;
  } catch {
    return null;
  }
}
