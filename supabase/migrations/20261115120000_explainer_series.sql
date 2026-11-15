-- Anlatım modülü: seri ve tekil video modeli (#216, docs/adr/0004-moduler-panel.md → Karar 1).
--
--   series                   seri: ad, tema, tür tercihi, görsel yol + stil, ses, altyazı stili,
--                            dil, varsayılan parametreler, sıradaki bölüm numarası
--   topic_requests           kullanıcının kısa isteği (bir öneri turu)
--   topic_suggestions        isteğe gelen konu önerileri: özet, kanca, ekranda ne var, kanıt düzeyi,
--                            kaynak adayları; yeni / seçildi / elendi
--   episodes                 bölüm ya da tekil video: senaryo, kaynak notları, hassasiyet, senaryo
--                            onayı, seri varsayılanlarının üstüne yazılanlar, dondurulmuş parametreler
--   episode_script_versions  senaryonun her sürümü (değişmez geçmiş; #205 buradan okur)
--   jobs.episode_id          üretim işi ↔ bölüm bağı (#201'de ertelenmişti)
--
-- Kararlar:
-- * İstemcinin beş tabloda YALNIZ SELECT izni vardır. Her yazım `public` INVOKER sarmalayıcı +
--   `internal` DEFINER çekirdek üzerinden geçer; çekirdek alanı `current_workspace_id()` ile
--   kendisi süzer, istemciden çalışma alanı kimliği almaz.
-- * Seri isteğe bağlıdır: `episodes.series_id` boş olabilir. Bölüm numarası yalnız seride vardır
--   ve seri içinde tekildir; numarayı `series.next_episode_number` sayacı verir (satır kilidi),
--   numara yeniden kullanılmaz.
-- * Senaryo onayı (`script_approved_*`) yalnız `approve_episode_script()` ile, owner/editor olan
--   ve makine olarak kaydedilmemiş bir oturumdan yazılır; değerler istemciden alınmaz. Senaryo,
--   kaynak notları, hassasiyet, tür ya da dil değişirse `private.episodes_guard()` onayı kendisi
--   siler ve yeni sürüm açar (service role için de).
-- * Üretim kapısı veritabanındadır: `private.jobs_episode_gate()` anlatım modülünün üretim işini
--   (ön hazırlık türleri dışındaki her `explainer.*`) bölümsüz ya da onaysız / onaydan sonra
--   değişmiş senaryoyla AÇTIRMAZ. `enqueue_job()` bu yüzden anlatım üretim işi açamaz; yol
--   `enqueue_episode_job()`'dır. Üretim açıkken senaryo ve onay kilitlidir; iş, açıldığı senaryo
--   sürümünü taşır (`jobs.episode_script_version`).
-- * Anlatım işlerinin aşamaları SUNUCUDA tanımlıdır (`private.explainer_job_stages`): istemci tür
--   seçer, aşama listesini seçemez. Böylece ön hazırlık türü (araştırma, taslak) ses / render
--   aşaması ya da üretim yeteneği taşıyamaz; tanımsız `explainer.*` türü açılamaz.
-- * Bölüm durumu (`episodes.status`) yazılmaz, hesaplanır: senaryo, onay, bölümün üretim işleri,
--   yayın ve arşiv alanlarından `private.episode_status()` türetir. Geçersiz geçiş diye bir şey
--   kalmaz; iş durumu değişince `jobs` trigger'ı bölümü yeniler.
-- * Seri varsayılanı → bölümde üstüne yazma → işe alınırken dondurma: `enqueue_episode_job()`
--   birleşik parametreleri `jobs.params`'a ve `episodes.params_snapshot`'a yazar.
-- * `content_items` bağı bu migration'da YOK: kart `influencer_id` ister; gevşetme ADR'de ayrı
--   adımdır (#234).
-- * pg_trgm projede açık değil; benzer konu araması normalleştirilmiş başlık eşitliği ve ortak
--   kelime oranıyla yapılır (`find_similar_topics`).

-- ── 1) Saf yardımcılar ──────────────────────────────────────────────────────
-- Başlığın karşılaştırma anahtarı: Türkçe harfler sadeleşir, küçük harf, yalnız harf/rakam.
CREATE FUNCTION internal.topic_key(p_title text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT btrim(regexp_replace(
    lower(translate(left(COALESCE(p_title, ''), 300), 'İIŞĞÜÖÇışğüöçÂâÎîÛû', 'iisguocisguocaaiiuu')),
    '[^a-z0-9]+', ' ', 'g'
  ))
$$;

-- Senaryo onayı gerektirmeyen (ön hazırlık) anlatım iş türleri. Bunların dışındaki her
-- `explainer.*` türü üretim işidir ve onaylı senaryo ister. Liste packages/shared ile aynıdır.
CREATE FUNCTION private.explainer_pre_approval_kinds()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT ARRAY['explainer.topics', 'explainer.script']
$$;

-- Anlatım iş türlerinin SABİT aşama tanımı (sıra, ad, onay gereği). İstemci aşama listesi
-- veremez: tür ne ise aşamalar odur. Tanımsız tür NULL döner ve iş açılamaz. Liste
-- packages/shared → JOB_KINDS ile aynıdır (test denetler); yeni tür ya da aşama yeni migration'da
-- bu fonksiyon yeniden tanımlanarak eklenir.
CREATE FUNCTION private.explainer_job_stages(p_kind text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_kind
    WHEN 'explainer.topics' THEN '[{"key":"research","requires_approval":false}]'::jsonb
    WHEN 'explainer.script' THEN '[{"key":"research","requires_approval":false},{"key":"draft","requires_approval":false}]'::jsonb
    WHEN 'explainer.render' THEN '[{"key":"voice","requires_approval":false},{"key":"captions","requires_approval":false},{"key":"visuals","requires_approval":false},{"key":"render","requires_approval":true}]'::jsonb
  END
$$;

-- Ön hazırlık işi üretim yeteneği isteyemez (ses, altyazı, render, klip, yayın).
CREATE FUNCTION private.explainer_pre_approval_capabilities_ok(p_capabilities text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_capabilities, '{}')) AS c (capability)
    WHERE c.capability ~ '^(voice|captions|render|clip|publish)\.'
  )
$$;

-- Çekirdeklerin ortak yetki denetimi: çağıranın alanı; owner/editor değilse 42501.
CREATE FUNCTION private.require_explainer_writer()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'Bu işlem için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  RETURN v_ws;
END;
$$;

-- Yama nesnesi: yalnız izin verilen alanlar, en çok 64 KB.
CREATE FUNCTION private.assert_patch(p_patch jsonb, p_allowed text[])
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR octet_length(p_patch::text) > 65536 THEN
    RAISE EXCEPTION 'Alanlar bir JSON nesnesi olmalı (en çok 64 KB).' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) AS k WHERE k <> ALL (p_allowed)) THEN
    RAISE EXCEPTION 'Bilinmeyen alan. İzin verilenler: %.', array_to_string(p_allowed, ', ')
      USING ERRCODE = '22023', HINT = 'unknown_field';
  END IF;
END;
$$;

-- Kaynak listesi: [{"title": metin, "url": "http(s)://…", "primary": mantıksal, …}]. Ad ya da
-- adresten en az biri dolu olmalı; adres yalnız http(s) olabilir (arayüzde bağlantı olur).
CREATE FUNCTION private.sources_valid(p_sources jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_typeof(p_sources) = 'array', false) AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_sources) = 'array' THEN p_sources ELSE '[]'::jsonb END)
      AS s (source)
    WHERE jsonb_typeof(s.source) <> 'object'
      OR (s.source ? 'title' AND jsonb_typeof(s.source -> 'title') <> 'string')
      OR (s.source ? 'url' AND jsonb_typeof(s.source -> 'url') <> 'string')
      OR length(COALESCE(s.source ->> 'title', '')) > 300
      OR length(COALESCE(s.source ->> 'url', '')) > 2000
      OR (s.source ? 'url' AND (s.source ->> 'url') !~ '^https?://[^[:space:]]+$')
      OR length(btrim(COALESCE(s.source ->> 'title', '') || COALESCE(s.source ->> 'url', ''))) = 0
  )
$$;

-- Kaynak notları: [{"claim": metin, "sources": [{"title": metin, "url": metin, …}], …}].
-- Biçimi doğrular ve iki kaynaktan azı olan iddiaların sayısını döndürür.
CREATE FUNCTION private.fact_notes_unsourced(p_notes jsonb)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_notes IS NULL OR jsonb_typeof(p_notes) <> 'array' THEN
    RAISE EXCEPTION 'Kaynak notları bir dizi olmalı.' USING ERRCODE = '22023', HINT = 'fact_notes_invalid';
  END IF;
  IF jsonb_array_length(p_notes) > 200 OR octet_length(p_notes::text) > 65536 THEN
    RAISE EXCEPTION 'Kaynak notları en çok 200 iddia ve 64 KB olabilir.'
      USING ERRCODE = '22023', HINT = 'fact_notes_invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_notes) AS n (note)
    WHERE jsonb_typeof(n.note) <> 'object'
      OR jsonb_typeof(n.note -> 'claim') IS DISTINCT FROM 'string'
      OR length(btrim(n.note ->> 'claim')) NOT BETWEEN 1 AND 1000
      OR (n.note ? 'sources' AND jsonb_typeof(n.note -> 'sources') <> 'array')
  ) THEN
    RAISE EXCEPTION 'Her kaynak notu {"claim": metin (1-1000), "sources": dizi} biçiminde olmalı.'
      USING ERRCODE = '22023', HINT = 'fact_notes_invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_notes) AS n (note)
    WHERE jsonb_array_length(COALESCE(n.note -> 'sources', '[]'::jsonb)) > 10
  ) THEN
    RAISE EXCEPTION 'Bir iddiaya en çok 10 kaynak yazılabilir.'
      USING ERRCODE = '22023', HINT = 'fact_notes_invalid';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_notes) AS n (note)
    WHERE NOT private.sources_valid(COALESCE(n.note -> 'sources', '[]'::jsonb))
  ) THEN
    RAISE EXCEPTION 'Her kaynak {"title": metin, "url": "http(s)://…"} biçiminde olmalı (en az biri dolu).'
      USING ERRCODE = '22023', HINT = 'fact_notes_invalid';
  END IF;
  RETURN (
    SELECT count(*)::integer FROM jsonb_array_elements(p_notes) AS n (note)
    WHERE jsonb_array_length(COALESCE(n.note -> 'sources', '[]'::jsonb)) < 2
  );
END;
$$;

-- ── 2) Tablolar ─────────────────────────────────────────────────────────────
CREATE TABLE public.series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT public.current_workspace_id()
    REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120 AND length(name) <= 120),
  theme text NOT NULL DEFAULT '' CHECK (length(theme) <= 2000),
  kind text,
  visual_route text,
  style_key text,
  voice_provider text,
  voice_name text,
  voice_rate text,
  caption_style jsonb NOT NULL DEFAULT '{}'::jsonb,
  language text NOT NULL DEFAULT 'tr',
  default_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  next_episode_number integer NOT NULL DEFAULT 1 CHECK (next_episode_number >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT series_kind_known CHECK (kind IS NULL OR kind IN ('event', 'how_it_works')),
  CONSTRAINT series_visual_route_known
    CHECK (visual_route IS NULL OR visual_route IN ('skia', 'hyperframes', 'blender', 'stock', 'meme')),
  CONSTRAINT series_status_known CHECK (status IN ('active', 'archived')),
  CONSTRAINT series_style_key_valid CHECK (style_key IS NULL OR style_key ~ '^[a-z0-9][a-z0-9_.-]{0,79}$'),
  CONSTRAINT series_voice_provider_valid
    CHECK (voice_provider IS NULL OR voice_provider ~ '^[a-z0-9][a-z0-9_.-]{0,39}$'),
  CONSTRAINT series_voice_name_valid
    CHECK (voice_name IS NULL OR (length(btrim(voice_name)) >= 1 AND length(voice_name) <= 80)),
  CONSTRAINT series_voice_rate_valid CHECK (voice_rate IS NULL OR voice_rate ~ '^[+-][0-9]{1,3}%$'),
  CONSTRAINT series_language_valid CHECK (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT series_caption_style_bounded
    CHECK (jsonb_typeof(caption_style) = 'object' AND octet_length(caption_style::text) <= 8192),
  CONSTRAINT series_default_params_bounded
    CHECK (jsonb_typeof(default_params) = 'object' AND octet_length(default_params::text) <= 16384)
);
CREATE INDEX series_workspace_id_idx ON public.series (workspace_id);
-- Ad alan içinde tekildir; büyük/küçük harf, Türkçe harf ve noktalama farkı ayrı ad sayılmaz.
CREATE UNIQUE INDEX series_workspace_name_key ON public.series (workspace_id, internal.topic_key(name));

COMMENT ON TABLE public.series IS
  'Anlatım serisi (#216): bölümlerin ortak varsayılanları. İsteğe bağlıdır; tekil video seri istemez. Yalnız RPC yazar.';
COMMENT ON COLUMN public.series.kind IS 'Tür tercihi: event (olay) | how_it_works (nasıl çalışır). Boşsa bölüm kendi türünü söyler.';
COMMENT ON COLUMN public.series.visual_route IS 'Varsayılan görsel yol; bölümde üstüne yazılabilir, işe alınırken dondurulur.';
COMMENT ON COLUMN public.series.style_key IS 'Görsel yolun stil anahtarı (ör. film-styles görünümü).';
COMMENT ON COLUMN public.series.voice_rate IS 'Konuşma hızı, edge-tts biçiminde (ör. +8%).';
COMMENT ON COLUMN public.series.default_params IS 'Serbest varsayılan parametreler (en çok 16 KB); bölümün params''ı üstüne yazar. Sır yazılmaz.';
COMMENT ON COLUMN public.series.next_episode_number IS 'Sıradaki bölüm numarası. Yalnız bölüm oluşturan çekirdek artırır; numara yeniden kullanılmaz.';

CREATE TABLE public.topic_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT public.current_workspace_id()
    REFERENCES public.workspaces (id) ON DELETE CASCADE,
  series_id uuid REFERENCES public.series (id),
  prompt text NOT NULL CHECK (length(btrim(prompt)) BETWEEN 1 AND 2000 AND length(prompt) <= 2000),
  kind text,
  language text NOT NULL DEFAULT 'tr',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT topic_requests_kind_known CHECK (kind IS NULL OR kind IN ('event', 'how_it_works')),
  CONSTRAINT topic_requests_language_valid CHECK (language ~ '^[a-z]{2}(-[A-Z]{2})?$')
);
CREATE INDEX topic_requests_workspace_id_idx ON public.topic_requests (workspace_id);
CREATE INDEX topic_requests_workspace_created_idx ON public.topic_requests (workspace_id, created_at DESC);
CREATE INDEX topic_requests_series_idx ON public.topic_requests (series_id) WHERE series_id IS NOT NULL;

COMMENT ON TABLE public.topic_requests IS
  'Kısa istek (#216, #217): kullanıcının yazdığı alan ya da soru ve o tura ait öneriler. Yalnız RPC yazar.';
COMMENT ON COLUMN public.topic_requests.kind IS 'Tür tercihi; boşsa öneriler iki türü karıştırır.';

CREATE TABLE public.topic_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT public.current_workspace_id()
    REFERENCES public.workspaces (id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.topic_requests (id) ON DELETE CASCADE,
  -- İsteğin serisinin kopyası (seriye göre süzmek için); trigger eşit tutar.
  series_id uuid REFERENCES public.series (id),
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 20),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200 AND length(title) <= 200),
  title_key text GENERATED ALWAYS AS (internal.topic_key(title)) STORED,
  summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 2000),
  hook text NOT NULL DEFAULT '' CHECK (length(hook) <= 500),
  visual_idea text NOT NULL DEFAULT '' CHECK (length(visual_idea) <= 2000),
  kind text NOT NULL,
  evidence_level text NOT NULL DEFAULT 'original',
  evidence_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  sensitivity_note text CHECK (sensitivity_note IS NULL OR length(sensitivity_note) <= 500),
  status text NOT NULL DEFAULT 'new',
  decided_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  decided_at timestamptz,
  rejection_reason text CHECK (rejection_reason IS NULL OR length(rejection_reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT topic_suggestions_kind_known CHECK (kind IN ('event', 'how_it_works')),
  CONSTRAINT topic_suggestions_evidence_level_known
    CHECK (evidence_level IN ('proven', 'format_example', 'original')),
  CONSTRAINT topic_suggestions_status_known CHECK (status IN ('new', 'picked', 'rejected')),
  CONSTRAINT topic_suggestions_evidence_detail_bounded
    CHECK (jsonb_typeof(evidence_detail) = 'object' AND octet_length(evidence_detail::text) <= 4096),
  CONSTRAINT topic_suggestions_source_candidates_bounded CHECK (
    jsonb_typeof(source_candidates) = 'array'
    AND jsonb_array_length(source_candidates) <= 10
    AND octet_length(source_candidates::text) <= 8192
  ),
  CONSTRAINT topic_suggestions_decision_consistent CHECK ((status = 'new') = (decided_at IS NULL)),
  CONSTRAINT topic_suggestions_request_position_key UNIQUE (request_id, position)
);
CREATE INDEX topic_suggestions_workspace_id_idx ON public.topic_suggestions (workspace_id);
CREATE INDEX topic_suggestions_series_idx ON public.topic_suggestions (series_id) WHERE series_id IS NOT NULL;
CREATE INDEX topic_suggestions_title_key_idx ON public.topic_suggestions (workspace_id, title_key);

COMMENT ON TABLE public.topic_suggestions IS
  'Konu önerisi (#216, #217). Seçilen öneri bölüme dönüşür (episodes.suggestion_id); elenenler saklanır. Yalnız RPC yazar.';
COMMENT ON COLUMN public.topic_suggestions.visual_idea IS 'Ekranda ne gösterilecek: çizilecek 3-5 şey ve yapılabilirlik notu.';
COMMENT ON COLUMN public.topic_suggestions.evidence_level IS
  'proven (kanıtlı: kanalın kendi ortancasının en az 3 katı) | format_example (format örneği) | original (özgün). Olguların doğruluğunu söylemez.';
COMMENT ON COLUMN public.topic_suggestions.evidence_detail IS 'Kanıt ayrıntısı: izlenme, ortanca, örnek sayısı, yayın ve bakış tarihi, adres (en çok 4 KB).';
COMMENT ON COLUMN public.topic_suggestions.source_candidates IS 'Kaynak adayları dizisi (en çok 10; ör. {"title", "url", "primary"}).';
COMMENT ON COLUMN public.topic_suggestions.title_key IS 'Benzer konu araması için normalleştirilmiş başlık.';

CREATE TABLE public.episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT public.current_workspace_id()
    REFERENCES public.workspaces (id) ON DELETE CASCADE,
  series_id uuid REFERENCES public.series (id),
  episode_number integer CHECK (episode_number IS NULL OR episode_number >= 1),
  suggestion_id uuid REFERENCES public.topic_suggestions (id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200 AND length(title) <= 200),
  title_key text GENERATED ALWAYS AS (internal.topic_key(title)) STORED,
  kind text NOT NULL,
  language text NOT NULL DEFAULT 'tr',
  summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 2000),
  hook text NOT NULL DEFAULT '' CHECK (length(hook) <= 500),
  visual_idea text NOT NULL DEFAULT '' CHECK (length(visual_idea) <= 2000),
  -- Senaryo paketi: bunlardan biri (ya da tür / dil) değişirse yeni sürüm açılır, onay silinir.
  script_text text NOT NULL DEFAULT '' CHECK (length(script_text) <= 20000),
  script jsonb,
  fact_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  unsourced_claim_count integer NOT NULL DEFAULT 0 CHECK (unsourced_claim_count >= 0),
  sensitivity_flags text[] NOT NULL DEFAULT '{}',
  sensitivity_note text CHECK (sensitivity_note IS NULL OR length(sensitivity_note) <= 1000),
  script_version integer NOT NULL DEFAULT 0 CHECK (script_version BETWEEN 0 AND 1000),
  script_approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  script_approved_at timestamptz,
  script_approved_version integer,
  script_approved_with_gaps boolean NOT NULL DEFAULT false,
  -- Seri varsayılanlarının üstüne yazılanlar (NULL = seriden gelir).
  visual_route text,
  style_key text,
  voice_provider text,
  voice_name text,
  voice_rate text,
  caption_style jsonb,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  params_snapshot jsonb,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT episodes_kind_known CHECK (kind IN ('event', 'how_it_works')),
  CONSTRAINT episodes_visual_route_known
    CHECK (visual_route IS NULL OR visual_route IN ('skia', 'hyperframes', 'blender', 'stock', 'meme')),
  CONSTRAINT episodes_status_known CHECK (
    status IN ('draft', 'script_ready', 'script_approved', 'in_production', 'ready_for_review', 'approved', 'published', 'archived')
  ),
  CONSTRAINT episodes_sensitivity_flags_known CHECK (
    sensitivity_flags <@ ARRAY['real_event', 'loss_of_life', 'injury', 'minors', 'crime', 'ongoing_investigation', 'private_individuals']
    AND cardinality(sensitivity_flags) <= 7
    AND array_position(sensitivity_flags, NULL) IS NULL
  ),
  CONSTRAINT episodes_number_iff_series CHECK ((series_id IS NULL) = (episode_number IS NULL)),
  CONSTRAINT episodes_series_number_key UNIQUE (series_id, episode_number),
  CONSTRAINT episodes_suggestion_key UNIQUE (suggestion_id),
  CONSTRAINT episodes_language_valid CHECK (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT episodes_style_key_valid CHECK (style_key IS NULL OR style_key ~ '^[a-z0-9][a-z0-9_.-]{0,79}$'),
  CONSTRAINT episodes_voice_provider_valid
    CHECK (voice_provider IS NULL OR voice_provider ~ '^[a-z0-9][a-z0-9_.-]{0,39}$'),
  CONSTRAINT episodes_voice_name_valid
    CHECK (voice_name IS NULL OR (length(btrim(voice_name)) >= 1 AND length(voice_name) <= 80)),
  CONSTRAINT episodes_voice_rate_valid CHECK (voice_rate IS NULL OR voice_rate ~ '^[+-][0-9]{1,3}%$'),
  CONSTRAINT episodes_caption_style_bounded CHECK (
    caption_style IS NULL
    OR (jsonb_typeof(caption_style) = 'object' AND octet_length(caption_style::text) <= 8192)
  ),
  CONSTRAINT episodes_params_bounded
    CHECK (jsonb_typeof(params) = 'object' AND octet_length(params::text) <= 16384),
  CONSTRAINT episodes_params_snapshot_bounded CHECK (
    params_snapshot IS NULL
    OR (jsonb_typeof(params_snapshot) = 'object' AND octet_length(params_snapshot::text) <= 65536)
  ),
  CONSTRAINT episodes_script_bounded CHECK (
    script IS NULL OR (jsonb_typeof(script) = 'object' AND octet_length(script::text) <= 131072)
  ),
  -- Onay üç kolonla birlikte vardır ve yalnız geçerli sürüme aittir.
  CONSTRAINT episodes_script_approval_consistent CHECK (
    (script_approved_at IS NULL AND script_approved_version IS NULL AND script_approved_by IS NULL
      AND NOT script_approved_with_gaps)
    OR (script_approved_at IS NOT NULL AND script_approved_version = script_version)
  )
);
CREATE INDEX episodes_workspace_id_idx ON public.episodes (workspace_id);
CREATE INDEX episodes_workspace_created_idx ON public.episodes (workspace_id, created_at DESC);
CREATE INDEX episodes_workspace_status_idx ON public.episodes (workspace_id, status);
CREATE INDEX episodes_title_key_idx ON public.episodes (workspace_id, title_key);

COMMENT ON TABLE public.episodes IS
  'Anlatım bölümü ya da tekil video (#216). series_id boşsa tekildir ve numarası yoktur. Yalnız RPC yazar.';
COMMENT ON COLUMN public.episodes.episode_number IS 'Seri içindeki numara (Bölüm 1, 2, 3…); seri içinde tekil, tekil videoda boş.';
COMMENT ON COLUMN public.episodes.script_text IS 'Anlatıcı metni (en çok 20 000 karakter).';
COMMENT ON COLUMN public.episodes.script IS 'Yapılandırılmış senaryo (motorun script.json''u; en çok 128 KB). İsteğe bağlı.';
COMMENT ON COLUMN public.episodes.fact_notes IS
  'İddia → kaynak tablosu: [{"claim", "sources": [{"title", "url", "primary"}], "note", "cautious_wording"}] (en çok 200 iddia, 64 KB).';
COMMENT ON COLUMN public.episodes.unsourced_claim_count IS 'İki kaynaktan azı olan iddia sayısı. Trigger hesaplar.';
COMMENT ON COLUMN public.episodes.script_version IS 'Senaryo paketinin sürümü; içerik her değiştiğinde trigger artırır (0 = hiç yazılmadı).';
COMMENT ON COLUMN public.episodes.script_approved_at IS
  'Yalnız approve_episode_script() ile yazılır; trigger oturumu denetler, script_approved_by''ı auth.uid()''den doldurur. Senaryo değişince silinir.';
COMMENT ON COLUMN public.episodes.script_approved_with_gaps IS 'Onay, kaynak eksiği (iki kaynaksız iddia ya da boş not) bilinerek verildi.';
COMMENT ON COLUMN public.episodes.params IS 'Serbest parametreler; serinin default_params''ının üstüne yazılır (en çok 16 KB). Sır yazılmaz.';
COMMENT ON COLUMN public.episodes.params_snapshot IS 'Son üretim işine dondurulan birleşik parametreler (jobs.params ile aynı).';
COMMENT ON COLUMN public.episodes.status IS
  'Hesaplanır (private.episode_status): draft → script_ready → script_approved → in_production → ready_for_review → approved → published | archived.';
COMMENT ON COLUMN public.episodes.published_at IS 'Yayın akışı (#234) yazar; yalnız onaylı (approved) bölümde dolabilir.';

CREATE TABLE public.episode_script_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL DEFAULT public.current_workspace_id()
    REFERENCES public.workspaces (id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES public.episodes (id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version >= 1),
  kind text NOT NULL,
  language text NOT NULL,
  script_text text NOT NULL,
  script jsonb,
  fact_notes jsonb NOT NULL,
  unsourced_claim_count integer NOT NULL,
  sensitivity_flags text[] NOT NULL,
  sensitivity_note text,
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  approved_with_gaps boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT episode_script_versions_episode_version_key UNIQUE (episode_id, version)
);
CREATE INDEX episode_script_versions_workspace_id_idx ON public.episode_script_versions (workspace_id);

COMMENT ON TABLE public.episode_script_versions IS
  'Senaryonun her sürümü (#216; #205 sürüm geçmişi ve karşılaştırma buradan okur). Trigger yazar; içerik değişmez.';
COMMENT ON COLUMN public.episode_script_versions.approved_at IS 'Bu sürüm onaylandıysa onay anı; sürüm sonradan değişse de geçmişte kalır.';

-- ── 3) jobs.episode_id ──────────────────────────────────────────────────────
ALTER TABLE public.jobs
  ADD COLUMN episode_id uuid REFERENCES public.episodes (id) ON DELETE SET NULL,
  ADD COLUMN episode_script_version integer,
  ADD CONSTRAINT jobs_episode_module CHECK (episode_id IS NULL OR module = 'explainer'),
  ADD CONSTRAINT jobs_single_owner CHECK (episode_id IS NULL OR clip_source_id IS NULL);
CREATE INDEX jobs_episode_idx ON public.jobs (episode_id) WHERE episode_id IS NOT NULL;

COMMENT ON COLUMN public.jobs.episode_id IS 'Sahip bölüm (anlatım modülü). Üretim işi bölümsüz açılamaz (private.jobs_episode_gate).';
COMMENT ON COLUMN public.jobs.episode_script_version IS 'İşin açıldığı senaryo sürümü; trigger bölümden yazar.';

-- ── 4) RLS, izinler, çalışma alanı ──────────────────────────────────────────
-- Ekip okur. Yazma policy'si ve yazma izni yok: her değişiklik RPC çekirdeğinden geçer.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['series', 'topic_requests', 'topic_suggestions', 'episodes', 'episode_script_versions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_team_member())',
      t || '_team_read', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (workspace_id = (SELECT public.current_workspace_id())) '
      'WITH CHECK (workspace_id = (SELECT public.current_workspace_id()))',
      t || '_workspace', t
    );
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
  END LOOP;
END;
$$;

CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.series
  FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent();
CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.topic_requests
  FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent('series_id=series.id');
CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.topic_suggestions
  FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent(
    'request_id=topic_requests.id', '?series_id=series.id'
  );
CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent(
    'series_id=series.id', '?suggestion_id=topic_suggestions.id'
  );
CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.episode_script_versions
  FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent('episode_id=episodes.id');

-- jobs: bölüm de aynı alanda olmalı (FK kısıtı RLS'e bakmaz).
DROP TRIGGER aa_set_workspace ON public.jobs;
CREATE TRIGGER aa_set_workspace BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION private.set_workspace_from_parent(
    '?clip_source_id=clip_sources.id', '?worker_id=production_workers.id', '?retry_of=jobs.id',
    '?episode_id=episodes.id'
  );

CREATE TRIGGER series_set_updated_at BEFORE UPDATE ON public.series
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER series_set_created_by BEFORE INSERT OR UPDATE ON public.series
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER topic_requests_set_updated_at BEFORE UPDATE ON public.topic_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER topic_requests_set_created_by BEFORE INSERT OR UPDATE ON public.topic_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER topic_suggestions_set_updated_at BEFORE UPDATE ON public.topic_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER topic_suggestions_set_created_by BEFORE INSERT OR UPDATE ON public.topic_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER episodes_set_updated_at BEFORE UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER episodes_set_created_by BEFORE INSERT OR UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();
CREATE TRIGGER episode_script_versions_set_created_by BEFORE INSERT OR UPDATE ON public.episode_script_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- ── 5) Bölüm durumu (hesaplanır) ────────────────────────────────────────────
--   archived          arşivlendi
--   published         yayınlandı (yalnız approved iken yazılabilir)
--   draft             senaryo metni yok
--   script_ready      senaryo var, onay bekliyor (ya da onaydan sonra değişti)
--   script_approved   senaryo onaylı, geçerli sürüm için açık üretim işi yok
--   in_production     geçerli sürümün üretim işi sırada ya da çalışıyor
--   ready_for_review  üretim işi bir aşamada onay bekliyor
--   approved          üretim işi sonuna kadar bitti ve son aşaması onaylandı
-- Yalnız geçerli senaryo sürümüyle açılmış üretim işleri sayılır; ön hazırlık işleri sayılmaz.
CREATE FUNCTION private.episode_status(e public.episodes)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF e.archived_at IS NOT NULL THEN
    RETURN 'archived';
  ELSIF e.published_at IS NOT NULL THEN
    RETURN 'published';
  ELSIF btrim(e.script_text) = '' THEN
    RETURN 'draft';
  ELSIF e.script_approved_at IS NULL THEN
    RETURN 'script_ready';
  END IF;
  RETURN COALESCE(
    (
      SELECT CASE
        WHEN bool_or(j.status IN ('queued', 'running')) THEN 'in_production'
        WHEN bool_or(j.status = 'awaiting_approval') THEN 'ready_for_review'
        WHEN bool_or(
          j.status = 'succeeded' AND j.stop_at IS NULL AND EXISTS (
            SELECT 1 FROM public.job_stages s
            WHERE s.job_id = j.id AND s.status = 'succeeded' AND s.approved_at IS NOT NULL
              AND s.seq = (SELECT max(m.seq) FROM public.job_stages m WHERE m.job_id = j.id)
          )
        ) THEN 'approved'
      END
      FROM public.jobs j
      WHERE j.episode_id = e.id
        AND j.episode_script_version = e.script_version
        AND NOT (j.kind = ANY (private.explainer_pre_approval_kinds()))
    ),
    'script_approved'
  );
END;
$$;

-- Bölümün bitmemiş (sırada, çalışan ya da onay bekleyen) üretim işi var mı?
CREATE FUNCTION private.episode_has_open_job(p_episode_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.episode_id = p_episode_id
      AND j.status IN ('queued', 'running', 'awaiting_approval')
      AND NOT (j.kind = ANY (private.explainer_pre_approval_kinds()))
  )
$$;

-- ── 6) Bölüm trigger'ı: sürüm, onay, durum (tek doğruluk kaynağı) ───────────
CREATE FUNCTION private.episodes_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.script_approved_at IS NOT NULL OR NEW.script_approved_by IS NOT NULL
      OR NEW.script_approved_version IS NOT NULL OR NEW.script_approved_with_gaps
      OR NEW.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Yeni bölüm onaysız ve yayınlanmamış açılır.'
        USING ERRCODE = '42501', HINT = 'approval_not_writable';
    END IF;
    NEW.unsourced_claim_count := private.fact_notes_unsourced(NEW.fact_notes);
    NEW.script_version := CASE
      WHEN btrim(NEW.script_text) <> '' OR NEW.script IS NOT NULL OR NEW.fact_notes <> '[]'::jsonb
      THEN 1 ELSE 0
    END;
    NEW.params_snapshot := NULL;
    NEW.status := private.episode_status(NEW);
    RETURN NEW;
  END IF;

  -- Öneri bağı yalnız kopabilir (öneri silinince NULL).
  IF NEW.suggestion_id IS DISTINCT FROM OLD.suggestion_id AND NEW.suggestion_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bölümün önerisi sonradan değiştirilemez.' USING ERRCODE = '55000';
  END IF;

  v_changed := ROW(NEW.script_text, NEW.script, NEW.fact_notes, NEW.sensitivity_flags,
                   NEW.sensitivity_note, NEW.kind, NEW.language)
    IS DISTINCT FROM
    ROW(OLD.script_text, OLD.script, OLD.fact_notes, OLD.sensitivity_flags,
        OLD.sensitivity_note, OLD.kind, OLD.language);

  IF v_changed THEN
    -- Üretim sürerken, yayından sonra ya da arşivde senaryo değişmez.
    IF OLD.archived_at IS NOT NULL OR OLD.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Arşivlenmiş ya da yayınlanmış bölümün senaryosu değiştirilemez.'
        USING ERRCODE = '55000', HINT = 'episode_locked';
    END IF;
    IF private.episode_has_open_job(OLD.id) THEN
      RAISE EXCEPTION 'Üretim sürerken senaryo değiştirilemez; önce işi iptal edin.'
        USING ERRCODE = '55000', HINT = 'episode_in_production';
    END IF;
    IF OLD.script_version >= 1000 THEN
      RAISE EXCEPTION 'Bir bölüm en çok 1000 senaryo sürümü tutar.' USING ERRCODE = '54000';
    END IF;
    NEW.unsourced_claim_count := private.fact_notes_unsourced(NEW.fact_notes);
    NEW.script_version := OLD.script_version + 1;
    -- Onay yalnız onaylanan sürüme aittir: içerik değişince silinir.
    NEW.script_approved_by := NULL;
    NEW.script_approved_at := NULL;
    NEW.script_approved_version := NULL;
    NEW.script_approved_with_gaps := false;
  ELSE
    NEW.script_version := OLD.script_version;
    NEW.unsourced_claim_count := OLD.unsourced_claim_count;

    IF NEW.script_approved_at IS DISTINCT FROM OLD.script_approved_at THEN
      IF NEW.script_approved_at IS NULL THEN
        -- Onayı geri almak her zaman güvenlidir; yalnız üretim sürerken yapılamaz.
        IF private.episode_has_open_job(OLD.id) THEN
          RAISE EXCEPTION 'Üretim sürerken senaryo onayı geri alınamaz; önce işi iptal edin.'
            USING ERRCODE = '55000', HINT = 'episode_in_production';
        END IF;
        NEW.script_approved_by := NULL;
        NEW.script_approved_version := NULL;
        NEW.script_approved_with_gaps := false;
      ELSE
        IF OLD.script_approved_at IS NOT NULL THEN
          RAISE EXCEPTION 'Verilmiş onay değiştirilemez.' USING ERRCODE = '55000', HINT = 'already_approved';
        END IF;
        IF OLD.archived_at IS NOT NULL OR NEW.archived_at IS NOT NULL OR btrim(NEW.script_text) = '' THEN
          RAISE EXCEPTION 'Yalnız senaryosu yazılmış, arşivlenmemiş bölüm onaylanabilir.'
            USING ERRCODE = '55000', HINT = 'script_not_ready';
        END IF;
        IF v_uid IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.team_members m
          WHERE m.user_id = v_uid AND m.workspace_id = NEW.workspace_id AND m.role IN ('owner', 'editor')
        ) THEN
          RAISE EXCEPTION 'Senaryoyu yalnız çalışma alanının owner ya da editörü onaylayabilir.'
            USING ERRCODE = '42501';
        END IF;
        -- TODO(#211): session_id claim'i gerçek oturumla doğrulanacak (bkz. production_jobs).
        IF private.current_session_id() IS NULL OR private.is_worker_session() THEN
          RAISE EXCEPTION 'Üretim makinesi oturumu onay veremez.'
            USING ERRCODE = '42501', HINT = 'worker_session';
        END IF;
        IF (NEW.unsourced_claim_count > 0 OR NEW.fact_notes = '[]'::jsonb)
          AND NOT COALESCE(NEW.script_approved_with_gaps, false) THEN
          RAISE EXCEPTION 'Kaynak eksiği var (iki kaynaksız iddia ya da boş kaynak notu); onay için bunu bilerek kabul edin.'
            USING ERRCODE = '23514', HINT = 'fact_gaps';
        END IF;
        NEW.script_approved_by := v_uid;
        NEW.script_approved_at := now();
        NEW.script_approved_version := NEW.script_version;
        NEW.script_approved_with_gaps := (NEW.unsourced_claim_count > 0 OR NEW.fact_notes = '[]'::jsonb);
      END IF;
    ELSIF (NEW.script_approved_by IS DISTINCT FROM OLD.script_approved_by AND NEW.script_approved_by IS NOT NULL)
      OR NEW.script_approved_version IS DISTINCT FROM OLD.script_approved_version
      OR NEW.script_approved_with_gaps IS DISTINCT FROM OLD.script_approved_with_gaps THEN
      RAISE EXCEPTION 'Onay alanları yalnız approve_episode_script() ile yazılır.'
        USING ERRCODE = '42501', HINT = 'approval_not_writable';
    END IF;
  END IF;

  -- Yayın yalnız onaylı (approved) bölümde işaretlenir.
  IF NEW.published_at IS DISTINCT FROM OLD.published_at AND NEW.published_at IS NOT NULL
    AND OLD.status <> 'approved' THEN
    RAISE EXCEPTION 'Yalnız videosu onaylanmış bölüm yayınlandı olarak işaretlenir.'
      USING ERRCODE = '55000', HINT = 'episode_not_approved';
  END IF;

  NEW.status := private.episode_status(NEW);
  RETURN NEW;
END;
$$;

-- Her yeni senaryo sürümü geçmişe yazılır; onay verilince sürüm satırına işlenir.
CREATE FUNCTION private.episodes_record_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.script_version > 0 AND (TG_OP = 'INSERT' OR NEW.script_version <> OLD.script_version) THEN
    INSERT INTO public.episode_script_versions (
      workspace_id, episode_id, version, kind, language, script_text, script, fact_notes,
      unsourced_claim_count, sensitivity_flags, sensitivity_note
    )
    VALUES (
      NEW.workspace_id, NEW.id, NEW.script_version, NEW.kind, NEW.language, NEW.script_text,
      NEW.script, NEW.fact_notes, NEW.unsourced_claim_count, NEW.sensitivity_flags,
      NEW.sensitivity_note
    );
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.script_approved_at IS NOT NULL AND OLD.script_approved_at IS NULL THEN
    UPDATE public.episode_script_versions
    SET approved_by = NEW.script_approved_by, approved_at = NEW.script_approved_at,
        approved_with_gaps = NEW.script_approved_with_gaps
    WHERE episode_id = NEW.id AND version = NEW.script_version;
  END IF;
  RETURN NULL;
END;
$$;

-- Sürüm satırı değişmez; onay yalnız bölümün geçerli onayıyla aynıysa ve bir kez yazılır.
CREATE FUNCTION private.episode_script_versions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.approved_at IS NOT NULL OR NEW.approved_by IS NOT NULL OR NEW.approved_with_gaps THEN
      RAISE EXCEPTION 'Sürüm onaysız açılır.' USING ERRCODE = '42501', HINT = 'approval_not_writable';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.episodes e
      WHERE e.id = NEW.episode_id AND e.script_version = NEW.version
        AND ROW(e.kind, e.language, e.script_text, e.script, e.fact_notes, e.sensitivity_flags, e.sensitivity_note)
          IS NOT DISTINCT FROM
          ROW(NEW.kind, NEW.language, NEW.script_text, NEW.script, NEW.fact_notes, NEW.sensitivity_flags, NEW.sensitivity_note)
    ) THEN
      RAISE EXCEPTION 'Sürüm yalnız bölümün geçerli senaryosundan yazılır.'
        USING ERRCODE = '55000', HINT = 'version_immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(NEW.episode_id, NEW.version, NEW.kind, NEW.language, NEW.script_text, NEW.script,
         NEW.fact_notes, NEW.unsourced_claim_count, NEW.sensitivity_flags, NEW.sensitivity_note,
         NEW.created_at)
       IS DISTINCT FROM
     ROW(OLD.episode_id, OLD.version, OLD.kind, OLD.language, OLD.script_text, OLD.script,
         OLD.fact_notes, OLD.unsourced_claim_count, OLD.sensitivity_flags, OLD.sensitivity_note,
         OLD.created_at) THEN
    RAISE EXCEPTION 'Senaryo sürümü değiştirilemez.' USING ERRCODE = '55000', HINT = 'version_immutable';
  END IF;
  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.approved_with_gaps IS DISTINCT FROM OLD.approved_with_gaps
    OR (NEW.approved_by IS DISTINCT FROM OLD.approved_by AND NEW.approved_by IS NOT NULL) THEN
    IF OLD.approved_at IS NOT NULL OR NOT EXISTS (
      SELECT 1 FROM public.episodes e
      WHERE e.id = NEW.episode_id AND e.script_approved_version = NEW.version
        AND e.script_approved_at IS NOT DISTINCT FROM NEW.approved_at
        AND e.script_approved_by IS NOT DISTINCT FROM NEW.approved_by
        AND e.script_approved_with_gaps = NEW.approved_with_gaps
    ) THEN
      RAISE EXCEPTION 'Sürüm onayı yalnız bölümün onayından yazılır.'
        USING ERRCODE = '42501', HINT = 'approval_not_writable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER episodes_guard BEFORE INSERT OR UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION private.episodes_guard();
CREATE TRIGGER episodes_record_version AFTER INSERT OR UPDATE ON public.episodes
  FOR EACH ROW EXECUTE FUNCTION private.episodes_record_version();
CREATE TRIGGER episode_script_versions_guard BEFORE INSERT OR UPDATE ON public.episode_script_versions
  FOR EACH ROW EXECUTE FUNCTION private.episode_script_versions_guard();

-- Önerinin serisi isteğinkiyle aynıdır.
CREATE FUNCTION private.topic_suggestions_sync_series()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.series_id := (SELECT r.series_id FROM public.topic_requests r WHERE r.id = NEW.request_id);
  RETURN NEW;
END;
$$;
-- Adı "a0_" ile başlar: aa_set_workspace'ten ÖNCE çalışır, alan denetimi doğru seriyi görür.
CREATE TRIGGER a0_sync_series BEFORE INSERT OR UPDATE ON public.topic_suggestions
  FOR EACH ROW EXECUTE FUNCTION private.topic_suggestions_sync_series();

-- ── 7) Üretim kapısı: jobs ↔ episodes ───────────────────────────────────────
-- INSERT: anlatım modülünün üretim işi bir bölüme bağlı olmalı ve o bölümün senaryosu onaylı,
-- onaydan beri değişmemiş olmalı. Ön hazırlık türleri (private.explainer_pre_approval_kinds)
-- bölümsüz ya da onaysız bölümle açılabilir. UPDATE: bağ yalnız kopabilir (bölüm silinince).
-- Kural service role ve postgres için de geçerlidir.
CREATE FUNCTION private.jobs_episode_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  e public.episodes;
  v_pre boolean;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.episode_id IS DISTINCT FROM OLD.episode_id AND NEW.episode_id IS NOT NULL)
      OR NEW.episode_script_version IS DISTINCT FROM OLD.episode_script_version THEN
      RAISE EXCEPTION 'İşin bölümü ve senaryo sürümü sonradan değiştirilemez.'
        USING ERRCODE = '55000', HINT = 'job_immutable';
    END IF;
    RETURN NEW;
  END IF;

  -- Modül / tür uyumsuzluğunu jobs CHECK'leri reddeder; kapı yalnız anlatım işine bakar.
  IF NEW.module IS DISTINCT FROM 'explainer' OR split_part(NEW.kind, '.', 1) IS DISTINCT FROM 'explainer' THEN
    NEW.episode_script_version := NULL;
    RETURN NEW;
  END IF;
  IF private.explainer_job_stages(NEW.kind) IS NULL THEN
    RAISE EXCEPTION 'Tanımsız anlatım iş türü: %.', NEW.kind
      USING ERRCODE = '23514', HINT = 'unknown_explainer_kind';
  END IF;
  v_pre := NEW.kind = ANY (private.explainer_pre_approval_kinds());
  IF v_pre AND NOT private.explainer_pre_approval_capabilities_ok(NEW.required_capabilities) THEN
    RAISE EXCEPTION 'Ön hazırlık işi üretim yeteneği (ses, altyazı, render, klip, yayın) isteyemez.'
      USING ERRCODE = '23514', HINT = 'production_capability_not_allowed';
  END IF;

  IF NEW.episode_id IS NULL THEN
    NEW.episode_script_version := NULL;
    IF NOT v_pre THEN
      RAISE EXCEPTION 'Anlatım üretim işi bir bölüme bağlı olmalı (enqueue_episode_job).'
        USING ERRCODE = '23514', HINT = 'episode_required';
    END IF;
    RETURN NEW;
  END IF;

  -- Kilit: senaryo kaydı ile iş açma aynı anda yarışamaz.
  SELECT * INTO e FROM public.episodes WHERE id = NEW.episode_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NEW; -- FK kısıtı reddeder.
  END IF;
  IF e.workspace_id IS DISTINCT FROM NEW.workspace_id THEN
    RAISE EXCEPTION 'Bağlanan kayıt başka bir çalışma alanına ait.'
      USING ERRCODE = '23514', HINT = 'workspace_mismatch';
  END IF;
  IF e.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Arşivlenmiş bölüm için iş açılamaz.' USING ERRCODE = '55000', HINT = 'episode_locked';
  END IF;
  NEW.episode_script_version := e.script_version;
  IF v_pre THEN
    RETURN NEW;
  END IF;
  IF e.script_approved_at IS NULL OR e.script_approved_version IS DISTINCT FROM e.script_version
    OR btrim(e.script_text) = '' THEN
    RAISE EXCEPTION 'Senaryo onaylanmadan üretim başlatılamaz.'
      USING ERRCODE = '42501', HINT = 'script_approval_required';
  END IF;
  RETURN NEW;
END;
$$;

-- İş durumu değişince bölümün durumu yeniden hesaplanır.
CREATE FUNCTION private.refresh_episode_status(p_episode_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.episodes e
  SET status = private.episode_status(e)
  WHERE e.id = p_episode_id AND e.status IS DISTINCT FROM private.episode_status(e)
$$;

CREATE FUNCTION private.jobs_sync_episode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.episode_id IS NOT NULL AND OLD.episode_id IS DISTINCT FROM NEW.episode_id THEN
    PERFORM private.refresh_episode_status(OLD.episode_id);
  END IF;
  IF NEW.episode_id IS NOT NULL THEN
    PERFORM private.refresh_episode_status(NEW.episode_id);
  END IF;
  RETURN NULL;
END;
$$;

-- Anlatım işinin aşamaları türün sabit tanımıyla BİREBİR aynı olmalı (sıra, ad, onay gereği, sayı).
-- Deyim düzeyinde çalışır: aşamalar tek INSERT ile yazılır (private.create_job). Aşama tanımı
-- sonradan değişmez (job_stages_guard), işin türü de değişmez (jobs_guard); yani ön hazırlık
-- türüne ses / render aşaması eklenemez, üretim türünden video onayı çıkarılamaz.
CREATE FUNCTION private.job_stages_explainer_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kind text;
BEGIN
  SELECT j.kind INTO v_kind
  FROM public.jobs j
  WHERE j.id IN (SELECT n.job_id FROM new_stages n)
    AND j.module = 'explainer'
    AND (
      SELECT jsonb_agg(
        jsonb_build_object('key', s.key, 'requires_approval', s.requires_approval) ORDER BY s.seq
      )
      FROM public.job_stages s WHERE s.job_id = j.id
    ) IS DISTINCT FROM private.explainer_job_stages(j.kind)
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Anlatım işinin aşamaları türün sabit tanımıyla aynı olmalı (%).', v_kind
      USING ERRCODE = '23514', HINT = 'explainer_stages_fixed';
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER job_stages_explainer_rules AFTER INSERT ON public.job_stages
  REFERENCING NEW TABLE AS new_stages
  FOR EACH STATEMENT EXECUTE FUNCTION private.job_stages_explainer_rules();

CREATE TRIGGER jobs_episode_gate BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION private.jobs_episode_gate();
CREATE TRIGGER jobs_sync_episode AFTER INSERT OR UPDATE OF status, episode_id ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION private.jobs_sync_episode();

-- ── 8) create_job: bölüm sahipli sürüm ──────────────────────────────────────
-- #201'deki 10 parametreli private.create_job() yerinde kalır ve buna devreder.
CREATE FUNCTION private.create_job(
  p_workspace_id uuid,
  p_module text,
  p_kind text,
  p_stages jsonb,
  p_params jsonb,
  p_required_capabilities text[],
  p_stop_at text,
  p_clip_source_id uuid,
  p_max_attempts integer,
  p_retry_of uuid,
  p_episode_id uuid
)
RETURNS public.jobs
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  j public.jobs;
BEGIN
  IF p_stages IS NULL OR jsonb_typeof(p_stages) IS DISTINCT FROM 'array'
    OR octet_length(p_stages::text) > 4096 THEN
    RAISE EXCEPTION 'Aşama listesi 1-20 elemanlı bir dizi olmalı.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_stages) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Aşama listesi 1-20 elemanlı bir dizi olmalı.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_stages) AS e (stage)
    WHERE jsonb_typeof(e.stage) IS DISTINCT FROM 'object'
      OR jsonb_typeof(e.stage -> 'key') IS DISTINCT FROM 'string'
      OR ((e.stage -> 'requires_approval') IS NOT NULL
          AND jsonb_typeof(e.stage -> 'requires_approval') <> 'boolean')
  ) THEN
    RAISE EXCEPTION 'Her aşama {"key": metin, "requires_approval": mantıksal} biçiminde olmalı.'
      USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT e.stage ->> 'key') FROM jsonb_array_elements(p_stages) AS e (stage))
    <> jsonb_array_length(p_stages) THEN
    RAISE EXCEPTION 'Aşama adları iş içinde tekil olmalı.' USING ERRCODE = '22023';
  END IF;
  IF p_stop_at IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_stages) AS e (stage) WHERE e.stage ->> 'key' = p_stop_at
  ) THEN
    RAISE EXCEPTION 'stop_at işin aşamalarından biri olmalı.' USING ERRCODE = '22023';
  END IF;
  -- DEFINER bağlamında RLS yok: sahip kayıt çağıranın alanında olmalı.
  IF p_clip_source_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clip_sources c
    WHERE c.id = p_clip_source_id AND c.workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Kaynak video bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF p_episode_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.episodes ep
    WHERE ep.id = p_episode_id AND ep.workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.jobs (
    workspace_id, module, kind, clip_source_id, episode_id, params, stop_at, required_capabilities,
    max_attempts, retry_of, current_stage
  )
  VALUES (
    p_workspace_id, p_module, p_kind, p_clip_source_id, p_episode_id, COALESCE(p_params, '{}'::jsonb),
    p_stop_at, COALESCE(p_required_capabilities, '{}'), COALESCE(p_max_attempts, 3), p_retry_of,
    p_stages -> 0 ->> 'key'
  )
  RETURNING * INTO j;

  INSERT INTO public.job_stages (workspace_id, job_id, seq, key, requires_approval)
  SELECT j.workspace_id, j.id, e.ord, e.stage ->> 'key',
    COALESCE((e.stage ->> 'requires_approval')::boolean, false)
  FROM jsonb_array_elements(p_stages) WITH ORDINALITY AS e (stage, ord);

  RETURN j;
END;
$$;

CREATE OR REPLACE FUNCTION private.create_job(
  p_workspace_id uuid,
  p_module text,
  p_kind text,
  p_stages jsonb,
  p_params jsonb,
  p_required_capabilities text[],
  p_stop_at text,
  p_clip_source_id uuid,
  p_max_attempts integer,
  p_retry_of uuid
)
RETURNS public.jobs
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN private.create_job(
    p_workspace_id, p_module, p_kind, p_stages, p_params, p_required_capabilities, p_stop_at,
    p_clip_source_id, p_max_attempts, p_retry_of, NULL::uuid
  );
END;
$$;

-- Yeniden deneme bölümü de taşır. Senaryo işten sonra değiştiyse eski iş yeniden denenmez:
-- dondurulmuş parametreler eski sürüme aittir; yeni iş enqueue_episode_job ile açılır.
CREATE OR REPLACE FUNCTION internal.retry_job(p_job_id uuid)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := public.current_workspace_id();
  j public.jobs;
  v_stages jsonb;
BEGIN
  IF NOT public.can_write_data() OR v_ws IS NULL THEN
    RAISE EXCEPTION 'Yeniden denemek için düzenleme yetkisi gerekir.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO j FROM public.jobs WHERE id = p_job_id AND workspace_id = v_ws;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İş bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF j.status NOT IN ('failed', 'cancelled') THEN
    RAISE EXCEPTION 'Sadece başarısız veya iptal edilmiş iş yeniden denenebilir.' USING ERRCODE = '55000';
  END IF;
  IF j.episode_id IS NOT NULL AND j.episode_script_version IS DISTINCT FROM (
    SELECT ep.script_version FROM public.episodes ep WHERE ep.id = j.episode_id
  ) THEN
    RAISE EXCEPTION 'Senaryo bu işten sonra değişti; bölüm için yeni iş açın.'
      USING ERRCODE = '55000', HINT = 'script_changed';
  END IF;
  SELECT jsonb_agg(
    jsonb_build_object('key', s.key, 'requires_approval', s.requires_approval) ORDER BY s.seq
  ) INTO v_stages
  FROM public.job_stages s WHERE s.job_id = j.id;
  RETURN private.create_job(
    v_ws, j.module, j.kind, v_stages, j.params, j.required_capabilities, j.stop_at,
    j.clip_source_id, j.max_attempts, j.id, j.episode_id
  );
END;
$$;

-- ── 9) Çekirdek yardımcılar (private) ───────────────────────────────────────
-- Serinin sıradaki bölüm numarasını ayırır. UPDATE seri satırını kilitler: eşzamanlı iki çağrı
-- sıraya girer ve farklı numara alır. Dönen satırda next_episode_number - 1 ayrılan numaradır.
CREATE FUNCTION private.next_episode_number(p_series_id uuid, p_workspace_id uuid)
RETURNS public.series
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  sr public.series;
BEGIN
  UPDATE public.series
  SET next_episode_number = next_episode_number + 1
  WHERE id = p_series_id AND workspace_id = p_workspace_id AND status = 'active'
  RETURNING * INTO sr;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.series s WHERE s.id = p_series_id AND s.workspace_id = p_workspace_id) THEN
      RAISE EXCEPTION 'Arşivlenmiş seriye bölüm eklenemez.' USING ERRCODE = '55000', HINT = 'series_archived';
    END IF;
    RAISE EXCEPTION 'Seri bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  RETURN sr;
END;
$$;

-- Bölüm satırı: seri varsa numara ayrılır, tür ve dil boşsa seriden gelir.
CREATE FUNCTION private.create_episode_row(
  p_workspace_id uuid,
  p_series_id uuid,
  p_suggestion_id uuid,
  p_title text,
  p_kind text,
  p_language text,
  p_summary text,
  p_hook text,
  p_visual_idea text,
  p_sensitivity_note text
)
RETURNS public.episodes
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  sr public.series;
  e public.episodes;
  v_kind text := p_kind;
  v_language text := p_language;
  v_number integer;
BEGIN
  IF p_series_id IS NOT NULL THEN
    sr := private.next_episode_number(p_series_id, p_workspace_id);
    v_number := sr.next_episode_number - 1;
    v_kind := COALESCE(v_kind, sr.kind);
    v_language := COALESCE(v_language, sr.language);
  END IF;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Bölümün türü gerekli: event ya da how_it_works.'
      USING ERRCODE = '22023', HINT = 'kind_required';
  END IF;

  INSERT INTO public.episodes (
    workspace_id, series_id, episode_number, suggestion_id, title, kind, language, summary, hook,
    visual_idea, sensitivity_note
  )
  VALUES (
    p_workspace_id, p_series_id, v_number, p_suggestion_id, btrim(p_title), v_kind,
    COALESCE(v_language, 'tr'), COALESCE(p_summary, ''), COALESCE(p_hook, ''),
    COALESCE(p_visual_idea, ''), NULLIF(btrim(p_sensitivity_note), '')
  )
  RETURNING * INTO e;
  RETURN e;
END;
$$;

-- İsteğe öneri ekler (toplam en çok 20). Çağıran isteği kilitlemiş olmalı.
CREATE FUNCTION private.insert_topic_suggestions(p_request public.topic_requests, p_suggestions jsonb)
RETURNS integer
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_existing integer;
  v_count integer;
  v_allowed constant text[] := ARRAY[
    'title', 'summary', 'hook', 'visual_idea', 'kind', 'evidence_level', 'evidence_detail',
    'source_candidates', 'sensitivity_note'
  ];
BEGIN
  IF p_suggestions IS NULL OR jsonb_typeof(p_suggestions) <> 'array'
    OR octet_length(p_suggestions::text) > 131072 THEN
    RAISE EXCEPTION 'Öneriler bir dizi olmalı (en çok 128 KB).' USING ERRCODE = '22023';
  END IF;
  v_count := jsonb_array_length(p_suggestions);
  SELECT count(*)::integer INTO v_existing
  FROM public.topic_suggestions s WHERE s.request_id = p_request.id;
  IF v_existing + v_count > 20 THEN
    RAISE EXCEPTION 'Bir isteğe en çok 20 öneri yazılabilir.'
      USING ERRCODE = '22023', HINT = 'too_many_suggestions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_suggestions) AS e (s) WHERE jsonb_typeof(e.s) <> 'object'
  ) THEN
    RAISE EXCEPTION 'Her öneri bir JSON nesnesi olmalı.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_suggestions) AS e (s), LATERAL jsonb_object_keys(e.s) AS k
    WHERE k <> ALL (v_allowed)
  ) THEN
    RAISE EXCEPTION 'Öneride bilinmeyen alan. İzin verilenler: %.', array_to_string(v_allowed, ', ')
      USING ERRCODE = '22023', HINT = 'unknown_field';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_suggestions) AS e (s)
    WHERE NOT private.sources_valid(COALESCE(NULLIF(e.s -> 'source_candidates', 'null'::jsonb), '[]'::jsonb))
  ) THEN
    RAISE EXCEPTION 'Kaynak adayları [{"title": metin, "url": "http(s)://…"}] biçiminde olmalı.'
      USING ERRCODE = '22023', HINT = 'sources_invalid';
  END IF;

  INSERT INTO public.topic_suggestions (
    workspace_id, request_id, series_id, position, title, summary, hook, visual_idea, kind,
    evidence_level, evidence_detail, source_candidates, sensitivity_note
  )
  SELECT
    p_request.workspace_id, p_request.id, p_request.series_id, (v_existing + e.ord)::smallint,
    btrim(e.s ->> 'title'), COALESCE(e.s ->> 'summary', ''), COALESCE(e.s ->> 'hook', ''),
    COALESCE(e.s ->> 'visual_idea', ''), COALESCE(e.s ->> 'kind', p_request.kind),
    COALESCE(e.s ->> 'evidence_level', 'original'),
    COALESCE(NULLIF(e.s -> 'evidence_detail', 'null'::jsonb), '{}'::jsonb),
    COALESCE(NULLIF(e.s -> 'source_candidates', 'null'::jsonb), '[]'::jsonb),
    NULLIF(btrim(e.s ->> 'sensitivity_note'), '')
  FROM jsonb_array_elements(p_suggestions) WITH ORDINALITY AS e (s, ord);
  RETURN v_count;
END;
$$;

-- ── 10) Seri çekirdekleri ───────────────────────────────────────────────────
CREATE FUNCTION internal.create_series(p_name text, p_settings jsonb)
RETURNS public.series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  v_set jsonb := COALESCE(p_settings, '{}'::jsonb);
  r public.series;
BEGIN
  PERFORM private.assert_patch(v_set, ARRAY[
    'theme', 'kind', 'visual_route', 'style_key', 'voice_provider', 'voice_name', 'voice_rate',
    'caption_style', 'language', 'default_params'
  ]);
  IF (SELECT count(*) FROM public.series s WHERE s.workspace_id = v_ws) >= 500 THEN
    RAISE EXCEPTION 'Çalışma alanı başına en çok 500 seri açılabilir.' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.series (
    workspace_id, name, theme, kind, visual_route, style_key, voice_provider, voice_name,
    voice_rate, caption_style, language, default_params
  )
  VALUES (
    v_ws, btrim(p_name), COALESCE(v_set ->> 'theme', ''), v_set ->> 'kind', v_set ->> 'visual_route',
    v_set ->> 'style_key', v_set ->> 'voice_provider', v_set ->> 'voice_name', v_set ->> 'voice_rate',
    COALESCE(NULLIF(v_set -> 'caption_style', 'null'::jsonb), '{}'::jsonb),
    COALESCE(v_set ->> 'language', 'tr'),
    COALESCE(NULLIF(v_set -> 'default_params', 'null'::jsonb), '{}'::jsonb)
  )
  RETURNING * INTO r;
  RETURN r;
END;
$$;

CREATE FUNCTION internal.update_series(p_series_id uuid, p_patch jsonb)
RETURNS public.series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  r public.series;
BEGIN
  PERFORM private.assert_patch(p_patch, ARRAY[
    'name', 'theme', 'kind', 'visual_route', 'style_key', 'voice_provider', 'voice_name',
    'voice_rate', 'caption_style', 'language', 'default_params'
  ]);
  UPDATE public.series s
  SET
    name = CASE WHEN p_patch ? 'name' THEN btrim(p_patch ->> 'name') ELSE s.name END,
    theme = CASE WHEN p_patch ? 'theme' THEN COALESCE(p_patch ->> 'theme', '') ELSE s.theme END,
    kind = CASE WHEN p_patch ? 'kind' THEN p_patch ->> 'kind' ELSE s.kind END,
    visual_route = CASE WHEN p_patch ? 'visual_route' THEN p_patch ->> 'visual_route' ELSE s.visual_route END,
    style_key = CASE WHEN p_patch ? 'style_key' THEN p_patch ->> 'style_key' ELSE s.style_key END,
    voice_provider = CASE WHEN p_patch ? 'voice_provider' THEN p_patch ->> 'voice_provider' ELSE s.voice_provider END,
    voice_name = CASE WHEN p_patch ? 'voice_name' THEN p_patch ->> 'voice_name' ELSE s.voice_name END,
    voice_rate = CASE WHEN p_patch ? 'voice_rate' THEN p_patch ->> 'voice_rate' ELSE s.voice_rate END,
    caption_style = CASE WHEN p_patch ? 'caption_style'
      THEN COALESCE(NULLIF(p_patch -> 'caption_style', 'null'::jsonb), '{}'::jsonb) ELSE s.caption_style END,
    language = CASE WHEN p_patch ? 'language' THEN COALESCE(p_patch ->> 'language', 'tr') ELSE s.language END,
    default_params = CASE WHEN p_patch ? 'default_params'
      THEN COALESCE(NULLIF(p_patch -> 'default_params', 'null'::jsonb), '{}'::jsonb) ELSE s.default_params END
  WHERE s.id = p_series_id AND s.workspace_id = v_ws
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seri bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  RETURN r;
END;
$$;

-- Arşivlenen seriye yeni bölüm ve istek açılmaz; mevcut bölümler yerinde kalır.
CREATE FUNCTION internal.archive_series(p_series_id uuid, p_archived boolean)
RETURNS public.series
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  r public.series;
BEGIN
  UPDATE public.series s
  SET status = CASE WHEN COALESCE(p_archived, true) THEN 'archived' ELSE 'active' END
  WHERE s.id = p_series_id AND s.workspace_id = v_ws
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seri bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  RETURN r;
END;
$$;

-- ── 11) İstek ve öneri çekirdekleri ─────────────────────────────────────────
CREATE FUNCTION internal.create_topic_request(
  p_prompt text, p_suggestions jsonb, p_series_id uuid, p_kind text, p_language text
)
RETURNS public.topic_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  sr public.series;
  r public.topic_requests;
BEGIN
  IF p_series_id IS NOT NULL THEN
    SELECT * INTO sr FROM public.series s WHERE s.id = p_series_id AND s.workspace_id = v_ws;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Seri bulunamadı.' USING ERRCODE = 'P0002';
    END IF;
    IF sr.status <> 'active' THEN
      RAISE EXCEPTION 'Arşivlenmiş seri için istek açılamaz.' USING ERRCODE = '55000', HINT = 'series_archived';
    END IF;
  END IF;
  INSERT INTO public.topic_requests (workspace_id, series_id, prompt, kind, language)
  VALUES (
    v_ws, p_series_id, btrim(p_prompt), COALESCE(p_kind, sr.kind),
    COALESCE(p_language, sr.language, 'tr')
  )
  RETURNING * INTO r;
  PERFORM private.insert_topic_suggestions(r, COALESCE(p_suggestions, '[]'::jsonb));
  RETURN r;
END;
$$;

CREATE FUNCTION internal.add_topic_suggestions(p_request_id uuid, p_suggestions jsonb)
RETURNS SETOF public.topic_suggestions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  r public.topic_requests;
BEGIN
  SELECT * INTO r FROM public.topic_requests q
  WHERE q.id = p_request_id AND q.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İstek bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM private.insert_topic_suggestions(r, p_suggestions);
  RETURN QUERY
    SELECT s.* FROM public.topic_suggestions s WHERE s.request_id = r.id ORDER BY s.position;
END;
$$;

-- Seçim: öneri bölüme dönüşür; serideyse sıradaki numarayı alır. Elenmiş öneri de seçilebilir.
CREATE FUNCTION internal.pick_topic_suggestion(p_suggestion_id uuid)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  s public.topic_suggestions;
  v_language text;
  e public.episodes;
BEGIN
  SELECT * INTO s FROM public.topic_suggestions t
  WHERE t.id = p_suggestion_id AND t.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Öneri bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF s.status = 'picked' THEN
    RAISE EXCEPTION 'Bu öneri zaten seçildi.' USING ERRCODE = '55000', HINT = 'already_picked';
  END IF;
  SELECT q.language INTO v_language FROM public.topic_requests q WHERE q.id = s.request_id;

  e := private.create_episode_row(
    v_ws, s.series_id, s.id, s.title, s.kind, v_language, s.summary, s.hook, s.visual_idea,
    s.sensitivity_note
  );
  UPDATE public.topic_suggestions
  SET status = 'picked', decided_by = auth.uid(), decided_at = now(), rejection_reason = NULL
  WHERE id = s.id;
  RETURN e;
END;
$$;

CREATE FUNCTION internal.reject_topic_suggestion(p_suggestion_id uuid, p_reason text)
RETURNS public.topic_suggestions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  s public.topic_suggestions;
BEGIN
  SELECT * INTO s FROM public.topic_suggestions t
  WHERE t.id = p_suggestion_id AND t.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Öneri bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF s.status <> 'new' THEN
    RAISE EXCEPTION 'Yalnız karar verilmemiş öneri elenebilir.' USING ERRCODE = '55000', HINT = 'already_decided';
  END IF;
  UPDATE public.topic_suggestions
  SET status = 'rejected', decided_by = auth.uid(), decided_at = now(),
      rejection_reason = NULLIF(btrim(p_reason), '')
  WHERE id = s.id
  RETURNING * INTO s;
  RETURN s;
END;
$$;

-- ── 12) Bölüm çekirdekleri ──────────────────────────────────────────────────
-- Önerisiz bölüm: tekil video (p_series_id boş) ya da serinin sıradaki bölümü.
CREATE FUNCTION internal.create_episode(
  p_title text, p_kind text, p_series_id uuid, p_language text, p_summary text, p_hook text
)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
BEGIN
  RETURN private.create_episode_row(
    v_ws, p_series_id, NULL, p_title, p_kind, p_language, p_summary, p_hook, '', NULL
  );
END;
$$;

-- Bölüm alanları ve seri varsayılanlarının üstüne yazılanlar. `kind` / `language` senaryo
-- paketine dahildir: değişirse yeni sürüm açılır ve onay silinir (trigger).
CREATE FUNCTION internal.update_episode(p_episode_id uuid, p_patch jsonb)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  r public.episodes;
BEGIN
  PERFORM private.assert_patch(p_patch, ARRAY[
    'title', 'summary', 'hook', 'visual_idea', 'kind', 'language', 'visual_route', 'style_key',
    'voice_provider', 'voice_name', 'voice_rate', 'caption_style', 'params'
  ]);
  UPDATE public.episodes e
  SET
    title = CASE WHEN p_patch ? 'title' THEN btrim(p_patch ->> 'title') ELSE e.title END,
    summary = CASE WHEN p_patch ? 'summary' THEN COALESCE(p_patch ->> 'summary', '') ELSE e.summary END,
    hook = CASE WHEN p_patch ? 'hook' THEN COALESCE(p_patch ->> 'hook', '') ELSE e.hook END,
    visual_idea = CASE WHEN p_patch ? 'visual_idea' THEN COALESCE(p_patch ->> 'visual_idea', '') ELSE e.visual_idea END,
    kind = CASE WHEN p_patch ? 'kind' THEN p_patch ->> 'kind' ELSE e.kind END,
    language = CASE WHEN p_patch ? 'language' THEN p_patch ->> 'language' ELSE e.language END,
    visual_route = CASE WHEN p_patch ? 'visual_route' THEN p_patch ->> 'visual_route' ELSE e.visual_route END,
    style_key = CASE WHEN p_patch ? 'style_key' THEN p_patch ->> 'style_key' ELSE e.style_key END,
    voice_provider = CASE WHEN p_patch ? 'voice_provider' THEN p_patch ->> 'voice_provider' ELSE e.voice_provider END,
    voice_name = CASE WHEN p_patch ? 'voice_name' THEN p_patch ->> 'voice_name' ELSE e.voice_name END,
    voice_rate = CASE WHEN p_patch ? 'voice_rate' THEN p_patch ->> 'voice_rate' ELSE e.voice_rate END,
    caption_style = CASE WHEN p_patch ? 'caption_style'
      THEN NULLIF(p_patch -> 'caption_style', 'null'::jsonb) ELSE e.caption_style END,
    params = CASE WHEN p_patch ? 'params'
      THEN COALESCE(NULLIF(p_patch -> 'params', 'null'::jsonb), '{}'::jsonb) ELSE e.params END
  WHERE e.id = p_episode_id AND e.workspace_id = v_ws
  RETURNING * INTO r;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  RETURN r;
END;
$$;

-- Bölümü başka seriye (sıradaki numarayla) ya da seri dışına taşır. Yalnız üretim başlamadan.
CREATE FUNCTION internal.move_episode(p_episode_id uuid, p_series_id uuid)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  e public.episodes;
  sr public.series;
BEGIN
  SELECT * INTO e FROM public.episodes x
  WHERE x.id = p_episode_id AND x.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF e.series_id IS NOT DISTINCT FROM p_series_id THEN
    RETURN e;
  END IF;
  IF e.status NOT IN ('draft', 'script_ready', 'script_approved') THEN
    RAISE EXCEPTION 'Üretimi başlamış bölüm taşınamaz.' USING ERRCODE = '55000', HINT = 'episode_locked';
  END IF;

  IF p_series_id IS NULL THEN
    UPDATE public.episodes SET series_id = NULL, episode_number = NULL WHERE id = e.id RETURNING * INTO e;
  ELSE
    sr := private.next_episode_number(p_series_id, v_ws);
    UPDATE public.episodes
    SET series_id = sr.id, episode_number = sr.next_episode_number - 1
    WHERE id = e.id
    RETURNING * INTO e;
  END IF;
  RETURN e;
END;
$$;

CREATE FUNCTION internal.archive_episode(p_episode_id uuid, p_archived boolean)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  e public.episodes;
BEGIN
  SELECT * INTO e FROM public.episodes x
  WHERE x.id = p_episode_id AND x.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(p_archived, true) AND private.episode_has_open_job(e.id) THEN
    RAISE EXCEPTION 'Üretim sürerken bölüm arşivlenemez; önce işi iptal edin.'
      USING ERRCODE = '55000', HINT = 'episode_in_production';
  END IF;
  UPDATE public.episodes
  SET archived_at = CASE WHEN COALESCE(p_archived, true) THEN COALESCE(archived_at, now()) END
  WHERE id = e.id
  RETURNING * INTO e;
  RETURN e;
END;
$$;

-- Senaryo paketini kaydeder. NULL parametre "dokunma" demektir; p_script için JSON null temizler.
-- İçerik değiştiyse trigger yeni sürüm açar ve onayı siler. p_expected_version verilirse ve
-- bölüm o sürümde değilse (başkası araya girdi) kayıt reddedilir.
CREATE FUNCTION internal.save_episode_script(
  p_episode_id uuid,
  p_script_text text,
  p_fact_notes jsonb,
  p_script jsonb,
  p_sensitivity_flags text[],
  p_sensitivity_note text,
  p_expected_version integer
)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  e public.episodes;
BEGIN
  SELECT * INTO e FROM public.episodes x
  WHERE x.id = p_episode_id AND x.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> e.script_version THEN
    RAISE EXCEPTION 'Senaryo bu arada değişti (sürüm %).', e.script_version
      USING ERRCODE = '55000', HINT = 'version_conflict';
  END IF;
  UPDATE public.episodes
  SET
    script_text = COALESCE(p_script_text, script_text),
    fact_notes = COALESCE(p_fact_notes, fact_notes),
    script = CASE WHEN p_script IS NULL THEN script ELSE NULLIF(p_script, 'null'::jsonb) END,
    sensitivity_flags = COALESCE(p_sensitivity_flags, sensitivity_flags),
    sensitivity_note = CASE WHEN p_sensitivity_note IS NULL THEN sensitivity_note
                            ELSE NULLIF(btrim(p_sensitivity_note), '') END
  WHERE id = e.id
  RETURNING * INTO e;
  RETURN e;
END;
$$;

-- Senaryo onayı: yalnız owner/editor olan insan oturumu. Asıl denetim episodes_guard
-- trigger'ındadır (doğrudan UPDATE de aynı kuraldan geçer); buradaki denetim erken ve anlaşılır
-- hata içindir. p_script_version onaylayanın okuduğu sürümdür: araya kayıt girdiyse reddedilir.
CREATE FUNCTION internal.approve_episode_script(
  p_episode_id uuid, p_script_version integer, p_acknowledge_fact_gaps boolean
)
RETURNS public.episodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  e public.episodes;
BEGIN
  -- TODO(#211): makine oturumunu ayıran session_id claim'i gerçek oturumla doğrulanacak.
  IF private.current_session_id() IS NULL OR private.is_worker_session() THEN
    RAISE EXCEPTION 'Üretim makinesi oturumu onay veremez.'
      USING ERRCODE = '42501', HINT = 'worker_session';
  END IF;
  SELECT * INTO e FROM public.episodes x
  WHERE x.id = p_episode_id AND x.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  IF p_script_version IS DISTINCT FROM e.script_version THEN
    RAISE EXCEPTION 'Onaylanan sürüm güncel değil (güncel sürüm %).', e.script_version
      USING ERRCODE = '55000', HINT = 'version_conflict';
  END IF;
  IF e.script_approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Senaryo zaten onaylı.' USING ERRCODE = '55000', HINT = 'already_approved';
  END IF;
  UPDATE public.episodes
  SET script_approved_at = now(), script_approved_with_gaps = COALESCE(p_acknowledge_fact_gaps, false)
  WHERE id = e.id
  RETURNING * INTO e;
  RETURN e;
END;
$$;

-- Bölüm için iş açar. Parametreler seri varsayılanı → bölümde üstüne yazılan → çağrıdaki ek
-- parametre sırasıyla birleştirilir ve DONDURULUR (jobs.params + episodes.params_snapshot).
-- Onay kapısını private.jobs_episode_gate() uygular. Aşamalar istemciden alınmaz: türün sabit
-- tanımından gelir (private.explainer_job_stages); üretim türünün son aşaması video onayıdır.
CREATE FUNCTION internal.enqueue_episode_job(
  p_episode_id uuid,
  p_kind text,
  p_required_capabilities text[],
  p_stop_at text,
  p_max_attempts integer,
  p_params jsonb
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid := private.require_explainer_writer();
  e public.episodes;
  sr public.series;
  v_extra jsonb := COALESCE(p_params, '{}'::jsonb);
  v_params jsonb;
  v_pre boolean;
  v_stages jsonb := private.explainer_job_stages(p_kind);
  j public.jobs;
BEGIN
  IF v_stages IS NULL THEN
    RAISE EXCEPTION 'Bölüm işi anlatım modülünün tanımlı türlerinden biri olmalı.'
      USING ERRCODE = '22023', HINT = 'unknown_explainer_kind';
  END IF;
  IF jsonb_typeof(v_extra) <> 'object' THEN
    RAISE EXCEPTION 'Ek parametreler bir JSON nesnesi olmalı.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO e FROM public.episodes x
  WHERE x.id = p_episode_id AND x.workspace_id = v_ws
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bölüm bulunamadı.' USING ERRCODE = 'P0002';
  END IF;
  v_pre := p_kind = ANY (private.explainer_pre_approval_kinds());
  IF e.series_id IS NOT NULL THEN
    SELECT * INTO sr FROM public.series s WHERE s.id = e.series_id;
  END IF;

  v_params := jsonb_build_object(
    'episode', jsonb_build_object(
      'id', e.id, 'number', e.episode_number, 'title', e.title, 'kind', e.kind,
      'language', e.language, 'script_version', e.script_version
    ),
    'series', CASE WHEN sr.id IS NULL THEN NULL
      ELSE jsonb_build_object('id', sr.id, 'name', sr.name, 'theme', sr.theme) END,
    'visual_route', COALESCE(e.visual_route, sr.visual_route),
    'style_key', COALESCE(e.style_key, sr.style_key),
    'voice', jsonb_build_object(
      'provider', COALESCE(e.voice_provider, sr.voice_provider),
      'name', COALESCE(e.voice_name, sr.voice_name),
      'rate', COALESCE(e.voice_rate, sr.voice_rate)
    ),
    'caption_style', COALESCE(e.caption_style, sr.caption_style, '{}'::jsonb),
    'params', COALESCE(sr.default_params, '{}'::jsonb) || e.params || v_extra
  );

  j := private.create_job(
    v_ws, 'explainer', p_kind, v_stages, v_params, p_required_capabilities, p_stop_at, NULL,
    p_max_attempts, NULL, e.id
  );
  IF NOT v_pre THEN
    UPDATE public.episodes SET params_snapshot = v_params WHERE id = e.id;
  END IF;
  RETURN j;
END;
$$;

-- ── 13) public sarmalayıcılar (SECURITY INVOKER) ────────────────────────────
CREATE FUNCTION public.create_series(p_name text, p_settings jsonb DEFAULT '{}'::jsonb)
RETURNS public.series LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.create_series(p_name, p_settings);
END;
$$;

CREATE FUNCTION public.update_series(p_series_id uuid, p_patch jsonb)
RETURNS public.series LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.update_series(p_series_id, p_patch);
END;
$$;

CREATE FUNCTION public.archive_series(p_series_id uuid, p_archived boolean DEFAULT true)
RETURNS public.series LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.archive_series(p_series_id, p_archived);
END;
$$;

CREATE FUNCTION public.create_topic_request(
  p_prompt text,
  p_suggestions jsonb DEFAULT '[]'::jsonb,
  p_series_id uuid DEFAULT NULL,
  p_kind text DEFAULT NULL,
  p_language text DEFAULT NULL
)
RETURNS public.topic_requests LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.create_topic_request(p_prompt, p_suggestions, p_series_id, p_kind, p_language);
END;
$$;

CREATE FUNCTION public.add_topic_suggestions(p_request_id uuid, p_suggestions jsonb)
RETURNS SETOF public.topic_suggestions LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN QUERY SELECT * FROM internal.add_topic_suggestions(p_request_id, p_suggestions);
END;
$$;

CREATE FUNCTION public.pick_topic_suggestion(p_suggestion_id uuid)
RETURNS public.episodes LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.pick_topic_suggestion(p_suggestion_id);
END;
$$;

CREATE FUNCTION public.reject_topic_suggestion(p_suggestion_id uuid, p_reason text DEFAULT NULL)
RETURNS public.topic_suggestions LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.reject_topic_suggestion(p_suggestion_id, p_reason);
END;
$$;

CREATE FUNCTION public.create_episode(
  p_title text,
  p_kind text DEFAULT NULL,
  p_series_id uuid DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_summary text DEFAULT '',
  p_hook text DEFAULT ''
)
RETURNS public.episodes LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.create_episode(p_title, p_kind, p_series_id, p_language, p_summary, p_hook);
END;
$$;

CREATE FUNCTION public.update_episode(p_episode_id uuid, p_patch jsonb)
RETURNS public.episodes LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.update_episode(p_episode_id, p_patch);
END;
$$;

CREATE FUNCTION public.move_episode(p_episode_id uuid, p_series_id uuid DEFAULT NULL)
RETURNS public.episodes LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.move_episode(p_episode_id, p_series_id);
END;
$$;

CREATE FUNCTION public.archive_episode(p_episode_id uuid, p_archived boolean DEFAULT true)
RETURNS public.episodes LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.archive_episode(p_episode_id, p_archived);
END;
$$;

CREATE FUNCTION public.save_episode_script(
  p_episode_id uuid,
  p_script_text text,
  p_fact_notes jsonb DEFAULT NULL,
  p_script jsonb DEFAULT NULL,
  p_sensitivity_flags text[] DEFAULT NULL,
  p_sensitivity_note text DEFAULT NULL,
  p_expected_version integer DEFAULT NULL
)
RETURNS public.episodes LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.save_episode_script(
    p_episode_id, p_script_text, p_fact_notes, p_script, p_sensitivity_flags, p_sensitivity_note,
    p_expected_version
  );
END;
$$;

CREATE FUNCTION public.approve_episode_script(
  p_episode_id uuid, p_script_version integer, p_acknowledge_fact_gaps boolean DEFAULT false
)
RETURNS public.episodes LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.approve_episode_script(p_episode_id, p_script_version, p_acknowledge_fact_gaps);
END;
$$;

CREATE FUNCTION public.enqueue_episode_job(
  p_episode_id uuid,
  p_kind text,
  p_required_capabilities text[] DEFAULT '{}',
  p_stop_at text DEFAULT NULL,
  p_max_attempts integer DEFAULT 3,
  p_params jsonb DEFAULT '{}'::jsonb
)
RETURNS public.jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  RETURN internal.enqueue_episode_job(
    p_episode_id, p_kind, p_required_capabilities, p_stop_at, p_max_attempts, p_params
  );
END;
$$;

-- Benzer konu (#202 "bu konuyu daha önce yaptık mı"): aynı normalleştirilmiş başlık ('exact') ya
-- da başlığın anlamlı kelimelerinin (4+ harf) en az %60'ı ve en az ikisi ortak ('similar').
-- SECURITY INVOKER: RLS çağıranın alanıyla sınırlar; viewer da çağırabilir. Seçilmiş öneriler
-- bölüm olarak zaten listede olduğundan ayrıca dönmez.
CREATE FUNCTION public.find_similar_topics(
  p_title text, p_limit integer DEFAULT 10, p_exclude_episode_id uuid DEFAULT NULL
)
RETURNS TABLE (
  source text,
  id uuid,
  title text,
  status text,
  series_id uuid,
  episode_number integer,
  match text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH q AS (
    SELECT internal.topic_key(p_title) AS key
  ),
  words AS (
    SELECT DISTINCT w.word
    FROM q, LATERAL regexp_split_to_table(q.key, ' ') AS w (word)
    WHERE length(w.word) >= 4
  ),
  need AS (
    SELECT count(*) AS total, GREATEST(2, ceil(count(*) * 0.6)) AS threshold FROM words
  ),
  candidates AS (
    SELECT 'episode'::text AS source, e.id, e.title, e.status, e.series_id, e.episode_number,
      e.title_key, e.created_at
    FROM public.episodes e
    WHERE p_exclude_episode_id IS NULL OR e.id <> p_exclude_episode_id
    UNION ALL
    SELECT 'suggestion'::text, s.id, s.title, s.status, s.series_id, NULL::integer, s.title_key,
      s.created_at
    FROM public.topic_suggestions s
    WHERE s.status <> 'picked'
  )
  SELECT c.source, c.id, c.title, c.status, c.series_id, c.episode_number,
    CASE WHEN c.title_key = q.key THEN 'exact' ELSE 'similar' END AS match, c.created_at
  FROM candidates c, q, need
  WHERE q.key <> '' AND (
    c.title_key = q.key
    OR (
      need.total >= 2
      AND (
        SELECT count(*) FROM words w WHERE w.word = ANY (string_to_array(c.title_key, ' '))
      ) >= need.threshold
    )
  )
  ORDER BY (c.title_key = q.key) DESC, c.created_at DESC, c.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)
$$;

-- ── 14) EXECUTE izinleri: açıkça ────────────────────────────────────────────
-- public sarmalayıcılar ve internal çekirdekler yalnız authenticated; private yardımcılar hiçbir
-- API rolüne açık değil. Service role'ün kullanıcı kimliği yoktur, bu RPC'leri çağıramaz.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature, n.nspname AS schema_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE (
      n.nspname IN ('public', 'internal') AND p.proname IN (
        'create_series', 'update_series', 'archive_series', 'create_topic_request',
        'add_topic_suggestions', 'pick_topic_suggestion', 'reject_topic_suggestion',
        'create_episode', 'update_episode', 'move_episode', 'archive_episode',
        'save_episode_script', 'approve_episode_script', 'enqueue_episode_job',
        'find_similar_topics'
      )
    ) OR (
      n.nspname = 'private' AND p.proname IN (
        'explainer_pre_approval_kinds', 'explainer_job_stages',
        'explainer_pre_approval_capabilities_ok', 'job_stages_explainer_rules', 'require_explainer_writer', 'assert_patch', 'sources_valid',
        'fact_notes_unsourced', 'episode_status', 'episode_has_open_job', 'episodes_guard',
        'episodes_record_version', 'episode_script_versions_guard', 'topic_suggestions_sync_series',
        'jobs_episode_gate', 'refresh_episode_status', 'jobs_sync_episode', 'create_job',
        'next_episode_number', 'create_episode_row', 'insert_topic_suggestions'
      )
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.signature
    );
    IF f.schema_name <> 'private' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.signature);
    END IF;
  END LOOP;
END;
$$;

-- Başlık anahtarı üretilmiş kolonda ve find_similar_topics içinde çalışır: yazan/okuyan rol
-- çağırabilmeli. Saf fonksiyondur, veri okumaz.
REVOKE ALL ON FUNCTION internal.topic_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION internal.topic_key(text) TO authenticated, service_role;
