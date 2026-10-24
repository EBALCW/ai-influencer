import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { unlink } from 'node:fs/promises';
import { createSession, hasLocalSupabase, VIEWER_STATE } from './global-setup';
test.skip(!hasLocalSupabase(), 'Yalnız yerel Supabase ile çalışır.');
const adminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
const proposal = {
  persona: {
    bio: 'Kurgusal AI karakterinin önerilen hikâyesi.',
    personality: ['meraklı', 'sakin', 'neşeli'],
    tone: {
      do: ['Kısa konuş', 'Açık ol', 'Soru sor'],
      dont: ['Abartma', 'Taklit etme', 'Vaat verme'],
    },
    sampleCaptions: ['Birinci örnek', 'İkinci örnek', 'Üçüncü örnek'],
    hookTraits: ['İmza aksesuar', 'Görsel dönüş'],
  },
  caption: {
    caption: 'AI caption denemesi',
    hashtags: ['#ai', '#kurgu', '#teknoloji'],
    cta: 'Sen ne düşünüyorsun?',
  },
  script: {
    hook: 'Senaryo açılışı',
    scenes: [
      { seconds: 10, visual: 'Sahne önerisi', narration: 'Konuşulacak metin' },
    ],
    caption: 'Senaryo caption',
  },
  weekly: {
    summary: 'Haftalık değerlendirme',
    observations: ['Yalnız ölçülen veriyi kullanın.'],
    suggestions: ['İki kancayı karşılaştırın.'],
    limitations: ['Eksik baseline nedeniyle büyüme hesaplanamaz.'],
  },
};
test('wizard ve içerik kartında AI önerisi yalnız onayla forma, kaydet ile DB’ye geçer', async ({
  page,
  browser,
}) => {
  const admin = adminClient();
  let id = '';
  const slug = `ai-${crypto.randomUUID()}`;
  try {
    const created = await page.request.post('/api/influencers', {
      data: { name: 'AI fixture', slug, niche: 'Teknoloji', language: 'tr' },
    });
    expect(created.status()).toBe(201);
    id = (await created.json()).influencer.id;
    await page.route('**/api/ai/settings', (r) =>
      r.fulfill({
        json: { enabled: true, hasKey: true, canEdit: false, settings: null },
      }),
    );
    await page.route('**/api/ai/suggest', async (r) => {
      const d = r.request().postDataJSON();
      expect(d.influencerId).toBe(id);
      const task = d.request.task as keyof typeof proposal;
      await r.fulfill({
        json: { task, suggestion: proposal[task], warnings: [] },
      });
    });
    await page.goto(`/influencers/new?draft=${id}&step=2&inf=${slug}`);
    await page
      .getByRole('button', { name: 'AI ile öner', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'AI önerisi', exact: true }),
    ).toContainText(proposal.persona.bio);
    await expect(page.getByLabel('Karakter hikâyesi')).toHaveValue('');
    expect(
      (
        await admin
          .from('influencer_personas')
          .select('id')
          .eq('influencer_id', id)
      ).data,
    ).toHaveLength(0);
    await page.getByRole('button', { name: 'Öneriyi forma uygula' }).click();
    await expect(page.getByLabel('Karakter hikâyesi')).toHaveValue(
      proposal.persona.bio,
    );
    expect(
      (
        await admin
          .from('influencer_personas')
          .select('id')
          .eq('influencer_id', id)
      ).data,
    ).toHaveLength(0);
    const content = await admin
      .from('content_items')
      .insert({ influencer_id: id, title: 'AI içerik fixture' })
      .select('id')
      .single();
    if (content.error) throw content.error;
    await page.goto(`/content?inf=${slug}`);
    await page
      .getByRole('button', { name: 'AI içerik fixture', exact: true })
      .click();
    const editor = page.getByRole('region', {
      name: 'İçerik düzenleme',
      exact: true,
    });
    for (const task of ['caption', 'script', 'weekly'] as const) {
      await editor.getByLabel('Öneri türü', { exact: true }).selectOption(task);
      await editor
        .getByRole('button', { name: 'AI ile öner', exact: true })
        .click();
      await expect(
        editor.getByRole('region', { name: 'AI önerisi', exact: true }),
      ).toBeVisible();
      expect(
        (
          await admin
            .from('content_items')
            .select('notes')
            .eq('id', content.data.id)
            .single()
        ).data?.notes,
      ).toBe('');
      await editor
        .getByRole('button', { name: 'Öneriyi forma uygula' })
        .click();
    }
    await expect(editor.getByLabel('Notlar', { exact: true })).toHaveValue(
      /AI caption denemesi[\s\S]*Senaryo açılışı[\s\S]*Haftalık değerlendirme/,
    );
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/content-items/${content.data.id}`) &&
        r.request().method() === 'PATCH',
    );
    await editor.getByRole('button', { name: 'İçeriği kaydet' }).click();
    expect((await saved).status()).toBe(200);
    expect(
      (
        await admin
          .from('content_items')
          .select('notes')
          .eq('id', content.data.id)
          .single()
      ).data?.notes,
    ).toContain('Haftalık değerlendirme');
    const viewer = await browser.newContext({ storageState: VIEWER_STATE });
    try {
      const vp = await viewer.newPage();
      await vp.goto(`/content?inf=${slug}`);
      await vp
        .getByRole('button', { name: 'AI içerik fixture', exact: true })
        .click();
      await expect(
        vp.getByRole('button', { name: 'AI ile öner', exact: true }),
      ).toHaveCount(0);
      expect(
        (
          await vp.request.post('/api/ai/suggest', {
            data: { influencerId: id, request: { task: 'weekly', input: {} } },
          })
        ).status(),
      ).toBe(403);
      expect(
        (await vp.request.put('/api/ai/settings', { data: {} })).status(),
      ).toBe(403);
    } finally {
      await viewer.close();
    }
    const guest = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      expect(
        (await guest.request.post('/api/ai/suggest', { data: {} })).status(),
      ).toBe(401);
    } finally {
      await guest.close();
    }
  } finally {
    if (id) {
      const r = await admin.from('influencers').delete().eq('id', id);
      if (r.error) throw r.error;
    }
  }
});

test('anahtar yoksa uyarı görünür; owner ayar kaydeder, editor değiştiremez', async ({
  page,
  browser,
}) => {
  const admin = adminClient();
  const statePath = `e2e/.auth/ai-owner-${crypto.randomUUID()}.json`;
  let ownerId = '';
  const prior = await admin
    .from('app_settings')
    .select('value')
    .eq('key', 'ai')
    .maybeSingle();
  if (prior.error) throw prior.error;
  try {
    ownerId = await createSession(
      `ai-owner-${crypto.randomUUID()}@example.invalid`,
      'owner',
      statePath,
    );
    const owner = await browser.newContext({ storageState: statePath });
    try {
      const op = await owner.newPage();
      await op.goto('/settings/ai');
      await op.getByLabel('Model ID', { exact: true }).fill('claude-fixture');
      for (const name of [
        'Giriş',
        'Çıkış',
        'Önbellek okuma',
        'Önbellek yazma (5 dk)',
        'Önbellek yazma (1 saat)',
      ])
        await op
          .getByLabel(`${name} (USD / milyon token)`, { exact: true })
          .fill('1');
      await op.getByRole('button', { name: 'AI ayarlarını kaydet' }).click();
      await expect(op.getByRole('status')).toContainText(
        'AI ayarları kaydedildi.',
      );
      expect(
        (
          await admin
            .from('app_settings')
            .select('value')
            .eq('key', 'ai')
            .single()
        ).data?.value,
      ).toMatchObject({ model: 'claude-fixture' });
    } finally {
      await owner.close();
    }
    await page.goto('/settings/ai');
    await expect(page.getByLabel('Model ID', { exact: true })).toBeDisabled();
    expect(
      (await page.request.put('/api/ai/settings', { data: {} })).status(),
    ).toBe(403);
    await page.route('**/api/ai/settings', (r) =>
      r.fulfill({
        json: { enabled: false, hasKey: false, canEdit: false, settings: null },
      }),
    );
    const inf = await admin
      .from('influencers')
      .insert({
        name: 'Disabled AI fixture',
        slug: `ai-disabled-${crypto.randomUUID()}`,
        status: 'draft',
      })
      .select('id,slug')
      .single();
    if (inf.error) throw inf.error;
    try {
      await page.goto(
        `/influencers/new?draft=${inf.data.id}&step=2&inf=${inf.data.slug}`,
      );
      await expect(
        page.getByRole('button', { name: 'AI ile öner', exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole('link', { name: 'AI ayarlarını kontrol edin.' }),
      ).toHaveAttribute('href', `/settings/ai?inf=${inf.data.slug}`);
    } finally {
      const r = await admin.from('influencers').delete().eq('id', inf.data.id);
      if (r.error) throw r.error;
    }
  } finally {
    const restored = prior.data
      ? await admin
          .from('app_settings')
          .upsert({ key: 'ai', value: prior.data.value })
      : await admin.from('app_settings').delete().eq('key', 'ai');
    if (restored.error) throw restored.error;
    if (ownerId) {
      const deleted = await admin.auth.admin.deleteUser(ownerId);
      if (deleted.error) throw deleted.error;
    }
    await unlink(statePath).catch((e) => {
      if (e.code !== 'ENOENT') throw e;
    });
  }
});
