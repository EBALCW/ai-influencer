# Platform toplayıcıları

`sync-dispatch` Edge Function'ı (#53) zamanlamayı, tekrar denemeyi ve veritabanı yazımını yapar. Her platform için yalnız bir **toplayıcı** (collector) yazılır: API'yi çağırıp yanıtı ortak tiplere çevirir. Sözleşme `types.ts` içindedir.

## Yeni toplayıcı eklemek (#50 Instagram, #51 YouTube, TikTok)

1. `collectors/<platform>.ts` dosyasında `Collector` arayüzünü uygula ve dışa aktar (ör. `export const instagramCollector: Collector`). İstemci/eşleme kodu büyürse `_shared/<platform>/` altına koy.
2. `collectors/index.ts` içindeki `collectors` nesnesine ekle: `instagram: instagramCollector`.
3. Testleri `collectors/<platform>.test.ts` dosyasına yaz. `ctx.fetch` için sahte fetch kullan, gerçek API'yi çağırma. Fixture'ları `_shared/<platform>/fixtures/` altına koy ve kişisel verileri sahteleştir.

Kaydı olmayan platformun hesapları sessizce atlanır. Toplayıcı henüz yoksa hata üretilmez.

## Sözleşme

| Metot                         | Ne zaman                                                                            | Döner                                          |
| ----------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| `fetchPosts(ctx, { since })`  | `posts` işi (30 dk), manuel                                                         | `CollectedPost[]`: yeni ve güncellenen postlar |
| `fetchAccount(ctx)`           | `accounts` işi (günde bir, 03:20 UTC), manuel                                       | `CollectedAccount`                             |
| `fetchPostMetrics(ctx, post)` | `metrics` işi (15 dk): yayından 1, 5, 24, 72 ve 168 saat sonra (`post.targetHours`) | `CollectedMetrics`, post silinmişse `null`     |

- `ctx.token.accessToken` kullanılır. Token yenileme #49'un (`refresh-tokens`) işidir, burada yazılmaz.
- Kota harcayan her çağrıdan sonra `ctx.reportQuota(birim)` çağrılır. Toplam `sync_runs.quota_units` alanına yazılır.
- Bilinmeyen veya eksik metrik için `ctx.warn('...')` çağrılır. Ham yanıt `raw` içinde döndürülür (`metric_snapshots.raw_payload`).
- Gelmeyen metrik `null` bırakılır, 0 yazılmaz. `completionRate` 0 ile 1 arasında olmalı.
- Toplayıcı veritabanına yazmaz, beklemez (`sleep` yok) ve tekrar denemez. Bunlar orkestratörün işidir.

## Hatalar

HTTP hatasını şu sınıflardan biriyle fırlat. `errorForResponse(response, 'etiket')` varsayılan eşlemeyi yapar: 401 → token, 429 → rate limit, 5xx → geçici, diğerleri → kalıcı. Platforma özgü durumları (ör. Instagram `400` + `code 190`) bu eşlemeden önce kendin ele al.

| Hata                                                          | Orkestratör ne yapar                                                                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TokenExpiredError(msg, 'expired' \| 'error')`                | Hesabın işi durur. `social_accounts.status` alanı `expired`/`error` olur (`error` → `sync_failed` uyarısı), çalışma `failed`                                                                           |
| `RateLimitedError(msg, retryAfterS, 'account' \| 'platform')` | `retryAfter` ≤ 30 sn ise bekleyip tekrar dener. Daha uzunsa durur, çalışma `partial` olur ve kalan iş sonraki cron'a kalır. `platform` kapsamında o platformun diğer hesapları da bu çalışmada atlanır |
| `TransientError`                                              | Üstel backoff ile 3 denemeye kadar tekrar dener (1 sn, 2 sn)                                                                                                                                           |
| `PermanentError` / diğer                                      | Tekrar denemez. O post atlanır, diğerleri devam eder. Hepsi başarısızsa çalışma `failed` olur (→ `sync_failed` uyarısı)                                                                                |

**Hata mesajına** token, istek URL'i (`?access_token=`) veya sağlayıcı yanıt gövdesi koyma. Orkestratör bilinen token'ları ve `*_token=` kalıplarını ayrıca maskeler, ama asıl sorumluluk toplayıcıdadır.

## Test

`fake.ts` → `createFakeCollector(platform, script)` her çağrının yanıtını ya da hatasını betikler. Orkestratör testleri (`_shared/sync/orchestrator.test.ts`) bu toplayıcıyı ve `MemoryStore`'u kullanır. Sahte toplayıcı üretim kaydına eklenmez.

```sh
cd supabase/functions && deno lint && deno test --allow-env
```

## YouTube (#51)

Kod: `youtube.ts` (toplayıcı), `_shared/youtube/client.ts` (HTTP + hata eşleme), `map.ts` (saf dönüşümler), `quota.ts` (birim tablosu), `fixtures/` (elle yazılmış, gerçek veri içermeyen yanıt örnekleri), `fake-fetch.ts` (yalnız testler). Testler: `youtube.test.ts`, `_shared/youtube/*.test.ts`.

### Çağrılar

| Metot              | Çağrı                                                                                                                                               | Data API birimi        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `fetchAccount`     | `channels.list?part=statistics&id=<external_id>` (external_id yoksa `mine=true`)                                                                    | 1                      |
| `fetchPosts`       | `channels.list?part=contentDetails` → uploads listesi; `playlistItems.list?part=contentDetails&maxResults=50` sayfaları; `videos.list` 50'lik paket | 1 + sayfa + ⌈n/50⌉     |
| `fetchPostMetrics` | `videos.list?part=statistics&id=<video>`; 24 sa noktasından itibaren Analytics `reports?ids=channel==MINE&filters=video==<id>`                      | 1 (Analytics sayılmaz) |

- `search.list` (100 birim) kullanılmaz. `part` sayısı maliyeti değiştirmez, bu yüzden posts için tek `videos.list` çağrısı `snippet,contentDetails,status,player,liveStreamingDetails` ister.
- Sayfalama: ilk senkronda en çok 10 sayfa (500 video), artımlı senkronda `since - 6 sa`'ten eski öğeye gelince ya da 4 sayfada durur.
- Yayımlanmamış videolar atlanır: tarihsiz playlist öğesi, `privacyStatus = private`, `liveBroadcastContent = upcoming/live`. Liste dışı (`unlisted`) videolar alınır.
- Metrik çağrısı post başınadır (sözleşme `fetchPostMetrics(ctx, post)`); bir nokta 1 birim olduğu için toplu istek gerekmedi.
- Analytics tarihleri Pasifik saatine göre gündür (`startDate` = yayın günü, `endDate` = bugün). Token kapsamı (`scope`) biliniyorsa ve `yt-analytics.readonly` içermiyorsa Analytics çağrılmaz. Analytics'ten gelen 403/400 Data API sayaçlarını engellemez (uyarı yazılır). 401, 429/kota ve 5xx orkestratöre gider.
- Analytics gecikmesi (24–48 sa): 1 ve 5 sa noktalarında yalnız Data API. Analytics boş dönerse snapshot yine yazılır (`raw.analyticsState = 'empty'`), izleme süresi ve tamamlama sonraki noktada (72/168 sa) dolar.

### Alan eşlemesi

| API alanı                                                          | Toplayıcı alanı → kolon                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `statistics.subscriberCount` / `videoCount` / `viewCount` (kanal)  | `followers` / `mediaCount` / `totalViews` → `account_snapshots.*`           |
| `id`, `snippet.publishedAt`                                        | `externalId`, `publishedAt` → `posts.external_id`, `posts.published_at`     |
| `snippet.title` + boş satır + `snippet.description`                | `caption` → `posts.caption`                                                 |
| `contentDetails.duration` (`PT1H2M3S`)                             | `durationS` → `posts.duration_s`                                            |
| süre + `player.embedWidth/embedHeight` (`maxHeight=640` ile döner) | `isShort` → `posts.is_short`; `url` = `/shorts/<id>` ya da `/watch?v=<id>`  |
| `statistics.viewCount` / `likeCount` / `commentCount` (video)      | `views` / `likes` / `comments` → `metric_snapshots.*` (gizliyse null)       |
| Analytics `shares`                                                 | `shares`                                                                    |
| Analytics `averageViewDuration` (sn)                               | `avgWatchTimeS` → `avg_watch_time_s`                                        |
| Analytics `averageViewPercentage` (0–100+)                         | `completionRate` = değer ÷ 100, en çok 1 (döngüdeki Shorts %100'ü aşabilir) |
| Analytics `views`, `estimatedMinutesWatched`, `subscribersGained`  | `raw.analytics` → `metric_snapshots.raw_payload`                            |
| —                                                                  | `saves`, `reach` = null (YouTube'da yok; orkestratör `_unmeasured` yazar)   |

### Shorts kuralı

Data API'de Short'u ayıran resmi bir alan yoktur (22 Eki 2026'da doğrulandı). Analytics'teki `creatorContentType = SHORTS` boyutu yalnız izlenme raporlarında var ve tek video filtresiyle bu metriklerle birlikte sorgulanamıyor. Sezgisel kural `map.ts` → `DEFAULT_SHORTS_RULE` içinde, toplayıcıya `createYoutubeCollector({ shorts })` ile verilebilir:

1. Süre ≤ `maxDurationS` (180 sn; Ekim 2024'ten beri Shorts 3 dakikaya kadar) **ve** yükseklik ≥ genişlik (dikey/kare) → Short.
2. En-boy oranı bilinmiyorsa süre ≤ `fallbackDurationS` (60 sn) → Short.
3. Canlı yayın kaydı (`liveStreamingDetails` var) ve süresi 0 olanlar Short değildir.

### Hata eşleme

| Yanıt                                                                       | Hata                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 401, `authError`, `UNAUTHENTICATED`                                         | `TokenExpiredError('expired')`                                                 |
| `invalid_grant` (OAuth)                                                     | `TokenExpiredError('error')` → `sync_failed`                                   |
| 403/429 + `quotaExceeded` / `dailyLimitExceeded`                            | `RateLimitedError(platform)`, bekleme = Pasifik gece yarısına kalan süre       |
| 403/429 + `rateLimitExceeded` / `userRateLimitExceeded`, ya da nedensiz 429 | `RateLimitedError(account)`, `Retry-After` varsa o kadar                       |
| 5xx, 408, ağ hatası                                                         | `TransientError`                                                               |
| diğerleri (400, 403 `insufficientPermissions`, 404 …)                       | `PermanentError`; mesajda yalnız durum kodu ve neden adı (gövde/URL/token yok) |

Kota birimi her yanıtta (Google hatalı isteklere de kota yazar) `ctx.reportQuota` ile raporlanır, ağ hatasında raporlanmaz.

### Kota tahmini

Birimler `quota.ts` → `YOUTUBE_QUOTA_COST` (kaynak: developers.google.com/youtube/v3/determine_quota_cost). Varsayılan proje kotası günde 10.000 birim, Pasifik gece yarısı sıfırlanır.

| İş (bir kanal)                  | Sıklık               | Birim / çalışma  | Günlük                |
| ------------------------------- | -------------------- | ---------------- | --------------------- |
| `posts` (yeni video yok / 1–50) | 48 (30 dk)           | 2 / 3            | ~96–144               |
| `accounts`                      | 1                    | 1                | 1                     |
| `metrics`                       | video başına 5 nokta | nokta başına 1   | 5 × günlük yeni video |
| İlk senkron (500 video)         | bir kez              | 1 + 10 + 10 = 21 | —                     |

Kanal başına günde ~150 birim + yeni video başına 5 birim: varsayılan kota ~60 kanala yeter. Bir Pasifik günündeki `sync_runs.quota_units` toplamı `notification_settings.youtube_quota_warn_units`'i (varsayılan 8.000) geçince `quota_warning` uyarısı yazılır (migration `20261022233000`).

### Ortam kurulumu (hosted)

- Google Cloud projesinde **YouTube Data API v3** ve **YouTube Analytics API** etkin olmalı. OAuth izinleri: `https://www.googleapis.com/auth/youtube.readonly` ve `https://www.googleapis.com/auth/yt-analytics.readonly` (bağlantı akışı #49).
- Toplayıcı yalnız `ctx.token.accessToken` kullanır, ek function secret'ı gerektirmez. Access token yenileme (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) #49'un `refresh-tokens` işindedir.

## TikTok (#52)

Kod: `tiktok.ts` (toplayıcı), `_shared/tiktok/client.ts` (HTTP + hata eşleme), `map.ts` (saf dönüşümler, alan listeleri), `fixtures/` (elle yazılmış, gerçek veri içermeyen yanıt örnekleri), `fake-fetch.ts` (yalnız testler). Testler: `tiktok.test.ts`, `_shared/tiktok/map.test.ts`. Ayrı bir `sync-tiktok` function'ı yoktur: zamanlama ve DB yazımı `sync-dispatch` (#53) üzerinden, toplayıcı `collectors/index.ts`'e kayıtlıdır.

### Çağrılar (Display API v2, `https://open.tiktokapis.com/v2`)

| Metot              | Çağrı                                                                                                                               | İzin                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `fetchAccount`     | `GET user/info/?fields=open_id,display_name,follower_count,following_count,likes_count,video_count`                                 | `user.info.basic`, `user.info.stats` |
| `fetchPosts`       | `POST video/list/?fields=id,create_time,title,video_description,duration,height,width,share_url`, gövde `{ max_count: 20, cursor }` | `video.list`                         |
| `fetchPostMetrics` | `POST video/query/?fields=id,view_count,like_count,comment_count,share_count`, gövde `{ filters: { video_ids: [id] } }`             | `video.list`                         |

- Token `Authorization: Bearer` başlığında gider. Yanıt zarfı `{ data, error: { code, message, log_id } }`; `error.code !== 'ok'` ise HTTP 200 olsa bile hata sayılır.
- Sayfalama: `video/list` yeniden eskiye sıralıdır, `cursor` (ms) + `has_more`. İlk senkronda en çok 25 sayfa (500 video), artımlı senkronda `since - 6 sa`'ten eski videoya gelince ya da 5 sayfada durur. İlerlemeyen cursor döngüyü bitirir.
- `fetchAccount`: hesabın `external_id`'si (TikTok `open_id`) doluysa ve token başka `open_id` döndürürse yazmaz (`PermanentError`), çünkü service role RLS'i aşar. `user.info.stats` izni yoksa sayaçlar gelmez; 0 yazmak yerine `PermanentError`.
- Kota: TikTok'ta birim kotası yok, dakikalık istek sınırı var (uç nokta başına ~600/dk). `sync_runs.quota_units` TikTok için **istek sayısıdır** (`quota_warning` yalnız YouTube'a bakar).

### Alan eşlemesi

| API alanı                                                     | Toplayıcı alanı → kolon                                                                 |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `follower_count` / `following_count` / `video_count`          | `followers` / `following` / `mediaCount` → `account_snapshots.*`                        |
| `likes_count` (hesabın toplam beğenisi)                       | `totalLikes` → `account_snapshots.total_likes` (yeni kolon, migration `20261022242000`) |
| `id`, `create_time` (Unix sn)                                 | `externalId`, `publishedAt` → `posts.external_id`, `posts.published_at`                 |
| `video_description` (başlık açıklamada yoksa önüne eklenir)   | `caption` → `posts.caption`                                                             |
| `duration`                                                    | `durationS`; `isShort` = süre ≤ 180 sn (ya da bilinmiyor)                               |
| `share_url` (sorgu parametreleri atılır)                      | `url` → `posts.url`                                                                     |
| `view_count` / `like_count` / `comment_count` / `share_count` | `views` / `likes` / `comments` / `shares` → `metric_snapshots.*`                        |
| —                                                             | `saves`, `reach`, `avgWatchTimeS`, `completionRate` = null (Display API vermez)         |

İzlenme süresi, tamamlama oranı, erişim ve kaydetme (favori) sayısı Display API'de **yoktur** (22 Eki 2026'da developers.tiktok.com → Display API → Video Object ile doğrulandı). `raw.unavailable` bu listeyi tutar; orkestratör `saves` için `_unmeasured` yazar. Bu metrikler panelden elle girilir: post detayı → "Elle girilen metrikler" (`POST /api/posts/[postId]/manual-metrics`, `metric_snapshots.source = 'manual'`). Elle girilen kontrol noktası sync'te ezilmez: `due_snapshots()` ölçülmüş noktayı döndürmez, yazım `ON CONFLICT (post_id, target_hours) DO NOTHING`'dir.

### Hata eşleme

| Yanıt                                              | Hata                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `scope_not_authorized` / `scope_permission_missed` | `TokenExpiredError('error')` → `sync_failed` (yeniden bağlanmak gerekir)       |
| 401, `access_token_invalid`                        | `TokenExpiredError('expired')`                                                 |
| 429, `rate_limit_exceeded`                         | `RateLimitedError(account)`, `Retry-After` varsa o kadar, yoksa backoff        |
| 5xx, 408, `internal_error`, ağ hatası              | `TransientError`                                                               |
| diğerleri (`invalid_params`, 403, 404 …)           | `PermanentError`; mesajda yalnız durum kodu ve hata kodu (gövde/URL/token yok) |

### Ortam kurulumu (hosted)

- developers.tiktok.com'da uygulama: **Login Kit** + **Display API** ürünleri, izinler `user.info.basic`, `user.info.stats`, `video.list`. Uygulama incelemeden geçmeden yalnız sandbox'a eklenen test kullanıcıları bağlanabilir.
- Toplayıcı yalnız `ctx.token.accessToken` kullanır, ek function secret'ı gerektirmez. Access token 24 saat, refresh token 365 gün geçerlidir; yenileme (`TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`) #49'un bağlantı/yenileme işindedir.

## Instagram (#50)

`instagram.ts`, `instagram.test.ts`, `_shared/instagram/fixtures/`: Instagram Login,
`graph.instagram.com/v23.0` (mevcut yorum adaptörüyle aynı sürüm). Ayrı bir
`sync-instagram` function yoktur; `sync-dispatch` kaydı kullanılır. Token Vault'tan,
DB yazımı, idempotent upsert, kota kaydı ve backoff ortak orkestratörden gelir.

- `fetchAccount`: `id,followers_count,follows_count,media_count`; `id` bağlı
  hesabın `external_id` değeriyle eşleşmelidir. Günlük erişim son 24 saat için
  `insights?metric=reach&period=day&metric_type=total_value` ile okunur.
- `fetchPosts`: `media` cursor sayfaları (50 kayıt, en çok 10 sayfa; ayarlanabilir).
  Sağlayıcının `paging.next` URL'i takip edilmez. Tekrarlayan/eksik cursor ve sayfa
  sınırı hatadır: eksik arşiv başarılı senkron gibi raporlanmaz. Daha eski
  kayıtlar `since - 6 saat` filtresinden geçer, bütün sayfalar taranır.
- `fetchPostMetrics`: medya kimliği ve `owner.id` hesapla eşleştirilir;
  `views,reach,likes,comments,shares,saved,total_interactions` istenir. REELS için
  `ig_reels_avg_watch_time,ig_reels_video_view_total_time` eklenir. Ortalama
  izleme ms → saniye çevrilir. Tamamlama oranı tahmin edilmez (NULL).
- `raw_payload.metrics` sayısal metrikleri (bilinmeyen adlar dahil),
  `mediaType`/`mediaProductType` medya türünü tutar. Toplam etkileşim ve toplam
  izleme süresi burada kalır; yeni kolon/migration yoktur. Thumbnail URL'i
  saklanmaz. Sağlayıcı açıklamaları, sayfalama URL'leri ve hata gövdeleri
  saklanmaz/loglanmaz. Gelmeyen metrik NULL; mevcut orkestratör zorunlu
  sayaçlardaki eksikliği `_unmeasured` ile işaretler.
- Kaldırılan `profile_views` sorgulanmaz; `account_snapshots.profile_views` NULL
  kalır. Canlı API sürümünde desteklenen profil metriği doğrulanmadan yerine
  başka metrik yazılmaz.
- İzinler: `instagram_business_basic`, `instagram_business_manage_insights`;
  Business/Creator hesap, #49 OAuth bağlantısı ve dolu `external_id` gerekir.
  Token yenileme burada yapılmaz. 190 → token; 4/17/32/613/429 → rate limit;
  5xx/ağ → geçici hata. Ortak orkestratör tekrar dener ve hesap durumunu yazar.

Resmi referanslar:
https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/insights/
https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/

**Canlı kabul testi bekliyor:** Meta referans sayfaları geliştirme ortamında
429/erişim hatası verdi; canlı hesap/API uygunluğu fixture testlerinin kanıtı
sayılmaz. #49 tamamlanıp test hesabında alanlar, izinler, owner kimliği, metrik
birimleri ve panel/Instagram eşitliği doğrulanmadan #50 kapatılmaz. Üretim
kaydına geçiş PR'ı bu doğrulama tamamlanana kadar draft tutulur.
