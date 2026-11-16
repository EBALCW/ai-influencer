// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOL_LOGIN_LIMIT } from '@/lib/tool-login/rate-limit';

vi.mock('server-only', () => ({}));

// Sahte kod çalışma anında kurulur (depoda anahtar biçimli sabit durmasın).
const CODE = 'ab12'.repeat(14);
const state = vi.hoisted(() => ({
  user: null as { id: string; email?: string } | null,
  role: 'editor' as string | null,
  automation: false as boolean | null,
  automationError: false,
  links: [] as Array<Record<string, unknown>>,
  linkUserId: null as string | null,
  linkError: false,
  linkType: 'magiclink',
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : new Error('no session'),
      }),
    },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: state.role
            ? { role: state.role, workspace_id: 'alan-1' }
            : null,
          error: null,
        }),
      };
      return chain;
    },
    rpc: async (name: string) => {
      if (name !== 'is_worker_session') throw new Error(`beklenmeyen: ${name}`);
      return state.automationError
        ? { data: null, error: { code: 'XX000', message: 'hata' } }
        : { data: state.automation, error: null };
    },
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    auth: {
      admin: {
        generateLink: async (params: Record<string, unknown>) => {
          state.links.push(params);
          if (state.linkError)
            return {
              data: { properties: null, user: null },
              error: new Error(`auth hatası ${CODE}`),
            };
          return {
            data: {
              properties: {
                hashed_token: CODE,
                email_otp: '123456',
                action_link: `http://127.0.0.1/auth/v1/verify?token=${CODE}`,
                verification_type: state.linkType,
              },
              user: { id: state.linkUserId ?? state.user?.id },
            },
            error: null,
          };
        },
      },
    },
  }),
}));

const { POST } = await import('./route');

const ORIGIN = 'http://localhost';
function request(
  headers: Record<string, string> = { origin: ORIGIN },
  body?: unknown,
) {
  return new NextRequest(`${ORIGIN}/api/tool-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  });
}

let seq = 0;
let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  seq += 1;
  Object.assign(state, {
    // Her test ayrı kullanıcı: hız sınırı sayacı testler arasında taşınmaz
    user: { id: `uye-${seq}`, email: `uye-${seq}@ornek.test` },
    role: 'editor',
    automation: false,
    automationError: false,
    links: [],
    linkUserId: null,
    linkError: false,
    linkType: 'magiclink',
  });
  logged = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  // Kod hiçbir koşulda loga yazılmaz
  expect(JSON.stringify(logged.mock.calls.map(String))).not.toContain(CODE);
  logged.mockRestore();
});

describe('POST /api/tool-login', () => {
  it('editor kendi hesabı için kod alır; yanıtta yalnız kod vardır', async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ code: CODE });
    expect(state.links).toEqual([
      { type: 'magiclink', email: state.user!.email },
    ]);
  });

  it('owner da üretebilir', async () => {
    state.role = 'owner';
    expect((await POST(request())).status).toBe(201);
  });

  it('istekteki e-posta ya da kullanıcı kimliği yok sayılır', async () => {
    const response = await POST(
      request(
        { origin: ORIGIN },
        {
          email: 'baskasi@ornek.test',
          user_id: 'baskasi',
          userId: 'baskasi',
          type: 'recovery',
        },
      ),
    );
    expect(response.status).toBe(201);
    expect(state.links).toEqual([
      { type: 'magiclink', email: state.user!.email },
    ]);
  });

  it('oturumsuz 401, viewer ve üye olmayan 403', async () => {
    state.role = 'viewer';
    expect((await POST(request())).status).toBe(403);
    state.role = null;
    expect((await POST(request())).status).toBe(403);
    state.user = null;
    expect((await POST(request())).status).toBe(401);
    expect(state.links).toEqual([]);
  });

  it('başka siteden ya da Origin başlıksız istek reddedilir', async () => {
    const forged: Record<string, string>[] = [
      { origin: 'https://example.invalid' },
      {},
    ];
    for (const headers of forged) {
      const response = await POST(request(headers));
      expect(response.status).toBe(403);
    }
    expect(state.links).toEqual([]);
  });

  it('otomasyon oturumu (makine, MCP) kod üretemez; belirsiz yanıt da reddedilir', async () => {
    state.automation = true;
    expect((await POST(request())).status).toBe(403);
    state.automation = null;
    expect((await POST(request())).status).toBe(403);
    state.automation = false;
    state.automationError = true;
    expect((await POST(request())).status).toBe(403);
    expect(state.links).toEqual([]);
  });

  it('Auth başka bir kullanıcı ya da başka tür döndürürse kod verilmez', async () => {
    state.linkUserId = 'baska-kullanici';
    let response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(CODE);
    state.linkUserId = null;
    state.linkType = 'signup';
    response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(CODE);
  });

  it('Auth hatası kodu ne yanıta ne loga sızdırır', async () => {
    state.linkError = true;
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'İşlem tamamlanamadı.' });
    expect(logged).toHaveBeenCalled();
  });

  it('e-postası olmayan hesap için kod üretilmez', async () => {
    state.user = { id: `eposta-yok-${seq}` };
    expect((await POST(request())).status).toBe(409);
    expect(state.links).toEqual([]);
  });

  it('kullanıcı başına hız sınırı: sınır dolunca 429, başka kullanıcı etkilenmez', async () => {
    for (let i = 0; i < TOOL_LOGIN_LIMIT; i += 1)
      expect((await POST(request())).status).toBe(201);
    const blocked = await POST(request());
    expect(blocked.status).toBe(429);
    expect(state.links).toHaveLength(TOOL_LOGIN_LIMIT);
    state.user = { id: `baska-${seq}`, email: `baska-${seq}@ornek.test` };
    expect((await POST(request())).status).toBe(201);
  });
});
