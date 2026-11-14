#!/usr/bin/env python3
"""timing.json -> out/captions.srt + out/captions.ass (kısa parçalar: en çok 6 kelime / 36 harf, en çok 2 satır)."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent
T = json.loads((ROOT / "timing.json").read_text()); spec = json.loads((ROOT / "script.json").read_text())
DISP = spec.get("display", {}); MAXW, MAXC = 6, 36
def disp(w):
    core = w.strip(".,:;!?"); return w.replace(core, DISP[core]) if core in DISP else w
rows = []
for s in T["segments"]:
    # edge-tts kelimeleri noktalamasız verir; noktalamayı metinden geri eşle
    toks = s["text"].split(); ws = s["words"]
    if len(toks) != len(ws):
        raise SystemExit(f"kelime sayısı tutmuyor: {s['id']} {len(toks)} != {len(ws)}")
    cur = []
    def flush():
        global cur
        if cur: rows.append({"t0": cur[0][1], "t1": cur[-1][2], "text": " ".join(c[0] for c in cur)}); cur = []
    for tok, w in zip(toks, ws):
        if cur and (len(cur) >= MAXW or len(" ".join(c[0] for c in cur)) + 1 + len(tok) > MAXC): flush()
        cur.append((disp(tok), w["start"], w["end"]))
        if tok[-1] in ".?!" or (tok[-1] in ",:;" and len(cur) >= 3): flush()
    flush()
# tek kelimelik artıkları bir öncekiyle birleştir (aynı cümledeyse ve sığıyorsa)
merged = []
for r in rows:
    if merged and len(r["text"].split()) == 1 and merged[-1]["text"][-1] not in ".?!" and len(merged[-1]["text"]) + len(r["text"]) < MAXC + 6 and r["t0"] - merged[-1]["t1"] < 0.4:
        merged[-1]["t1"] = r["t1"]; merged[-1]["text"] += " " + r["text"]
    else: merged.append(r)
rows = merged
for i, r in enumerate(rows):
    nxt = rows[i + 1]["t0"] if i + 1 < len(rows) else 1e9
    r["t0"] = max(0, r["t0"] - 0.04); r["t1"] = nxt - 0.07 if nxt - r["t1"] < 0.45 else r["t1"] + 0.25
def st(t, sep=","):
    ms = int(round(t * 1000)); return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d}{sep}{ms % 1000:03d}"
def at(t):
    cs = int(round(t * 100)); return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"
out = ROOT / "out"; out.mkdir(exist_ok=True)
(out / "captions.srt").write_text("".join(f"{i}\n{st(r['t0'])} --> {st(r['t1'])}\n{r['text']}\n\n" for i, r in enumerate(rows, 1)), encoding="utf-8")
head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Alt,Arial,50,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,1,0,0,0,100,100,0.5,0,1,3.2,1.2,2,150,150,470,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
(out / "captions.ass").write_text(head + "".join(f"Dialogue: 0,{at(r['t0'])},{at(r['t1'])},Alt,,0,0,0,,{r['text']}\n" for r in rows), encoding="utf-8")
print(len(rows), "altyazı; en uzun:", max(len(r["text"]) for r in rows), "harf")
