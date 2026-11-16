#!/usr/bin/env python3
"""timing.<dil>.json -> shots.<dil>.json (çekim başına başlangıç ve süre, 24 fps kare sınırında).
Çapalar script'in içindedir: her bölümün "shots" listesi. "s04" = bölüm başı; ["s06b", "Motoru", 1] = bölümde
bu kelimenin 1. geçtiği yer. Dil değişince çapa kelimeleri de o dilin script'inde durur; sahne kodu değişmez.
  FILM_LANG=tr|en python make_shots.py"""
import json, os, pathlib
ROOT = pathlib.Path(__file__).resolve().parent
LANG = os.environ.get("FILM_LANG", "tr")
T = json.loads((ROOT / f"timing.{LANG}.json").read_text())
strip = lambda w: w.strip(".,:;!?")
starts = []
for s in T["segments"]:
    for a in s["shots"]:
        if isinstance(a, str): starts.append((a, s["start"] - 0.30)); continue
        shot, word, nth = a
        hit = [w for w in s["words"] if strip(w["text"]) == strip(word)]
        assert len(hit) >= nth, (shot, word)
        starts.append((shot, hit[nth - 1]["start"] - 0.20))
starts[0] = (starts[0][0], 0.0)
fr = lambda x: round(x * 24) / 24
out = []
for i, (shot, t) in enumerate(starts):
    end = starts[i + 1][1] if i + 1 < len(starts) else T["total"]
    out.append({"id": shot, "start": fr(t), "dur": round(fr(end) - fr(t), 4)})
(ROOT / f"shots.{LANG}.json").write_text(json.dumps(out, indent=1))
for o in out: print(o["id"], f"{o['start']:7.2f} {o['dur']:5.2f}")
print(len(out), "çekim, toplam", round(sum(o["dur"] for o in out), 2), "sn,", round(sum(o["dur"] for o in out) * 24), "kare")
