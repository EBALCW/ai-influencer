// Oturum güvenlik denetimi (runtime.ts): işaretlenemeyen ya da onayı reddedilmeyen oturumla
// hiçbir araç çalışmaz ve token saklanmaz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMemoryStore } from './auth/credential-store.ts';
import { SessionManager, type FetchLike } from './auth/session.ts';
import type { DbErrorLike, ToolError } from './lib/errors.ts';
import { VIEWER_NOT_SUPPORTED, createPanelSession } from './runtime.ts';

const config = {
  supabaseUrl: 'https://proje.supabase.co',
  anonKey: 'anon',
};
const part = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const token = {
  access_token: `${part({})}.${part({
    sub: '11111111-1111-4111-8111-111111111111',
    session_id: '22222222-2222-4222-8222-222222222222',
    role: 'authenticated',
  })}.imza`,
  refresh_token: 'rtok1',
  expires_in: 3600,
};

async function harness(
  responses: Record<string, DbErrorLike | null>,
  data: Record<string, unknown> = {},
) {
  const store = createMemoryStore();
  const authCalls: string[] = [];
  const fetch: FetchLike = async (url) => {
    authCalls.push(url);
    return { status: 204, text: async () => '' };
  };
  const manager = new SessionManager({ config, store, fetch });
  await manager.adopt(token);
  const rpcCalls: string[] = [];
  const client = {
    rpc: async (name: string) => {
      rpcCalls.push(name);
      const error = name in responses ? responses[name] : { code: 'PGRST202' };
      return { data: error ? null : (data[name] ?? {}), error };
    },
    from: () => {
      throw new Error('tabloya ulaşılmamalı');
    },
  } as unknown as SupabaseClient;
  return {
    session: createPanelSession({ config, store, manager, client }),
    store,
    rpcCalls,
    authCalls,
  };
}

const REFUSED = { code: '42501', hint: 'worker_session' };

test('viewer hesabı (işaretlenemeyen oturum) reddedilir; token kasadan silinir, oturum kapatılır', async () => {
  const h = await harness({ register_mcp_session: { code: '42501' } });
  assert.equal(h.store.entries.size, 1);
  for (const kind of ['read', 'write'] as const) {
    await assert.rejects(h.session.gateway(kind), (error: ToolError) => {
      assert.equal(error.code, kind === 'read' ? 'yetki_yok' : 'giris_gerekli');
      return true;
    });
  }
  // İlk çağrı nedeni söyler ve oturumu siler; sonrakiler "giriş yok" görür.
  assert.equal(h.store.entries.size, 0, 'işaretsiz oturum saklanmaz');
  assert.equal(
    h.authCalls.some((url) => url.includes('/logout?scope=local')),
    true,
  );
  assert.equal(
    h.rpcCalls.some((name) => name.startsWith('approve_')),
    false,
    'işaretlenemeyen oturumla yoklama bile yapılmaz',
  );
});

test('viewer reddi anlaşılır bir Türkçe ileti verir', async () => {
  const h = await harness({ register_mcp_session: { code: '42501' } });
  await assert.rejects(h.session.gateway('read'), (error: ToolError) => {
    assert.equal(error.message, VIEWER_NOT_SUPPORTED);
    assert.match(error.message, /editor ya da owner/);
    return true;
  });
  const who = await h.session.describe();
  assert.equal(who.giris, 'yok');
});

test('onay reddedilmiyorsa (yoklama geçilirse) araçlar süreç boyunca kapalı kalır', async () => {
  const h = await harness({
    register_mcp_session: null,
    approve_episode_script: { code: 'P0002' },
    approve_job_stage: REFUSED,
  });
  await assert.rejects(h.session.gateway('read'), (error: ToolError) => {
    assert.equal(error.code, 'oturum_gecersiz');
    assert.match(error.message, /Güvenlik denetimi başarısız/);
    return true;
  });
  const calls = h.rpcCalls.length;
  await assert.rejects(h.session.gateway('write'));
  assert.equal(h.rpcCalls.length, calls, 'yeniden denenmez');
});

test('yetkisi panelden kaldırılmış oturum kullanılmaz ve silinir', async () => {
  const h = await harness({
    register_mcp_session: { code: '42501', hint: 'session_revoked' },
  });
  await assert.rejects(
    h.session.gateway('read'),
    (error: ToolError) => error.code === 'oturum_gecersiz',
  );
  assert.equal(h.store.entries.size, 0);
});

test('işaretli ve onayı reddedilen oturum: okuma açık; yazma veritabanı izin veriyorsa açık', async () => {
  const guard = {
    register_mcp_session: null,
    approve_episode_script: REFUSED,
    approve_job_stage: REFUSED,
    can_draft: null,
  };
  const writable = await harness(guard, { can_draft: true });
  await writable.session.gateway('read');
  await writable.session.gateway('write');
  assert.deepEqual(writable.rpcCalls, [
    'register_mcp_session',
    'approve_episode_script',
    'approve_job_stage',
    'can_draft',
  ]);
  assert.equal(writable.store.entries.size, 1);

  // Veritabanı taslak yetkisi vermiyorsa (ör. üye sonradan viewer yapıldı) oturum salt okurdur.
  const readOnly = await harness(guard, { can_draft: false });
  await readOnly.session.gateway('read');
  await assert.rejects(
    readOnly.session.gateway('write'),
    (error: ToolError) =>
      error.code === 'yetki_yok' && /salt okur/.test(error.message),
  );
  assert.equal(
    readOnly.store.entries.size,
    1,
    'salt okur oturum geçerlidir, silinmez',
  );
});
