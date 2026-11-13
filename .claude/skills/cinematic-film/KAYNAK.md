# Kaynak

Bu klasör `Moh4696/cinematic-skill` deposundaki `skills/cinematic-film` klasörünün değiştirilmemiş kopyasıdır.

- Depo: https://github.com/Moh4696/cinematic-skill
- Commit: `bf43556` (12 Kasım 2026'da alındı)
- Lisans: MIT (`LICENSE`)
- Eklenenler: yalnızca bu dosya, `LICENSE` ve `requirements.txt` (depo kökünden kopyalandı)

Dosyalar elle kopyalandı, otomatik güncellenmez. Güncellemek için yeni sürümün kodunu okuyup klasörü yeniden kopyala ve commit'i burada değiştir. Projeye özgü kurallar (Türkçe ses, dikey çıktı, kaynak ve hassasiyet kuralları) bu klasöre değil `.claude/skills/anlatim-videosu/SKILL.md` dosyasına yazılır.

## Güvenlik notu

Eklenmeden önce kod okundu: ağ erişimi yalnızca görsel (Wikimedia Commons), harita sınırı ve açık lisanslı yazı tipi indirmek için; süreç çağrıları `ffmpeg`, `ffprobe` ve seslendirme komutu. `tts_say.py --cmd` verilen komutu kabukta çalıştırır: oraya yalnızca kendi yazdığın seslendirme komutunu ver.

Bu kopya projede uçtan uca çalıştırıldı (13 Kasım 2026, macOS, Python 3.14): seslendirme, kareler, ses efektleri, 1080×1920 render ve SRT üretimi. Dikey videoda `burn_captions.py` yazısı küçük kaldığı için altyazı ffmpeg ile gömülüyor (bkz. `anlatim-videosu/SKILL.md`).
