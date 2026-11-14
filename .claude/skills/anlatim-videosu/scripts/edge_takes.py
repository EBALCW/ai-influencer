#!/usr/bin/env python3
"""film-styles / animated-explainer yolu için Türkçe seslendirme: satır başına bir edge-tts kaydı
ve her kelimenin zamanı.

`edit-video/scripts/voice.py --engine files` satır başına bir kayıt bekler (`voice/takes/00.mp3`,
`01.mp3`, …) ve yanında `NN.words.json` varsa kelime zamanlarını oradan alır; yoksa Whisper modeli
indirip transkript çıkarmaya çalışır. Bu betik ikisini de edge-tts'ten üretir: model indirilmez,
kelime zamanları servisin kendi `WordBoundary` olaylarından gelir.

  python edge_takes.py <reel> [--voice tr-TR-AhmetNeural] [--rate +8%] [--redo 0,3]

<reel>/spec.py şunları tanımlar (voice.py ile aynı sözleşme):
  LINES   söylenecek satırlar, sırayla. Ekranda görünecek haliyle yaz ("3.000 kilometre").
  SPOKEN  isteğe bağlı: {'3.000': 'üç bin'} gibi, yalnızca sese giden okunuş.
  VOICE, RATE  isteğe bağlı varsayılanlar (komut satırı önceliklidir).

Var olan kayıtlar yeniden üretilmez; --redo verilen satırları yeniler. İnternet gerekir
(edge-tts Microsoft'un ücretsiz servisine bağlanır; anahtar ya da hesap gerekmez).
Sonra: python <edit-video>/scripts/voice.py <reel> --engine files
"""
import argparse
import asyncio
import importlib.util
import json
import pathlib

import edge_tts

# edge-tts kelime zamanları, çözülmüş mp3'teki sese göre ~0,05 sn erken gelir (11 kayıtta ölçüldü:
# son kelimenin bitişi ile sesin bittiği an arasındaki fark 0,04-0,085 sn). Görsel vuruş sesten
# önce düşmesin diye zamanlar bu kadar ileri alınır.
OFFSET = 0.05


def load_spec(reel):
    s = importlib.util.spec_from_file_location("spec", reel / "spec.py")
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m


def spoken_text(line, said, guest_mark):
    """voice.py'deki lines_of ile aynı kural: * ve | atılır, SPOKEN karşılığı varsa o okunur."""
    if line.startswith(guest_mark):
        line = line[len(guest_mark):]
    out = []
    for tok in line.replace("*", "").replace(" | ", " ").split():
        core = tok.strip('.,!?:;"')
        out.append(tok.replace(core, said[core]) if core in said else tok)
    return " ".join(out)


async def say(text, voice, rate, mp3, words_json):
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []
    with mp3.open("wb") as f:
        async for ev in com.stream():
            if ev["type"] == "audio":
                f.write(ev["data"])
            elif ev["type"] == "WordBoundary":
                s = ev["offset"] / 1e7 + OFFSET
                words.append({"text": ev["text"], "start": round(s, 3), "end": round(s + ev["duration"] / 1e7, 3)})
    if not words:
        raise SystemExit(f"edge-tts kelime zamanı döndürmedi: {text!r}")
    words_json.write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")
    return words


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("reel")
    ap.add_argument("--voice")
    ap.add_argument("--rate")
    ap.add_argument("--redo", default="")
    a = ap.parse_args()
    reel = pathlib.Path(a.reel).expanduser().resolve()
    spec = load_spec(reel)
    voice = a.voice or getattr(spec, "VOICE", "tr-TR-AhmetNeural")
    rate = a.rate or getattr(spec, "RATE", "+8%")
    said = getattr(spec, "SPOKEN", {})
    mark = f"[{getattr(spec, 'GUEST', 'Agent')}] "
    redo = {int(n) for n in a.redo.split(",") if n.strip()}
    takes = reel / "voice" / "takes"
    takes.mkdir(parents=True, exist_ok=True)
    for i, line in enumerate(spec.LINES):
        mp3, wj = takes / f"{i:02d}.mp3", takes / f"{i:02d}.words.json"
        text = spoken_text(line, said, mark)
        if mp3.exists() and wj.exists() and i not in redo:
            print(f"{i:02d} (var)  {text}")
            continue
        words = asyncio.run(say(text, voice, rate, mp3, wj))
        print(f"{i:02d} {words[-1]['end']:5.2f} sn, {len(words)} kelime  {text}")
    print(f"-> {takes}  (ses: {voice}, hız: {rate})")


if __name__ == "__main__":
    main()
