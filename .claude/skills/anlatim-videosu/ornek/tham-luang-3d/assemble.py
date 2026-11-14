#!/usr/bin/env python3
"""frames/<çekim>/f-*.png -> clips/<çekim>.mp4 -> out/master (altyazısız) -> out/final (altyazılı).
  python assemble.py [--clips-only] [--no-clips]"""
import json, pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent
FF = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
shots = json.loads((ROOT / "shots.json").read_text()); T = json.loads((ROOT / "timing.json").read_text())
FPS = 24
def run(*a): subprocess.run([FF, "-y", "-v", "error", *map(str, a)], check=True)
(ROOT / "clips").mkdir(exist_ok=True)
if "--no-clips" not in sys.argv and "--audio-only" not in sys.argv:
    for s in shots:
        n = round(s["dur"] * FPS); d = ROOT / "frames" / s["id"]
        have = len(list(d.glob("f-*.png")))
        if not n <= have <= n + 2: raise SystemExit(f"{s['id']}: {have}/{n} kare")
        clip = ROOT / "clips" / f"{s['id']}.mp4"
        if clip.exists() and clip.stat().st_mtime > max(p.stat().st_mtime for p in d.glob("f-*.png")): continue
        run("-framerate", FPS, "-start_number", 1, "-i", d / "f-%04d.png", "-frames:v", n,
            "-vf", "scale=1080:1920:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-crf", 13, "-preset", "fast", "-r", FPS, clip)
        print("clip", s["id"], n)
if "--clips-only" in sys.argv: sys.exit()
total = sum(s["dur"] for s in shots)
lst = ROOT / "clips" / "list.txt"; lst.write_text("".join(f"file '{ROOT / 'clips' / (s['id'] + '.mp4')}'\n" for s in shots))
# --- ses: anlatım + sentezlenmiş ortam yatağı (yalnızca ffmpeg)
bed = ROOT / "audio" / "bed.wav"
run("-f", "lavfi", "-i", f"sine=f=55:r=48000:d={total}", "-f", "lavfi", "-i", f"sine=f=82.4:r=48000:d={total}",
    "-f", "lavfi", "-i", f"anoisesrc=c=brown:r=48000:d={total}:a=0.6:seed=3", "-f", "lavfi", "-i", f"anoisesrc=c=pink:r=48000:d={total}:a=0.25:seed=9",
    "-filter_complex",
    "[0]volume=0.50,tremolo=f=0.12:d=0.5[a];[1]volume=0.28,tremolo=f=0.17:d=0.6[b];"
    "[2]lowpass=f=260,volume=1.3,tremolo=f=0.19:d=0.35[c];[3]highpass=f=900,lowpass=f=3500,volume=0.10,tremolo=f=0.31:d=0.4[d];"
    f"[a][b][c][d]amix=inputs=4:normalize=0,afade=t=in:d=2,afade=t=out:st={total - 3}:d=3,aformat=channel_layouts=stereo[o]",
    "-map", "[o]", "-c:a", "pcm_s16le", bed)
mix = ROOT / "audio" / "mix.wav"
run("-i", ROOT / "audio" / "narration.wav", "-i", bed, "-filter_complex",
    "[0]highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=160:makeup=2,aformat=channel_layouts=stereo[v];"
    "[1]volume=-17dB[b];[v][b]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000[o]",
    "-map", "[o]", "-t", total, "-c:a", "pcm_s16le", mix)
if "--audio-only" in sys.argv: sys.exit()
out = ROOT / "out"
master = out / "magara-17-gun-3d-tr-altyazisiz.mp4"
vf = f"vignette=PI/5.5,fade=t=in:d=0.6,fade=t=out:st={total - 1.2}:d=1.2"
enc = ["-c:v", "libx264", "-crf", 19, "-preset", "medium", "-maxrate", "9M", "-bufsize", "18M", "-pix_fmt", "yuv420p", "-r", FPS,
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", total]
run("-f", "concat", "-safe", 0, "-i", lst, "-i", mix, "-vf", vf, "-map", "0:v", "-map", "1:a", *enc, master)
final = out / "magara-17-gun-3d-tr.mp4"
ass = str(out / "captions.ass").replace(":", r"\:")
run("-f", "concat", "-safe", 0, "-i", lst, "-i", mix, "-vf", vf + f",subtitles='{ass}'", "-map", "0:v", "-map", "1:a", *enc, final)
print("bitti", final, total)
