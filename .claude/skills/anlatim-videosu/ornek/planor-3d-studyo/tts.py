#!/usr/bin/env python3
"""script[.<dil>].json -> audio/<dil>/seg/NN.mp3 + kelime zamanları -> audio/<dil>/narration.wav + timing.<dil>.json.
  FILM_LANG=tr|en  VOICE=<edge-tts sesi> (verilmezse script'teki)  python tts.py [--redo 03,07]
Ses bir parametredir: anlatıcı kataloğundan başka ses seçilince yalnızca VOICE değişir, sahne kodu aynı kalır."""
import asyncio, hashlib, json, os, pathlib, subprocess, sys
import edge_tts
ROOT = pathlib.Path(__file__).resolve().parent
FF = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
LANG = os.environ.get("FILM_LANG", "tr")
OFFSET, LEAD, TAIL = 0.05, 0.35, 1.4
spec = json.loads((ROOT / ("script.json" if LANG == "tr" else f"script.{LANG}.json")).read_text())
VOICE = os.environ.get("VOICE") or spec["voice"]
RATE = spec.get("rate", "+0%")
A = ROOT / "audio" / LANG; seg_dir = A / "seg"; seg_dir.mkdir(parents=True, exist_ok=True)
redo = set(sys.argv[sys.argv.index("--redo") + 1].split(",")) if "--redo" in sys.argv else set()
def run(*a): subprocess.run([FF, "-y", "-v", "error", *map(str, a)], check=True)
async def say(text, mp3, wj, h):
    com = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary"); words = []
    with mp3.open("wb") as f:
        async for ev in com.stream():
            if ev["type"] == "audio": f.write(ev["data"])
            elif ev["type"] == "WordBoundary":
                s = ev["offset"] / 1e7 + OFFSET
                words.append({"text": ev["text"], "start": round(s, 3), "end": round(s + ev["duration"] / 1e7, 3)})
    assert words, text
    wj.write_text(json.dumps({"hash": h, "words": words}, ensure_ascii=False))
def dur(p): return float(subprocess.check_output(["ffprobe", "-v", "0", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]))
t = LEAD; out = []; parts = []; nwords = 0
sil = seg_dir / "_lead.wav"; run("-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", LEAD, sil); parts.append(sil)
for i, s in enumerate(spec["segments"]):
    mp3, wj, wav = seg_dir / f"{s['id']}.mp3", seg_dir / f"{s['id']}.json", seg_dir / f"{s['id']}.wav"
    h = hashlib.md5((s["text"] + RATE + VOICE).encode()).hexdigest()
    if s["id"] in redo or not wj.exists() or json.loads(wj.read_text())["hash"] != h:
        asyncio.run(say(s["text"], mp3, wj, h)); print("tts", s["id"])
    words = json.loads(wj.read_text())["words"]
    run("-i", mp3, "-ar", 48000, "-ac", 1, wav)
    last = words[-1]["end"]; use = min(dur(wav), last + 0.25); gap = s.get("gap", 0.35)   # edge-tts sonda ~0,8 sn sessizlik bırakır
    out.append({"id": s["id"], "text": s["text"], "shots": s.get("shots", []), "start": round(t + words[0]["start"], 3), "end": round(t + last, 3),
                "words": [{"text": w["text"], "start": round(t + w["start"], 3), "end": round(t + w["end"], 3)} for w in words]})
    p = seg_dir / f"_p{i:02d}.wav"; run("-i", wav, "-af", f"atrim=0:{use},apad=pad_dur={gap}", "-t", use + gap, p); parts.append(p)
    nwords += len(s["text"].split()); t += use + gap
total = t + TAIL
(A / "concat.txt").write_text("".join(f"file '{p}'\n" for p in parts))
run("-f", "concat", "-safe", 0, "-i", A / "concat.txt", "-af", f"apad=pad_dur={TAIL}", "-c:a", "pcm_s16le", A / "narration.wav")
(ROOT / f"timing.{LANG}.json").write_text(json.dumps({"lang": LANG, "voice": VOICE, "total": round(total, 3), "segments": out}, ensure_ascii=False, indent=1))
print(f"{nwords} kelime, {total:.1f} sn, ses {VOICE}")
for o in out: print(o["id"], f"{o['start']:.2f}-{o['end']:.2f}", f"{o['end'] - o['start']:.1f}")
