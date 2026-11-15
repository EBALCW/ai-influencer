import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { hasLocalSupabase, VIEWER_STATE } from './global-setup';

// Anlatım modülü ekranları (#216 modeli; #217 ve #218'in AI'sız arayüzü): seri → konu önerileri →
// seçim → senaryo ve kaynak notları → onay → değişiklikte onayın düşmesi → üretime gönderme.
// Veri arayüzden ve panel API'sinden oluşturulur; silme RPC'si olmadığı için kayıtlar yerel
// veritabanında kalır (adlar çalıştırma başına tekildir).
test.skip(!hasLocalSupabase(), 'Yerel Supabase yok (pnpm supabase:start)');

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const heading = (page: Page) => page.locator('.page-heading');
const idFromUrl = (page: Page) => page.url().split('/').pop()!.split('?')[0]!;

test('seri → elle öneriler → seçim → senaryo ve kaynak notları → onay → değişiklik → yeniden onay → üretime gönder', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const run = crypto.randomUUID().slice(0, 8);
  const seriesName = `E2E Seri ${run}`;
  const topic = `Planör ${run} motorsuz nasıl uçar`;

  // 1) Seri: makul varsayılanlarla oluşturulur.
  const response = await page.goto('/explainers');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Anlatım videoları', level: 1 }),
  ).toBeVisible();
  await page.getByRole('link', { name: /Yeni seri/ }).click();
  const seriesForm = page.getByRole('form', { name: 'Yeni seri' });
  await expect(seriesForm.getByLabel(/^Görsel yol/)).toHaveValue('hyperframes');
  await expect(seriesForm.getByLabel(/^Ses/)).toHaveValue('tr-TR-AhmetNeural');
  await expect(seriesForm.getByLabel(/^Konuşma hızı/)).toHaveValue('+8%');
  await expect(seriesForm.getByLabel(/^Dil/)).toHaveValue('tr');
  await seriesForm.getByLabel(/^Seri adı/).fill(seriesName);
  await seriesForm.getByLabel(/^Tema/).fill('Uçan şeylerin mekaniği');
  await seriesForm.getByLabel(/^Konuşma hızı/).fill('hızlı');
  await seriesForm.getByRole('button', { name: 'Seriyi oluştur' }).click();
  await expect(seriesForm.getByRole('alert')).toContainText('+8%');
  await seriesForm.getByLabel(/^Konuşma hızı/).fill('+8%');
  await seriesForm.getByRole('button', { name: 'Seriyi oluştur' }).click();
  await expect(page).toHaveURL(/\/explainers\/series\/[0-9a-f-]{36}$/);
  const seriesUrl = page.url();
  await expect(
    page.getByRole('heading', { name: seriesName, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Bu seride henüz bölüm yok.')).toBeVisible();
  const defaults = page.getByRole('region', { name: 'Üretim varsayılanları' });
  await expect(defaults).toContainText('Stil paketi (HyperFrames)');
  await expect(defaults).toContainText('tr-TR-AhmetNeural');

  // 2) Konu isteği: seri önceden seçili; AI girişi yerinde ama kapalı.
  await page.getByRole('link', { name: 'Konu önerisi iste' }).click();
  const requestForm = page.getByRole('form', { name: 'Konu isteği' });
  await expect(
    requestForm.getByLabel(/^Seri/).locator('option:checked'),
  ).toHaveText(seriesName);
  await requestForm
    .getByLabel(/Ne hakkında video istiyorsunuz/)
    .fill(`Havacılıkta az bilinen çözümler ${run}`);
  await requestForm
    .getByRole('button', { name: 'İsteği aç ve önerilere geç' })
    .click();
  await expect(page).toHaveURL(/\/explainers\/topics\/[0-9a-f-]{36}$/);
  const topicUrl = page.url();
  await expect(page.getByText('Henüz öneri yok.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Yapay zekâdan öneri iste' }),
  ).toBeDisabled();

  // 3) Tek öneri: zararlı adres reddedilir, http(s) adres güvenli bağlantı olur.
  const addForm = page.getByRole('form', { name: 'Öneri ekle' });
  await addForm.getByLabel('Öneri başlığı').fill(topic);
  await addForm.getByLabel('Özet').fill('Kanat, hava akımı ve termikler.');
  await addForm.getByLabel('Kanca').fill('Motoru yok ama saatlerce uçuyor.');
  await addForm
    .getByLabel('Ekranda ne gösterilecek')
    .fill('Kanat kesiti, termik sütunu');
  await addForm.getByLabel('Kaynak adayı 1 adı').fill('Planör el kitabı');
  await addForm.getByLabel('Kaynak adayı 1 adresi').fill('javascript:alert(1)');
  await addForm.getByRole('button', { name: 'Öneriyi ekle' }).click();
  await expect(addForm.getByRole('alert')).toContainText('Tür seçin');
  await addForm.getByLabel(/^Tür/).selectOption('how_it_works');
  await addForm.getByRole('button', { name: 'Öneriyi ekle' }).click();
  await expect(addForm.getByRole('alert')).toContainText('http://');
  await addForm
    .getByLabel('Kaynak adayı 1 adresi')
    .fill('https://example.org/planor');
  await addForm.getByRole('button', { name: 'Öneriyi ekle' }).click();
  await expect(page.getByText('Öneri eklendi.')).toBeVisible();
  const card = page.getByRole('article', { name: `Öneri: ${topic}` });
  await expect(card).toContainText('Karar bekliyor');
  await expect(card).toContainText('Nasıl çalışır');
  await expect(card).toContainText('Kanıt: Özgün');
  await expect(card).toContainText('Motoru yok ama saatlerce uçuyor.');
  await expect(card).toContainText('Kanat kesiti, termik sütunu');
  const source = card.getByRole('link', { name: 'Planör el kitabı' });
  await expect(source).toHaveAttribute('href', 'https://example.org/planor');
  await expect(source).toHaveAttribute('rel', 'noopener noreferrer');

  // 4) Toplu ekleme.
  await page.getByRole('button', { name: 'Elle: toplu' }).click();
  const batch = page.getByRole('form', { name: 'Toplu öneri ekle' });
  await batch
    .getByLabel(/Başlıklar/)
    .fill(`Deniz feneri ${run}\n\nAsma köprü ${run}`);
  await batch.getByLabel(/Hepsinin türü/).selectOption('event');
  await batch.getByRole('button', { name: 'Önerileri ekle' }).click();
  await expect(page.getByText('2 öneri eklendi.')).toBeVisible();
  await expect(page.getByRole('article', { name: /^Öneri: / })).toHaveCount(3);

  // 5) Eleme: klavyeyle; elenen öneri saklanır ve yine seçilebilir.
  const rejected = page.getByRole('article', {
    name: `Öneri: Deniz feneri ${run}`,
  });
  await rejected.getByRole('button', { name: 'Ele', exact: true }).click();
  const reason = rejected.getByLabel(/Neden eleniyor/);
  await expect(reason).toBeFocused();
  await reason.fill('Seriye uymuyor');
  await page.keyboard.press('Enter');
  await expect(rejected).toContainText('Elendi');
  await expect(rejected).toContainText('Seriye uymuyor');
  await expect(
    rejected.getByRole('button', { name: 'Yine de seç' }),
  ).toBeVisible();

  // 6) Seçim: öneri serinin ilk bölümüne dönüşür.
  await card.getByRole('button', { name: 'Bu konuyu seç' }).click();
  await expect(card).toContainText('Seçildi');
  await card.getByRole('link', { name: 'Bölümü aç' }).click();
  await expect(page).toHaveURL(/\/explainers\/episodes\/[0-9a-f-]{36}$/);
  const episodeId = idFromUrl(page);
  const episodeUrl = page.url();
  await expect(
    page.getByRole('heading', { name: `Bölüm 1: ${topic}`, level: 1 }),
  ).toBeVisible();
  await expect(heading(page)).toContainText('Taslak');
  await expect(page.getByRole('region', { name: 'Akış' })).toContainText(
    'Senaryoyu ve kaynak notlarını yazın.',
  );
  // Önerinin özeti ve kancası bölüme taşınır.
  await expect(page.getByRole('region', { name: 'Akış' })).toContainText(
    'Motoru yok ama saatlerce uçuyor.',
  );

  // 7) Senaryo + kaynak notu: tek kaynaklı iddia anında işaretlenir.
  const approval = page.getByRole('region', { name: 'Senaryo onayı' });
  const production = page.getByRole('region', { name: 'Üretim', exact: true });
  await expect(approval).toContainText('Önce senaryoyu yazıp kaydedin');
  await expect(
    production.getByRole('button', { name: 'Üretime gönder' }),
  ).toBeDisabled();
  await page
    .getByLabel('Anlatıcı metni')
    .fill('Motoru yok ama saatlerce uçuyor.\nPlanör yükselen havayı kullanır.');
  await page.getByRole('button', { name: 'İddia ekle' }).click();
  await page
    .getByLabel('İddia 1 metni')
    .fill('Planörler termik hava akımlarıyla yükselir.');
  await page.getByLabel('İddia 1, kaynak 1 adı').fill('Planör el kitabı');
  await page
    .getByLabel('İddia 1, kaynak 1 adresi')
    .fill('https://example.org/planor');
  const summary = page.getByTestId('fact-gap-summary');
  await expect(summary).toContainText('1 iddianın kaynağı eksik');
  await expect(page.getByText('Kaydedilmemiş değişiklik')).toBeVisible();
  await page.getByRole('button', { name: 'Senaryoyu kaydet' }).click();
  await expect(page.getByText('Senaryo kaydedildi.')).toBeVisible();
  await expect(heading(page)).toContainText('Senaryo onay bekliyor');
  await expect(heading(page)).toContainText('1 kaynağı eksik iddia');

  // 8) Viewer onaylayamaz: düğme yok, API 403.
  const viewer = await browser.newContext({ storageState: VIEWER_STATE });
  try {
    const viewerPage = await viewer.newPage();
    expect((await viewerPage.goto(episodeUrl))?.status()).toBe(200);
    await expect(
      viewerPage.getByRole('region', { name: 'Senaryo onayı' }),
    ).toContainText('İzleyici rolü onay veremez.');
    await expect(
      viewerPage.getByRole('button', { name: /Senaryoyu onayla/ }),
    ).toHaveCount(0);
    const denied = await viewer.request.post(
      `/api/explainers/episodes/${episodeId}/approve`,
      { data: { script_version: 1, acknowledge_fact_gaps: true } },
    );
    expect(denied.status()).toBe(403);
  } finally {
    await viewer.close();
  }

  // 9) Editor onayı: kaynak eksiği açıkça kabul edilmeden onay verilemez.
  const approveButton = approval.getByRole('button', {
    name: /Senaryoyu onayla/,
  });
  await expect(approveButton).toBeDisabled();
  const refused = await page.request.post(
    `/api/explainers/episodes/${episodeId}/approve`,
    { data: { script_version: 1 } },
  );
  expect(refused.status()).toBe(422);
  expect(((await refused.json()) as { code: string }).code).toBe('fact_gaps');
  await approval.getByLabel(/Kaynak eksiğini biliyorum/).check();
  await approveButton.click();
  await expect(page.getByText(/Senaryo onaylandı/)).toBeVisible();
  await expect(approval).toContainText('✓ Onaylı');
  await expect(approval).toContainText('Kaynak eksiği bilinerek onaylandı');
  await expect(approval).toContainText('tarafından onaylandı');
  await expect(heading(page)).toContainText('Senaryo onaylı');
  await expect(
    production.getByRole('button', { name: 'Üretime gönder' }),
  ).toBeEnabled();

  // 10) Değişiklik: ikinci kaynak eklenir → yeni sürüm, onay düşer.
  await page.getByLabel('İddia 1, kaynak 2 adı').fill('Meteoroloji kurumu');
  await expect(summary).toContainText('Her iddianın en az iki kaynağı var');
  await expect(
    page.getByText('Kaydederseniz mevcut onay silinir.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Senaryoyu kaydet' }).click();
  await expect(page.getByText(/onay silindi/)).toBeVisible();
  await expect(heading(page)).toContainText('Senaryo onay bekliyor');
  await expect(approval).toContainText('Onay bekliyor');
  await expect(approval).toContainText(/Sürüm 1 .* onaylanmıştı/);
  await expect(
    production.getByRole('button', { name: 'Üretime gönder' }),
  ).toBeDisabled();
  const versions = page.getByRole('region', { name: 'Sürüm geçmişi' });
  await expect(versions.getByRole('listitem')).toHaveCount(2);
  await expect(versions.getByRole('listitem').nth(0)).toContainText(
    /Sürüm 2.*Güncel/,
  );
  await expect(versions.getByRole('listitem').nth(1)).toContainText(
    'Onaylandı (kaynak eksiğiyle)',
  );
  await versions
    .getByRole('button', { name: 'Sürüm 1 ile güncel sürümü karşılaştır' })
    .click();
  await expect(versions).toContainText('senaryo metni aynı.');
  await expect(
    versions.getByRole('list', { name: 'Kaynak notu farkı' }),
  ).toContainText('1 → 2 kaynak');

  // 11) Yeniden onay: eksik kalmadığı için ek kabul gerekmez.
  await expect(approval.getByLabel(/Kaynak eksiğini biliyorum/)).toHaveCount(0);
  await approval.getByRole('button', { name: /Senaryoyu onayla/ }).click();
  await expect(approval).toContainText('✓ Onaylı');
  await expect(approval).not.toContainText('Kaynak eksiği bilinerek');

  // 12) Üretime gönder: makine bağlı olmasa da iş sıraya girer.
  await expect(
    production.getByRole('list', { name: 'Üretim için gerekenler' }),
  ).toContainText('Senaryo onaylı (sürüm 2).');
  await production.getByRole('button', { name: 'Üretime gönder' }).click();
  await expect(page.getByText(/Üretim işi sıraya alındı/)).toBeVisible();
  const job = production.getByRole('article', { name: /^Üretim işi/ });
  await expect(job).toContainText('Sırada');
  await expect(job.getByRole('list', { name: 'Aşamalar' })).toContainText(
    '1. Seslendirme',
  );
  await expect(job.getByRole('list', { name: 'Aşamalar' })).toContainText(
    '4. Render ve video onayı',
  );
  await expect(heading(page)).toContainText('Üretiliyor');
  await expect(page.getByLabel('Anlatıcı metni')).toBeDisabled();
  await expect(
    page.getByText(/Üretim sürerken senaryo değiştirilemez/),
  ).toBeVisible();

  const { data: jobs, error } = await adminClient()
    .from('jobs')
    .select(
      'module, kind, status, episode_script_version, required_capabilities, params',
    )
    .eq('episode_id', episodeId);
  if (error) throw error;
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    module: 'explainer',
    kind: 'explainer.render',
    status: 'queued',
    episode_script_version: 2,
    required_capabilities: [
      'voice.edge-tts',
      'captions.burn',
      'render.hyperframes',
    ],
  });
  // Seri varsayılanları işe dondurulmuştur.
  expect(jobs[0]!.params).toMatchObject({
    visual_route: 'hyperframes',
    voice: { name: 'tr-TR-AhmetNeural', rate: '+8%' },
    series: { name: seriesName },
    episode: { number: 1, script_version: 2 },
  });
  // Üretim sürerken senaryo API'den de değiştirilemez.
  const locked = await page.request.put(
    `/api/explainers/episodes/${episodeId}/script`,
    { data: { script_text: 'değişti', expected_version: 2 } },
  );
  expect(locked.status()).toBe(409);

  // 13) İptal: bölüm onaylı senaryoya döner (kuyrukta iş bırakılmaz).
  await job.getByRole('button', { name: 'İşi iptal et' }).click();
  await expect(job).toContainText('İptal edildi');
  await expect(heading(page)).toContainText('Senaryo onaylı');

  // 14) Seri sayfası bölümü numarası ve durumuyla listeler; istek seride görünür.
  await page.goto(seriesUrl);
  const row = page
    .getByRole('table', { name: `${seriesName} bölümleri` })
    .getByRole('row')
    .filter({ hasText: topic });
  await expect(row).toContainText('Bölüm 1');
  await expect(row).toContainText('Senaryo onaylı');
  await expect(
    page.getByRole('region', { name: 'Bu serinin konu istekleri' }),
  ).toContainText('3 öneri · 1 karar bekliyor');
  await page.goto('/explainers');
  await expect(
    page.getByRole('article', { name: `Seri: ${seriesName}` }),
  ).toContainText('Uçan şeylerin mekaniği');
  expect(topicUrl).toContain('/explainers/topics/');
});

test('tekil video: seri olmadan; çakışmada sessizce üstüne yazılmaz; eski sürüm geri yüklenir; seriye taşınır', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const run = crypto.randomUUID().slice(0, 8);
  const title = `Baraj ${run} neden yıkıldı`;

  await page.goto('/explainers');
  await page.getByRole('link', { name: 'Tekil video', exact: true }).click();
  const form = page.getByRole('form', { name: 'Yeni video' });
  await expect(form.getByLabel(/^Seri/)).toHaveValue('');
  await form.getByLabel(/Konu \/ çalışma başlığı/).fill(title);
  await form.getByRole('button', { name: 'Videoyu oluştur' }).click();
  await expect(form.getByRole('alert')).toContainText('Tür seçin');
  await form.getByLabel(/^Tür/).selectOption('event');
  await form.getByRole('button', { name: 'Videoyu oluştur' }).click();
  await expect(page).toHaveURL(/\/explainers\/episodes\/[0-9a-f-]{36}$/);
  const episodeId = idFromUrl(page);
  const episodeUrl = page.url();
  const scriptApi = `/api/explainers/episodes/${episodeId}/script`;

  // Numara yok, karakter istenmez; olay türünde hassasiyet kuralları görünür.
  await expect(
    page.getByRole('heading', { name: title, level: 1 }),
  ).toBeVisible();
  await expect(heading(page)).toContainText('Tekil video');
  await expect(heading(page)).not.toContainText('Bölüm');
  await expect(
    page.getByRole('combobox', { name: 'Aktif influencer' }),
  ).toHaveCount(0);
  await expect(page.getByText('Gerçek olay anlatırken:')).toBeVisible();
  await page.getByLabel('Can kaybı').check();

  const script = page.getByLabel('Anlatıcı metni');
  await script.fill('İlk metin.');
  await page.getByRole('button', { name: 'Senaryoyu kaydet' }).click();
  await expect(page.getByText('Senaryo kaydedildi.')).toBeVisible();
  await expect(heading(page)).toContainText('Kaynak notu yok');

  // Başka bir editör aynı anda kaydeder (sürüm 2).
  const other = await page.request.put(scriptApi, {
    data: { script_text: 'Başka editörün metni.', expected_version: 1 },
  });
  expect(other.status()).toBe(200);

  // Bu sekme hâlâ sürüm 1 üzerinde: kayıt reddedilir, iki sürüm gösterilir.
  await script.fill('İlk metin.\nBenim eklediğim satır.');
  await page.getByRole('button', { name: 'Senaryoyu kaydet' }).click();
  const conflict = page.getByRole('alertdialog', {
    name: /başka biri değiştirdi/,
  });
  await expect(conflict).toBeVisible();
  await expect(conflict).toContainText('güncel sürüm 2');
  await expect(
    conflict.getByRole('list', { name: 'Senaryo metni farkı' }),
  ).toContainText('Başka editörün metni.');
  await expect(script).toHaveValue('İlk metin.\nBenim eklediğim satır.');
  const stillTheirs = (await (await page.request.get(scriptApi)).json()) as {
    script: { script_text: string; script_version: number };
  };
  expect(stillTheirs.script).toMatchObject({
    script_text: 'Başka editörün metni.',
    script_version: 2,
  });

  // Kullanıcı bilerek kendi metnini yeni sürüm olarak kaydeder; diğer sürüm geçmişte kalır.
  await conflict
    .getByRole('button', { name: 'Benim metnimi yeni sürüm olarak kaydet' })
    .click();
  await expect(page.getByText(/yeni sürüm olarak kaydedildi/)).toBeVisible();
  await expect(conflict).toHaveCount(0);
  const versions = page.getByRole('region', { name: 'Sürüm geçmişi' });
  await expect(versions.getByRole('listitem')).toHaveCount(3);

  // Eskiye dönüş: sürüm 2 içeriği yeni sürüm (4) olarak kaydedilir. Escape vazgeçer.
  await versions
    .getByRole('button', { name: 'Sürüm 2: bu sürümü geri yükle' })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'yeni bir sürüm olarak kaydedilir',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await versions
    .getByRole('button', { name: 'Sürüm 2: bu sürümü geri yükle' })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Geri yükle' })
    .click();
  await expect(
    page.getByText('Sürüm 2 yeni sürüm olarak geri yüklendi.'),
  ).toBeVisible();
  await expect(script).toHaveValue('Başka editörün metni.');
  await expect(versions.getByRole('listitem')).toHaveCount(4);
  await expect(versions.getByRole('listitem').nth(0)).toContainText(
    /Sürüm 4.*Güncel/,
  );

  // Liste: tekil videolar arasında, durumuyla.
  await page.goto('/explainers');
  const standalone = page.getByRole('table', { name: 'Tekil videolar' });
  await expect(
    standalone.getByRole('row').filter({ hasText: title }),
  ).toContainText('Senaryo onay bekliyor');

  // Benzer konu uyarısı: engellemez, eski videoyu gösterir.
  await page.getByRole('link', { name: 'Tekil video', exact: true }).click();
  const again = page.getByRole('form', { name: 'Yeni video' });
  await again
    .getByLabel(/Konu \/ çalışma başlığı/)
    .fill(title.toLocaleUpperCase('tr'));
  const similar = page.getByRole('status', { name: 'Benzer konular' });
  await expect(similar).toContainText('aynı başlık');
  await expect(similar.getByRole('link', { name: title })).toHaveAttribute(
    'href',
    `/explainers/episodes/${episodeId}`,
  );
  await expect(
    again.getByRole('button', { name: 'Videoyu oluştur' }),
  ).toBeEnabled();

  // Seriye taşıma: tekil video serinin ilk bölümü olur.
  const seriesName = `E2E Taşıma ${run}`;
  const created = await page.request.post('/api/explainers/series', {
    data: { name: seriesName, settings: { visual_route: 'skia' } },
  });
  expect(created.status()).toBe(201);
  const duplicate = await page.request.post('/api/explainers/series', {
    data: { name: seriesName.toLocaleUpperCase('tr') },
  });
  expect(duplicate.status()).toBe(409);
  expect(((await duplicate.json()) as { error: string }).error).toBe(
    'Bu adda bir seri zaten var.',
  );
  await page.goto(episodeUrl);
  const settings = page.getByRole('region', { name: 'Bölüm ayarları' });
  await settings
    .getByLabel(`“${title}” için hedef`)
    .selectOption({ label: `Seri: ${seriesName}` });
  await settings.getByRole('button', { name: 'Taşı', exact: true }).click();
  await expect(page.getByText(/Bölüm taşındı/)).toBeVisible();
  await expect(
    page.getByRole('heading', { name: `Bölüm 1: ${title}`, level: 1 }),
  ).toBeVisible();
  // Üretim ayarı seriden gelir.
  await expect(
    page
      .getByRole('region', { name: 'Üretim', exact: true })
      .getByRole('list', { name: 'Üretim için gerekenler' }),
  ).toContainText('Görsel yol: Skia 2B çizim (seriden).');
});
