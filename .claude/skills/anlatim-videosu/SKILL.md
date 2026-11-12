---
name: anlatim-videosu
description: Bir olayı ya da konuyu görselleştirip seslendirme ve altyazıyla anlatan kısa dikey video üretir (ör. bir mağara dalışı kazası, bir keşif, bir rekor, "nasıl çalışır"). Araştırma, kaynaklı senaryo, Türkçe seslendirme, koddan animasyon, altyazı, 1080×1920 çıktı. "Şu olayı anlatan video yap", "anlatım videosu", "belgesel tarzı short", "faceless video", "olay videosu", "explainer" dendiğinde kullan.
---

# Anlatım videosu

Yüz göstermeyen, tek anlatıcılı, görsel anlatımlı kısa film: fotoğraflar, haritalar, rotalar,
kartlar ve büyük sayılar üzerinde gezen tek bir kamera; her vurgu anlatıcının söylediği kelimeye
oturur. Motor `.claude/skills/cinematic-film/` içindedir (dışarıdan alındı, bkz. `KAYNAK.md`).
**Önce o klasördeki `SKILL.md` dosyasını oku**: iş akışı, kurallar ve komutlar orada. Bu dosya
yalnızca projeye özgü farkları söyler. İnsanlar için rehber: `docs/explainer-guide.md`.

## Projeye özgü kurallar

### 1. Doğruluk (atlanamaz)

- Her olgu (tarih, yer, sayı, isim, sıra) **en az iki bağımsız kaynaktan** doğrulanır; biri
  birincil olmalı (resmî rapor, mahkeme kaydı, kurumun kendi açıklaması, hakemli yayın).
  Kaynaklar `script.json` → `fact_notes` içine iddia başına bir satır yazılır.
- Kaynaklar çelişiyorsa çelişkiyi anlat ya da o ayrıntıyı çıkar. Boşluğu tahminle doldurma.
- Emin olunmayan şey "iddia ediliyor", "rapora göre" diye söylenir.
- Senaryo ve olgular kullanıcı onayından geçmeden seslendirme ve görsel işine başlanmaz
  (motorun birinci onay kapısı).

### 2. Gerçek olaylarda hassasiyet

Kaza, ölüm, suç gibi konularda:

- Saygılı ve sakin anlatım. Abartılı başlık, geri sayım, "korkunç son" türü sömürü dili yok.
- Hayatını kaybedenlerin ve yakınlarının mahremiyeti: kamuya açık olmayan ayrıntı, ceset ya
  da yaralanma görüntüsü, aileyi hedef gösteren bilgi kullanılmaz. Reşit olmayanların adı verilmez.
- Suçlama yalnızca resmî bulguya dayanır; soruşturma sürüyorsa bunu söyle.
- Sonunda olaydan çıkan dersi ya da değişen kuralı ver; video yalnızca şok için yapılmaz.

### 3. Görseller

- Gerçek fotoğraf ve belgeler yalnızca lisansı uygun kaynaktan (`fetch_commons.py` lisansı
  denetler ve `credits.md` yazar). Haber sitesinden, sosyal medyadan görsel alınmaz.
- Kodla çizilen belge "canlandırma" diye etiketlenir. **AI görseli gerçek olayın ya da gerçek
  bir kişinin kanıtıymış gibi sunulmaz**; kullanılıyorsa açıkça illüstrasyon olarak.
- Yayında AI etiketi ve kaynak kuralları: `docs/compliance.md`.

### 4. Türkçe seslendirme (ücretsiz)

Motor seslendirme için herhangi bir komutu kabul eder. Türkçe için `edge-tts` kullan:

```
python3 scripts/tts_say.py --project <proje> \
  --cmd 'edge-tts --voice tr-TR-AhmetNeural --rate=+8% --file {txt} --write-media {out}'
```

- Sesler: `tr-TR-AhmetNeural` (erkek), `tr-TR-EmelNeural` (kadın). İngilizce video için
  `en-US-GuyNeural`, `en-US-AriaNeural`.
- `script.json` içinde `spoken` alanına sayıları ve kısaltmaları **okunduğu gibi** yaz
  ("1996" → "bin dokuz yüz doksan altı", "80 m" → "seksen metre").
- `split_takes.py` hangi satırları işaretlerse dinle; yanlış okunan kelimeyi yeniden yaz.
- `edge-tts` yoksa: `pip install edge-tts` (proje sanal ortamına).

### 5. Dikey çıktı

Motorun örnekleri yatay (16:9). Reels / Shorts / TikTok için:

- Panoyu **dikey** tasarla: kümeleri yan yana değil alt alta diz, her kümede tek kahraman öğe.
- Tüm deneme ve son render'da `--size 1080x1920` kullan (taslak için `--size 540x960`).
- Güvenli alan: üstte ~%12, altta ~%20 boş kalsın (platform arayüzü ve caption kapatır).
  Altyazıyı `burn_captions.py` ile göm; yazı telefonda bir saniyede okunacak büyüklükte olsun.
- Süre 45-90 saniye (yaklaşık 110-230 kelime). İlk cümle kanca: sonucu ya da en çarpıcı
  olguyu baştan söyle, sonra "nasıl oldu"ya dön.
- Dikey düzen motorun yazarı tarafından belgelenmemiş. İlk kareleri (`render.py --probe`)
  mutlaka kendin aç ve bak; taşan, kesilen ya da küçük kalan öğe varsa düzeni düzelt.

### 6. Dosyalar

- Proje klasörü repo dışında: `~/ai-influencer-films/<kısa-ad>/`. Video, ses ve indirilen
  görseller repoya girmez.
- Python ortamı (bir kez):

  ```
  python3 -m venv ~/.local/share/ai-influencer-film-venv
  ~/.local/share/ai-influencer-film-venv/bin/pip install -r .claude/skills/cinematic-film/requirements.txt edge-tts
  ```

  Windows: `py -m venv %USERPROFILE%\ai-influencer-film-venv` ve aynı `pip install`.
  Komutları bu ortamın `python`'ıyla çalıştır. Önce `scripts/check_setup.py`.

- Bittiğinde: `out/final.mp4`, `credits.md` ve kaynak listesi (`fact_notes`) birlikte teslim
  edilir. Panelde içerik kartı açarken kaynak türü ve notlara bunları yaz.

## Teslimden önce

- [ ] Her olgunun kaynağı `fact_notes` içinde, kullanıcı senaryoyu onayladı
- [ ] İlk 2 saniye kanca; süre 45-90 sn
- [ ] 1080×1920, altyazı gömülü ve güvenli alanda, Türkçe karakterler doğru
- [ ] Her satırdan bir kareye baktın; karanlık, taşan, üst üste binen öğe yok
- [ ] Ses: yanlış okunan kelime yok, müzik sesi bastırmıyor
- [ ] `credits.md` var; AI görseli varsa illüstrasyon olarak etiketli
