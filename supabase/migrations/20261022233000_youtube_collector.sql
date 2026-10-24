-- #51 YouTube veri toplayıcı.
--
-- Kararlar:
-- * Kanalın toplam görüntülenmesi (channels.list statistics.viewCount) için
--   account_snapshots.total_views. Instagram/TikTok için NULL kalır.
-- * Kota uyarısı: YouTube Data API günlük proje kotası (varsayılan 10.000 birim) Pasifik
--   saatiyle gece yarısı sıfırlanır. Toplayıcı her çalışmanın harcadığı birimi
--   sync_runs.quota_units'e yazar (#53). O Pasifik günündeki YouTube toplamı
--   notification_settings.youtube_quota_warn_units eşiğini (varsayılan 8.000 = %80)
--   geçince `quota_warning` uyarısı yazılır (gün başına bir kez, dedupe_key).
-- * Uyarı tür listesi CHECK ile sabit olduğu için kısıt yeni türle yeniden kurulur ve push
--   başlığı eklenir. Aynı liste packages/shared/src/alerts.ts → ALERT_TYPES içinde.

-- ── 1) Toplam görüntülenme ──────────────────────────────────────────────────
ALTER TABLE public.account_snapshots
  ADD COLUMN total_views bigint CHECK (total_views IS NULL OR total_views >= 0);
COMMENT ON COLUMN public.account_snapshots.total_views IS
  'Hesabın toplam görüntülenmesi (YouTube kanal viewCount, #51). Platform vermiyorsa NULL.';

-- ── 2) Kota eşiği ───────────────────────────────────────────────────────────
ALTER TABLE public.notification_settings
  ADD COLUMN youtube_quota_warn_units integer NOT NULL DEFAULT 8000
    CHECK (youtube_quota_warn_units BETWEEN 100 AND 1000000);
COMMENT ON COLUMN public.notification_settings.youtube_quota_warn_units IS
  'YouTube Data API günlük kota uyarı eşiği (birim, Pasifik günü). Varsayılan kota 10.000 (#51).';

-- ── 3) Uyarı türü ───────────────────────────────────────────────────────────
ALTER TABLE public.alerts DROP CONSTRAINT alerts_type_known;
ALTER TABLE public.alerts
  ADD CONSTRAINT alerts_type_known CHECK (type IN (
    'viral_post', 'follower_milestone', 'token_expiring', 'sync_failed',
    'budget_warning', 'budget_exceeded', 'content_not_ready', 'generation_failed',
    'weekly_report_ready', 'quota_warning'
  )) NOT VALID;

CREATE OR REPLACE FUNCTION private.alert_push_title(p_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT CASE p_type
    WHEN 'viral_post' THEN 'Viral eşik aşıldı'
    WHEN 'follower_milestone' THEN 'Takipçi kilometre taşı'
    WHEN 'token_expiring' THEN 'Token süresi doluyor'
    WHEN 'sync_failed' THEN 'Senkronizasyon hatası'
    WHEN 'budget_warning' THEN 'Bütçe uyarı eşiğine ulaştı'
    WHEN 'budget_exceeded' THEN 'Bütçe aşıldı'
    WHEN 'content_not_ready' THEN 'Yayın saati geldi, içerik hazır değil'
    WHEN 'generation_failed' THEN 'Üretim başarısız'
    WHEN 'weekly_report_ready' THEN 'Haftalık rapor hazır'
    WHEN 'quota_warning' THEN 'YouTube API kotası sınıra yaklaştı'
    ELSE 'Yeni uyarı'
  END
$fn$;

-- ── 4) Kota uyarısı ─────────────────────────────────────────────────────────
-- Pasifik günü başlangıcı (YouTube kotasının sıfırlandığı an), timestamptz olarak.
CREATE FUNCTION private.youtube_quota_day_start(p_at timestamptz)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = ''
AS $fn$
  SELECT date_trunc('day', p_at AT TIME ZONE 'America/Los_Angeles') AT TIME ZONE 'America/Los_Angeles'
$fn$;

CREATE FUNCTION private.sync_runs_quota_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start timestamptz;
  v_used bigint;
  v_threshold integer;
BEGIN
  IF NEW.platform IS DISTINCT FROM 'youtube' OR coalesce(NEW.quota_units, 0) <= 0 THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.quota_units IS NOT DISTINCT FROM NEW.quota_units THEN
    RETURN NULL;
  END IF;

  SELECT coalesce((SELECT s.youtube_quota_warn_units FROM public.notification_settings s LIMIT 1), 8000)
  INTO v_threshold;
  v_start := private.youtube_quota_day_start(NEW.started_at);
  SELECT coalesce(sum(r.quota_units), 0) INTO v_used
  FROM public.sync_runs r
  WHERE r.platform = 'youtube'
    AND r.started_at >= v_start
    AND r.started_at < v_start + interval '1 day';

  IF v_used >= v_threshold THEN
    PERFORM private.raise_alert(
      'quota_warning',
      NULL,
      jsonb_build_object(
        'platform', 'youtube',
        'used_units', v_used,
        'threshold_units', v_threshold,
        'daily_limit_units', 10000,
        'quota_day', to_char(NEW.started_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD')
      ),
      'quota_warning:youtube:' || to_char(NEW.started_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD')
    );
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER sync_runs_quota_alert
  AFTER INSERT OR UPDATE OF quota_units ON public.sync_runs
  FOR EACH ROW EXECUTE FUNCTION private.sync_runs_quota_alert();

COMMENT ON FUNCTION private.sync_runs_quota_alert() IS
  'YouTube günlük kota toplamı notification_settings.youtube_quota_warn_units eşiğini geçince quota_warning uyarısı (#51).';
