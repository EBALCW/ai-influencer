-- Çalışma alanı yalıtımı (#181, migration 20261113100000_workspaces.sql).
--
-- Düzen: önce tek alan varken (A = "Varsayılan çalışma alanı") her kiracı tablosuna bir satır
-- yazılır; sonra create_workspace_for_user ile ikinci alan (B) açılır. Ardından B'nin owner'ı
-- olarak HER tabloda A'nın satırı okunmaya, güncellenmeye, silinmeye ve A'ya satır eklenmeye
-- çalışılır. Test sayısı tablo sayısına bağlı olduğu için no_plan kullanılır.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.no_plan();

-- ── Katalog: yeni tablo unutulmasın ─────────────────────────────────────────
-- Her public tablo ya kiracı tablosudur (workspace_id NOT NULL + workspaces FK + RESTRICTIVE
-- policy + üst türetme trigger'ı) ya da aşağıdaki BİLİNÇLİ muafiyet listesindedir:
--   workspaces               kiracının kendisi; kendi policy'leri var (aşağıda denetlenir)
--   generation_worker_status üretim worker'ının kurulum geneli sağlık satırı; kullanıcı verisi
--                            içermez, yalnız service role yazar
-- Yeni tablo eklerken: ya kiracı tablosu yap ya da gerekçesiyle bu listeye ekle.
CREATE TEMP TABLE tenant_tables ON COMMIT DROP AS
SELECT c.relname::text AS table_name, c.oid AS table_oid
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname NOT IN ('workspaces', 'generation_worker_status');
GRANT SELECT ON tenant_tables TO authenticated;

SELECT extensions.is(
  ARRAY(
    SELECT t.table_name FROM tenant_tables t
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = t.table_oid AND a.attname = 'workspace_id'
        AND a.attnotnull AND NOT a.attisdropped
    )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'every non-exempt public table has a NOT NULL workspace_id column'
);
SELECT extensions.is(
  ARRAY(
    SELECT t.table_name FROM tenant_tables t
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_constraint k
      JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
      WHERE k.conrelid = t.table_oid AND k.contype = 'f'
        AND k.confrelid = 'public.workspaces'::regclass
        AND a.attname = 'workspace_id' AND k.confdeltype = 'c'
    )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'every workspace_id references workspaces with ON DELETE CASCADE'
);
SELECT extensions.is(
  ARRAY(
    SELECT t.table_name FROM tenant_tables t
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_policy p
      WHERE p.polrelid = t.table_oid
        AND NOT p.polpermissive
        AND p.polcmd = '*'
        AND p.polroles = ARRAY['authenticated'::regrole::oid]
        AND pg_get_expr(p.polqual, p.polrelid) LIKE '%workspace_id = %current_workspace_id()%'
        AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%workspace_id = %current_workspace_id()%'
    )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'every non-exempt public table has a RESTRICTIVE FOR ALL workspace policy'
);
SELECT extensions.is(
  ARRAY(
    SELECT t.table_name FROM tenant_tables t
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_trigger g
      WHERE g.tgrelid = t.table_oid AND g.tgname = 'aa_set_workspace' AND NOT g.tgisinternal
        AND g.tgfoid = 'private.set_workspace_from_parent()'::regprocedure
        AND g.tgenabled = 'O'
    )
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'every non-exempt public table has the workspace derivation/immutability trigger'
);
SELECT extensions.is(
  ARRAY(
    SELECT t.table_name FROM tenant_tables t
    WHERE (
      SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attrdef d
      JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      WHERE d.adrelid = t.table_oid AND a.attname = 'workspace_id'
    ) NOT LIKE '%current_workspace_id()'
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'workspace_id defaults to current_workspace_id() everywhere'
);
-- FK ile bağlı her üst kayıt trigger'da denetlenmeli (FK kısıtı RLS'e bakmaz).
SELECT extensions.is(
  ARRAY(
    SELECT format('%s.%s -> %s', t.table_name, a.attname, k.confrelid::regclass)
    FROM tenant_tables t
    JOIN pg_constraint k ON k.conrelid = t.table_oid AND k.contype = 'f'
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    JOIN tenant_tables parent ON parent.table_oid = k.confrelid
    JOIN pg_attribute pa ON pa.attrelid = k.confrelid AND pa.attnum = k.confkey[1]
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_trigger g
      WHERE g.tgrelid = t.table_oid AND g.tgname = 'aa_set_workspace'
        AND position(
          convert_to(format('%s=%s.%s', a.attname, parent.table_name, pa.attname), 'UTF8')
          IN g.tgargs
        ) > 0
    )
    -- comments.account_id: comments_prepare her yazımda post'un hesabıyla ezer; post denetlenir.
    AND NOT (t.table_name = 'comments' AND a.attname = 'account_id')
    ORDER BY 1
  ),
  ARRAY[]::text[],
  'every foreign key between tenant tables is checked by the workspace trigger'
);
SELECT extensions.ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.workspaces'::regclass)
  AND NOT has_table_privilege('authenticated', 'public.workspaces', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.workspaces', 'DELETE')
  AND NOT has_table_privilege('anon', 'public.workspaces', 'SELECT')
  AND has_column_privilege('authenticated', 'public.workspaces', 'name', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.workspaces', 'push_enabled', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.workspaces', 'id', 'UPDATE'),
  'workspaces: RLS on; clients cannot insert/delete and may only update the name'
);
SELECT extensions.is(
  ARRAY(SELECT id::text FROM storage.buckets WHERE id NOT IN ('assets', 'contracts') ORDER BY 1),
  ARRAY[]::text[],
  'every storage bucket is handled by storage_object_in_workspace (add new buckets there)'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_policy p
    WHERE p.polrelid = 'storage.objects'::regclass AND p.polname = 'storage_objects_workspace'
      AND NOT p.polpermissive AND p.polcmd = '*'
      AND pg_get_expr(p.polqual, p.polrelid) LIKE '%storage_object_in_workspace%'
      AND pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%storage_object_in_workspace%'
  ),
  'storage.objects has a RESTRICTIVE workspace policy for every command'
);
SELECT extensions.ok(
  (SELECT bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=""']) FROM pg_proc p
   WHERE p.oid IN (
     'private.set_workspace_from_parent()'::regprocedure,
     'private.create_workspace_for_user(uuid, text)'::regprocedure,
     'private.raise_budget_alerts(date, uuid)'::regprocedure,
     'private.raise_alert(text, uuid, jsonb, text, uuid)'::regprocedure
   )),
  'new privileged functions are SECURITY DEFINER with an empty search_path'
);
SELECT extensions.ok(
  NOT has_function_privilege('authenticated', 'public.create_workspace_for_user(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.create_workspace_for_user(uuid, text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.create_workspace_for_user(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'private.create_workspace_for_user(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.current_workspace_id()', 'EXECUTE'),
  'only the service role can create workspaces; anon cannot resolve a workspace'
);
SELECT extensions.ok(
  (SELECT bool_and(NOT p.prosecdef) FROM pg_proc p
   WHERE p.pronamespace = 'internal'::regnamespace
     AND p.proname IN ('fx_rate', 'credits_to_money', 'cost_entries_converted', 'budget_status', 'report_summary')),
  'workspace-parameterised cost/report cores are SECURITY INVOKER (caller RLS still applies)'
);
SELECT extensions.ok(
  EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'private.sync_requests'::regclass AND attname = 'workspace_id' AND attnotnull
  ),
  'manual sync throttle rows carry a workspace'
);

-- ── Fixture: kullanıcılar ───────────────────────────────────────────────────
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT u.id, 'authenticated', 'authenticated', u.email, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
FROM (VALUES
  ('a1810000-0000-4000-8000-000000000001'::uuid, 'ws-a-owner@example.invalid'),
  ('a1810000-0000-4000-8000-000000000002'::uuid, 'ws-a-editor@example.invalid'),
  ('a1810000-0000-4000-8000-000000000003'::uuid, 'ws-a-viewer@example.invalid'),
  ('a1810000-0000-4000-8000-000000000004'::uuid, 'ws-a-mover@example.invalid'),
  ('b1810000-0000-4000-8000-000000000001'::uuid, 'ws-b-owner@example.invalid'),
  ('b1810000-0000-4000-8000-000000000002'::uuid, 'ws-b-editor@example.invalid'),
  ('c1810000-0000-4000-8000-000000000001'::uuid, 'ws-outsider@example.invalid')
) AS u (id, email);

-- ── Tek alan varken: oturumsuz yazım o alana düşer ──────────────────────────
SELECT extensions.is((SELECT count(*)::integer FROM public.workspaces), 1, 'migration leaves exactly one workspace');
SELECT extensions.is(
  public.current_workspace_id(), (SELECT id FROM public.workspaces),
  'single workspace: sessionless (service role / postgres) calls resolve to it'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.influencers WHERE workspace_id <> (SELECT id FROM public.workspaces)),
  0, 'existing (seed) rows were moved into the default workspace'
);
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT extensions.is(
  public.current_workspace_id(), NULL::uuid,
  'an anon JWT without a user never gets the single-workspace fallback'
);
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
SELECT extensions.is(
  public.current_workspace_id(), NULL::uuid,
  'an authenticated JWT without a user id never gets the single-workspace fallback'
);
SELECT set_config('request.jwt.claims', '', true);

INSERT INTO public.team_members (user_id, role) VALUES
  ('a1810000-0000-4000-8000-000000000001', 'owner'),
  ('a1810000-0000-4000-8000-000000000002', 'editor'),
  ('a1810000-0000-4000-8000-000000000003', 'viewer'),
  ('a1810000-0000-4000-8000-000000000004', 'editor');

-- ── Fixture: A alanında her kiracı tablosuna bir satır ──────────────────────
INSERT INTO public.influencers (id, name, slug, status)
VALUES ('a1820000-0000-4000-8000-000000000001', 'WS A Influencer', 'ws-shared-slug', 'active');
INSERT INTO public.influencer_personas (influencer_id, version, bio, is_current)
VALUES ('a1820000-0000-4000-8000-000000000001', 1, 'A persona', true);
INSERT INTO public.assets (id, influencer_id, kind, storage_path, mime_type)
VALUES ('a1830000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001', 'final_video',
  'a1820000-0000-4000-8000-000000000001/ws-a.mp4', 'video/mp4');
INSERT INTO public.prompts (id, influencer_id, category, key, title, body)
VALUES ('a1840000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001', 'caption', 'ws-a', 'A prompt', 'gövde');
INSERT INTO public.generations (id, influencer_id, tool, type, status)
VALUES ('a1850000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001', 'ws-tool', 'image', 'queued');
INSERT INTO public.social_accounts (id, influencer_id, platform, handle, external_id, status, token_ref)
VALUES ('a1860000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001', 'instagram',
  '@ws.a', 'ws-a-external', 'active', 'ws-a-token-ref');
INSERT INTO public.content_items (id, influencer_id, title, assignee_id, target_account_id)
VALUES ('a1870000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001', 'A içerik',
  'a1810000-0000-4000-8000-000000000002', 'a1860000-0000-4000-8000-000000000001');
INSERT INTO public.posts (id, account_id, content_item_id, external_id, published_at)
VALUES ('a1880000-0000-4000-8000-000000000001', 'a1860000-0000-4000-8000-000000000001',
  'a1870000-0000-4000-8000-000000000001', 'ws-a-post', now() - interval '2 days');
INSERT INTO public.metric_snapshots (post_id, captured_at, views, target_hours)
VALUES ('a1880000-0000-4000-8000-000000000001', now() - interval '1 day', 10, 24);
INSERT INTO public.account_snapshots (account_id, captured_at, followers)
VALUES ('a1860000-0000-4000-8000-000000000001', now() - interval '1 day', 10);
INSERT INTO public.costs (id, influencer_id, category, amount, currency, incurred_on)
VALUES ('a1890000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001', 'tool', 1, 'USD', '2001-03-10');
INSERT INTO public.brands (id, name) VALUES ('a18a0000-0000-4000-8000-000000000001', 'WS Ortak Marka');
INSERT INTO public.brand_deals (id, brand_id, influencer_id)
VALUES ('a18b0000-0000-4000-8000-000000000001', 'a18a0000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001');
INSERT INTO public.alerts (id, influencer_id, type, payload)
VALUES ('a18c0000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001', 'sync_failed', '{}');
INSERT INTO public.budgets (id, influencer_id, month, amount, currency) VALUES
  ('a18d0000-0000-4000-8000-000000000001', NULL, '2001-03-01', 100, 'USD'),
  ('a18d0000-0000-4000-8000-000000000002', 'a1820000-0000-4000-8000-000000000001', '2001-04-01', 1000, 'USD');
INSERT INTO public.exchange_rates (currency, base_currency, rate, valid_on) VALUES ('EUR', 'USD', 1.1, '2001-01-01');
INSERT INTO public.credit_rates (tool, currency, rate_per_credit, valid_from) VALUES ('ws-tool', 'USD', 1, '2001-01-01');
INSERT INTO public.content_item_assets (content_item_id, asset_id)
VALUES ('a1870000-0000-4000-8000-000000000001', 'a1830000-0000-4000-8000-000000000001');
INSERT INTO public.posting_slots (account_id, weekday, local_time)
VALUES ('a1860000-0000-4000-8000-000000000001', 1, '10:00');
INSERT INTO public.app_settings (key, value) VALUES ('ai', '{"model":"ws-a"}')
ON CONFLICT (workspace_id, key) DO UPDATE SET value = EXCLUDED.value;
INSERT INTO public.learnings (influencer_id, post_id, body)
VALUES ('a1820000-0000-4000-8000-000000000001', 'a1880000-0000-4000-8000-000000000001', 'A öğrenimi');
INSERT INTO public.alert_reads (alert_id, user_id)
VALUES ('a18c0000-0000-4000-8000-000000000001', 'a1810000-0000-4000-8000-000000000002');
INSERT INTO public.reports (influencer_id, period_start, period_end, summary)
VALUES ('a1820000-0000-4000-8000-000000000001', '2001-03-05', '2001-03-11', '{}');
INSERT INTO public.sync_runs (job, platform, account_id, status)
VALUES ('posts', 'instagram', 'a1860000-0000-4000-8000-000000000001', 'succeeded');
INSERT INTO public.brand_deal_content_items (brand_deal_id, content_item_id)
VALUES ('a18b0000-0000-4000-8000-000000000001', 'a1870000-0000-4000-8000-000000000001');
INSERT INTO public.brand_deal_files (brand_deal_id, storage_path, file_name)
VALUES ('a18b0000-0000-4000-8000-000000000001', 'a18b0000-0000-4000-8000-000000000001/a.pdf', 'a.pdf');
-- publish_jobs doğrulaması (checklist, bağlı hesap…) bu testin konusu değil: yalnız fixture için
-- kullanıcı trigger'ları kapatılır; satır tek alan varken DEFAULT ile A'ya düşer.
ALTER TABLE public.publish_jobs DISABLE TRIGGER USER;
INSERT INTO public.publish_jobs (id, content_item_id, account_id, asset_id, platform, title)
VALUES ('a18e0000-0000-4000-8000-000000000001', 'a1870000-0000-4000-8000-000000000001',
  'a1860000-0000-4000-8000-000000000001', 'a1830000-0000-4000-8000-000000000001', 'instagram', 'A yayın');
ALTER TABLE public.publish_jobs ENABLE TRIGGER USER;
INSERT INTO public.comments (id, post_id, account_id, platform, external_id, text, published_at)
VALUES ('a18f0000-0000-4000-8000-000000000001', 'a1880000-0000-4000-8000-000000000001',
  'a1860000-0000-4000-8000-000000000001', 'instagram', 'ws-a-comment', 'A yorumu', now() - interval '1 hour');
INSERT INTO public.comment_replies (comment_id, body)
VALUES ('a18f0000-0000-4000-8000-000000000001', 'A yanıtı');
INSERT INTO public.trends (id, influencer_id, url)
VALUES ('a1900000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001', 'https://example.invalid/ws-trend');
INSERT INTO public.clip_sources (id, video_id, video_url, channel_name, title, duration_seconds, permission_status, permission_ref)
VALUES ('a1910000-0000-4000-8000-000000000001', 'wsAAAAAAAA1', 'https://www.youtube.com/watch?v=wsAAAAAAAA1',
  'WS Kanal', 'A yayını', 600, 'granted', 'IZIN-WS-A');
INSERT INTO public.clips (id, source_id, influencer_id, title, start_seconds, end_seconds)
VALUES ('a1920000-0000-4000-8000-000000000001', 'a1910000-0000-4000-8000-000000000001',
  'a1820000-0000-4000-8000-000000000001', 'A klibi', 10, 40);

-- ── İkinci alan: create_workspace_for_user ──────────────────────────────────
CREATE TEMP TABLE ws ON COMMIT DROP AS
SELECT id AS a, NULL::uuid AS b FROM public.workspaces;
UPDATE ws SET b = private.create_workspace_for_user('b1810000-0000-4000-8000-000000000001', '  İkinci alan  ');
GRANT SELECT ON ws TO authenticated;

SELECT extensions.results_eq(
  $$SELECT w.name, w.push_enabled, w.created_by FROM public.workspaces w WHERE w.id = (SELECT b FROM ws)$$,
  $$VALUES ('İkinci alan'::text, false, 'b1810000-0000-4000-8000-000000000001'::uuid)$$,
  'create_workspace_for_user creates a trimmed, push-disabled workspace'
);
SELECT extensions.results_eq(
  $$SELECT role::text, workspace_id FROM public.team_members WHERE user_id = 'b1810000-0000-4000-8000-000000000001'$$,
  $$SELECT 'owner'::text, b FROM ws$$,
  'create_workspace_for_user makes the user the owner of the new workspace'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.notification_settings WHERE workspace_id = (SELECT b FROM ws)),
  1, 'a new workspace gets its own notification settings row'
);
SELECT extensions.throws_ok(
  $$SELECT private.create_workspace_for_user('a1810000-0000-4000-8000-000000000001', 'Üçüncü')$$,
  '23514', NULL, 'the last owner of a workspace cannot be moved to a new one'
);
SELECT extensions.throws_ok(
  $$SELECT private.create_workspace_for_user('a1810000-0000-4000-8000-000000000002', '   ')$$,
  '22023', NULL, 'workspace name must be 1-80 characters'
);
SELECT extensions.throws_ok(
  $$SELECT private.create_workspace_for_user('00000000-0000-4000-8000-00000000dead', 'Yok')$$,
  'P0002', NULL, 'unknown user is rejected'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.workspaces), 2,
  'failed create_workspace_for_user calls leave no workspace behind'
);

INSERT INTO public.team_members (user_id, role, workspace_id)
SELECT 'b1810000-0000-4000-8000-000000000002', 'editor', b FROM ws;

-- ── İki alan varken: oturumsuz çağrı alan bulamaz ───────────────────────────
SELECT extensions.is(
  public.current_workspace_id(), NULL::uuid,
  'two workspaces: sessionless calls get NULL (server code must pass or derive the workspace)'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.brands (name) VALUES ('Alansız marka')$$,
  '23502', NULL, 'two workspaces: a parentless service-role insert without workspace_id is rejected'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.content_items (id, influencer_id, title)
    VALUES ('a1870000-0000-4000-8000-000000000002', 'a1820000-0000-4000-8000-000000000001', 'Türetilen')$$,
  'two workspaces: a service-role insert with a parent needs no workspace_id'
);
SELECT extensions.is(
  (SELECT workspace_id FROM public.content_items WHERE id = 'a1870000-0000-4000-8000-000000000002'),
  (SELECT a FROM ws), 'workspace_id is derived from the parent influencer'
);

-- B alanının kendi verisi (alan açıkça verilir ya da üstten türetilir).
INSERT INTO public.influencers (id, name, slug, status, workspace_id)
SELECT 'b1820000-0000-4000-8000-000000000001', 'WS B Influencer', 'ws-shared-slug', 'active', b FROM ws;
SELECT extensions.pass('influencer slug is unique per workspace: the same slug exists in A and B');
SELECT extensions.throws_ok(
  $$INSERT INTO public.influencers (name, slug, workspace_id) SELECT 'Kopya', 'ws-shared-slug', b FROM ws$$,
  '23505', NULL, 'the slug is still unique inside one workspace'
);
INSERT INTO public.social_accounts (id, influencer_id, platform, handle, external_id, status, token_ref)
VALUES ('b1860000-0000-4000-8000-000000000001', 'b1820000-0000-4000-8000-000000000001', 'instagram',
  '@ws.b', 'ws-b-external', 'active', 'ws-b-token-ref');
SELECT extensions.is(
  (SELECT workspace_id FROM public.social_accounts WHERE id = 'b1860000-0000-4000-8000-000000000001'),
  (SELECT b FROM ws), 'child of a workspace-B influencer lands in workspace B'
);
INSERT INTO public.content_items (id, influencer_id, title)
VALUES ('b1870000-0000-4000-8000-000000000001', 'b1820000-0000-4000-8000-000000000001', 'B içerik');
INSERT INTO public.brands (id, name, workspace_id)
SELECT 'b18a0000-0000-4000-8000-000000000001', 'WS Ortak Marka', b FROM ws;
SELECT extensions.pass('brand names are unique per workspace: the same name exists in A and B');
INSERT INTO public.app_settings (key, value, workspace_id) SELECT 'ai', '{"model":"ws-b"}', b FROM ws;
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.app_settings WHERE key = 'ai'), 2,
  'app_settings keys are per workspace'
);
INSERT INTO public.clip_sources (id, video_id, video_url, channel_name, title, permission_status, permission_ref, workspace_id)
SELECT 'b1910000-0000-4000-8000-000000000001', 'wsAAAAAAAA1', 'https://www.youtube.com/watch?v=wsAAAAAAAA1',
  'WS Kanal', 'B yayını', 'granted', 'IZIN-WS-B', b FROM ws;
SELECT extensions.pass('clip source video_url is unique per workspace');
INSERT INTO public.clips (id, source_id, title, start_seconds, end_seconds)
VALUES ('b1920000-0000-4000-8000-000000000001', 'b1910000-0000-4000-8000-000000000001', 'B klibi', 0, 30);
INSERT INTO public.trends (id, url, workspace_id)
SELECT 'b1900000-0000-4000-8000-000000000001', 'https://example.invalid/ws-trend', b FROM ws;
SELECT extensions.pass('trend url is unique per workspace');

-- Service role da alanlar arası bağ kuramaz; workspace_id değiştirilemez.
SELECT extensions.throws_ok(
  $$INSERT INTO public.content_items (influencer_id, title, assignee_id)
    VALUES ('a1820000-0000-4000-8000-000000000001', 'Çapraz atama', 'b1810000-0000-4000-8000-000000000002')$$,
  '23514', NULL, 'assignee must be a member of the content item''s workspace (FK ignores RLS)'
);
SELECT extensions.throws_ok(
  $$UPDATE public.content_items SET assignee_id = 'b1810000-0000-4000-8000-000000000002'
    WHERE id = 'a1870000-0000-4000-8000-000000000001'$$,
  '23514', NULL, 'an UPDATE cannot attach a row to another workspace''s member either'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.brand_deals (brand_id, influencer_id)
    VALUES ('b18a0000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001')$$,
  '23514', NULL, 'a deal cannot join an influencer and a brand from different workspaces'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.clips (source_id, influencer_id, title, start_seconds, end_seconds)
    VALUES ('b1910000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001', 'Çapraz klip', 0, 10)$$,
  '23514', NULL, 'a clip cannot point at another workspace''s influencer'
);
UPDATE public.influencers SET workspace_id = (SELECT b FROM ws) WHERE id = 'a1820000-0000-4000-8000-000000000001';
SELECT extensions.is(
  (SELECT workspace_id FROM public.influencers WHERE id = 'a1820000-0000-4000-8000-000000000001'),
  (SELECT a FROM ws), 'workspace_id is immutable, even for the service role'
);
UPDATE public.team_members SET workspace_id = (SELECT b FROM ws) WHERE user_id = 'a1810000-0000-4000-8000-000000000003';
SELECT extensions.is(
  (SELECT workspace_id FROM public.team_members WHERE user_id = 'a1810000-0000-4000-8000-000000000003'),
  (SELECT a FROM ws), 'a membership cannot be moved between workspaces with UPDATE'
);
INSERT INTO public.content_items (id, influencer_id, title, workspace_id)
SELECT 'a1870000-0000-4000-8000-000000000003', 'a1820000-0000-4000-8000-000000000001', 'Yanlış alan verildi', b FROM ws;
SELECT extensions.is(
  (SELECT workspace_id FROM public.content_items WHERE id = 'a1870000-0000-4000-8000-000000000003'),
  (SELECT a FROM ws), 'an explicit workspace_id is overridden by the parent''s workspace'
);
DELETE FROM public.content_items
WHERE id IN ('a1870000-0000-4000-8000-000000000002', 'a1870000-0000-4000-8000-000000000003');

-- ── HER kiracı tablosu: B'nin owner'ı A'nın satırına dokunamaz ──────────────
-- Fixture satırı A'daki bir satırın kopyasıdır (yeni id ile). İki ekleme denenir:
--   explicit: workspace_id = A (istemci başka alanı açıkça verir)
--   parent  : workspace_id = B ama FK'ler A'nın kayıtlarını gösterir (üst türetme A yapar)
CREATE TEMP TABLE isolation_results (
  table_name text PRIMARY KEY,
  fixture_rows bigint, seen bigint, updated bigint, deleted bigint,
  insert_explicit text, insert_parent text, derives boolean, has_parent boolean,
  rows_a_after bigint, rows_b_before bigint, rows_b_after bigint, row_unchanged boolean
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.probe_tenant_tables() RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  t text;
  v_a uuid := (SELECT a FROM ws);
  v_b uuid := (SELECT b FROM ws);
  v_row jsonb; v_row_after jsonb; v_new jsonb;
  v_cols text[];
  v_order text;
  r isolation_results;
BEGIN
  FOR t IN SELECT table_name FROM tenant_tables ORDER BY 1 LOOP
    r := NULL;
    r.table_name := t;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id = $1', t)
      INTO r.fixture_rows USING v_a;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id = $1', t)
      INTO r.rows_b_before USING v_b;
    -- Trigger'ın alanı türettiği FK kolonları ('?' ile başlamayanlar). Fixture satırı olarak bu
    -- kolonlardan en az biri dolu olan satır seçilir ki "parent" denemesi anlamlı olsun.
    SELECT COALESCE(array_agg(split_part(arg, '=', 1)), '{}') INTO v_cols
    FROM pg_trigger g,
      LATERAL unnest(string_to_array(encode(g.tgargs, 'escape'), '\000')) AS arg
    WHERE g.tgrelid = ('public.' || t)::regclass AND g.tgname = 'aa_set_workspace'
      AND arg <> '' AND left(arg, 1) <> '?';
    r.derives := cardinality(v_cols) > 0;
    SELECT COALESCE('(' || string_agg(format('x.%I IS NOT NULL', c), ' OR ') || ')', '(x.workspace_id IS NOT NULL)')
      INTO v_order FROM unnest(v_cols) AS c;
    EXECUTE format(
      'SELECT to_jsonb(x) FROM public.%I x WHERE x.workspace_id = $1 ORDER BY %s DESC, to_jsonb(x)::text LIMIT 1',
      t, v_order
    ) INTO v_row USING v_a;
    r.has_parent := EXISTS (SELECT 1 FROM unnest(v_cols) AS c WHERE (v_row ->> c) IS NOT NULL);
    v_new := v_row;
    IF v_new ? 'id' AND jsonb_typeof(v_new -> 'id') = 'string' THEN
      v_new := v_new || jsonb_build_object('id', gen_random_uuid());
    END IF;

    PERFORM set_config('request.jwt.claim.sub', 'b1810000-0000-4000-8000-000000000001', true);
    SET LOCAL ROLE authenticated;

    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id = $1', t)
        INTO r.seen USING v_a;
    EXCEPTION WHEN insufficient_privilege THEN
      r.seen := 0;
    END;
    BEGIN
      EXECUTE format(
        'WITH u AS (UPDATE public.%I SET workspace_id = $2 WHERE workspace_id = $1 RETURNING 1) '
        'SELECT count(*) FROM u', t
      ) INTO r.updated USING v_a, v_b;
    EXCEPTION WHEN OTHERS THEN
      r.updated := 0;
    END;
    BEGIN
      EXECUTE format(
        'WITH d AS (DELETE FROM public.%I WHERE workspace_id = $1 RETURNING 1) SELECT count(*) FROM d', t
      ) INTO r.deleted USING v_a;
    EXCEPTION WHEN OTHERS THEN
      r.deleted := 0;
    END;
    BEGIN
      EXECUTE format(
        'INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I, $1)).*', t, t
      ) USING v_new;
      -- Eklenebildiyse kaydı bırakma: sonraki denemeler ve testler etkilenmesin.
      RAISE EXCEPTION 'geri al' USING ERRCODE = 'WS001';
    EXCEPTION
      WHEN SQLSTATE 'WS001' THEN r.insert_explicit := 'inserted';
      WHEN OTHERS THEN r.insert_explicit := SQLSTATE;
    END;
    BEGIN
      EXECUTE format(
        'INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I, $1)).*', t, t
      ) USING v_new || jsonb_build_object('workspace_id', v_b);
      RAISE EXCEPTION 'geri al' USING ERRCODE = 'WS001';
    EXCEPTION
      WHEN SQLSTATE 'WS001' THEN r.insert_parent := 'inserted';
      WHEN OTHERS THEN r.insert_parent := SQLSTATE;
    END;

    RESET ROLE;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id = $1', t)
      INTO r.rows_a_after USING v_a;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE workspace_id = $1', t)
      INTO r.rows_b_after USING v_b;
    EXECUTE format(
      'SELECT to_jsonb(x) FROM public.%I x WHERE x.workspace_id = $1 ORDER BY %s DESC, to_jsonb(x)::text LIMIT 1',
      t, v_order
    ) INTO v_row_after USING v_a;
    r.row_unchanged := v_row_after IS NOT DISTINCT FROM v_row;
    INSERT INTO isolation_results VALUES (r.*);
  END LOOP;
END;
$fn$;
SELECT pg_temp.probe_tenant_tables();

SELECT extensions.is(
  ARRAY(SELECT table_name FROM isolation_results WHERE fixture_rows = 0 ORDER BY 1),
  ARRAY[]::text[], 'the fixture has a workspace-A row in every tenant table'
);
SELECT extensions.is(
  ARRAY(SELECT table_name FROM isolation_results WHERE seen <> 0 ORDER BY 1),
  ARRAY[]::text[], 'workspace B cannot read workspace A rows in any tenant table'
);
SELECT extensions.is(
  ARRAY(SELECT table_name FROM isolation_results WHERE updated <> 0 OR NOT row_unchanged ORDER BY 1),
  ARRAY[]::text[], 'workspace B cannot update workspace A rows in any tenant table'
);
SELECT extensions.is(
  ARRAY(SELECT table_name FROM isolation_results WHERE deleted <> 0 OR rows_a_after < fixture_rows ORDER BY 1),
  ARRAY[]::text[], 'workspace B cannot delete workspace A rows in any tenant table'
);
SELECT extensions.is(
  ARRAY(SELECT table_name FROM isolation_results
        WHERE insert_explicit = 'inserted' OR rows_a_after > fixture_rows ORDER BY 1),
  ARRAY[]::text[], 'workspace B cannot insert a row with workspace_id = A in any tenant table'
);
-- "parent" denemesi yalnız alanı üstten türeten tablolarda anlamlıdır (kök tabloda bu, meşru bir
-- B satırıdır). Fixture bu tabloların hepsinde üst kaydı dolu bir satır içermelidir.
SELECT extensions.is(
  ARRAY(SELECT table_name FROM isolation_results WHERE derives AND NOT has_parent ORDER BY 1),
  ARRAY[]::text[], 'the fixture row has a parent in every table that derives its workspace'
);
SELECT extensions.is(
  ARRAY(SELECT table_name FROM isolation_results
        WHERE has_parent AND (insert_parent = 'inserted' OR rows_b_after > rows_b_before) ORDER BY 1),
  ARRAY[]::text[], 'workspace B cannot attach a child row to a workspace A parent in any tenant table'
);
SELECT extensions.cmp_ok(
  (SELECT count(*)::integer FROM isolation_results WHERE has_parent), '>=', 25,
  'the parent-attachment probe covered the child tables'
);

-- Aynı denemeler tek tek ve beklenen hata koduyla (mekanizma: RLS WITH CHECK = 42501).
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b1810000-0000-4000-8000-000000000001', true);
SELECT extensions.is(public.current_workspace_id(), (SELECT b FROM ws), 'B owner resolves to workspace B');
SELECT extensions.throws_ok(
  $$INSERT INTO public.brands (name, workspace_id) SELECT 'A''ya sızan marka', a FROM ws$$,
  '42501', NULL, 'B owner cannot insert a root row into workspace A'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.content_items (influencer_id, title)
    VALUES ('a1820000-0000-4000-8000-000000000001', 'A influencer''ına içerik')$$,
  '42501', NULL, 'B owner cannot add content to a workspace A influencer'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.social_accounts (influencer_id, platform, handle)
    VALUES ('a1820000-0000-4000-8000-000000000001', 'tiktok', '@sizinti')$$,
  '42501', NULL, 'B owner cannot add a social account to a workspace A influencer'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.budgets (influencer_id, month, amount)
    VALUES ('a1820000-0000-4000-8000-000000000001', '2001-04-01', 5)$$,
  '42501', NULL, 'B owner cannot set a budget on a workspace A influencer'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.content_items (influencer_id, title, assignee_id)
    VALUES ('b1820000-0000-4000-8000-000000000001', 'A üyesine atama', 'a1810000-0000-4000-8000-000000000002')$$,
  '23514', NULL, 'B owner cannot assign own content to a workspace A member'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.influencers), 1, 'B owner sees only workspace B influencers'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.prompt_lineages), 0, 'views (security_invoker) hide workspace A prompts'
);

-- Ekip ve alan kayıtları
SELECT extensions.results_eq(
  $$SELECT user_id FROM public.team_members ORDER BY 1$$,
  $$VALUES ('b1810000-0000-4000-8000-000000000001'::uuid), ('b1810000-0000-4000-8000-000000000002'::uuid)$$,
  'B owner sees only the members of workspace B'
);
SELECT extensions.results_eq(
  $$SELECT id FROM public.workspaces$$, $$SELECT b FROM ws$$, 'B owner sees only workspace B'
);
SELECT extensions.is_empty(
  $$UPDATE public.team_members SET role = 'viewer' WHERE user_id = 'a1810000-0000-4000-8000-000000000002' RETURNING 1$$,
  'B owner cannot change a workspace A member''s role'
);
SELECT extensions.is_empty(
  $$DELETE FROM public.team_members WHERE user_id = 'a1810000-0000-4000-8000-000000000003' RETURNING 1$$,
  'B owner cannot remove a workspace A member'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.team_members (user_id, role, workspace_id)
    SELECT 'c1810000-0000-4000-8000-000000000001', 'owner', a FROM ws$$,
  '42501', NULL, 'B owner cannot add a member to workspace A'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.team_members (user_id, role) VALUES ('c1810000-0000-4000-8000-000000000001', 'viewer')$$,
  'B owner can add a member to the own workspace (workspace_id defaults to it)'
);
SELECT extensions.is_empty(
  $$UPDATE public.workspaces SET name = 'Ele geçirildi' WHERE id = (SELECT a FROM ws) RETURNING 1$$,
  'B owner cannot rename workspace A'
);
SELECT extensions.results_eq(
  $$UPDATE public.workspaces SET name = 'B yeni ad' RETURNING name$$,
  $$VALUES ('B yeni ad'::text)$$, 'B owner renames only the own workspace'
);
SELECT extensions.throws_ok(
  $$UPDATE public.workspaces SET push_enabled = true$$,
  '42501', NULL, 'an owner cannot enable instance-wide push channels for the own workspace'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.workspaces (name) VALUES ('İstemciden alan')$$,
  '42501', NULL, 'clients cannot create workspaces'
);
SELECT extensions.throws_ok(
  $$DELETE FROM public.workspaces$$, '42501', NULL, 'clients cannot delete workspaces'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_workspace_for_user(auth.uid(), 'Kendi alanım')$$,
  '42501', NULL, 'clients cannot call create_workspace_for_user'
);

-- ── RLS'i aşan RPC'ler başka alanın id'sini reddeder ────────────────────────
SELECT extensions.throws_ok(
  $$SELECT public.cancel_generation('a1850000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'cancel_generation (DEFINER core) cannot see a workspace A generation'
);
SELECT extensions.is(
  public.request_sync('a1860000-0000-4000-8000-000000000001'), 'not_found',
  'request_sync (DEFINER core) cannot see a workspace A account'
);
SELECT extensions.throws_ok(
  $$SELECT public.retry_generation('a1850000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'retry_generation cannot see a workspace A generation'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_generation('a1820000-0000-4000-8000-000000000001', 'image', 'ws-tool')$$,
  '42501', NULL, 'enqueue_generation cannot queue for a workspace A influencer'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_trend_to_backlog('a1900000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'push_trend_to_backlog cannot see a workspace A trend'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_trend_to_backlog('b1900000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'push_trend_to_backlog cannot target a workspace A influencer'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('a1920000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'push_clip_to_backlog cannot see a workspace A clip'
);
SELECT extensions.throws_ok(
  $$SELECT public.push_clip_to_backlog('b1920000-0000-4000-8000-000000000001', 'a1820000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'push_clip_to_backlog cannot target a workspace A influencer'
);
SELECT extensions.throws_ok(
  $$SELECT public.save_content_item('a1870000-0000-4000-8000-000000000001', '{"title":"ele geçirildi"}'::jsonb)$$,
  'P0002', NULL, 'save_content_item cannot see a workspace A content item'
);
SELECT extensions.throws_ok(
  $$SELECT public.enqueue_publish_job('a1870000-0000-4000-8000-000000000001', 'başlık')$$,
  'P0002', NULL, 'enqueue_publish_job cannot see a workspace A content item'
);
SELECT extensions.throws_ok(
  $$SELECT public.cancel_publish_job('a18e0000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'cancel_publish_job cannot see a workspace A job'
);
SELECT extensions.throws_ok(
  $$SELECT public.record_manual_metrics('a1880000-0000-4000-8000-000000000001', 1, 1, 1, 1)$$,
  'P0002', NULL, 'record_manual_metrics cannot see a workspace A post'
);
SELECT extensions.throws_ok(
  $$SELECT public.create_persona_version('a1820000-0000-4000-8000-000000000001', 'x', 'x', '{}', '{}', '{}', '{}')$$,
  'P0002', NULL, 'create_persona_version cannot see a workspace A influencer'
);
SELECT extensions.throws_ok(
  $$SELECT public.generate_weekly_report('2001-03-05', 'a1820000-0000-4000-8000-000000000001')$$,
  'P0002', NULL, 'generate_weekly_report cannot report on a workspace A influencer'
);
SELECT extensions.is(
  public.mark_alerts_read(ARRAY['a18c0000-0000-4000-8000-000000000001'::uuid]), 0,
  'mark_alerts_read ignores workspace A alerts'
);
SELECT extensions.is(public.unread_alert_count(), 0, 'workspace A alerts are not counted for B');
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.budget_status('2001-03-15')), 0,
  'budget_status shows no workspace A budgets'
);
SELECT extensions.is(
  public.fx_rate('EUR', 'USD', '2001-06-01'), NULL::numeric, 'fx_rate does not use workspace A exchange rates'
);
SELECT extensions.is_empty(
  $$SELECT 1 FROM public.credits_to_money('ws-tool', 10, '2001-06-01')$$,
  'credits_to_money does not use workspace A credit rates'
);
SELECT extensions.is(
  internal.fx_rate('EUR', 'USD', '2001-06-01', (SELECT a FROM ws)), NULL::numeric,
  'passing another workspace id to the INVOKER core still hits RLS'
);
SELECT extensions.is(
  (public.dashboard_overview('2001-03-01', '2001-03-31', 'ws-shared-slug') ->> 'accounts')::integer, 1,
  'dashboard for the shared slug resolves to the caller''s own influencer (B has one account)'
);
SELECT extensions.is(
  public.report_summary('2001-03-05', '2001-03-11', 'a1820000-0000-4000-8000-000000000001'), NULL::jsonb,
  'report_summary returns nothing for a workspace A influencer'
);

-- Storage yardımcıları ve nesneler
SELECT extensions.ok(
  NOT public.asset_object_in_influencer_folder('a1820000-0000-4000-8000-000000000001/x.png')
  AND NOT public.brand_file_in_deal_folder('a18b0000-0000-4000-8000-000000000001/x.pdf')
  AND NOT public.storage_object_in_workspace('assets', 'a1820000-0000-4000-8000-000000000001/x.png')
  AND NOT public.storage_object_in_workspace('contracts', 'a18b0000-0000-4000-8000-000000000001/x.pdf'),
  'storage helpers reject workspace A folders for B'
);
SELECT extensions.ok(
  public.asset_object_in_influencer_folder('b1820000-0000-4000-8000-000000000001/x.png')
  AND public.storage_object_in_workspace('assets', 'b1820000-0000-4000-8000-000000000001/x.png')
  AND NOT public.storage_object_in_workspace('yeni-bucket', 'b1820000-0000-4000-8000-000000000001/x.png'),
  'storage helpers accept the own folder and deny unknown buckets'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('assets', 'a1820000-0000-4000-8000-000000000001/sizinti.png')$$,
  '42501', NULL, 'B owner cannot upload into a workspace A influencer folder'
);
SELECT extensions.throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('contracts', 'a18b0000-0000-4000-8000-000000000001/sizinti.pdf')$$,
  '42501', NULL, 'B owner cannot upload into a workspace A deal folder'
);
SELECT extensions.lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('assets', 'b1820000-0000-4000-8000-000000000001/b.png')$$,
  'B owner uploads into the own influencer folder'
);

-- A'nın editörü kendi klasörüne yükler; B onu göremez, silemez.
SELECT set_config('request.jwt.claim.sub', 'a1810000-0000-4000-8000-000000000002', true);
SELECT extensions.is(public.current_workspace_id(), (SELECT a FROM ws), 'A editor resolves to workspace A');
SELECT extensions.lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('assets', 'a1820000-0000-4000-8000-000000000001/a.png')$$,
  'A editor uploads into the own influencer folder'
);
SELECT extensions.lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name) VALUES ('contracts', 'a18b0000-0000-4000-8000-000000000001/a.pdf')$$,
  'A editor uploads into the own deal folder'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM storage.objects WHERE bucket_id IN ('assets', 'contracts')
   AND name IN ('a1820000-0000-4000-8000-000000000001/a.png', 'a18b0000-0000-4000-8000-000000000001/a.pdf',
                'b1820000-0000-4000-8000-000000000001/b.png')),
  2, 'A editor sees the own objects but not workspace B''s'
);
SELECT set_config('request.jwt.claim.sub', 'b1810000-0000-4000-8000-000000000001', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM storage.objects WHERE bucket_id IN ('assets', 'contracts')
   AND name IN ('a1820000-0000-4000-8000-000000000001/a.png', 'a18b0000-0000-4000-8000-000000000001/a.pdf',
                'b1820000-0000-4000-8000-000000000001/b.png')),
  1, 'B owner sees only the own storage object (reads were bucket-wide before)'
);
SELECT extensions.is_empty(
  $$DELETE FROM storage.objects WHERE name = 'a1820000-0000-4000-8000-000000000001/a.png' RETURNING 1$$,
  'B owner cannot delete a workspace A storage object'
);
SELECT extensions.is_empty(
  $$UPDATE storage.objects SET name = 'b1820000-0000-4000-8000-000000000001/calinti.png'
    WHERE name = 'a1820000-0000-4000-8000-000000000001/a.png' RETURNING 1$$,
  'B owner cannot move a workspace A storage object into the own folder'
);

-- ── Roller alan içinde eskisi gibi çalışır ──────────────────────────────────
SELECT set_config('request.jwt.claim.sub', 'a1810000-0000-4000-8000-000000000003', true);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.influencers WHERE id = 'a1820000-0000-4000-8000-000000000001'),
  1, 'A viewer reads workspace A data'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.influencers WHERE id = 'b1820000-0000-4000-8000-000000000001'),
  0, 'A viewer cannot read workspace B data'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.influencers (name, slug) VALUES ('Viewer denemesi', 'ws-viewer-denemesi')$$,
  '42501', NULL, 'A viewer is still read-only'
);
SELECT extensions.is_empty(
  $$UPDATE public.influencers SET name = 'Viewer yazdı' WHERE id = 'a1820000-0000-4000-8000-000000000001' RETURNING 1$$,
  'A viewer cannot update'
);
SELECT extensions.is_empty(
  $$UPDATE public.workspaces SET name = 'Viewer adı' RETURNING 1$$, 'A viewer cannot rename the workspace'
);

SELECT set_config('request.jwt.claim.sub', 'a1810000-0000-4000-8000-000000000002', true);
SELECT extensions.lives_ok(
  $$INSERT INTO public.influencers (id, name, slug) VALUES ('a1820000-0000-4000-8000-000000000002', 'Editor ekledi', 'ws-editor-ekledi')$$,
  'A editor writes in workspace A'
);
SELECT extensions.is(
  (SELECT workspace_id FROM public.influencers WHERE id = 'a1820000-0000-4000-8000-000000000002'),
  (SELECT a FROM ws), 'rows written by an A editor land in workspace A'
);
SELECT extensions.lives_ok(
  $$INSERT INTO public.content_items (influencer_id, title, assignee_id)
    VALUES ('a1820000-0000-4000-8000-000000000001', 'Kendi ekibine atama', 'a1810000-0000-4000-8000-000000000004')$$,
  'A editor assigns content to a member of the own workspace'
);
SELECT extensions.is_empty(
  $$UPDATE public.workspaces SET name = 'Editor adı' RETURNING 1$$, 'A editor cannot rename the workspace'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.exchange_rates (currency, base_currency, rate, valid_on) VALUES ('GBP', 'USD', 1.3, '2001-01-01')$$,
  '42501', NULL, 'A editor still cannot write owner-only settings tables'
);
SELECT extensions.is(
  public.fx_rate('EUR', 'USD', '2001-06-01'), 1.1::numeric, 'A editor reads the own workspace exchange rate'
);
SELECT extensions.is(
  public.request_sync('a1860000-0000-4000-8000-000000000001') <> 'not_found', true,
  'request_sync still finds the caller''s own account'
);
SELECT extensions.is(
  (public.cancel_generation('a1850000-0000-4000-8000-000000000001')).status::text, 'cancelled',
  'cancel_generation still works inside the own workspace'
);

SELECT set_config('request.jwt.claim.sub', 'a1810000-0000-4000-8000-000000000001', true);
SELECT extensions.results_eq(
  $$UPDATE public.workspaces SET name = 'A yeni ad' RETURNING name$$,
  $$VALUES ('A yeni ad'::text)$$, 'A owner renames workspace A'
);
SELECT extensions.results_eq(
  $$UPDATE public.team_members SET role = 'viewer' WHERE user_id = 'a1810000-0000-4000-8000-000000000004' RETURNING role::text$$,
  $$VALUES ('viewer'::text)$$, 'A owner manages roles inside workspace A'
);
SELECT extensions.is_empty(
  $$UPDATE public.team_members SET role = 'viewer' WHERE user_id = 'b1810000-0000-4000-8000-000000000002' RETURNING 1$$,
  'A owner cannot manage workspace B members'
);
SELECT extensions.throws_ok(
  $$INSERT INTO public.team_members (user_id, role) VALUES ('b1810000-0000-4000-8000-000000000002', 'editor')$$,
  '23505', NULL, 'a user belongs to one workspace: an existing member of B cannot be added to A'
);

-- Ekip dışı kullanıcı hiçbir alanı çözemez.
RESET ROLE;
DELETE FROM public.team_members WHERE user_id = 'c1810000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'c1810000-0000-4000-8000-000000000001', true);
SELECT extensions.is(public.current_workspace_id(), NULL::uuid, 'a non-member resolves to no workspace');
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.influencers) + (SELECT count(*)::integer FROM public.workspaces)
    + (SELECT count(*)::integer FROM public.team_members),
  0, 'a non-member sees nothing'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ── Son owner kuralı alan başına ────────────────────────────────────────────
SELECT extensions.throws_ok(
  $$UPDATE public.team_members SET role = 'viewer' WHERE user_id = 'b1810000-0000-4000-8000-000000000001'$$,
  '23514', NULL, 'the only owner of workspace B cannot be demoted although workspace A has an owner'
);
SELECT extensions.throws_ok(
  $$DELETE FROM public.team_members WHERE user_id = 'a1810000-0000-4000-8000-000000000001'$$,
  '23514', NULL, 'the only owner of workspace A cannot be removed'
);

-- ── OAuth RPC'leri (service role; kullanıcı kimliği parametre) ──────────────
SELECT extensions.throws_ok(
  $$SELECT private.oauth_state_save(repeat('a', 43), 'b1810000-0000-4000-8000-000000000002',
    'a1820000-0000-4000-8000-000000000001', 'youtube', repeat('v', 43), clock_timestamp() + interval '5 minutes')$$,
  '42501', NULL, 'oauth_state_save rejects an influencer of another workspace'
);
SELECT extensions.lives_ok(
  $$SELECT private.oauth_state_save(repeat('b', 43), 'a1810000-0000-4000-8000-000000000002',
    'a1820000-0000-4000-8000-000000000001', 'youtube', repeat('v', 43), clock_timestamp() + interval '5 minutes')$$,
  'oauth_state_save accepts the own workspace influencer'
);
-- Durum A editörü için kayıtlı; B editörü aynı hash ile tüketemez (kullanıcıya bağlı) ve A
-- editörü başka alana taşınırsa (aşağıda yapılmaz) influencer koşulu da engeller.
SELECT extensions.is(
  private.oauth_state_consume(repeat('b', 43), 'b1810000-0000-4000-8000-000000000002',
    'a1820000-0000-4000-8000-000000000001', 'youtube'),
  NULL::jsonb, 'oauth_state_consume returns nothing to a member of another workspace'
);
SELECT extensions.throws_ok(
  $$SELECT private.oauth_connect_token('b1810000-0000-4000-8000-000000000002', 'a1860000-0000-4000-8000-000000000001',
    'a1820000-0000-4000-8000-000000000001', 'instagram', 'ws-a-external', '{"access_token":"t"}'::jsonb, NULL)$$,
  '42501', NULL, 'oauth_connect_token rejects an account of another workspace'
);
SELECT extensions.throws_ok(
  $$SELECT private.oauth_revoke_begin('b1810000-0000-4000-8000-000000000002', 'a1860000-0000-4000-8000-000000000001',
    'a1820000-0000-4000-8000-000000000001')$$,
  '42501', NULL, 'oauth_revoke_begin rejects an account of another workspace'
);
SELECT extensions.is(
  (SELECT status::text FROM public.social_accounts WHERE id = 'a1860000-0000-4000-8000-000000000001'),
  'active', 'the workspace A account is untouched by the rejected OAuth calls'
);

-- ── Sistem işleri: satırlar doğru alana, hesaplar alan başına ───────────────
-- Uyarı: influencer'dan türetilir; influencer'sız ve alansız çağrı iki alan varken yazılmaz.
SELECT extensions.ok(
  private.raise_alert('sync_failed', 'b1820000-0000-4000-8000-000000000001', '{}'::jsonb, 'ws:dedupe'),
  'raise_alert without a workspace derives it from the influencer'
);
SELECT extensions.is(
  (SELECT workspace_id FROM public.alerts WHERE dedupe_key = 'ws:dedupe'),
  (SELECT b FROM ws), 'the alert lands in the influencer''s workspace'
);
SELECT extensions.ok(
  private.raise_alert('quota_warning', NULL, '{}'::jsonb, 'ws:dedupe', (SELECT a FROM ws)),
  'the same dedupe key can be used in another workspace'
);
SELECT extensions.ok(
  NOT private.raise_alert('quota_warning', NULL, '{}'::jsonb, 'ws:dedupe', (SELECT a FROM ws)),
  'the dedupe key is still unique inside a workspace'
);
SELECT extensions.ok(
  NOT private.raise_alert('quota_warning', NULL, '{}'::jsonb, 'ws:orphan'),
  'two workspaces: an alert with neither influencer nor workspace is not written'
);
-- Push hedefleri kurulum genelinde tek settir: yalnız operatörün açtığı alan kullanabilir.
SELECT vault.create_secret('https://ntfy.example.invalid/ws-alerts', 'notify_ntfy_url');
UPDATE public.notification_settings SET push_ntfy = true;
SELECT extensions.is(
  (SELECT count(*)::integer FROM private.alert_push_requests('sync_failed', (SELECT a FROM ws))), 1,
  'the default workspace (push_enabled) produces a push request'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM private.alert_push_requests('sync_failed', (SELECT b FROM ws))), 0,
  'a workspace without push_enabled never uses the instance-wide push channels'
);
UPDATE public.notification_settings SET push_ntfy = false;

-- Worker (service role) üretimi tamamlar: maliyet üretimin KENDİ alanının kredi fiyatıyla yazılır.
INSERT INTO public.credit_rates (tool, currency, rate_per_credit, valid_from, workspace_id)
SELECT 'ws-tool', 'USD', 2, '2001-01-01', b FROM ws;
SELECT extensions.pass('credit rates are unique per workspace: the same tool/date exists in A and B');
INSERT INTO public.generations (id, influencer_id, tool, type, status, credits, created_at)
VALUES ('b1850000-0000-4000-8000-000000000001', 'b1820000-0000-4000-8000-000000000001', 'ws-tool', 'image',
  'succeeded', 10, '2001-03-10T10:00:00Z');
SELECT extensions.results_eq(
  $$SELECT amount, workspace_id FROM public.costs WHERE generation_id = 'b1850000-0000-4000-8000-000000000001'$$,
  $$SELECT 20.0000::numeric, b FROM ws$$,
  'generation cost uses the generation''s own workspace credit rate (2/credit in B, not A''s 1/credit)'
);

-- Bütçe: B'nin gideri A'nın toplam bütçesine sayılmaz; uyarı yalnız B'de oluşur.
INSERT INTO public.budgets (id, influencer_id, month, amount, currency, workspace_id)
SELECT 'b18d0000-0000-4000-8000-000000000001', NULL, '2001-03-01', 10, 'USD', b FROM ws;
SELECT extensions.pass('the team-total budget is unique per workspace and month');
SELECT extensions.results_eq(
  $$SELECT spent FROM internal.budget_status('2001-03-15', (SELECT a FROM ws))$$,
  $$VALUES (1.0000::numeric)$$, 'workspace A total budget counts only workspace A costs'
);
SELECT extensions.results_eq(
  $$SELECT spent FROM internal.budget_status('2001-03-15', (SELECT b FROM ws))$$,
  $$VALUES (20.0000::numeric)$$, 'workspace B total budget counts only workspace B costs'
);
SELECT extensions.results_eq(
  $$SELECT workspace_id, type FROM public.alerts WHERE type IN ('budget_warning', 'budget_exceeded')
    AND payload ->> 'month' = '2001-03'$$,
  $$SELECT b, 'budget_exceeded'::text FROM ws$$,
  'the budget alert is raised only in the workspace whose budget is exceeded'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.budget_status('2001-03-15')), 0,
  'two workspaces: the public wrapper returns nothing to a sessionless caller'
);

-- Haftalık rapor (cron): her alan için ayrı ekip toplamı.
SELECT public.generate_weekly_reports('2001-03-05');
SELECT extensions.results_eq(
  $$SELECT workspace_id FROM public.reports WHERE influencer_id IS NULL AND period_start = '2001-03-05' ORDER BY 1$$,
  $$SELECT x FROM ws, LATERAL (VALUES (a), (b)) v (x) ORDER BY 1$$,
  'weekly job writes one team report per workspace'
);
SELECT extensions.results_eq(
  $$SELECT (r.summary -> 'cost' ->> 'total')::numeric FROM public.reports r
    WHERE r.influencer_id IS NULL AND r.period_start = '2001-03-05' AND r.workspace_id = (SELECT a FROM ws)$$,
  $$VALUES (1.0000::numeric)$$, 'workspace A team report contains only workspace A costs'
);
SELECT extensions.results_eq(
  $$SELECT (r.summary -> 'cost' ->> 'total')::numeric FROM public.reports r
    WHERE r.influencer_id IS NULL AND r.period_start = '2001-03-05' AND r.workspace_id = (SELECT b FROM ws)$$,
  $$VALUES (20.0000::numeric)$$, 'workspace B team report contains only workspace B costs'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.alerts a JOIN public.reports r ON a.payload ->> 'report_id' = r.id::text
   WHERE a.type = 'weekly_report_ready' AND a.workspace_id <> r.workspace_id),
  0, 'report-ready alerts are written to the report''s workspace'
);

-- ── create_workspace_for_user: başka alandaki üyeyi taşır ───────────────────
CREATE TEMP TABLE moved ON COMMIT DROP AS
SELECT private.create_workspace_for_user('a1810000-0000-4000-8000-000000000004', 'Taşınan alan') AS c;
SELECT extensions.results_eq(
  $$SELECT role::text, workspace_id FROM public.team_members WHERE user_id = 'a1810000-0000-4000-8000-000000000004'$$,
  $$SELECT 'owner'::text, c FROM moved$$,
  'a non-owner member of another workspace is moved and becomes owner of the new one'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.team_members
   WHERE workspace_id = (SELECT a FROM ws) AND user_id = 'a1810000-0000-4000-8000-000000000004'),
  0, 'the moved user is no longer a member of the old workspace'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.content_items WHERE assignee_id = 'a1810000-0000-4000-8000-000000000004'),
  0, 'assignments in the old workspace are cleared when the member leaves'
);

-- Alan silinince (service role) üyelikler son owner kuralına takılmadan CASCADE ile gider.
SELECT extensions.lives_ok(
  $$DELETE FROM public.workspaces WHERE id = (SELECT c FROM moved)$$,
  'deleting a workspace cascades its memberships (last-owner rule does not block it)'
);
SELECT extensions.is(
  (SELECT count(*)::integer FROM public.team_members WHERE user_id = 'a1810000-0000-4000-8000-000000000004'),
  0, 'memberships of a deleted workspace are gone'
);

SELECT * FROM extensions.finish();
ROLLBACK;
