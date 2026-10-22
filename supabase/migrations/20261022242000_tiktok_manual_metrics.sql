-- #52 TikTok veri toplayıcı + elle metrik girişi.
--
-- Kararlar:
-- * TikTok Display API hesabın toplam beğenisini (`user.info.stats` → likes_count) verir;
--   account_snapshots'ta karşılığı yoktu. Yeni nullable kolon total_likes (diğer platformlarda
--   NULL), YouTube'daki total_views ile aynı desen.
-- * Display API izlenme süresi, tamamlama oranı, erişim ve kaydetme sayısı vermez. Bunlar panelden
--   elle girilebilir. Satırın API'den mi elle mi geldiği metric_snapshots.source ile ayrılır
--   ('api' varsayılan, mevcut satırlar 'api' sayılır).
-- * Elle giriş public.record_manual_metrics() ile yapılır (SECURITY INVOKER, RLS + editor
--   denetimi). Kontrol noktası (target_hours) verilirse satır o noktaya yazılır:
--   captured_at = published_at + target saat, hours_since_publish = target.
--   UNIQUE (post_id, target_hours) çakışmasında:
--     - mevcut satır 'manual' ise elle düzeltme kabul edilir (güncellenir) → 'updated'
--     - mevcut satır 'api' ise ÜZERİNE YAZILMAZ → 'conflict' (panel 409 döner)
--   Kontrol noktası verilmezse (NULL) ad-hoc ölçüm olarak şimdiki zamana eklenir.
-- * Elle girilen değer sync'te ezilmez: orkestratör (post_id, target_hours) için
--   ON CONFLICT DO NOTHING yazar, due_snapshots() zaten ölçülmüş noktayı döndürmez.

-- ── 1) Hesap toplam beğenisi ────────────────────────────────────────────────
ALTER TABLE public.account_snapshots
  ADD COLUMN total_likes bigint CHECK (total_likes IS NULL OR total_likes >= 0);
COMMENT ON COLUMN public.account_snapshots.total_likes IS
  'Hesabın toplam beğenisi (TikTok likes_count, #52). Diğer platformlarda NULL.';

-- ── 2) Metrik kaynağı ───────────────────────────────────────────────────────
ALTER TABLE public.metric_snapshots
  ADD COLUMN source text NOT NULL DEFAULT 'api' CHECK (source IN ('api', 'manual'));
COMMENT ON COLUMN public.metric_snapshots.source IS
  'api = toplayıcı (sync-dispatch), manual = panelden elle giriş (#52). Elle girilen nokta sync''te ezilmez.';

-- ── 3) Elle giriş ───────────────────────────────────────────────────────────
CREATE FUNCTION public.record_manual_metrics(
  p_post_id uuid,
  p_views bigint,
  p_likes bigint,
  p_comments bigint,
  p_shares bigint,
  p_target_hours smallint DEFAULT NULL,
  p_saves bigint DEFAULT NULL,
  p_reach bigint DEFAULT NULL,
  p_avg_watch_time_s numeric DEFAULT NULL,
  p_completion_rate numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_published timestamptz;
  v_captured timestamptz;
  v_hours numeric;
  v_id uuid;
  v_inserted boolean;
  v_unmeasured text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'Editor yetkisi gerekli.' USING ERRCODE = '42501';
  END IF;
  IF p_target_hours IS NOT NULL AND p_target_hours NOT IN (1, 5, 24, 72, 168) THEN
    RAISE EXCEPTION 'Geçersiz kontrol noktası.' USING ERRCODE = '22023';
  END IF;

  SELECT p.published_at INTO v_published FROM public.posts p WHERE p.id = p_post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  IF p_target_hours IS NOT NULL THEN
    IF v_published IS NULL THEN
      RAISE EXCEPTION 'Yayın zamanı olmayan posta kontrol noktası girilemez.' USING ERRCODE = '22023';
    END IF;
    v_captured := v_published + p_target_hours * interval '1 hour';
    IF v_captured > now() THEN
      RAISE EXCEPTION 'Bu kontrol noktasına henüz gelinmedi.' USING ERRCODE = '22023';
    END IF;
    v_hours := p_target_hours;
  ELSE
    v_captured := now();
    v_hours := CASE WHEN v_published IS NULL OR v_published > v_captured THEN NULL
      ELSE round((extract(epoch FROM v_captured - v_published) / 3600)::numeric, 2) END;
  END IF;

  -- NOT NULL sayaçlarda boş bırakılan alan 0 yazılır ve ölçülmedi olarak işaretlenir (#53 kuralı).
  IF p_saves IS NULL THEN v_unmeasured := array_append(v_unmeasured, 'saves'); END IF;

  INSERT INTO public.metric_snapshots AS m (
    post_id, captured_at, hours_since_publish, target_hours, views, reach, likes, comments,
    shares, saves, avg_watch_time_s, completion_rate, raw_payload, source
  )
  VALUES (
    p_post_id, v_captured, v_hours, p_target_hours, p_views, p_reach, p_likes, p_comments,
    p_shares, coalesce(p_saves, 0), p_avg_watch_time_s, p_completion_rate,
    CASE WHEN cardinality(v_unmeasured) > 0
      THEN jsonb_build_object('entry', 'manual', '_unmeasured', to_jsonb(v_unmeasured))
      ELSE jsonb_build_object('entry', 'manual') END,
    'manual'
  )
  ON CONFLICT (post_id, target_hours) DO UPDATE SET
    views = EXCLUDED.views,
    reach = EXCLUDED.reach,
    likes = EXCLUDED.likes,
    comments = EXCLUDED.comments,
    shares = EXCLUDED.shares,
    saves = EXCLUDED.saves,
    avg_watch_time_s = EXCLUDED.avg_watch_time_s,
    completion_rate = EXCLUDED.completion_rate,
    raw_payload = EXCLUDED.raw_payload
  WHERE m.source = 'manual'
  RETURNING m.id, (m.xmax = 0) INTO v_id, v_inserted;

  IF v_id IS NULL THEN
    -- Aynı noktada API ölçümü var: üzerine yazılmaz.
    RETURN jsonb_build_object('status', 'conflict', 'id', (
      SELECT m.id FROM public.metric_snapshots m
      WHERE m.post_id = p_post_id AND m.target_hours = p_target_hours
    ));
  END IF;
  RETURN jsonb_build_object('status', CASE WHEN v_inserted THEN 'created' ELSE 'updated' END, 'id', v_id);
END;
$$;
COMMENT ON FUNCTION public.record_manual_metrics(uuid, bigint, bigint, bigint, bigint, smallint, bigint, bigint, numeric, numeric) IS
  'Elle metrik girişi (#52). Dönüş status: created | updated (önceki elle giriş düzeltildi) | conflict (API ölçümü var, yazılmadı).';
REVOKE ALL ON FUNCTION public.record_manual_metrics(uuid, bigint, bigint, bigint, bigint, smallint, bigint, bigint, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manual_metrics(uuid, bigint, bigint, bigint, bigint, smallint, bigint, bigint, numeric, numeric) TO authenticated, service_role;
