# ADR 0002: Görsel/video üretim sağlayıcısı

- **Durum:** Önerildi (karar ekip tarafından verilecek)
- **Tarih:** 2026-10-21
- **İlgili issue:** [#47](https://github.com/EBALCW/ai-influencer/issues/47)

## Bağlam

Panel görsel üretimi, image-to-video ve video-to-video (karakter giydirme / motion transfer, bkz. #15) işlerini tetikleyecek. Operasyon tarafında Higgsfield kullanılıyor (videoda "Hixfield"). Sağlayıcı değişebileceği için kod `GenerationProvider` arayüzüne yazılır, sağlayıcı env ile seçilir (`GENERATION_PROVIDER`, varsayılan `mock`).

Bu belgedeki her bilgi resmi dokümandan alındı ve kaynak linki verildi. Doğrulanamayan maddeler **doğrulanamadı** olarak işaretlendi. Tarih: 2026-10-21.

## Higgsfield: resmi API var mı?

**Evet.** Higgsfield'in herkese açık bir REST API'si ve resmi SDK'ları var. API, higgsfield.ai aboneliğinden ayrı bir üründür ve ayrı faturalandırılır.

| Konu           | Bulgu                                                                                                                                                                                                                                                                                    | Kaynak                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Base URL       | `https://api.higgsfield.ai`                                                                                                                                                                                                                                                              | [API reference overview](https://docs.higgsfield.ai/docs/api-reference/overview.md)                          |
| Auth           | `Authorization: Key <API_KEY_ID>:<API_KEY_SECRET>`; anahtarlar sadece sunucuda                                                                                                                                                                                                           | [Quickstart](https://docs.higgsfield.ai/docs/quickstart.md)                                                  |
| Gönderim       | `POST /<model-id>` (ör. `/higgsfield-ai/soul/v2/standard`); opsiyonel `Idempotency-Key` başlığı                                                                                                                                                                                          | [Quickstart](https://docs.higgsfield.ai/docs/quickstart.md)                                                  |
| İş modeli      | Asenkron: yanıt `request_id`, `status`, `status_url`, `cancel_url`                                                                                                                                                                                                                       | [Requests and lifecycle](https://docs.higgsfield.ai/docs/concepts/requests.md)                               |
| Durumlar       | `queued`, `in_progress` · terminal: `completed`, `failed`, `nsfw`, `canceled`                                                                                                                                                                                                            | [Requests and lifecycle](https://docs.higgsfield.ai/docs/concepts/requests.md)                               |
| Durum okuma    | `GET /requests/{request_id}/status`                                                                                                                                                                                                                                                      | [Quickstart](https://docs.higgsfield.ai/docs/quickstart.md)                                                  |
| İptal          | `POST /requests/{request_id}/cancel` → 202 (gövdesiz). Sadece `queued` iş iptal edilir, başlamışsa 400                                                                                                                                                                                   | [Cancel a queued request](https://docs.higgsfield.ai/docs/api-reference/requests/cancel-a-queued-request.md) |
| Webhook        | `hf_webhook` query parametresi. Gövde: `request_id`, `status`, `error`, `payload`. 5xx/ağ hatasında 2 saat boyunca yeniden dener, 4xx kalıcı sayılır, tekrar teslim olabilir (dedupe: `request_id` + terminal status), 10 sn içinde yanıt verilmeli. **İmza doğrulaması belgelenmemiş.** | [Webhooks](https://docs.higgsfield.ai/docs/how-to/webhooks.md)                                               |
| Çıktı          | Görsel: `images[].url`, video: `video.url`                                                                                                                                                                                                                                               | [Requests and lifecycle](https://docs.higgsfield.ai/docs/concepts/requests.md)                               |
| Hatalar        | 400 parametre/eşzamanlılık · 401 kimlik · 403 yetersiz kredi · 404 bulunamadı · 422 doğrulama/idempotency · 423 model geçici kapalı · 500 · 503 model hazır değil. Gövde `{ "detail": ... }`; mesajın ayrıştırılmaması öneriliyor                                                        | [Errors and retries](https://docs.higgsfield.ai/docs/concepts/errors.md)                                     |
| Rate limit     | Sabit sayı yayımlanmamış, hesap ve modele göre değişiyor. Eşzamanlılık sınırı **400** ile dönüyor; `Retry-After` veya rate-limit başlıkları yok                                                                                                                                          | [Rate limits](https://docs.higgsfield.ai/docs/concepts/rate-limits.md)                                       |
| Faturalandırma | Kredi. Sadece başarılı istek ücretlendirilir; `failed`/`nsfw` ve iptal edilen queued iş iade edilir. Krediler 1 yıl geçerli                                                                                                                                                              | [Billing and retention](https://docs.higgsfield.ai/docs/concepts/billing-and-retention.md)                   |
| Çıktı saklama  | En az 7 gün erişilebilir, sonra silinebilir. Çıktılar kendi Storage'ımıza indirilmeli                                                                                                                                                                                                    | [Billing and retention](https://docs.higgsfield.ai/docs/concepts/billing-and-retention.md)                   |
| SDK            | Python `higgsfield-client`, TypeScript `@higgsfield/client` (sunucu tarafı)                                                                                                                                                                                                              | [Client libraries](https://docs.higgsfield.ai/docs/how-to/sdk.md)                                            |
| Video-to-video | Motion transfer: `POST /higgsfield/genjutsu/motion-transfer/v1.0`, alanlar `video_url`, `image_urls` (1–8), `prompt`, `resolution` (`480p`/`720p`/`1080p`)                                                                                                                               | [Genjutsu motion transfer](https://docs.higgsfield.ai/docs/models/genjutsu/motion-transfer.md)               |
| Model listesi  | Hesaba göre değişiyor, [console.higgsfield.ai](https://console.higgsfield.ai) üzerinden bulunuyor                                                                                                                                                                                        | [Docs index](https://docs.higgsfield.ai/docs/llms.txt)                                                       |
| MCP            | Resmi bir hosted MCP sunucusu olduğu ikincil kaynaklarda geçiyor. **Resmi dokümandan doğrulanamadı.**                                                                                                                                                                                    | —                                                                                                            |

## Alternatifler

| Sağlayıcı     | Auth                                 | İş modeli / durumlar                                                                                                                                                      | Webhook                            | Kaynak                                                                          |
| ------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| **fal.ai**    | `Authorization: Key $FAL_KEY`        | Queue: `POST https://queue.fal.run/<model>`; durumlar `IN_QUEUE`, `IN_PROGRESS`, `COMPLETED`; status `GET .../requests/{id}/status`, iptal `PUT .../requests/{id}/cancel` | `fal_webhook` query parametresi    | [Queue](https://fal.ai/docs/model-apis/model-endpoints/queue)                   |
| **Replicate** | doğrulanamadı (bu dilimde bakılmadı) | Prediction durumları: `starting`, `processing`, `succeeded`, `failed`, `canceled`, `aborted`; 30 dk zaman aşımı; aborted ücretlendirilmez                                 | Var (imza ayrıntısı doğrulanamadı) | [Prediction lifecycle](https://replicate.com/docs/topics/predictions/lifecycle) |
| **Runway**    | doğrulanamadı                        | doğrulanamadı                                                                                                                                                             | doğrulanamadı                      | —                                                                               |
| **Kling**     | doğrulanamadı                        | doğrulanamadı                                                                                                                                                             | doğrulanamadı                      | —                                                                               |

## Öneri

1. **Higgsfield birincil sağlayıcı olsun.** Ekip operasyonda zaten onu kullanıyor. Resmi bir API var, video-to-video (motion transfer) da destekleniyor ve başarısız işler ücretlendirilmiyor.
2. Kod sağlayıcıdan bağımsız kalsın. fal.ai'nin iş modeli aynı (queue + status + cancel + webhook), gerekirse ikinci adaptör olarak eklenebilir.
3. **Webhook birincil, polling yedek olsun.** İmza belgelenmediği için webhook gövdesine güvenilmez: webhook geldiğinde sonuç her zaman `GET /requests/{id}/status` ile tekrar okunur. Webhook sadece "şimdi kontrol et" sinyalidir.
4. Çıktılar 7 gün içinde Supabase Storage'a kopyalansın (#45). Sağlayıcı URL'i kalıcı değil.
5. Her gönderimde `Idempotency-Key` = `generations.id` olsun. Yeniden denemelerde çift ücret oluşmaz.

## Dilim 1'de yapılanlar (#47)

`apps/panel/src/lib/generation/` (server-only):

| Dosya                    | Görev                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `provider.ts`            | `GenerationProvider` arayüzü: `generateImage`, `imageToVideo`, `videoToVideo`, `getStatus`, `cancel`   |
| `types.ts`               | İstek Zod şemaları, `GenerationJob`. Durum şeması DB `generation_status` enum'undan üretilir           |
| `status.ts`              | Geçiş kuralları (geri gidiş ve terminalden çıkış yok)                                                  |
| `errors.ts`              | `GenerationError` + HTTP durumu → kod eşlemesi (mesaj ayrıştırılmaz, sağlayıcı yanıtı dışarı taşınmaz) |
| `budget.ts`              | `checkBudget()`: saf fonksiyon, 4 ondalık basamak hassasiyeti                                          |
| `mock-provider.ts`       | Deterministik sağlayıcı: `[mock:fail]` ile başarısızlık, idempotency, enjekte edilebilir saat          |
| `higgsfield-provider.ts` | Belgelenmiş endpoint'lerle adaptör (görsel + motion transfer)                                          |
| `index.ts`               | `getGenerationProvider()`: env ile seçim                                                               |

Testler (`*.test.ts`): ortak sözleşme suite'i hem `MockProvider` hem de bellek içi sahte Higgsfield API'siyle koşar. Gerçek ağ çağrısı yok.

## Dilim 2: kuyruk ve worker (#47)

Kuyruk veritabanında, worker Supabase Edge Function'da (`supabase/functions/process-generations/`, Deno) çalışır; ayrıntı `docs/data-model.md` → "Üretim kuyruğu". Sağlayıcı sözleşmesi Deno tarafında `supabase/functions/_shared/generation/provider.ts`: `submit(job) → providerJobId`, `poll(id) → durum/ilerleme/sonuç URL'i/kredi`, `cancel(id)`, tipli `ProviderError` (geçici: `rejected`, `timeout`, `unavailable`). Higgsfield adaptörü `higgsfield.ts`; testler `FakeProvider` ve sahte `fetch` ile, ağsız.

- **Polling seçildi, webhook yok.** İmza belgelenmediği için webhook zaten sadece "şimdi kontrol et" sinyali olacaktı (Öneri 3). Worker dakikada bir çalışıp 15 sn aralıkla yokluyor; gecikme en çok ~1 dk. Webhook ileride eklenirse sadece `next_run_at = now()` yapması yeterli.
- **Anahtar yoksa** (`HIGGSFIELD_API_KEY_ID` / `HIGGSFIELD_API_KEY_SECRET` function secret'ı) worker iş almaz, işler `queued` kalır, `generation_worker_status.providers` boş yazılır ve panel "sağlayıcı yapılandırılmamış" gösterir.
- `apps/panel/src/lib/generation/` (Dilim 1, Node) panelde sağlayıcı çağırmadığı için kuyrukta kullanılmıyor; sözleşme testleri referans olarak duruyor.

### Adaptördeki varsayımlar (doğrulanmadı)

| Konu              | Varsayım                                                                                                                                                       | Doğrulanınca                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Görsel modeli     | Varsayılan `higgsfield-ai/soul/v2/standard` (Quickstart örneği); `HIGGSFIELD_IMAGE_MODEL` ile değişir                                                          | Hesaptaki model listesine göre secret'ı ayarla            |
| Görsel alanları   | Gövde `{ prompt, ...model_params }`; negatif prompt ve seed sadece doluysa `negative_prompt` / `seed` adıyla gönderilir. Model desteklemezse 422 → iş `failed` | Model sayfasındaki adlarla `higgsfield.ts` → `requestFor` |
| Image-to-video    | Model `HIGGSFIELD_IMAGE_TO_VIDEO_MODEL` verilmezse iş "yapılandırılmamış" hatasıyla biter. Gövde `{ image_url, prompt, duration, resolution }`                 | Model ve alan adları                                      |
| İlerleme          | Yanıtta yok; durumdan türetilir (queued 10, in_progress 50, completed 100)                                                                                     | Yanıtta yüzde varsa `poll` içinde oku                     |
| Kredi             | Yanıtta yok; `credits = null`, bu yüzden otomatik `costs` kaydı oluşmaz                                                                                        | Kredi alanı veya estimate endpoint'i                      |
| 400 yanıtı        | Eşzamanlılık sınırı ile parametre hatası aynı kodla dönüyor; geçici sayılır, `max_attempts` sonra `failed`                                                     | —                                                         |
| Referans dosyalar | Worker 1 saatlik imzalı Storage URL'i gönderir; sağlayıcının bu URL'leri indirebildiği varsayılır                                                              | —                                                         |
| Çıktı boyutu      | Edge Function belleğine indirilip yüklenir, 100 MiB sınırı                                                                                                     | Büyük videolar için akışlı yükleme                        |

## Açık sorular

- **Image-to-video:** Hangi Higgsfield modeli kullanılacak ve alan adları neler? Model sayfası doğrulanmadığı için adaptörde bu işlem şimdilik `not_configured` dönüyor.
- **Görsel model alanları:** Negatif prompt, seed ve en-boy oranı modele özgü. Doğrulanana kadar sadece `modelParams` ile, model sayfasındaki adlarıyla gönderilir. `negativePrompt`/`seed` verilirse istek reddedilir.
- **Kredi tahmini:** Faturalandırma sayfası bir "estimate" endpoint'inden bahsediyor ama yolu doğrulanamadı. Bütçe koruması (`checkBudget`) için gönderimden önce maliyet tahmini gerekiyor.
- **Webhook imzası** belgelenmemiş (bkz. Öneri 3).
- **Kredi bilgisi:** Status yanıtında kredi alanı belgelenmemiş. Kredi gelmedikçe başarısız/başarılı üretimler `costs`'a otomatik yazılmaz (kredi fiyatı olsa bile); hesap ekstresinden elle girilmeli veya estimate endpoint'i doğrulanmalı.
- **Hesap/abonelik:** Ekip API için ayrı bir Higgsfield Cloud hesabı ve bakiye açmalı (minimum yükleme ve fiyatlar console'dan kontrol edilmeli).
