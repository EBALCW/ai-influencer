#!/usr/bin/env python3
"""Dikey video için kısa parçalı SRT yazar (parça başına en çok N kelime; varsayılan 6).

Motorun `burn_captions.py --srt-only` çıktısı parça başına 9 kelimeye kadar çıkar; dikey karede bu
üç satıra sarar ve çizimin üstüne taşar. Bu betik aynı zamanlamayı (audio/timing.json, motorun
`captions.chunks_for` işlevi) kullanır, yalnızca parçaları kısaltır: altyazı en çok iki satır kalır.

  python kisa_srt.py --project ~/ai-influencer-films/<ad> [--out out/captions.srt] [--max-words 6]
"""
import argparse
import json
import pathlib
import sys

MOTOR = pathlib.Path(__file__).resolve().parents[2] / "cinematic-film" / "scripts"
sys.path.insert(0, str(MOTOR))


def damga(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", required=True)
    ap.add_argument("--out", default="out/captions.srt")
    ap.add_argument("--max-words", type=int, default=6)
    a = ap.parse_args()
    import captions

    proj = pathlib.Path(a.project).expanduser().resolve()
    timing = json.loads((proj / "audio" / "timing.json").read_text())
    captions.MAX_WORDS["kisa"] = a.max_words          # motor dosyasına dokunmadan yeni bir parça boyu
    rows = captions.chunks_for(timing, "kisa")
    out = pathlib.Path(a.out)
    out = out if out.is_absolute() else proj / out
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        for i, r in enumerate(rows, 1):
            f.write(f"{i}\n{damga(r['t0'])} --> {damga(r['t1'])}\n{' '.join(w for w, _ in r['words'])}\n\n")
    print(f"srt: {out} ({len(rows)} parça, en çok {a.max_words} kelime)")


if __name__ == "__main__":
    main()
