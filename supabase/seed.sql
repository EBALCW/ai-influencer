-- Deterministic demo data. No auth users, credentials, or real platform tokens are seeded.
INSERT INTO public.influencers (id, name, slug, niche, language, status)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  'Demo Creator',
  'demo-creator',
  'lifestyle',
  'tr',
  'draft'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  niche = EXCLUDED.niche,
  language = EXCLUDED.language,
  status = EXCLUDED.status;

INSERT INTO public.social_accounts (id, influencer_id, platform, handle, external_id, status)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'instagram', '@demo.creator', 'demo-instagram-account', 'pending'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'youtube', '@democreator', 'demo-youtube-channel', 'pending')
ON CONFLICT (id) DO UPDATE SET
  influencer_id = EXCLUDED.influencer_id,
  platform = EXCLUDED.platform,
  handle = EXCLUDED.handle,
  external_id = EXCLUDED.external_id,
  status = EXCLUDED.status;

INSERT INTO public.posts (id, account_id, external_id, url, caption, published_at, duration_s, is_short)
VALUES
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'demo-ig-post-01', 'https://example.invalid/ig/01', 'Demo post 1', '2026-10-01T10:00:00Z', 18, true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'demo-ig-post-02', 'https://example.invalid/ig/02', 'Demo post 2', '2026-10-02T10:00:00Z', 22, true),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'demo-ig-post-03', 'https://example.invalid/ig/03', 'Demo post 3', '2026-10-03T10:00:00Z', 16, true),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'demo-ig-post-04', 'https://example.invalid/ig/04', 'Demo post 4', '2026-10-04T10:00:00Z', 25, true),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'demo-ig-post-05', 'https://example.invalid/ig/05', 'Demo post 5', '2026-10-05T10:00:00Z', 20, true),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', 'demo-yt-post-06', 'https://example.invalid/yt/06', 'Demo post 6', '2026-10-06T10:00:00Z', 30, true),
  ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000002', 'demo-yt-post-07', 'https://example.invalid/yt/07', 'Demo post 7', '2026-10-07T10:00:00Z', 27, true),
  ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000002', 'demo-yt-post-08', 'https://example.invalid/yt/08', 'Demo post 8', '2026-10-08T10:00:00Z', 19, true),
  ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000002', 'demo-yt-post-09', 'https://example.invalid/yt/09', 'Demo post 9', '2026-10-09T10:00:00Z', 24, true),
  ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', 'demo-yt-post-10', 'https://example.invalid/yt/10', 'Demo post 10', '2026-10-10T10:00:00Z', 21, true)
ON CONFLICT (id) DO UPDATE SET
  account_id = EXCLUDED.account_id,
  external_id = EXCLUDED.external_id,
  url = EXCLUDED.url,
  caption = EXCLUDED.caption,
  published_at = EXCLUDED.published_at,
  duration_s = EXCLUDED.duration_s,
  is_short = EXCLUDED.is_short;

INSERT INTO public.metric_snapshots (id, post_id, captured_at, hours_since_publish, views, reach, likes, comments, shares, saves, avg_watch_time_s, completion_rate)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '2026-10-01T11:00:00Z', 1, 1200, 950, 74, 8, 5, 11, 12.4, 0.61),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '2026-10-02T11:00:00Z', 1, 980, 800, 62, 6, 3, 4, 13.1, 0.58),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', '2026-10-03T11:00:00Z', 1, 1450, 1120, 91, 11, 7, 8, 10.8, 0.66),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', '2026-10-04T11:00:00Z', 1, 760, 640, 39, 4, 2, 3, 14.5, 0.54),
  ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005', '2026-10-05T11:00:00Z', 1, 2100, 1680, 155, 17, 13, 15, 12.2, 0.72),
  ('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000006', '2026-10-06T11:00:00Z', 1, 3400, 2800, 210, 20, 18, 24, 18.2, 0.64),
  ('40000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000007', '2026-10-07T11:00:00Z', 1, 2850, 2300, 178, 15, 10, 18, 17.5, 0.67),
  ('40000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000008', '2026-10-08T11:00:00Z', 1, 1900, 1510, 105, 9, 8, 11, 12.8, 0.59),
  ('40000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000009', '2026-10-09T11:00:00Z', 1, 3200, 2600, 240, 21, 22, 29, 16.4, 0.71),
  ('40000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000010', '2026-10-10T11:00:00Z', 1, 2300, 1840, 165, 13, 12, 16, 15.6, 0.68)
ON CONFLICT (id) DO UPDATE SET
  post_id = EXCLUDED.post_id,
  captured_at = EXCLUDED.captured_at,
  hours_since_publish = EXCLUDED.hours_since_publish,
  views = EXCLUDED.views,
  reach = EXCLUDED.reach,
  likes = EXCLUDED.likes,
  comments = EXCLUDED.comments,
  shares = EXCLUDED.shares,
  saves = EXCLUDED.saves,
  avg_watch_time_s = EXCLUDED.avg_watch_time_s,
  completion_rate = EXCLUDED.completion_rate;

-- Demo uyarıları (#56): bildirim merkezinde görünen örnekler. Payload'da sadece id, sayı ve enum değerleri var.
INSERT INTO public.alerts (id, influencer_id, type, payload, dedupe_key, created_at)
VALUES
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'viral_post',
   '{"post_id": "30000000-0000-4000-8000-000000000009", "account_id": "20000000-0000-4000-8000-000000000002", "platform": "youtube", "views": 9600, "baseline": 2730, "ratio": 3.5, "multiplier": 3}',
   'viral_post:30000000-0000-4000-8000-000000000009', now() - interval '20 minutes'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'follower_milestone',
   '{"account_id": "20000000-0000-4000-8000-000000000001", "platform": "instagram", "milestone": 10000, "followers": 10240}',
   'follower_milestone:20000000-0000-4000-8000-000000000001:10000', now() - interval '2 hours'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'token_expiring',
   '{"account_id": "20000000-0000-4000-8000-000000000001", "platform": "instagram", "days_left": 5}',
   'token_expiring:20000000-0000-4000-8000-000000000001:demo', now() - interval '5 hours'),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'sync_failed',
   '{"account_id": "20000000-0000-4000-8000-000000000002", "platform": "youtube"}',
   'sync_failed:20000000-0000-4000-8000-000000000002:demo', now() - interval '1 day'),
  ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'content_not_ready',
   '{"content_item_id": "00000000-0000-4000-8000-000000000000", "stage": "edit"}',
   'content_not_ready:demo', now() - interval '2 days')
ON CONFLICT (id) DO UPDATE SET
  influencer_id = EXCLUDED.influencer_id,
  type = EXCLUDED.type,
  payload = EXCLUDED.payload,
  dedupe_key = EXCLUDED.dedupe_key;
