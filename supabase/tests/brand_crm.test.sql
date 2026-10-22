-- Marka CRM'i (#60): RLS, paid_at kuralı, içerik bağlantısı, contracts bucket'ı ve gelir fonksiyonu.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(38);

-- Fixture (postgres rolüyle, RLS dışında). Gerçek marka verisi yok.
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('97000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'crm-editor@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('97000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'crm-viewer@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('97000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'crm-outsider@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
INSERT INTO public.team_members (user_id, role) VALUES
  ('97000000-0000-4000-8000-000000000001', 'editor'),
  ('97000000-0000-4000-8000-000000000002', 'viewer');

INSERT INTO public.influencers (id, name, slug, status) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'CRM A', 'crm-a', 'active'),
  ('d1000000-0000-4000-8000-000000000002', 'CRM B', 'crm-b', 'active');
INSERT INTO public.content_items (id, influencer_id, title) VALUES
  ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'A kartı'),
  ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000002', 'B kartı');
INSERT INTO public.brands (id, name) VALUES
  ('d3000000-0000-4000-8000-000000000001', 'Örnek Marka');
-- 1 EUR = 1.1 USD (2026-09-01'den itibaren)
INSERT INTO public.exchange_rates (currency, base_currency, rate, valid_on)
VALUES ('EUR', 'USD', 1.1, '2026-09-01');

INSERT INTO public.brand_deals (id, brand_id, influencer_id, stage, fee, currency, paid_at) VALUES
  -- Eylül sınırları: 1 ve 30 Eylül dahil, 1 Ekim hariç
  ('d4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'paid', 100.10, 'USD', '2026-09-01'),
  ('d4000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'paid', 200, 'EUR', '2026-09-30'),
  ('d4000000-0000-4000-8000-000000000003', 'd3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'paid', 50, 'USD', '2026-10-01'),
  -- Kuru olmayan para birimi: converted_fee NULL
  ('d4000000-0000-4000-8000-000000000004', 'd3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 'paid', 70, 'GBP', '2026-09-15'),
  -- Kaybedilen deal: paid_at verilse bile temizlenir, gelire girmez
  ('d4000000-0000-4000-8000-000000000005', 'd3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'lost', 999, 'USD', '2026-09-10'),
  ('d4000000-0000-4000-8000-000000000006', 'd3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'lead', 300, 'USD', NULL);

-- ── Yapı ──────────────────────────────────────────────────────────
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.brand_deal_content_items'::regclass),
  'brand_deal_content_items RLS açık'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.brand_deal_files'::regclass),
  'brand_deal_files RLS açık'
);
SELECT extensions.is(
  ARRAY(
    SELECT policyname::text COLLATE "C" FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('brand_deal_content_items', 'brand_deal_files')
    ORDER BY 1
  ),
  ARRAY[
    'brand_deal_content_items_team_read', 'brand_deal_content_items_team_write',
    'brand_deal_files_team_read', 'brand_deal_files_team_write'
  ]::text[],
  'yeni tablolarda ekip okuma / yazma politikaları var'
);
SELECT extensions.is(
  (SELECT public FROM storage.buckets WHERE id = 'contracts'),
  false,
  'contracts bucket private'
);
SELECT extensions.is(
  (SELECT paid_at FROM public.brand_deals WHERE id = 'd4000000-0000-4000-8000-000000000005'),
  NULL,
  'paid olmayan deal''in paid_at değeri temizlenir'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.brand_deals (brand_id, influencer_id, brief)
    VALUES ('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', '[]'::jsonb)$$,
  '23514', NULL,
  'brief JSON nesnesi olmalı'
);


SET LOCAL ROLE authenticated;

-- ── Editor ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000001', true);
SELECT extensions.lives_ok(
  $$INSERT INTO public.brands (id, name, notes) VALUES ('d3000000-0000-4000-8000-000000000002', 'Hedef Marka', 'araştırma notu')$$,
  'editor marka ekleyebilir'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.brands (name) VALUES ('hedef marka')$$,
  '23505', NULL,
  'marka adı büyük/küçük harf duyarsız benzersiz'
);
SELECT extensions.is(
  (SELECT created_by FROM public.brands WHERE id = 'd3000000-0000-4000-8000-000000000002'),
  '97000000-0000-4000-8000-000000000001'::uuid,
  'created_by oturumdaki kullanıcıdan dolar'
);
SELECT extensions.lives_ok(
  $$UPDATE public.brand_deals SET stage = 'paid' WHERE id = 'd4000000-0000-4000-8000-000000000006'$$,
  'editor deal aşamasını paid yapabilir'
);
SELECT extensions.is(
  (SELECT paid_at FROM public.brand_deals WHERE id = 'd4000000-0000-4000-8000-000000000006'),
  (now() AT TIME ZONE 'Europe/Istanbul')::date,
  'paid''e geçişte paid_at bugünün tarihi olur'
);
UPDATE public.brand_deals SET paid_at = '2026-09-20' WHERE id = 'd4000000-0000-4000-8000-000000000006';
SELECT extensions.is(
  (SELECT paid_at FROM public.brand_deals WHERE id = 'd4000000-0000-4000-8000-000000000006'),
  '2026-09-20'::date,
  'ödeme tarihi elle düzeltilebilir'
);
UPDATE public.brand_deals SET stage = 'delivered' WHERE id = 'd4000000-0000-4000-8000-000000000006';
SELECT extensions.is(
  (SELECT paid_at FROM public.brand_deals WHERE id = 'd4000000-0000-4000-8000-000000000006'),
  NULL,
  'paid''den çıkınca paid_at temizlenir'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.brand_deal_content_items (brand_deal_id, content_item_id)
    VALUES ('d4000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001')$$,
  'editor aynı influencer''ın içeriğini bağlayabilir'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.brand_deal_content_items (brand_deal_id, content_item_id)
    VALUES ('d4000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002')$$,
  '23514', NULL,
  'başka influencer''ın içeriği bağlanamaz'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.brand_deal_content_items (brand_deal_id, content_item_id)
    VALUES ('d4000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001')$$,
  '23505', NULL,
  'aynı içerik iki kez bağlanamaz'
);
SELECT extensions.lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('contracts', 'd4000000-0000-4000-8000-000000000001/pgtap.pdf')$$,
  'editor deal klasörüne sözleşme yükleyebilir'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('contracts', 'pgtap-root.pdf')$$,
  '42501', NULL,
  'editor bucket köküne yükleyemez'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('contracts', '00000000-0000-4000-8000-000000000000/x.pdf')$$,
  '42501', NULL,
  'editor var olmayan deal klasörüne yükleyemez'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('contracts', 'd4000000-0000-4000-8000-000000000001/a/b.pdf')$$,
  '42501', NULL,
  'editor iç içe klasöre yükleyemez'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.brand_deal_files (brand_deal_id, storage_path, file_name, mime_type)
    VALUES ('d4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001/pgtap.pdf', 'sozlesme.pdf', 'application/pdf')$$,
  'editor dosya kaydı oluşturabilir'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.brand_deal_files (brand_deal_id, storage_path, file_name)
    VALUES ('d4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000002/x.pdf', 'x.pdf')$$,
  '23514', NULL,
  'dosya kaydı başka deal klasörünü gösteremez'
);
SELECT extensions.is(
  ARRAY(
    SELECT id::text || ':' || coalesce(converted_fee::text, 'NULL')
    FROM public.brand_deal_revenue('2026-09-01', '2026-09-30', 'USD')
  ),
  ARRAY[
    'd4000000-0000-4000-8000-000000000001:100.1000',
    'd4000000-0000-4000-8000-000000000004:NULL',
    'd4000000-0000-4000-8000-000000000002:220.0000'
  ],
  'gelir: ay sınırı paid_at ile, lost/ödenmemiş hariç, EUR çevrilir, kursuz GBP NULL'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.brand_deal_revenue('2026-09-01', '2026-09-30', 'USD', 'd1000000-0000-4000-8000-000000000002')),
  1,
  'gelir influencer ile filtrelenir'
);

-- ── Viewer ────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000002', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.brand_deals WHERE brand_id = 'd3000000-0000-4000-8000-000000000001'),
  6,
  'viewer deal''leri görebilir'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.brand_deal_files),
  1,
  'viewer dosya kayıtlarını görebilir'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'contracts'),
  1,
  'viewer sözleşme nesnesini görebilir (signed URL için)'
);
SELECT extensions.is_empty(
  $$UPDATE public.brand_deals SET stage = 'lost' WHERE id = 'd4000000-0000-4000-8000-000000000001' RETURNING 1$$,
  'viewer deal aşamasını değiştiremez (0 satır)'
);
SELECT extensions.is_empty(
  $$UPDATE public.brands SET notes = 'x' RETURNING 1$$,
  'viewer marka düzenleyemez (0 satır)'
);
SELECT extensions.is_empty(
  $$DELETE FROM public.brand_deal_content_items RETURNING 1$$,
  'viewer içerik bağlantısını silemez (0 satır)'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.brand_deals (brand_id, influencer_id)
    VALUES ('d3000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001')$$,
  '42501', NULL,
  'viewer deal açamaz'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.brand_deal_files (brand_deal_id, storage_path, file_name)
    VALUES ('d4000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001/v.pdf', 'v.pdf')$$,
  '42501', NULL,
  'viewer dosya kaydı oluşturamaz'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('contracts', 'd4000000-0000-4000-8000-000000000001/viewer.pdf')$$,
  '42501', NULL,
  'viewer sözleşme yükleyemez'
);

-- ── Ekip dışı ─────────────────────────────────────────────────────
SELECT set_config('request.jwt.claim.sub', '97000000-0000-4000-8000-000000000003', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.brands) + (SELECT count(*)::integer FROM public.brand_deals),
  0,
  'ekip dışı marka ve deal göremez'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.brand_deal_content_items) + (SELECT count(*)::integer FROM public.brand_deal_files),
  0,
  'ekip dışı bağlantı ve dosya kaydı göremez'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM storage.objects WHERE bucket_id = 'contracts'),
  0,
  'ekip dışı sözleşme nesnesi göremez'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.brand_deal_revenue('2026-01-01', '2026-12-31', 'USD')),
  0,
  'ekip dışı gelir verisi alamaz'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('contracts', 'd4000000-0000-4000-8000-000000000001/out.pdf')$$,
  '42501', NULL,
  'ekip dışı sözleşme yükleyemez'
);

SELECT * FROM extensions.finish();
ROLLBACK;
