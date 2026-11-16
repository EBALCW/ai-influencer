# Künye

- Görüntü: Blender 5.3 (EEVEE), tamamı kodla kurulan sahneler. Dış model, fotoğraf, doku ya da harita verisi kullanılmadı.
- Dünya küresi: elle çizilmiş kaba kıta çokgenlerinden üretilen noktalar (`kit/studyo.py`, `LAND`). Şematiktir.
- Seslendirme: edge-tts, `tr-TR-AhmetNeural` (Microsoft Edge çevrimiçi metin okuma; hesap ya da anahtar gerekmez).
  Yayın ve ticari kullanım koşulları Microsoft'un hizmet şartlarına bağlıdır; yayından önce kontrol edilmeli ya da
  anlatıcı kataloğundan lisansı açık bir sesle yeniden seslendirilmeli (`VOICE=… python tts.py`).
- Ses yatağı: ffmpeg ile sentezlenen uğultu, hava ve kesme "vuuş"ları. İndirilen ses yok.
- Yazı tipleri (yalnızca render'da kullanılır, dağıtılmaz): Georgia (etiketler), Arial Bold (küçük notlar, kadran),
  Avenir Next Condensed Heavy (büyük altyazı). Hepsi macOS ile gelir.
- Olgular: `sources.md`.
