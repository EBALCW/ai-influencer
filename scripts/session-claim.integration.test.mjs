// #201'in bıraktığı soru: gerçek bir Supabase Auth erişim token'ında `session_id` claim'i var mı?
// Makine oturumunu insan oturumundan ayıran her kural (onay, iş açma, yetki kaldırma) bu claim'e
// dayanır (docs/AUTH.md → "Üretim makinesi oturumu"). Bu test yerel Supabase'te gerçek kullanıcıyla
// giriş yapar ve token'ı inceler; veritabanının aynı claim'i okuduğunu RPC ile doğrular.
// Yerel veriye kullanıcı yazdığı için yalnız WORKER_INTEGRATION=1 ile çalışır (CI'da ayarlı).
// Kendi kullanıcısını ve çalışma alanını açar, sonunda siler.
// Gereksinim: çalışan yerel Supabase ve LOCAL_SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const enabled = process.env.WORKER_INTEGRATION === '1';
const url = process.env.LOCAL_SUPABASE_URL ?? '';
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ?? '';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const run = randomUUID().slice(0, 8);
const email = `session-claim-${run}@example.test`;
const password = `sc-${randomUUID()}`;
let userId = '';
let workspaceId = '';

async function call(
  path,
  { key = anonKey, token, body, method = 'POST' } = {},
) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // gövde JSON değil
  }
  return { status: response.status, json };
}

function claims(accessToken) {
  return JSON.parse(
    Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
  );
}

async function passwordSignIn() {
  const { status, json } = await call('/auth/v1/token?grant_type=password', {
    body: { email, password },
  });
  assert.equal(status, 200, 'parolayla giriş başarısız');
  return json;
}

before(async () => {
  if (!enabled) return;
  // Uzak bir projeye asla test kullanıcısı yazılmaz.
  assert.match(
    url,
    /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/,
    'LOCAL_SUPABASE_URL yerel bir adres olmalı',
  );
  const created = await call('/auth/v1/admin/users', {
    key: serviceKey,
    body: { email, password, email_confirm: true },
  });
  assert.equal(created.status, 200, 'test kullanıcısı oluşturulamadı');
  userId = created.json.id;
  // Kendi çalışma alanı: testin sonucu yereldeki başka veriye bağlı olmasın.
  const workspace = await call('/rest/v1/rpc/create_workspace_for_user', {
    key: serviceKey,
    body: { p_user_id: userId, p_name: `Oturum testi ${run}` },
  });
  assert.equal(
    workspace.status,
    200,
    `test çalışma alanı açılamadı: ${workspace.json?.code} ${workspace.json?.message}`,
  );
  workspaceId = workspace.json;
});

after(async () => {
  if (!enabled || !userId) return;
  // Alan silinince üyelik, iş ve makine kayıtları da silinir (ON DELETE CASCADE).
  if (workspaceId)
    await call(`/rest/v1/workspaces?id=eq.${workspaceId}`, {
      key: serviceKey,
      method: 'DELETE',
    });
  await call(`/auth/v1/admin/users/${userId}`, {
    key: serviceKey,
    method: 'DELETE',
  });
});

test(
  'parolayla açılan oturumun erişim token’ında session_id var; yenilemede değişmez',
  { skip: !enabled },
  async () => {
    const first = await passwordSignIn();
    const firstClaims = claims(first.access_token);
    assert.match(firstClaims.session_id, UUID);
    assert.equal(firstClaims.sub, userId);
    assert.equal(firstClaims.role, 'authenticated');

    const refreshed = await call('/auth/v1/token?grant_type=refresh_token', {
      body: { refresh_token: first.refresh_token },
    });
    assert.equal(refreshed.status, 200);
    assert.equal(
      claims(refreshed.json.access_token).session_id,
      firstClaims.session_id,
      'yenileme aynı oturumu sürdürür',
    );

    const second = await passwordSignIn();
    assert.match(claims(second.access_token).session_id, UUID);
    assert.notEqual(
      claims(second.access_token).session_id,
      firstClaims.session_id,
      'her giriş ayrı bir oturumdur',
    );
  },
);

test(
  'sunucuda açılan oturum (generate_link + verify; eşleme bunu kullanır) da session_id taşır',
  { skip: !enabled },
  async () => {
    const link = await call('/auth/v1/admin/generate_link', {
      key: serviceKey,
      body: { type: 'magiclink', email },
    });
    assert.equal(link.status, 200);
    assert.equal(typeof link.json.hashed_token, 'string');
    const verified = await call('/auth/v1/verify', {
      body: { type: 'magiclink', token_hash: link.json.hashed_token },
    });
    assert.equal(verified.status, 200);
    assert.match(claims(verified.json.access_token).session_id, UUID);
    assert.equal(claims(verified.json.access_token).sub, userId);

    // Tek kullanımlık: aynı özet ikinci kez oturum açmaz.
    const again = await call('/auth/v1/verify', {
      body: { type: 'magiclink', token_hash: link.json.hashed_token },
    });
    assert.notEqual(again.status, 200);
  },
);

test(
  'veritabanı claim’i okur: makine olarak kaydolan oturum işaretlenir, diğeri etkilenmez',
  { skip: !enabled },
  async () => {
    const human = await passwordSignIn();
    const machine = await passwordSignIn();
    const rpc = (name, token, body = {}) =>
      call(`/rest/v1/rpc/${name}`, { token, body });

    assert.equal(
      (await rpc('is_worker_session', machine.access_token)).json,
      false,
    );
    const registered = await rpc('register_worker', machine.access_token, {
      p_name: `claim-${run}`,
      p_platform: 'linux',
    });
    assert.equal(registered.status, 200, 'register_worker claim’i görmeli');
    assert.equal(
      (await rpc('is_worker_session', machine.access_token)).json,
      true,
    );
    assert.equal(
      (await rpc('is_worker_session', human.access_token)).json,
      false,
    );

    // Yenilenen token da aynı oturumdur: işaret kalıcıdır.
    const refreshed = await call('/auth/v1/token?grant_type=refresh_token', {
      body: { refresh_token: machine.refresh_token },
    });
    assert.equal(
      (await rpc('is_worker_session', refreshed.json.access_token)).json,
      true,
    );

    // Makine oturumu iş açamaz; aynı kullanıcının insan oturumu açabilir.
    const stages = {
      p_module: 'explainer',
      p_kind: 'explainer.selftest',
      p_stages: [{ key: 'a' }],
    };
    const refused = await rpc(
      'enqueue_job',
      refreshed.json.access_token,
      stages,
    );
    assert.equal(refused.status, 403);
    assert.equal(refused.json.code, '42501');
    const allowed = await rpc('enqueue_job', human.access_token, stages);
    assert.equal(allowed.status, 200);
    const cancelled = await rpc('request_cancel_job', human.access_token, {
      p_job_id: allowed.json.id,
    });
    assert.equal(cancelled.status, 200);
  },
);
