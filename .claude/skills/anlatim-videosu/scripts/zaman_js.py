#!/usr/bin/env python3
"""voice/timing.json -> assets/timing.js (kompozisyonun saati) ve out/captions.srt.

film-styles yolunda kompozisyon (index.html) her şeyi sesin kelime zamanlarına bağlar. HyperFrames
render'ı ağ ve dosya okuması yapmadan çalışsın diye zamanlama JSON olarak değil, sayfaya
<script src="assets/timing.js"> ile giren bir JS dosyası olarak verilir:

  window.TIMING = { duration, lines: [{start, end, words: [{w, s, e}]}], phrases: [{n, line, text, s, e}] }

Altyazı parçaları (phrases) spec.py LINES'tan çıkar: " | " işareti ve cümle sonu noktalama
(. ? ! ; :) parçayı böler. Ses bu işareti görmez (voice.py atar), yani parça sınırını değiştirmek
için sesi yeniden üretmek gerekmez; bu betiği yeniden çalıştırmak yeter.

  python zaman_js.py <reel> [--hold 1.2]
"""
import argparse
import importlib.util
import json
import pathlib


def damga(t):
    ms = int(round(max(0, t) * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("reel")
    ap.add_argument("--hold", type=float, default=1.2, help="konuşma bittikten sonra altyazının en çok kalacağı süre (sn)")
    a = ap.parse_args()
    reel = pathlib.Path(a.reel).expanduser().resolve()
    s = importlib.util.spec_from_file_location("spec", reel / "spec.py")
    spec = importlib.util.module_from_spec(s)
    s.loader.exec_module(spec)
    timing = json.loads((reel / "voice" / "timing.json").read_text(encoding="utf-8"))
    mark = f"[{getattr(spec, 'GUEST', 'Agent')}] "
    phrases = []
    for i, raw in enumerate(spec.LINES):
        raw = raw[len(mark):] if raw.startswith(mark) else raw
        words = timing["lines"][i]["words"]
        toks = raw.replace("*", "").split()
        if len([t for t in toks if t != "|"]) != len(words):
            raise SystemExit(f"satır {i}: spec.py ile timing.json kelime sayısı uyuşmuyor; voice.py'yi yeniden çalıştır")
        k, cur = 0, []
        for t in toks:
            if t == "|":
                if cur:
                    phrases.append((i, cur))
                    cur = []
                continue
            cur.append(words[k])
            k += 1
            if t[-1] in ".?!;:":
                phrases.append((i, cur))
                cur = []
        if cur:
            phrases.append((i, cur))
    out = []
    for n, (i, ws) in enumerate(phrases):
        nxt = phrases[n + 1][1][0]["s"] if n + 1 < len(phrases) else timing["duration"]
        out.append({"n": n + 1, "line": i, "text": " ".join(w["w"] for w in ws), "s": round(max(0, ws[0]["s"] - 0.06), 3),
                    "e": round(min(nxt - 0.06, ws[-1]["e"] + a.hold), 3)})
    data = {"duration": timing["duration"], "lines": [{"start": l["start"], "end": l["end"], "words": l["words"]} for l in timing["lines"]],
            "phrases": out}
    (reel / "assets").mkdir(exist_ok=True)
    (reel / "assets" / "timing.js").write_text("window.TIMING = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
    (reel / "out").mkdir(exist_ok=True)
    with (reel / "out" / "captions.srt").open("w", encoding="utf-8") as f:
        for p in out:
            f.write(f"{p['n']}\n{damga(p['s'])} --> {damga(p['e'])}\n{p['text']}\n\n")
    print(f"{len(out)} altyazı parçası, {timing['duration']:.2f} sn -> assets/timing.js, out/captions.srt")
    for p in out:
        print(f"  {p['n']:2d} {p['s']:6.2f}-{p['e']:6.2f}  {p['text']}")


if __name__ == "__main__":
    main()
