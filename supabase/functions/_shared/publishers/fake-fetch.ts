// Testler için yöntem farkındalıklı sahte fetch: `METHOD /yol` anahtarıyla betiklenmiş yanıt döner,
// çağrıları (yöntem, başlık, gövde) kaydeder. Gerçek ağ çağrısı yapılmaz. Üretim kodu import etmez.

export interface PublishCall {
  method: string;
  url: URL;
  headers: Headers;
  body: string | Uint8Array | null;
}

export type PublishResponder = (
  call: PublishCall,
  n: number,
) => Response | Error | Promise<Response | Error>;

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/**
 * Rota anahtarı `METHOD pathname` (ör. `PUT /upload/youtube/v3/videos`). Liste verilirse sırayla,
 * son yanıt tekrar kullanılır. Rotası olmayan çağrı hata fırlatır.
 */
export function createPublishFetch(
  routes: Record<string, PublishResponder | PublishResponder[]>,
) {
  const calls: PublishCall[] = [];
  const counters = new Map<string, number>();
  const fetchFn = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const method = (init?.method ?? 'GET').toUpperCase();
    const raw = init?.body;
    const body =
      raw === undefined || raw === null
        ? null
        : raw instanceof Uint8Array
          ? raw
          : String(raw);
    const call: PublishCall = {
      method,
      url,
      headers: new Headers(init?.headers),
      body,
    };
    calls.push(call);
    const key = `${method} ${url.pathname}`;
    const route = routes[key];
    if (!route) throw new Error(`sahte fetch: rota yok (${key})`);
    const n = counters.get(key) ?? 0;
    counters.set(key, n + 1);
    const responder = Array.isArray(route)
      ? route[Math.min(n, route.length - 1)]
      : route;
    const result = await responder(call, n);
    if (result instanceof Error) throw result;
    return result;
  }) as typeof fetch;
  return { fetch: fetchFn, calls };
}
