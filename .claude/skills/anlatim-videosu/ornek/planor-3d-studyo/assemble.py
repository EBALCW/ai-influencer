#!/usr/bin/env python3
"""frames/<çekim>/f-*.png (+ labels/<çekim>/l-*.png) -> clips/<çekim>.mp4 -> out/planor-studyo-<dil>.mp4
Görüntü 720x1280'de ışıma (bloom) alır, lanczos ile 1080x1920'ye büyütülür, vinyet eklenir; yazı geçişi tam
çözünürlükte üstüne biner; büyük altyazı en son yakılır. Altyazısız ana kopya üretilmez.
  FILM_LANG=tr|en python assemble.py [--no-clips] [--audio-only]"""
import json, os, pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "kit") if (ROOT / "kit").is_dir() else str(ROOT / ".." / ".." / "blender"))
import studyo_post as P
FF = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
LANG = os.environ.get("FILM_LANG", "tr")
shots = json.loads((ROOT / f"shots.{LANG}.json").read_text())
FPS = 24
def run(*a): subprocess.run([FF, "-y", "-v", "error", *map(str, a)], check=True)
(ROOT / "clips").mkdir(exist_ok=True)
if "--no-clips" not in sys.argv and "--audio-only" not in sys.argv:
    for s in shots:
        n = round(s["dur"] * FPS); d = ROOT / "frames" / s["id"]; ld = ROOT / "labels" / s["id"]
        have = len(list(d.glob("f-*.png")))
        if have != n: raise SystemExit(f"{s['id']}: {have}/{n} kare")
        clip = ROOT / "clips" / f"{s['id']}.mp4"
        plate = P.glow_filter("0:v", "g") + ";[g]scale=1080:1920:flags=lanczos,vignette=PI/5.5"
        enc = ["-frames:v", n, "-c:v", "libx264", "-crf", 13, "-preset", "fast", "-pix_fmt", "yuv420p", "-r", FPS, clip]
        src = ["-framerate", FPS, "-start_number", 1, "-i", d / "f-%04d.png"]
        if (ld / "YOK").exists():
            run(*src, "-filter_complex", plate + "[o]", "-map", "[o]", *enc)
        else:
            if len(list(ld.glob("l-*.png"))) != n: raise SystemExit(f"{s['id']}: yazı karesi eksik")
            run(*src, "-framerate", FPS, "-start_number", 1, "-i", ld / "l-%04d.png",
                "-filter_complex", plate + "[p];[p][1:v]overlay=0:0:format=auto[o]", "-map", "[o]", *enc)
        print("clip", s["id"], n)
total = sum(s["dur"] for s in shots)
lst = ROOT / "clips" / "list.txt"; lst.write_text("".join(f"file '{ROOT / 'clips' / (s['id'] + '.mp4')}'\n" for s in shots))
A = ROOT / "audio" / LANG
bed, mix = A / "bed.wav", A / "mix.wav"
run(*P.bed_args(total, [s["start"] for s in shots[1:]]), "-map", "[bed]", "-c:a", "pcm_s16le", bed)
run("-i", A / "narration.wav", "-i", bed, "-filter_complex",
    "[0]highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=160:makeup=2,aformat=channel_layouts=stereo[v];"
    "[1]volume=-17dB[b];[v][b]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000[o]",
    "-map", "[o]", "-t", total, "-c:a", "pcm_s16le", mix)
if "--audio-only" in sys.argv: sys.exit()
out = ROOT / "out"; out.mkdir(exist_ok=True)
final = out / f"planor-studyo-{LANG}.mp4"
ass = str(out / f"captions.{LANG}.ass").replace(":", r"\:")
vf = f"fade=t=in:d=0.4,fade=t=out:st={total - 1.0}:d=1.0,subtitles='{ass}'"
run("-f", "concat", "-safe", 0, "-i", lst, "-i", mix, "-vf", vf, "-map", "0:v", "-map", "1:a",
    "-c:v", "libx264", "-crf", 18, "-preset", "medium", "-maxrate", "10M", "-bufsize", "20M", "-pix_fmt", "yuv420p", "-r", FPS,
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", total, final)
print("bitti", final, round(total, 2))
