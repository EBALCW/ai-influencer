#!/usr/bin/env python3
"""timing.<dil>.json -> out/captions.<dil>.ass: alt-ortada 2-3 kelimelik büyük, dar, kalın beyaz altyazı.
  FILM_LANG=tr|en python captions.py"""
import json, os, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "kit") if (ROOT / "kit").is_dir() else str(ROOT / ".." / ".." / "blender"))
import studyo_post as P
LANG = os.environ.get("FILM_LANG", "tr")
T = json.loads((ROOT / f"timing.{LANG}.json").read_text())
rows = P.caption_rows(T, lang=LANG, max_words=3, max_chars=17)
(ROOT / "out").mkdir(exist_ok=True)
P.write_big_captions(rows, ROOT / "out" / f"captions.{LANG}.ass")
print(len(rows), "altyazı; en uzun:", max(len(r["text"]) for r in rows), "harf")
for r in rows: print(f"{r['t0']:6.2f}-{r['t1']:6.2f}  {r['text']}")
