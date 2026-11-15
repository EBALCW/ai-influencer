#!/usr/bin/env python3
"""frames/<çekim>/f-*.png (+ labels/<çekim>/l-*.png) -> clips/<çekim>.mp4 -> out/ana kopya (altyazısız) -> out/final.
Görüntü 720x1280'den lanczos ile büyütülür, vinyet eklenir; yazı geçişi 1080x1920'de üstüne bindirilir (keskin kalır).
  python assemble.py [--clips-only] [--no-clips] [--audio-only]"""
import json, pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parent
FF = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
shots = json.loads((ROOT / "shots.json").read_text())
FPS = 24
def run(*a): subprocess.run([FF, "-y", "-v", "error", *map(str, a)], check=True)
(ROOT / "clips").mkdir(exist_ok=True)
if "--no-clips" not in sys.argv and "--audio-only" not in sys.argv:
    for s in shots:
        n = round(s["dur"] * FPS); d = ROOT / "frames" / s["id"]; ld = ROOT / "labels" / s["id"]
        have = len(list(d.glob("f-*.png")))
        if have != n: raise SystemExit(f"{s['id']}: {have}/{n} kare")
        clip = ROOT / "clips" / f"{s['id']}.mp4"
        plate = "scale=1080:1920:flags=lanczos,vignette=PI/5"
        enc = ["-frames:v", n, "-c:v", "libx264", "-crf", 13, "-preset", "fast", "-pix_fmt", "yuv420p", "-r", FPS, clip]
        if (ld / "YOK").exists():
            run("-framerate", FPS, "-start_number", 1, "-i", d / "f-%04d.png", "-vf", plate, *enc)
        else:
            if len(list(ld.glob("l-*.png"))) != n: raise SystemExit(f"{s['id']}: yazı karesi eksik")
            run("-framerate", FPS, "-start_number", 1, "-i", d / "f-%04d.png", "-framerate", FPS, "-start_number", 1, "-i", ld / "l-%04d.png",
                "-filter_complex", f"[0:v]{plate}[p];[p][1:v]overlay=0:0:format=auto[o]", "-map", "[o]", *enc)
        print("clip", s["id"], n)
if "--clips-only" in sys.argv: sys.exit()
total = sum(s["dur"] for s in shots)
lst = ROOT / "clips" / "list.txt"; lst.write_text("".join(f"file '{ROOT / 'clips' / (s['id'] + '.mp4')}'\n" for s in shots))

# --- ses: anlatım + mekâna göre değişen sentez ortam yatağı (yalnızca ffmpeg, indirilen ses yok)
LOC = {"oda": "h1 h2 c2 c3 c4 c5 d4 f1 g3 g4 g5", "dalis": "b1 c1 d3 e1 e2 g1 g2 i0 i1 i2", "yagmur": "a4 a6 b2 f2",
       "gunduz": "a1 a2 i6 j2", "kesit": "h3 a3 a5 d1 d2 d5 i3 i4 i5 i7 j1"}
def env(names, fade=0.7, gain=1.0):
    """Çekim aralıklarında 1, dışında 0 olan, yumuşak geçişli zarf ifadesi (volume filtresi için)."""
    iv = []
    for s in shots:
        if s["id"] in names.split():
            a, b = s["start"], s["start"] + s["dur"]
            if iv and abs(iv[-1][1] - a) < 0.01: iv[-1][1] = b
            else: iv.append([a, b])
    e = "+".join(f"clip((t-{a - fade / 2:.2f})/{fade},0,1)*clip(({b + fade / 2:.2f}-t)/{fade},0,1)" for a, b in iv) or "0"
    return f"volume='{gain}*min(1,{e})':eval=frame"
drip = "+".join(f"{v}*sin(2*PI*{f}*mod(t+{ph},{P})*(1-{g}*mod(t+{ph},{P})))*exp(-mod(t+{ph},{P})*{dc})"
                for v, f, ph, P, g, dc in ((0.5, 1750, 0.3, 3.13, 0.9, 34), (0.35, 2300, 1.7, 4.71, 1.1, 40), (0.3, 1320, 2.2, 7.37, 0.7, 28),
                                           (0.22, 2850, 0.9, 5.93, 1.2, 46), (0.28, 1560, 4.1, 11.3, 0.8, 30)))
bed = ROOT / "audio" / "bed.wav"
src = lambda kind, seed, amp: ["-f", "lavfi", "-i", f"anoisesrc=c={kind}:r=48000:d={total}:a={amp}:seed={seed}"]
run("-f", "lavfi", "-i", f"sine=f=55:r=48000:d={total}", "-f", "lavfi", "-i", f"sine=f=82.4:r=48000:d={total}",
    *src("brown", 3, 0.6), *src("brown", 11, 0.6), *src("pink", 9, 0.4), *src("white", 5, 0.3), *src("pink", 21, 0.3),
    "-f", "lavfi", "-i", f"aevalsrc='{drip}':s=48000:d={total}",
    "-filter_complex",
    # alçak uğultu: her yerde; kesit/gündüz çekimlerinde biraz geride
    "[0]volume=0.45,tremolo=f=0.12:d=0.5[d1];[1]volume=0.24,tremolo=f=0.17:d=0.6[d2];[d1][d2]amix=inputs=2:normalize=0[dr];"
    # mağara havası: boğuk gürültü + yankılı damlalar
    f"[2]lowpass=f=240,volume=1.1,tremolo=f=0.19:d=0.3,{env(LOC['oda'] + ' ' + LOC['kesit'])}[cv];"
    f"[7]aecho=0.8:0.7:90|210|370:0.5|0.35|0.2,lowpass=f=5000,{env(LOC['oda'], gain=0.55)}[dp];"
    # su altı: çok boğuk gürleme + ağır nefes/kabarcık nabzı
    f"[3]lowpass=f=140,volume=2.4,tremolo=f=0.23:d=0.7,{env(LOC['dalis'])}[uw];"
    f"[4]bandpass=f=420:w=260,tremolo=f=6.5:d=0.9,tremolo=f=0.22:d=0.95,volume=0.5,{env(LOC['dalis'])}[bb];"
    # yağmur (dışarı) ve hafif gündüz havası
    f"[5]highpass=f=1400,lowpass=f=7500,tremolo=f=0.4:d=0.25,volume=0.55,{env(LOC['yagmur'])}[rn];"
    f"[6]bandpass=f=700:w=600,tremolo=f=0.15:d=0.6,volume=0.25,{env(LOC['gunduz'] + ' ' + LOC['yagmur'])}[wd];"
    f"[dr][cv][dp][uw][bb][rn][wd]amix=inputs=7:normalize=0,afade=t=in:d=2,afade=t=out:st={total - 3}:d=3,aformat=channel_layouts=stereo[o]",
    "-map", "[o]", "-c:a", "pcm_s16le", bed)
mix = ROOT / "audio" / "mix.wav"
run("-i", ROOT / "audio" / "narration.wav", "-i", bed, "-filter_complex",
    "[0]highpass=f=70,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=160:makeup=2,aformat=channel_layouts=stereo[v];"
    "[1]volume=-15dB[b];[v][b]amix=inputs=2:normalize=0:duration=longest,loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000[o]",
    "-map", "[o]", "-t", total, "-c:a", "pcm_s16le", mix)
if "--audio-only" in sys.argv: sys.exit()
out = ROOT / "out"; out.mkdir(exist_ok=True)
master = out / "magara-17-gun-3d-v2-tr-altyazisiz.mp4"
vf = f"fade=t=in:d=0.6,fade=t=out:st={total - 1.2}:d=1.2"
enc = ["-c:v", "libx264", "-crf", 19, "-preset", "medium", "-maxrate", "9M", "-bufsize", "18M", "-pix_fmt", "yuv420p", "-r", FPS,
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", total]
run("-f", "concat", "-safe", 0, "-i", lst, "-i", mix, "-vf", vf, "-map", "0:v", "-map", "1:a", *enc, master)
final = out / "magara-17-gun-3d-v2-tr.mp4"
ass = str(out / "captions.ass").replace(":", r"\:")
run("-f", "concat", "-safe", 0, "-i", lst, "-i", mix, "-vf", vf + f",subtitles='{ass}'", "-map", "0:v", "-map", "1:a", *enc, final)
print("bitti", final, total)
