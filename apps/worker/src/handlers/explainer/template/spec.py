"""Üretim makinesi yazar; elle düzenlenmez. Senaryo metni bu dosyada DEĞİL, yanındaki spec.json'da
durur: metin veridir, Python koduna katılmaz. `edge_takes.py`, `voice.py` ve `zaman_js.py` bu
modülden yalnız LINES, SPOKEN, VOICE, RATE ve GUEST adlarını okur."""
import json
import pathlib

_DATA = json.loads(pathlib.Path(__file__).with_name("spec.json").read_text(encoding="utf-8"))

LINES = [str(line) for line in _DATA["lines"]]
SPOKEN = {str(k): str(v) for k, v in _DATA.get("spoken", {}).items()}
VOICE = str(_DATA["voice"])
RATE = str(_DATA["rate"])
# Konuk konuşmacı işareti kullanılmaz: temizlenmiş hiçbir satır denetim karakteriyle başlayamaz.
GUEST = "\x00"
