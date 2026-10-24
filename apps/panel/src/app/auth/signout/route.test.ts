// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Çıkış (CSRF): normal çıkış yalnız POST. GET yalnız üye olmayanın oturumunu kapatır
// (requireTeamMember yönlendirmesi); başka siteden gelen GET ekip üyesinin oturumunu kapatamaz.
const state = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  member: true,
  memberError: false,
  signOut: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
      signOut: state.signOut,
    },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: state.member ? { role: 'editor' } : null,
          error: state.memberError ? { message: 'down' } : null,
        }),
      };
      return chain;
    },
  }),
}));

const { GET, POST } = await import('./route');
const req = (path: string, method = 'GET') =>
  new NextRequest(`http://localhost:3000${path}`, { method });

beforeEach(() => {
  state.user = { id: 'u1' };
  state.member = true;
  state.memberError = false;
  state.signOut.mockReset();
  state.signOut.mockResolvedValue({ error: null });
});

describe('/auth/signout', () => {
  it('POST oturumu kapatır ve /login’e 303 ile gider', async () => {
    const r = await POST(req('/auth/signout', 'POST'));
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('http://localhost:3000/login');
    expect(state.signOut).toHaveBeenCalledTimes(1);
  });

  it('POST yalnız bilinen hata kodunu taşır', async () => {
    const r = await POST(
      req('/auth/signout?error=https://evil.example', 'POST'),
    );
    expect(r.headers.get('location')).toBe('http://localhost:3000/login');
  });

  it('parametresiz GET çıkış yapmaz (bağlantı/görselle CSRF)', async () => {
    const r = await GET(req('/auth/signout'));
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('http://localhost:3000/');
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it('GET ?error=not_allowed ekip üyesinin oturumunu kapatmaz', async () => {
    const r = await GET(req('/auth/signout?error=not_allowed'));
    expect(r.headers.get('location')).toBe('http://localhost:3000/');
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it('GET ?error=not_allowed üye olmayanın oturumunu kapatır', async () => {
    state.member = false;
    const r = await GET(req('/auth/signout?error=not_allowed'));
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(
      'http://localhost:3000/login?error=not_allowed',
    );
    expect(state.signOut).toHaveBeenCalledTimes(1);
  });

  it('üyelik okunamazsa (requireTeamMember ile aynı) oturum kapatılır', async () => {
    state.memberError = true;
    await GET(req('/auth/signout?error=not_allowed'));
    expect(state.signOut).toHaveBeenCalledTimes(1);
  });
});
