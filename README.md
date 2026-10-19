# AI Influencer

Yapay zeka ile influencer karakteri oluşturma, büyütme ve gelire dönüştürme projesi. Proje iki parçadan oluşuyor:

1. **Operasyon:** Karakter tasarımı, hesap kurulumu, trend araştırması, içerik üretimi, yayın ve monetizasyon. [Bu videodaki](https://youtu.be/YCthYjhIY90) 7 günlük süreç temel alındı.
2. **Admin Panel:** Ekip bilgisayarlarında açılan bir web uygulaması. Influencer oluşturma ve düzenleme, YouTube / Instagram / TikTok istatistikleri, içerik takvimi, maliyet takibi ve marka iş birlikleri buradan yönetilecek.

## Yol haritası

| Epic | Konu |
|---|---|
| [#5](../../issues/5) | 1 · AI karakter oluşturma ve imaj |
| [#9](../../issues/9) | 2 · Hesap kurulumu ve algoritma ısıtma |
| [#14](../../issues/14) | 3 · Trend araştırması, otomasyon, AI entegrasyonları |
| [#20](../../issues/20) | 4 · İçerik üretim hattı |
| [#26](../../issues/26) | 5 · Yayın stratejisi ve analitik |
| [#31](../../issues/31) | 6 · Bütçe ve monetizasyon |
| [#35](../../issues/35) | 7 · Risk, uyum ve platform kuralları |
| [#63](../../issues/63) | 8 · Admin panel: altyapı ve mimari |
| [#64](../../issues/64) | 9 · Admin panel: Influencer Studio |
| [#65](../../issues/65) | 10 · Admin panel: sosyal medya entegrasyonları ve analitik |
| [#66](../../issues/66) | 11 · Admin panel: operasyon (içerik, yayın, maliyet, markalar) |

Öncelikler `P0` / `P1` / `P2` label'larıyla işaretli. İşe `P0` ile başlanır.

## Admin panel (plan)

```
[Ekip bilgisayarı: Next.js panel (localhost:3000)]
          │
          ▼
[Supabase: Postgres · Auth · Storage · Vault]
          ▲
          │  pg_cron → Edge Functions (Instagram / YouTube / TikTok sync)
          ▼
[Instagram Graph API · YouTube Data & Analytics API · TikTok API · Higgsfield · Claude API]
```

Panel her bilgisayarda yerel olarak çalışır, veri Supabase'de ortak tutulur. Böylece ekipteki herkes aynı veriyi görür ve istatistik toplama job'ları bilgisayarlar kapalıyken de çalışır. Kesin karar: [#36](../../issues/36).

## Durum

Planlama aşamasında. Henüz kod yok.
