# Kaynak

`find-ideas`, `write-script`, `edit-video`, `film-styles` ve `animated-explainer` klasörleri
`alisadiq-ai/favstash-ai-video-editing-skills` deposundan alındı ("FavStash Creator Skills").

- Depo: https://github.com/alisadiq-ai/favstash-ai-video-editing-skills
- Commit: `b07970a` (14 Kasım 2026'da alındı), paket sürümü 0.9.0
- Lisans: Apache-2.0 (`LICENSE`, her klasörde bir kopya). Üçüncü taraf bildirimleri: `THIRD_PARTY_NOTICES.md`.
  `film-styles` stil rehberlerinin bir kısmı MIT lisanslı malzemeden uyarlanmıştır (`film-styles/NOTICE.md`).
  `animated-explainer/assets/fonts/` içindeki yazı tipleri SIL OFL 1.1 (`OFL.txt`).
- Depodaki yerleri: `skills/1-research/find-ideas`, `skills/2-scripting/write-script`,
  `skills/3-editing/edit-video`, `skills/3-styles-animated/film-styles`,
  `skills/3-styles-animated/animated-explainer`. Burada düz yerleşimle (`.claude/skills/<ad>/`) duruyor.

Dosyalar elle kopyalandı, otomatik güncellenmez. Projeye özgü kurallar (Türkçe ses, kaynak kuralı,
çalışan komutlar) bu klasörlere değil `.claude/skills/anlatim-videosu/SKILL.md` dosyasına yazılır.

## Alınmayanlar

- `publish-and-analyze` (FavStash servisiyle yayın ve analitik): yayın kendi panelimizden yapılır.
- Kamera önü stilleri (`adaptive-glass`, `paper-grid`, `breakout-card`, `text-over-footage`,
  `motion-effects`) ve `product-motion-ads`: bu projede çekim yok.
- Karakter skill'leri (`cartoon-character`, `3d-character`, ~15 MB): fotoğraf ve görsel üretici
  gerektirir; örnek karakterler kod lisansı kapsamında değildir.
- Depo kökündeki `INSTALL_FOR_AGENTS.md`, `README.md`, testler, önizleme görselleri, Claude eklenti
  tanımı. Kurulum adımları körlemesine çalıştırılmadı; FavStash CLI kurulmadı, hesap açılmadı.

Alınan skill'lerin hiçbiri alınmayanlara zorunlu bağımlı değildir. Tek isteğe bağlı bağ:
`animated-explainer` içindeki `CHARACTER` (imleç karakteri) `cartoon-character` ister; yoksa
`CHARACTER = None` ile çalışır.

## Yapılan değişiklikler (Apache-2.0 madde 4b)

Eklenen dosyalar: her klasörde `LICENSE`, `THIRD_PARTY_NOTICES.md` (depo kökünden kopya) ve `KAYNAK.md`.

| Dosya | Değişiklik |
| --- | --- |
| `find-ideas/SKILL.md` | Başa Türkçe "Bu projede" notu. FavStash'e bağlanmayı öneren üç cümle nötrleştirildi (kaydedilmiş içerik, analitik, "Without FavStash"). |
| `write-script/SKILL.md` | Başa Türkçe not. "through FavStash" kaynağı listeden çıkarıldı. |
| `edit-video/SKILL.md` | Başa Türkçe not. `description` ve stil tablosundan kurulu olmayan yedi stil çıkarıldı. Son paragraftaki `publish-and-analyze` yönlendirmesi "yayın ayrı adımdır (panel)" olarak değiştirildi. `3d-character` atfı silindi. |
| `edit-video/references/local-tools.md` | Alınmayan `INSTALL_FOR_AGENTS.md` atfı ve "optional FavStash CLI" ifadesi silindi. |
| `edit-video/references/voice.md` | Başa Türkçe not: Türkçe ses için `edge-tts` yolu. |
| `edit-video/scripts/reference-analyze.mjs` | `--url` yalnız http(s) adresi kabul eder ve yt-dlp'ye `--` ardından verilir (seçenek kaçırmayı önler). |
| `edit-video/scripts/doctor.mjs` | FavStash CLI denetimi, çıktı satırı ve `npm install -g @sketric/favstash-mcp` önerisi silindi. |
| `film-styles/SKILL.md` | Başa Türkçe not. |
| `film-styles/references/building.md` | `--quality delivery` → `--quality high` (sabitlenen HyperFrames 0.8.32 yalnızca draft/standard/high kabul ediyor; `delivery` hata veriyor) ve komuta `< /dev/null` eklendi. |
| `animated-explainer/SKILL.md` | Başa Türkçe not; aynı `--quality` düzeltmesi. |
| `animated-explainer/example/spec.py` | `CHARACTER = 'ali'` → `None` (karakter skill'i alınmadı). |
| `animated-explainer/assets/fonts/` | Üç `.woff2` (Latin alt kümesi; İ Ş ş Ğ ğ yok) yerine aynı ailelerin tam `.ttf` dosyaları kondu (google/fonts deposundan: Inter Tight değişken, Instrument Serif Italic, Geist Mono değişken). Dosya adlarının gövdesi aynı, `OFL.txt` içindeki adlar güncellendi. |

Başka dosyaya dokunulmadı (`film-styles/styles/` altındaki 99 stil rehberi, `lib/`, `voice.py`,
`sfx-sync.mjs`, `build.py` aynen duruyor). Klasör ve ortam değişkeni adlarındaki `favstash`
(`.favstash-studio/`, `FAVSTASH_GSAP`) işlevsel olduğu için bırakıldı.

## Güvenlik notu

Eklenmeden önce betikler okundu:

- Ağ: yalnızca `init-workspace.mjs --install` (`npm install`: hyperframes 0.8.32, gsap 3.14.2,
  three 0.168.0) ve `reference-analyze.mjs` (verilen URL için `yt-dlp`). Başka ağ çağrısı yok;
  `eval`, kabuk üzerinden komut ya da gizli kodlama yok.
- Süreç çağrıları: `ffmpeg`, `ffprobe`, `npm`, `yt-dlp`, `hyperframes`, `python3`.
- Yazdığı yerler: verilen çalışma klasörü (`<workspace>/.favstash-studio/`, reel klasörü) ve ses
  efektleri için `$TMPDIR/favstash-sfx/`. `voice.py` ve `build.py` reel klasöründeki `spec.py`
  dosyasını Python olarak çalıştırır: oraya yalnızca kendi yazdığın dosyayı koy.
- `reference-analyze.mjs --cookies-from-browser` tarayıcı çerezlerini `yt-dlp`'ye verir; kullanma.
- HyperFrames CLI anonim kullanım verisi gönderebilir ve iş bitince geri bildirim sorabilir:
  komutları `HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_NO_UPDATE_CHECK=1` ile ve `< /dev/null` ile
  çalıştır. `hyperframes tts`/`transcribe` model indirir (Kokoro, Whisper); bu projede kullanılmıyor.

Bu kopya projede uçtan uca çalıştırıldı (14 Kasım 2026, macOS, Node 24, Python 3.14): `film-styles`
+ `edit-video` ile Blueprint stilinde 48,8 saniyelik Türkçe dikey film (ses kilidi, render, ses
efekti miksi, senkron denetimi). `animated-explainer` örneği (karaktersiz, yeni yazı tipleriyle) derlendi ve lint'ten geçti; anlık
görüntülerde kartlar çizildi ama üstteki konuşma satırı görünmedi, nedeni araştırılmadı ve tam render
alınmadı. `find-ideas` ve `write-script` yalnızca metindir.
