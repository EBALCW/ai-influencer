#!/usr/bin/env python3
"""script.json -> audio/seg/NN.mp3 + kelime zamanları -> audio/narration.wav + timing.json.
  python tts.py [--redo 03,17]   (metni değişen bölüm kendiliğinden yenilenir)"""
import asyncio, json, pathlib, subprocess, sys, hashlib
import edge_tts
ROOT = pathlib.Path(__file__).resolve().parent
FF = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
OFFSET = 0.05   # edge-tts kelime zamanları sese göre ~0,05 sn erken
LEAD = 0.5      # filmin başındaki sessizlik
spec = json.loads((ROOT / "script.json").read_text())
seg_dir = ROOT / "audio" / "seg"; seg_dir.mkdir(parents=True, exist_ok=True)
redo = set(sys.argv[sys.argv.index("--redo") + 1].split(",")) if "--redo" in sys.argv else set()

async def say(text, mp3, wj):
    com = edge_tts.Communicate(text, spec["voice"], rate=spec["rate"], boundary="WordBoundary")
    words = []
    with mp3.open("wb") as f:
        async for ev in com.stream():
            if ev["type"] == "audio": f.write(ev["data"])
            elif ev["type"] == "WordBoundary":
                s = ev["offset"] / 1e7 + OFFSET
                words.append({"text": ev["text"], "start": round(s, 3), "end": round(s + ev["duration"] / 1e7, 3)})
    assert words, text
    wj.write_text(json.dumps({"hash": hashlib.md5((text + spec["rate"]).encode()).hexdigest(), "words": words}, ensure_ascii=False))

def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "0", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]))

t = LEAD; out = []; inputs = []; nwords = 0
for s in spec["segments"]:
    mp3, wj = seg_dir / f"{s['id']}.mp3", seg_dir / f"{s['id']}.json"
    h = hashlib.md5((s["text"] + spec["rate"]).encode()).hexdigest()
    if s["id"] in redo or not wj.exists() or json.loads(wj.read_text())["hash"] != h:
        asyncio.run(say(s["text"], mp3, wj)); print("tts", s["id"])
    words = json.loads(wj.read_text())["words"]
    wav = seg_dir / f"{s['id']}.wav"
    # baş/son sessizliği kırpılmaz (kelime zamanları kaymasın); yalnızca wav'a çevrilir
    subprocess.run([FF, "-y", "-v", "error", "-i", str(mp3), "-ar", "48000", "-ac", "1", str(wav)], check=True)
    d = dur(wav); last = words[-1]["end"]
    use = min(d, last + 0.25)       # edge-tts sonda ~0,8 sn sessizlik bırakır; kes
    out.append({"id": s["id"], "text": s["text"], "start": round(t + words[0]["start"], 3), "end": round(t + last, 3),
                "words": [{"text": w["text"], "start": round(t + w["start"], 3), "end": round(t + w["end"], 3)} for w in words]})
    inputs.append((wav, use, s.get("gap", 0.35))); nwords += len(s["text"].split())
    t += use + s.get("gap", 0.35)
total = t + 1.2
lst = ROOT / "audio" / "concat.txt"
parts = []
sil = ROOT / "audio" / "seg" / "_lead.wav"
subprocess.run([FF, "-y", "-v", "error", "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=mono", "-t", str(LEAD), str(sil)], check=True)
parts.append(sil)
for i, (wav, use, gap) in enumerate(inputs):
    p = seg_dir / f"_p{i:02d}.wav"
    subprocess.run([FF, "-y", "-v", "error", "-i", str(wav), "-af", f"atrim=0:{use},apad=pad_dur={gap}", "-t", str(use + gap), str(p)], check=True)
    parts.append(p)
lst.write_text("".join(f"file '{p}'\n" for p in parts))
subprocess.run([FF, "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-af", "apad=pad_dur=1.2", "-c:a", "pcm_s16le", str(ROOT / "audio" / "narration.wav")], check=True)
(ROOT / "timing.json").write_text(json.dumps({"total": round(total, 3), "segments": out}, ensure_ascii=False, indent=1))
print(f"{nwords} kelime, {total:.1f} sn")
for o in out: print(o["id"], f"{o['start']:.2f}-{o['end']:.2f}", f"{o['end']-o['start']:.1f}")
