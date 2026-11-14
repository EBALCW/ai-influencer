#!/usr/bin/env python3
"""timing.json + aşağıdaki çapa listesi -> shots.json (çekim başına başlangıç ve süre).
Çapa: (çekim, bölüm, o bölümde çekimin başladığı kelime | None=bölüm başı)."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent
ANCHORS = [
 ("h1", "01", None), ("h2", "02", None), ("h3", "02", "Ve"),
 ("a1", "03", None), ("a2", "03", "Yaban"), ("a3", "04", None), ("a4", "04", "Planları"), ("a5", "05", None), ("a6", "06", None),
 ("b1", "07", None), ("b2", "08", None),
 ("c1", "09", None), ("c2", "10", None), ("c3", "11", None), ("c4", "12", None), ("c5", "12", "Eskiden"),
 ("d1", "13", None), ("d2", "14", None), ("d3", "14", "Bazı"), ("d4", "15", None), ("d5", "16", None),
 ("e1", "17", None), ("e2", "18", None),
 ("f1", "19", None), ("f2", "20", None),
 ("g1", "21", None), ("g2", "22", None), ("g3", "23", None), ("g4", "23", "Yüzlerine,"), ("g5", "24", None),
 ("i0", "25", None), ("i1", "25", "Dalgıç"), ("i2", "26", None), ("i3", "26", "Yol"),
 ("i4", "27", None), ("i5", "28", None), ("i6", "29", None), ("i7", "30", None),
 ("j1", "31", None), ("j2", "32", None),
]
T = json.loads((ROOT / "timing.json").read_text()); segs = {s["id"]: s for s in T["segments"]}
starts = []
for shot, seg, word in ANCHORS:
    if seg not in segs: continue
    s = segs[seg]
    if word is None: t = s["start"] - 0.30
    else:
        hit = [w for w in s["words"] if w["text"].strip(".,:;!?") == word.strip(".,:;!?")]
        assert hit, (shot, word); t = hit[0]["start"] - 0.20
    starts.append((shot, max(0.0, t)))
starts[0] = (starts[0][0], 0.0)
out = []
for i, (shot, t) in enumerate(starts):
    end = starts[i + 1][1] if i + 1 < len(starts) else T["total"]
    fr = lambda x: round(x * 24) / 24            # 24 fps kare sınırına oturt
    out.append({"id": shot, "start": fr(t), "dur": round(fr(end) - fr(t), 4)})
(ROOT / "shots.json").write_text(json.dumps(out, indent=1))
for o in out: print(o["id"], f"{o['start']:7.2f} {o['dur']:5.2f}")
print(len(out), "çekim, toplam", sum(o["dur"] for o in out))
