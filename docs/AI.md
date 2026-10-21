# Panel içi AI asistanı

Panelde Claude ile öneri üretilir (persona taslağı, caption + hashtag). Öneriler **kaydedilmez**: kullanıcıya gösterilir, kullanıcı onaylarsa forma yazılır. Model çıktısı hiçbir aksiyonu otomatik tetiklemez.

## Yapılandırma

| Env                 | Zorunlu | Açıklama                                                                           |
| ------------------- | ------- | ---------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Evet    | Sadece sunucuda okunur. Yoksa `/api/ai/*` 503 döner, build ve CI anahtarsız geçer. |
| `ANTHROPIC_MODEL`   | Hayır   | Boşsa `claude-opus-5-5`. İleride `app_settings` tablosundan okunacak.              |

Desteklenen modellerde sunucu tarafı fallback (`fallbacks: "default"`) açıktır: güvenlik sınıflandırıcısı bir isteği reddederse aynı çağrıda başka bir modelle denenir.

## Kod yapısı

| Dosya                                        | Görev                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `apps/panel/src/lib/ai/claude.ts`            | `server-only` istemci, `runStructured()`: yapılandırılmış çıktı + Zod doğrulama, 30 sn zaman aşımı, 1 yeniden deneme |
| `apps/panel/src/lib/ai/errors.ts`            | SDK hatalarını kullanıcı mesajlı `AiError`'a çevirir (401/429/5xx/zaman aşımı/red/bozuk çıktı)                       |
| `apps/panel/src/lib/ai/prompts.ts`           | Görev talimatları. Şimdilik kod içinde, #46 ile `prompts` tablosundan okunacak                                       |
| `apps/panel/src/lib/ai/schemas.ts`           | Girdi ve çıktı Zod şemaları                                                                                          |
| `apps/panel/src/lib/ai/normalize.ts`         | Persona kuralları: 3-5 hashtag, en fazla 2 emoji, uzunluk sınırları (uyarı üretir)                                   |
| `apps/panel/src/lib/ai/rate-limit.ts`        | Kullanıcı başına dakikada 10 istek (bellek içi)                                                                      |
| `apps/panel/src/app/api/ai/suggest/route.ts` | `POST`, en az `editor`                                                                                               |

## API

`POST /api/ai/suggest`

```json
{
  "task": "caption",
  "input": {
    "persona": { "name": "Mina Arven", "niche": "AI ve gündelik teknoloji" },
    "topic": "Açık kalan sekmeler"
  }
}
```

```json
{
  "task": "persona",
  "input": {
    "name": "Mina Arven",
    "niche": "AI ve gündelik teknoloji",
    "language": "tr"
  }
}
```

Yanıt: `{ task, suggestion, warnings, usage: { inputTokens, outputTokens, cacheReadInputTokens }, model, promptId }`.

| Durum     | Anlamı                                                     |
| --------- | ---------------------------------------------------------- |
| 400       | Gövde doğrulanamadı                                        |
| 401 / 403 | Oturum yok / editor yetkisi yok                            |
| 422       | Model isteği reddetti                                      |
| 429       | İstek sınırı (panel veya sağlayıcı), `Retry-After` başlığı |
| 502 / 504 | Sağlayıcıya ulaşılamadı veya bozuk çıktı / zaman aşımı     |
| 503       | `ANTHROPIC_API_KEY` tanımlı değil                          |

## Kurallar

- Kullanıcı girdisi talimatlardan ayrı, `<girdi>` bloğunda veri olarak verilir (prompt injection).
- Loga sadece hata kodu ve sağlayıcı istek kimliği yazılır; anahtar, girdi veya model yanıtı yazılmaz.
- Testler SDK'yı mock'lar. CI'da gerçek API çağrısı yapılmaz.
