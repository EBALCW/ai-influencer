// Testler için sahte fetch: istek URL'ine göre betiklenmiş yanıt döner, çağrıları kaydeder.
// Gerçek ağ çağrısı yapılmaz. Üretim kodu bunu import etmez.

export interface RecordedCall {
  url: URL;
  /** `/youtube/v3/videos` → 'videos', Analytics → 'reports'. */
  resource: string;
  authorization: string | null;
}

export type Responder = (
  url: URL,
  call: number,
) => Response | Promise<Response> | Error;

export function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** resource → yanıtlayıcı (ya da sıralı yanıt listesi; son yanıt tekrar kullanılır). */
export function createFakeFetch(
  routes: Record<string, Responder | Responder[]>,
) {
  const calls: RecordedCall[] = [];
  const counters = new Map<string, number>();
  const fetchFn = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const resource = url.pathname.split('/').filter(Boolean).pop() ?? '';
    const headers = new Headers(init?.headers);
    calls.push({ url, resource, authorization: headers.get('authorization') });
    const route = routes[resource];
    if (!route) throw new Error(`sahte fetch: rota yok (${resource})`);
    const n = counters.get(resource) ?? 0;
    counters.set(resource, n + 1);
    const responder = Array.isArray(route)
      ? route[Math.min(n, route.length - 1)]
      : route;
    const result = await responder(url, n);
    if (result instanceof Error) throw result;
    return result;
  }) as typeof fetch;
  return { fetch: fetchFn, calls };
}
