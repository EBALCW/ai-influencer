-- #51 YouTube toplayıcı: account_snapshots.total_views, Pasifik günü kota toplamı ve
-- quota_warning uyarısı (eşik, tekilleştirme, platform/gün sınırı).
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(16);

INSERT INTO public.influencers (id, name, slug)
VALUES ('a5510000-0000-4000-8000-000000000001', 'YouTube fixture', 'youtube-fixture');
INSERT INTO public.social_accounts (id, influencer_id, platform, handle, external_id, token_ref, status) VALUES
  ('a5520000-0000-4000-8000-000000000001', 'a5510000-0000-4000-8000-000000000001', 'youtube', 'yt-fixture', 'UCfixture51', 'ref-yt', 'active');

-- ── total_views ─────────────────────────────────────────────────────────────
SELECT extensions.has_column('public', 'account_snapshots', 'total_views', 'account_snapshots has total_views');
SELECT extensions.col_type_is('public', 'account_snapshots', 'total_views', 'bigint', 'total_views is bigint');
SELECT extensions.lives_ok(
  $$INSERT INTO public.account_snapshots (account_id, captured_at, followers, media_count, total_views)
    VALUES ('a5520000-0000-4000-8000-000000000001', '2026-01-10 00:00:00+00', 8910, 42, 1234567)$$,
  'channel snapshot with total views is stored'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.account_snapshots (account_id, captured_at, followers, total_views)
    VALUES ('a5520000-0000-4000-8000-000000000001', '2026-01-11 00:00:00+00', 1, -1)$$,
  '23514', NULL, 'negative total_views is rejected'
);

-- ── Ayar ve tür ─────────────────────────────────────────────────────────────
SELECT extensions.is(
  (SELECT youtube_quota_warn_units FROM public.notification_settings),
  8000, 'default YouTube quota warning threshold is 80% of 10.000'
);
SELECT extensions.is(
  private.alert_push_title('quota_warning'),
  'YouTube API kotası sınıra yaklaştı', 'quota_warning has a push title'
);
SELECT extensions.is(
  private.alert_push_title('weekly_report_ready'),
  'Haftalık rapor hazır', 'existing push titles are kept'
);
-- 2026-01-11 07:30 UTC = 2026-01-10 23:30 PST → gün 2026-01-10 08:00 UTC'de başlar.
SELECT extensions.is(
  private.youtube_quota_day_start('2026-01-11 07:30:00+00'),
  '2026-01-10 08:00:00+00'::timestamptz, 'quota day starts at Pacific midnight'
);

-- ── Kota uyarısı ────────────────────────────────────────────────────────────
-- Pasifik günü 2026-01-10: 5000 birim → eşik altı.
INSERT INTO public.sync_runs (id, job, platform, account_id, started_at, status, quota_units) VALUES
  ('a5550000-0000-4000-8000-000000000001', 'posts', 'youtube', 'a5520000-0000-4000-8000-000000000001',
   '2026-01-10 20:00:00+00', 'succeeded', 5000);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE type = 'quota_warning'), 0,
  'no warning below the threshold'
);

-- Instagram kotası YouTube toplamına sayılmaz.
INSERT INTO public.sync_runs (job, platform, started_at, status, quota_units) VALUES
  ('posts', 'instagram', '2026-01-10 21:00:00+00', 'succeeded', 9000);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE type = 'quota_warning'), 0,
  'other platforms do not count towards YouTube quota'
);

-- Çalışma açılır, kapanırken 3500 birim yazar (orkestratör akışı) → toplam 8500 ≥ 8000.
-- 07:30 UTC hâlâ Pasifik günü 2026-01-10.
SET LOCAL ROLE service_role;
INSERT INTO public.sync_runs (id, job, platform, account_id, started_at) VALUES
  ('a5550000-0000-4000-8000-000000000002', 'metrics', 'youtube', 'a5520000-0000-4000-8000-000000000001',
   '2026-01-11 07:30:00+00');
UPDATE public.sync_runs SET status = 'succeeded', quota_units = 3500
WHERE id = 'a5550000-0000-4000-8000-000000000002';
RESET ROLE;
SELECT extensions.results_eq(
  $$SELECT influencer_id, payload ->> 'platform', (payload ->> 'used_units')::integer,
           (payload ->> 'threshold_units')::integer, payload ->> 'quota_day'
    FROM public.alerts WHERE dedupe_key = 'quota_warning:youtube:2026-01-10'$$,
  $$VALUES (NULL::uuid, 'youtube', 8500, 8000, '2026-01-10')$$,
  'crossing the threshold raises one quota_warning for the Pacific day'
);

-- Aynı gün daha fazla harcama yeni uyarı üretmez.
INSERT INTO public.sync_runs (job, platform, started_at, status, quota_units) VALUES
  ('posts', 'youtube', '2026-01-10 22:00:00+00', 'succeeded', 1000);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE type = 'quota_warning'), 1,
  'quota warning is deduplicated per day'
);

-- Yeni Pasifik günü (2026-01-11 00:30 PST) sıfırdan sayar.
INSERT INTO public.sync_runs (id, job, platform, started_at, status, quota_units) VALUES
  ('a5550000-0000-4000-8000-000000000003', 'posts', 'youtube', '2026-01-11 08:30:00+00', 'succeeded', 900);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE dedupe_key = 'quota_warning:youtube:2026-01-11'), 0,
  'quota resets at Pacific midnight'
);

-- Durum güncellemesi (kota değişmeden) uyarıyı yeniden tetiklemez; eşik düşürülünce sonraki yazım uyarır.
UPDATE public.notification_settings SET youtube_quota_warn_units = 500;
UPDATE public.sync_runs SET error = 'not' WHERE id = 'a5550000-0000-4000-8000-000000000003';
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts WHERE dedupe_key = 'quota_warning:youtube:2026-01-11'), 0,
  'updates that do not touch quota_units do not re-evaluate'
);
UPDATE public.sync_runs SET quota_units = 950 WHERE id = 'a5550000-0000-4000-8000-000000000003';
SELECT extensions.is(
  (SELECT (payload ->> 'threshold_units')::integer FROM public.alerts
   WHERE dedupe_key = 'quota_warning:youtube:2026-01-11'),
  500, 'threshold comes from notification_settings'
);

SELECT extensions.throws_ok(
  $$UPDATE public.notification_settings SET youtube_quota_warn_units = 10$$,
  '23514', NULL, 'threshold must be at least 100 units'
);

SELECT * FROM extensions.finish();
ROLLBACK;
