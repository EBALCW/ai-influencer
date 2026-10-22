// Testler için sahte fetch: TikTok uç noktasına göre betiklenmiş yanıt döner, çağrıları
// (yöntem, gövde, yetki başlığı) kaydeder. Gerçek ağ çağrısı yapılmaz. Üretim kodu bunu
// import etmez.

export interface RecordedCall {
  url: URL;
  /** `/v2/video/list/` → 'video/list'. */
  endpoint: string;
  method: string;
  body: Record<string, unknown> | null;
  authorization: string | null;
}

export type Responder = (
  call: RecordedCall,
  n: number,
) => Response | Promise<Response> | Error;

export function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** endpoint → yanıtlayıcı (ya da sıralı yanıt listesi; son yanıt tekrar kullanılır). */
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
    const endpoint = url.pathname.replace(/^\/v2\//, '').replace(/\/+$/, '');
    const headers = new Headers(init?.headers);
    const call: RecordedCall = {
      url,
      endpoint,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      authorization: headers.get('authorization'),
    };
    calls.push(call);
    const route = routes[endpoint];
    if (!route) throw new Error(`sahte fetch: rota yok (${endpoint})`);
    const n = counters.get(endpoint) ?? 0;
    counters.set(endpoint, n + 1);
    const responder = Array.isArray(route)
      ? route[Math.min(n, route.length - 1)]
      : route;
    const result = await responder(call, n);
    if (result instanceof Error) throw result;
    return result;
  }) as typeof fetch;
  return { fetch: fetchFn, calls };
}
