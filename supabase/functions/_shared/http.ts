// Edge Function'lar için ortak HTTP yardımcıları (docs/DEVELOPMENT.md §9).

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// İç hata mesajı istemciye sızdırılmaz; ayrıntı sadece loga yazılır.
export function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return json({ error: { code, message } }, status);
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * Zamanlanmış (pg_cron + pg_net) ya da sunucudan sunucuya çağrıları doğrular.
 * Çağıran `x-cron-secret` başlığında CRON_SECRET'ı gönderir. Sır tanımlı değilse
 * istek her zaman reddedilir (yanlış yapılandırma açık kapı bırakmaz).
 * Dönüş: null → yetkili; Response → hemen döndür.
 */
export function requireCronSecret(
  req: Request,
  secret: string | null = Deno.env.get('CRON_SECRET') ?? null,
): Response | null {
  if (!secret) {
    console.error('CRON_SECRET tanımlı değil; istek reddedildi');
    return errorResponse(503, 'not_configured', 'Fonksiyon yapılandırılmamış');
  }
  const got = req.headers.get('x-cron-secret') ?? '';
  if (!timingSafeEqual(got, secret)) {
    return errorResponse(401, 'unauthorized', 'Yetkisiz');
  }
  return null;
}
