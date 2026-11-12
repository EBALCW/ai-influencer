-- Trend ve viral içerik arşivi (#10). Araştırma kaydı → içerik backlog'u (#57).
--
-- Arşiv formatı #10'daki `research/trends.csv` sütunlarıyla birebir eşleşir; #12'deki
-- `kaynak` sütunu `source` (manual/claude) olarak tutulur. Değerler ASCII anahtar
-- olarak saklanır, Türkçe etiketler ve CSV eşlemeleri panelde
-- (`apps/panel/src/lib/research/`).
--
-- Backlog bağlantısı `trends.content_item_id` üzerindedir: content_items tablosuna
-- kolon eklenmez (başka işlerin content_items migration'larıyla çakışmasın).

CREATE TABLE public.trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = global (her karaktere uyarlanabilir); dolu = o influencer'a özel.
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  captured_on date NOT NULL DEFAULT current_date,
  platform text NOT NULL DEFAULT 'other'
    CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'other')),
  url text NOT NULL CHECK (url ~ '^https?://[^\s/]+' AND length(url) <= 2000),
  account_handle text NOT NULL DEFAULT '' CHECK (length(account_handle) <= 100),
  views bigint CHECK (views >= 0),
  likes bigint CHECK (likes >= 0),
  comments bigint CHECK (comments >= 0),
  duration_s integer CHECK (duration_s BETWEEN 0 AND 36000),
  format text NOT NULL DEFAULT 'other'
    CHECK (format IN ('dance', 'transformation', 'short_film', 'pov', 'meme', 'lip_sync', 'outfit', 'other')),
  hook text NOT NULL DEFAULT '' CHECK (length(hook) <= 500),
  sound text NOT NULL DEFAULT '' CHECK (length(sound) <= 300),
  why_viral text NOT NULL DEFAULT '' CHECK (length(why_viral) <= 1000),
  adaptation_idea text NOT NULL DEFAULT '' CHECK (length(adaptation_idea) <= 2000),
  adaptation_score smallint CHECK (adaptation_score BETWEEN 1 AND 5),
  cost_estimate text CHECK (cost_estimate IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'shortlisted', 'used', 'rejected')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'claude')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 3000),
  content_item_id uuid REFERENCES public.content_items (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);
-- Aynı link aynı kapsamda bir kez arşivlenir (CSV tekrar yüklemesi kopya üretmez).
CREATE UNIQUE INDEX trends_url_scope_idx
  ON public.trends (url, coalesce(influencer_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX trends_status_score_idx ON public.trends (status, adaptation_score DESC NULLS LAST, captured_on DESC);
CREATE INDEX trends_influencer_idx ON public.trends (influencer_id);
CREATE UNIQUE INDEX trends_content_item_idx ON public.trends (content_item_id) WHERE content_item_id IS NOT NULL;

ALTER TABLE public.trends ENABLE ROW LEVEL SECURITY;
CREATE POLICY trends_team_read ON public.trends
  FOR SELECT TO authenticated USING (public.is_team_member());
CREATE POLICY trends_team_write ON public.trends
  FOR ALL TO authenticated USING (public.can_write_data()) WITH CHECK (public.can_write_data());
CREATE TRIGGER trends_set_updated_at BEFORE UPDATE ON public.trends
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trends_set_created_by BEFORE INSERT OR UPDATE ON public.trends
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
REVOKE ALL ON public.trends FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trends TO authenticated;

-- Metinleri kırp; bağlı içerik kartı trendin kapsamıyla uyumlu olmalı.
CREATE FUNCTION public.validate_trend()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE item_influencer uuid;
BEGIN
  NEW.url := trim(NEW.url);
  NEW.account_handle := trim(NEW.account_handle);
  NEW.hook := trim(NEW.hook);
  NEW.sound := trim(NEW.sound);
  NEW.why_viral := trim(NEW.why_viral);
  NEW.adaptation_idea := trim(NEW.adaptation_idea);
  NEW.notes := trim(NEW.notes);
  IF NEW.content_item_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.content_item_id IS DISTINCT FROM OLD.content_item_id) THEN
    SELECT influencer_id INTO item_influencer FROM public.content_items WHERE id = NEW.content_item_id;
    IF item_influencer IS NULL
      OR (NEW.influencer_id IS NOT NULL AND item_influencer IS DISTINCT FROM NEW.influencer_id) THEN
      RAISE EXCEPTION 'İçerik kartı trendle aynı influencer’a ait olmalı.' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trends_validate BEFORE INSERT OR UPDATE ON public.trends
  FOR EACH ROW EXECUTE FUNCTION public.validate_trend();

-- "Backlog'a aktar": trendden `idea` aşamasında içerik kartı oluşturur, trendi
-- `used` yapar ve kartı trende bağlar. Tek transaction; trend satırı kilitlenir,
-- böylece çift tıklama iki kart üretmez. SECURITY INVOKER: çağıranın RLS'i geçerli.
--   P0002 trend yok / görünmüyor · 42501 viewer · 23505 zaten aktarılmış
--   23514 elenmiş trend, influencer uyuşmazlığı · 22023 influencer seçilmemiş
CREATE FUNCTION public.push_trend_to_backlog(
  p_trend_id uuid,
  p_influencer_id uuid DEFAULT NULL,
  p_title text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  t public.trends%ROWTYPE;
  v_target uuid;
  v_item_id uuid;
  v_title text;
BEGIN
  IF NOT public.can_write_data() THEN
    RAISE EXCEPTION 'Editor yetkisi gerekli.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO t FROM public.trends WHERE id = p_trend_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trend bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF t.content_item_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bu trend zaten backlog’a aktarıldı.' USING ERRCODE = '23505';
  END IF;
  IF t.status = 'rejected' THEN
    RAISE EXCEPTION 'Elenmiş trend backlog’a aktarılamaz.' USING ERRCODE = '23514';
  END IF;
  IF t.influencer_id IS NOT NULL AND p_influencer_id IS NOT NULL
    AND p_influencer_id IS DISTINCT FROM t.influencer_id THEN
    RAISE EXCEPTION 'Bu trend başka bir influencer’a özel.' USING ERRCODE = '23514';
  END IF;
  v_target := coalesce(t.influencer_id, p_influencer_id);
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Global trend için influencer seçin.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.influencers WHERE id = v_target) THEN
    RAISE EXCEPTION 'Influencer bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  v_title := left(coalesce(
    nullif(trim(p_title), ''),
    nullif(t.adaptation_idea, ''),
    nullif(t.why_viral, ''),
    'Trend: ' || t.url
  ), 200);

  INSERT INTO public.content_items (
    influencer_id, title, hook_type, stage, source_url, source_views,
    viral_reason, adaptation_score, notes
  )
  VALUES (
    v_target,
    v_title,
    nullif(left(t.hook, 200), ''),
    'idea',
    t.url,
    t.views,
    left(t.why_viral, 3000),
    t.adaptation_score,
    left(concat_ws(E'\n',
      'Trend arşivinden aktarıldı (' || t.platform || ', ' || t.format || ').',
      'Hesap: ' || nullif(t.account_handle, ''),
      'Ses/müzik: ' || nullif(t.sound, ''),
      'Uyarlama fikri: ' || nullif(t.adaptation_idea, ''),
      'Not: ' || nullif(t.notes, '')
    ), 10000)
  )
  RETURNING id INTO v_item_id;

  UPDATE public.trends
  SET status = 'used', content_item_id = v_item_id
  WHERE id = t.id;
  RETURN v_item_id;
END;
$$;
REVOKE ALL ON FUNCTION public.push_trend_to_backlog(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_trend_to_backlog(uuid, uuid, text) TO authenticated;
