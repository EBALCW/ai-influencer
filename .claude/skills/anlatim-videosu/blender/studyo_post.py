"""Stüdyo kalıbının Blender dışı yarısı (düz Python, bpy gerekmez): dile göre ekran yazıları, büyük altyazı (ASS),
ışıma (bloom) filtresi ve sentez ses yatağı. `studyo.py` de `load_texts`'i buradan alır."""
import json
import os


# ---------------------------------------------------------------- dile göre ekran yazıları
class Texts:
    """texts.<dil>.json sarmalayıcısı: T("anahtar") ya da T("anahtar", km=45). Eksik anahtar hata verir:
    çeviride unutulan yazı render'da sessizce boş çıkmasın."""

    def __init__(self, data, lang):
        self.data, self.lang = data, lang

    def __call__(self, key, **fmt):
        if key not in self.data:
            raise KeyError(f"texts.{self.lang}.json içinde '{key}' yok")
        v = self.data[key]
        return v.format(**fmt) if fmt else v

    def has(self, key):
        return key in self.data


def load_texts(folder, lang="tr"):
    with open(os.path.join(folder, f"texts.{lang}.json"), encoding="utf-8") as f:
        return Texts(json.load(f), lang)


def upper(s, lang="tr"):
    """Büyük harf; Türkçede i→İ, ı→I (str.upper() 'i'yi 'I' yapar)."""
    if lang == "tr":
        s = s.replace("i", "İ").replace("ı", "I")
    return s.upper()


# ---------------------------------------------------------------- büyük altyazı
def caption_rows(timing, lang="tr", max_words=3, max_chars=17, shift=0.12, display=None):
    """Kelime zamanlarından 2-3 kelimelik büyük altyazı parçaları. timing: tts.py çıktısı (segments[].text/words).
    Cümle sonunda ve virgülde bölünür; tek kelimelik artık, sığıyorsa öncekine eklenir. shift: edge-tts kelime
    zamanları sesten ~0,1 sn erken olduğu için gecikme."""
    display = display or {}
    rows = []
    for s in timing["segments"]:
        toks, ws = s["text"].split(), s["words"]
        if len(toks) != len(ws):
            raise SystemExit(f"kelime sayısı tutmuyor: {s['id']} {len(toks)} != {len(ws)}")
        cur = []

        def flush(end):
            if cur:
                rows.append({"t0": cur[0][1], "t1": cur[-1][2], "text": " ".join(c[0] for c in cur), "end": end})
                cur.clear()

        for tok, w in zip(toks, ws):
            core = tok.strip(".,:;!?")
            word = display.get(core, core) + ("?" if tok.endswith("?") else "")
            if cur and (len(cur) >= max_words or len(" ".join(c[0] for c in cur)) + 1 + len(word) > max_chars):
                flush(False)
            cur.append((word, w["start"], w["end"]))
            if tok[-1] in ".?!:":
                flush(True)
            elif tok[-1] in ",;" and len(cur) >= 2:
                flush(True)
        flush(True)
    merged = []
    for r in rows:
        p = merged[-1] if merged else None
        if (p and " " not in r["text"] and not p["end"] and len(p["text"]) + 1 + len(r["text"]) <= max_chars + 5
                and r["t0"] - p["t1"] < 0.4):
            p["t1"], p["end"] = r["t1"], r["end"]
            p["text"] += " " + r["text"]
        else:
            merged.append(dict(r))
    for i, r in enumerate(merged):
        nxt = merged[i + 1]["t0"] if i + 1 < len(merged) else 1e9
        r["t1"] = nxt - 0.03 if nxt - r["t1"] < 0.5 else r["t1"] + 0.3
        r["t0"] += shift
        r["t1"] += shift
        r["text"] = upper(r["text"], lang)
    return merged


def _ass_t(t):
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def write_big_captions(rows, path, font="Avenir Next Condensed Heavy", size=104, margin_v=500, res=(1080, 1920)):
    """Alt-ortada büyük, dar, kalın beyaz harfler; yumuşak gölge. margin_v: karenin altından piksel (1920'de 500 ≈
    yazı tabanı %74). Yazı tam çözünürlükte, ffmpeg `subtitles` filtresiyle bindirilir (Blender'da değil)."""
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {res[0]}
PlayResY: {res[1]}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Buyuk,{font},{size},&H00FFFFFF,&H00FFFFFF,&H50000000,&H78000000,0,0,0,0,100,100,1.5,0,1,2.2,3,2,60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    body = "".join(f"Dialogue: 0,{_ass_t(r['t0'])},{_ass_t(r['t1'])},Buyuk,,0,0,0,,{{\\blur1.2\\fad(50,0)}}{r['text']}\n"
                   for r in rows)
    with open(path, "w", encoding="utf-8") as f:
        f.write(head + body)
    return path


# ---------------------------------------------------------------- görüntü: ışıma
def glow_filter(src="0:v", out="g", threshold=0.62, sigma=14, amount=0.75):
    """EEVEE'de bloom yok (4.2'den beri); ışıyan malzemelerin halesi ffmpeg ile eklenir. Parlak bölgeler ayrılır,
    bulanıklaştırılır ve üstüne 'screen' ile bindirilir. 720x1280 görüntüde, büyütmeden ÖNCE uygula (ucuz).
    Dönen: filter_complex parçası; çıktı etiketi [out]."""
    k = 1.0 / max(1e-3, 1 - threshold)
    return (f"[{src}]format=gbrp,split[{out}a][{out}b];"
            f"[{out}b]lutrgb=r='clip((val/255-{threshold})*{k:.3f},0,1)*255':g='clip((val/255-{threshold})*{k:.3f},0,1)*255'"
            f":b='clip((val/255-{threshold})*{k:.3f},0,1)*255',gblur=sigma={sigma},lutrgb=r='val*{amount}':g='val*{amount}'"
            f":b='val*{amount}'[{out}c];[{out}a][{out}c]blend=all_mode=screen[{out}]")


# ---------------------------------------------------------------- ses: sentez yatak
def bed_args(total, cuts, drone=(55.0, 82.4), whoosh=0.5):
    """Stüdyo yatağı için ffmpeg argümanları (girdiler + filter_complex; çıktı etiketi [bed], stereo):
    alçak iki sinüs uğultu + havadar gürültü + her kesmede kısa 'vuuş'. İndirilen ses yoktur.
    cuts: kesme anları (sn). Dönen liste: ffmpeg'e -map '[bed]' ile birlikte verilir."""
    env = "+".join(f"exp(-pow((t-{c:.2f})/0.16,2))" for c in cuts) or "0"
    return ["-f", "lavfi", "-i", f"sine=f={drone[0]}:r=48000:d={total}", "-f", "lavfi", "-i", f"sine=f={drone[1]}:r=48000:d={total}",
            "-f", "lavfi", "-i", f"anoisesrc=c=pink:r=48000:d={total}:a=0.5:seed=7",
            "-f", "lavfi", "-i", f"anoisesrc=c=white:r=48000:d={total}:a=0.5:seed=3",
            "-filter_complex",
            "[0]volume=0.40,tremolo=f=0.11:d=0.5[d1];[1]volume=0.20,tremolo=f=0.17:d=0.6[d2];"
            "[2]bandpass=f=900:w=900,tremolo=f=0.13:d=0.5,volume=0.16[air];"
            f"[3]bandpass=f=1500:w=1600,volume='{whoosh}*min(1,{env})':eval=frame[wh];"
            f"[d1][d2][air][wh]amix=inputs=4:normalize=0,afade=t=in:d=1.2,afade=t=out:st={total - 2.2:.2f}:d=2.2,"
            "aformat=channel_layouts=stereo[bed]"]
