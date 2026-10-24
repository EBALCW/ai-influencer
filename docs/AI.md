# Panel içi AI asistanı

Wizard'ın persona adımında ve içerik kartında AI önerisi alınır. İçerik kartı caption/hashtag,
kısa film senaryosu ve son 7 günün analizini destekler. Öneri önce önizlenir; **Öneriyi forma
uygula** yalnız formu değiştirir. Kullanıcı ayrıca kaydetmedikçe persona/içerik yazılmaz.
Model çıktısı yayınlama, araç çağırma veya üretim başlatma yetkisine sahip değildir.

## Yapılandırma

1. Sunucuda `ANTHROPIC_API_KEY` tanımlı olmalıdır. Anahtar tarayıcıya gönderilmez ve panel formuna girilmez.
2. Owner, **Ayarlar → AI** (`/settings/ai`) sayfasında model ID'sini ve milyon token başına USD fiyatlarını kaydeder.
3. Giriş, çıkış, cache okuma, 5 dakikalık ve 1 saatlik cache yazma fiyatları ayrı girilir. En fazla 4 ondalık kullanılır.
4. Görev talimatı isteğe bağlı olarak prompt kütüphanesinden (#46) gelir. Her görev sabit bir soya (kategori + `key`) eşlenir; eşleme `apps/panel/src/lib/ai/prompt-source.ts` içindedir:

   | Görev    | Kategori     | `key`        | Panelde başlık |
   | -------- | ------------ | ------------ | -------------- |
   | persona  | `character`  | `ai-persona` | "AI Persona"   |
   | caption  | `caption`    | `ai-caption` | "AI Caption"   |
   | senaryo  | `short_film` | `ai-script`  | "AI Script"    |
   | haftalık | `research`   | `ai-weekly`  | "AI Weekly"    |
   | yanıt    | `caption`    | `ai-reply`   | "AI Reply"     |

   Caption görevi için yapıştırılacak hazır kütüphane metni ve test kaydı `docs/caption-prompt.md` içindedir (#23).

   Influencer'a özel soy globalden önce gelir; soyun en yüksek versiyonu okunur. Kütüphane metni koddaki ortak güvenlik/çıktı kurallarına **eklenir**, onları değiştirmez. Eşleşen prompt yoksa koddaki yerleşik talimat kullanılır (`promptId`: `builtin:<görev>@1`). Aynı kategorideki görsel/video üretim şablonları AI asistanına gitmez.

Model ve fiyat için sabit varsayılan yoktur; eski `ANTHROPIC_MODEL` env'i kullanılmaz.
Eksik anahtar/ayar halinde düğme pasiftir; build ve CI anahtarsız çalışır. Kütüphanede
prompt olmaması hata değildir, yerleşik talimat kullanılır. Yalnız owner model/fiyatı değiştirir; ekip okuyabilir, viewer öneri isteyemez.

Model ID ve fiyatlar şu resmi kaynaklardan doğrulanır (okuma: 2026-10-21):
[model listesi](https://platform.claude.com/docs/en/models/overview),
[fiyatlar](https://platform.claude.com/docs/en/about-claude/pricing),
[yapılandırılmış çıktı](https://platform.claude.com/docs/en/build-with-claude/structured-outputs),
[kullanım alanları](https://platform.claude.com/docs/en/api/messages/create).
Kaynakta doğrulanan güncel ID'ler arasında `claude-opus-5-5` ve `claude-sonnet-5-5` vardır;
bunlar örnektir, otomatik seçilmez ve uygulama koduna fiyat sabitlenmez.

## Maliyet ve hata davranışı

Resmi SDK, 30 saniye zaman aşımıyla tek çağrı yapar. Otomatik yeniden deneme veya model
fallback'i yoktur; farklı modelin fiyatıyla yanlış maliyet yazılmaz. Kullanım yanıtı alınır
alınmaz `costs` tablosuna `ai_api` kategorisiyle bir satır yazılır. Hesaplama bigint ve
4 ondalık basamakla yapılır; giriş, çıkış ve cache türleri ayrı fiyatlandırılır.
Sonraki fiyat değişikliği geçmiş maliyetleri değiştirmez.

JSON geçersiz, kesilmiş veya model tarafından reddedilmiş olsa da bilinen token kullanımı
kaydedilir. Sağlayıcı kullanım bilgisi döndürmeden ağ/SDK hatası oluşursa tutar uydurulmaz.
Maliyet yazımı başarısızsa öneri başarı diye sunulmaz: 503 döner; tekrar çağırmadan kayıtlar
kontrol edilmelidir. Sunucu loguna yalnız sabit hata kodu yazılır. Anahtar, prompt, kullanıcı
girdisi, model yanıtı ve sağlayıcı hata nesnesi loglanmaz.

## Yorum yanıtı (#61)

Gelen kutusunda (`/inbox`) her yorumun yanıt kutusunda **AI ile öner** görevi `reply` çalıştırır. İstemci yalnız `{ commentId, language }` gönderir; route yorum metnini, post caption'ını ve influencer'ın güncel persona tonu/bio'sunu kullanıcının oturumuyla (RLS) okur. Yorum seçilen influencer'ın hesabına ait değilse 404 döner. Modele **yorum yazarının adı, hesap bilgisi veya başka yorumlar gönderilmez**. Çıktı `{ reply }` (1–1000 karakter; talimat 300 karakter, en fazla 1 emoji, hashtag/link yok ister). AI olduğu sorulursa karakter bunu açıkça söyler (`docs/compliance.md`); fiyat/anlaşma sözü verilmez, iletişim bilgisi uydurulmaz.

Öneri yalnız **taslaktır**: "Öneriyi forma uygula" yanıt kutusunu doldurur, gönderim ayrı "Yanıtı gönder" tıklamasıyla kuyruğa alınır. Otomatik veya toplu yanıt yoktur. Maliyet diğer görevler gibi `costs`'a (`ai_api`) yazılır.

## Haftalık veri

`ai_weekly_summary` RPC'si RLS ile, UTC'de son 7 günü hesaplar. Her post için dönem sonuna
kadar en son kümülatif izlenme ile dönem başlangıcına kadar son ölçümün farkı kullanılır.
Dönemde yayımlanan yeni postun başlangıcı sıfır kabul edilir. Eski postlarda negatif sayaç farkı sıfırlanır; baseline olmayan eski post artış toplamına girmez. Kaç postta ve
hesapta baseline ve son 7 günde ölçüm olduğu ayrıca verilir. Eski ölçüm bulunan ancak güncel snapshot olmayan hesap/postlar taze ölçüm gibi yorumlanmamalıdır. Tüm hesapların başlangıç/son takipçi ölçümü yoksa
`followerChange` NULL'dır. Yeni post sayımı `[from,to)` aralığıdır. JSON tek SQL satırında
agregasyon yapıldığı için PostgREST'in 1000 satır sınırı toplamı kesmez.

Modele hesap token'ları, e-posta, iletişim bilgileri veya ham sağlayıcı payload'ları gönderilmez;
yalnız sayısal özet gider. Bu özet belirli postları veya dönem içindeki izlenme akışını
kapsamıyorsa modelden bu sınırları açıklaması istenir. Öneriler insan incelemesi gerektirir.

## API ve testler

`POST /api/ai/suggest` (editor+):

```json
{
  "influencerId": "00000000-0000-4000-8000-000000000001",
  "request": {
    "task": "caption",
    "input": {
      "persona": { "name": "Kurgusal karakter", "niche": "Teknoloji" },
      "topic": "Açık kalan sekmeler",
      "language": "tr"
    }
  }
}
```

Diğer görevler `persona`, `script` (`topic`, `durationSeconds`, `language`), `weekly`
(`language`) ve `reply` (`commentId`, `language`; #61). Yanıt `{task,suggestion,warnings,usage,model,promptId}` şeklindedir.
`GET /api/ai/settings` ekip okumasıdır; anahtarın yalnız tanımlı olup olmadığını döner.
`PUT /api/ai/settings` owner yazımıdır. Başarı dışında 400 (girdi), 401/403 (yetki),
404 (influencer), 422 (red), 429 (hız sınırı), 502/504 (sağlayıcı/çıktı), 503
(yapılandırma veya maliyet kaydı) dönebilir.

İki sınır birlikte uygulanır: kullanıcı başına 10 istek/dakika bellek sınırı (süreç yeniden
başlayınca sıfırlanır) ve kalıcı günlük sınır. Günlük sınır o UTC günündeki kullanıcının
`costs` (`ai_api`) kayıtlarını sayar; varsayılan 200, owner `/settings/ai` → "Kullanıcı başına
günlük AI isteği" ile değiştirir (`app_settings.ai.dailyLimitPerUser`). Sınır dolunca 429 ve
`Retry-After` (UTC gün sonuna kadar); sayım okunamazsa istek reddedilir.

- Vitest: SDK çağrısı → Zod doğrulama → maliyet satırı; hatalı çıktıda da faturalama, yetki, hız sınırı, fiyat ve log gizliliği.
- pgTAP: ayarların owner yazımı/team okuması, outsider izolasyonu, snapshot farkı ve 1000'den fazla postta agregasyon.
- Playwright: wizard ve içerik kartı önizleme/onay/kaydet akışı, üç içerik öneri türü, owner ayar formu ve viewer/guest yetkileri. AI route'u mock'lanır; CI'da gerçek ücretli API çağrısı yoktur.
