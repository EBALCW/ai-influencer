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
