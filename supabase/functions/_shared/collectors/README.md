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
