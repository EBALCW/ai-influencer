#!/usr/bin/env python3
"""Animated-explainer builder: a reel spec plus its locked voice -> a HyperFrames project and a cue sheet.

    python3 <skill>/scripts/build.py <edit>/work/<reel>        # the folder that holds spec.py and voice/timing.json

Writes <reel>/index.html (render it with `hyperframes render <reel>`), <reel>/cues.json (one sound per visible event,
for edit-video's sfx-sync.mjs) and <reel>/assets/. Every picture and sound event is keyed to a word time in
voice/timing.json, which edit-video's scripts/voice.py writes.

spec.py defines:
  LINES      the spoken lines, in order. *word* = accent (serif italic, accent colour); " | " splits a line into two
             on-screen phrases (the voice ignores it). A line that starts with "[<GUEST>] " is the second voice's.
  BIG        indices of lines whose first phrase is shown big (the hook).                                   optional
  DARKTXT    indices of lines set in ink, for light fields.                                                 optional
  STYLE      'fields' (default) or 'rail'.                                                                  optional
  CHARACTER  'ali', 'stashy', a path to a rig folder, or None (no character). Needs the cartoon-character skill.
  HOST, GUEST  the character's name chip and the second voice's tag (default 'you' and 'Agent').           optional
  def build(T) -> dict(scenes=[...], sfx=[...], js="...", css="...", ava=..., pres=..., rail=..., hook=..., hud="...")
     scenes  [{"id", "t0", "field", "html", "enter"?: "iris"|"scroll"|"cut", "at"?: [x, y]}]  (t1 = next scene's t0)
     sfx     [[t, sound, gain_db], ...]  t = the frame the event first shows; sound = a pack id such as "ui-pop";
             gain is relative to the pack's suggested level (0 = suggested)
     js      timeline code using the helpers in assets/explainer.js (pop, rise, fade, nudge, count, draw, type, push)
     ava     the cursor: {"path": [[t, x, y, dur?]], "clicks": [[t, x, y]], "size": [[t, scale]], "show": [[t, on]]}
     pres    the character's performance: {"poses": [[t, pose]], "upper": [[a, b, "worried"|"excited"]], "bounces": [t]}
     rail    rail look only: {"start": [x, y, scale], "land": t, "chapters": [[t, label, y]], "end": [t, x, y, scale]}
     hook    optional hook hit: {"t", "target": css selector, "stamp", "sub"?, "out"?}
T (the voice timing): T.L(i) and T.E(i) are line i's start and end, T.W(i, j) word j's start, T.find('word', line=i)
the start of a word by its text, T.END the reel's length.
Needs python3 and ffmpeg; GSAP comes from edit-video's workspace runtime (FAVSTASH_GSAP overrides).
"""
import html as H, importlib.util, json, os, pathlib, re, shutil, subprocess, sys

SKILL = pathlib.Path(__file__).resolve().parents[1]
ASSETS = SKILL / 'assets'
FPS = 30
esc = lambda s: H.escape(str(s), quote=False)


FONT_WEIGHTS = {'thin': 100, 'extralight': 200, 'light': 300, 'regular': 400, 'medium': 500, 'semibold': 600,
                'bold': 700, 'extrabold': 800, 'black': 900}


def font_faces(folder, href, family=None):
    """@font-face rules for every font in `folder`, read from its file name: <family>-<weight or var>[-<style>]."""
    rules = []
    for f in sorted(pathlib.Path(folder).iterdir()):
        fmt = {'.woff2': 'woff2', '.woff': 'woff', '.ttf': 'truetype', '.otf': 'opentype'}.get(f.suffix.lower())
        if not fmt:
            continue
        parts, style, weight = re.split(r'[-_]', f.stem), 'normal', '400'
        if parts[-1].lower() in ('italic', 'normal'):
            style = parts.pop().lower()
        w = parts[-1].lower()
        if w == 'var':
            weight = '100 900'
            parts.pop()
        elif w.isdigit() or w in FONT_WEIGHTS:
            weight = str(FONT_WEIGHTS.get(w, w))
            parts.pop()
        name = family or ' '.join(p[:1].upper() + p[1:] for p in parts)
        rules.append(f'@font-face {{ font-family: "{name}"; font-style: {style}; font-weight: {weight}; '
                     f'src: url("{href}{f.name}") format("{fmt}"); }}')
    return '\n'.join(rules)


def find_gsap(start):
    """GSAP comes from the workspace runtime that edit-video's `init-workspace.mjs --install` prepares."""
    env = os.environ.get('FAVSTASH_GSAP')
    if env and pathlib.Path(env).is_file():
        return pathlib.Path(env)
    for base in (pathlib.Path(start).resolve(), pathlib.Path.cwd()):
        for p in [base, *base.parents]:
            c = p / '.favstash-studio/runtime/node_modules/gsap/dist/gsap.min.js'
            if c.is_file():
                return c
    raise SystemExit("GSAP not found. Run edit-video's scripts/init-workspace.mjs --workspace <project> --install, "
                     "or set FAVSTASH_GSAP to a local gsap.min.js.")


def find_cartoon():
    """The cartoon-character skill: FAVSTASH_CARTOON, or installed next to this skill."""
    env = os.environ.get('FAVSTASH_CARTOON')
    for c in ([pathlib.Path(env)] if env else []) + [SKILL.parent / 'cartoon-character']:
        if (c / 'scripts' / 'presenter.py').is_file():
            return c
    raise SystemExit('This spec has a CHARACTER, which needs the cartoon-character skill: install it next to this skill '
                     'or set FAVSTASH_CARTOON to its folder. Or set CHARACTER = None.')


class Timing:
    def __init__(self, p):
        d = json.loads(pathlib.Path(p).read_text()); self.d = d; self.LN = d['lines']; self.END = d['duration']
        self.words = [(i, j, w) for i, l in enumerate(self.LN) for j, w in enumerate(l['words'])]

    def L(self, i): return self.LN[i]['start']
    def E(self, i): return self.LN[i]['end']
    def W(self, i, j): return self.LN[i]['words'][j]['s']
    def We(self, i, j): return self.LN[i]['words'][j]['e']

    def find(self, word, line=None, n=1):
        """Start of the n-th occurrence of word (case and punctuation don't matter), optionally inside one line."""
        norm = lambda s: re.sub(r"[^a-z0-9%$']", '', s.lower())
        k = 0
        for i, j, w in self.words:
            if line is not None and i != line: continue
            if norm(w['w']) == norm(word):
                k += 1
                if k == n: return w['s']
        raise KeyError(f'{word!r} (n={n}, line={line}) is not in the voice')


def load_spec(reel):
    p = reel / 'spec.py'
    if not p.is_file(): raise SystemExit(f'No spec.py in {reel}')
    s = importlib.util.spec_from_file_location('spec', p); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
    return m


def phrases(spec, T, mark):
    """One spoken line = one on-screen phrase; " | " inside a line splits it into display phrases."""
    out = []
    for i, line in enumerate(spec.LINES):
        who = 'guest' if line.startswith(mark) else 'host'
        line = line[len(mark):] if who == 'guest' else line
        chunks = [c.split() for c in line.split(' | ')]
        tw = T.LN[i]['words']
        if sum(len(c) for c in chunks) != len(tw):
            raise SystemExit(f'line {i}: {sum(len(c) for c in chunks)} script words vs {len(tw)} voice words\n  {line}\n  {[w["w"] for w in tw]}')
        k = 0
        for n, toks in enumerate(chunks):
            ws = [{'t': t.replace('*', ''), 'acc': t.startswith('*'), 's': round(tw[k + j]['s'], 3)} for j, t in enumerate(toks)]
            t0 = 0 if (i == 0 and n == 0) else round(tw[k]['s'] - .08, 3)
            out.append({'t0': t0, 'words': ws, 'who': who, 'line': i, 'big': i in getattr(spec, 'BIG', []) and n == 0,
                        'dark': i in getattr(spec, 'DARKTXT', []) or getattr(spec, 'STYLE', 'fields') == 'rail', 'lit0': i == 0 and n == 0})
            k += len(toks)
    for i in range(len(out) - 1):
        out[i]['t1'] = out[i + 1]['t0']
    out[-1]['t1'] = None
    return out


def character(spec, reel, T, B, assets):
    """The lip-synced rig (cartoon-character skill) for the cursor badge or the rail head. Returns (html, pres) or ('', None)."""
    name = getattr(spec, 'CHARACTER', None)
    if not name:
        return '', None
    cartoon = find_cartoon()
    rig = cartoon / 'characters' / name / 'rig' if '/' not in str(name) else (reel / name).resolve()
    if not (rig / 'patches.json').is_file(): raise SystemExit(f'No rig at {rig}')
    dst = assets / 'presenter'
    if dst.exists(): shutil.rmtree(dst)
    shutil.copytree(rig, dst)
    for f in ('presenter.css', 'presenter.js'):
        shutil.copy(cartoon / 'assets' / f, assets / f)
    work = reel / 'build'; work.mkdir(exist_ok=True)
    words = [{'w': w['w'], 's': w['s'], 'e': w['e']} for l in T.LN if l.get('speaker', 'host') == 'host' for w in l['words']]
    (work / 'words.json').write_text(json.dumps(words))
    run = lambda *a: subprocess.run([sys.executable, *map(str, a)], check=True, capture_output=True)
    run(cartoon / 'scripts/lipsync.py', '--audio', reel / 'voice/vo.wav', '--words', work / 'words.json', '--out', work / 'mouth.json')
    sch = dict(B.get('pres') or {}); sch.setdefault('poses', [[0, 'neutral']]); sch['total'] = T.END
    (work / 'schedule.json').write_text(json.dumps(sch))
    rail = getattr(spec, 'STYLE', 'fields') == 'rail'
    run(cartoon / 'scripts/presenter.py', '--rig', dst, '--rig-url', 'assets/presenter', '--schedule', work / 'schedule.json',
        '--mouth', work / 'mouth.json', '--out-html', work / 'presenter.html', '--out-pres', work / 'pres.json',
        *(['--left', '0', '--top', '-5', '--size', '105'] if rail else ['--left', '1', '--top', '-10', '--size', '223']))
    return (work / 'presenter.html').read_text(), json.loads((work / 'pres.json').read_text())


def main(reel):
    reel = pathlib.Path(reel).resolve()
    spec = load_spec(reel)
    style = getattr(spec, 'STYLE', 'fields')
    host, guest = getattr(spec, 'HOST', 'you'), getattr(spec, 'GUEST', 'Agent')
    T = Timing(reel / 'voice/timing.json')
    B = spec.build(T)
    PH = phrases(spec, T, f'[{guest}] ')
    SC = B['scenes']
    for k, c in enumerate(SC):
        c['t1'] = SC[k + 1]['t0'] if k + 1 < len(SC) else T.END
        c['cs'] = 0 if k == 0 else round(c['t0'] - .15, 3)           # a clip starts with its transition
        c['dur'] = round(min(c['t1'] + .55, T.END) - c['cs'], 3)        # and stays under the next one's iris

    assets = reel / 'assets'; (assets / 'img').mkdir(parents=True, exist_ok=True)
    if (assets / 'fonts').exists(): shutil.rmtree(assets / 'fonts')
    shutil.copytree(ASSETS / 'fonts', assets / 'fonts')
    for f in ('explainer.css', 'explainer.js', 'rail.css'):
        shutil.copy(ASSETS / f, assets / f)
    shutil.copy(find_gsap(reel), assets / 'gsap.min.js')
    pres_html, pres = character(spec, reel, T, B, assets)

    def ph_html(i, p):
        ws = ' '.join(f'<span class="w{" i" if w["acc"] else ""}" id="ph{i}w{j}">{esc(w["t"])}</span>' for j, w in enumerate(p['words']))
        tag = f'<span class="tag">{esc(guest)}</span>' if p['who'] == 'guest' else ''
        return f'<div class="ph{" big" if p["big"] else ""}{" guest" if p["who"] == "guest" else ""}{" dark" if p["dark"] else ""}" id="ph{i}">{tag}{ws}</div>'

    scenes_html = '\n'.join(
        f'<div class="scene clip" id="{c["id"]}" data-start="{c["cs"]}" data-duration="{c["dur"]}" data-track-index="{1 + k % 2}">'
        f'<div class="field f-{c["field"]}"></div><div class="cam">{c["html"]}</div></div>' for k, c in enumerate(SC))
    ava = B.get('ava') if (style != 'rail' and pres_html) else None
    n_rip = len((ava or {}).get('clicks', []))
    data = dict(END=T.END, SC=[{k: c[k] for k in ('id', 't0', 't1', 'cs', 'dur', 'enter', 'at') if k in c} for c in SC], PH=PH,
                LN=[{'start': l['start'], 'end': l['end'], 'who': l.get('speaker', 'host')} for l in T.LN], AVA=ava,
                ACC=B.get('acc'), HUDDARK=B.get('huddark'), RAIL=B.get('rail') if style == 'rail' else None, HOOK=B.get('hook'))
    badge = pres_html or '<div class="dot"></div>'
    ava_html = ('<div id="ava"><svg class="arrow" viewBox="0 0 46 58"><path d="M4 4 L4 46 L15 35 L23 53 L31 49 L23 32 L39 32 Z" fill="#15161A" stroke="#FBF4EA" stroke-width="4" stroke-linejoin="round"/></svg>'
                f'<div class="bw"><div class="ring"></div><div class="badge">{pres_html}</div>'
                + (f'<div class="name">{esc(host)}</div>' if B.get('name', True) else '') + '</div></div>') if ava else ''
    rail_html = f'<div id="rail"><div class="line"></div><div class="prog"></div><div id="rhead"><div class="badge">{badge}</div><span id="rchip"></span></div></div>'
    pres_links = '<link rel="stylesheet" href="assets/presenter.css" />' if pres_html else ''
    doc = f'''<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=1080, height=1920" />
<script src="assets/gsap.min.js"></script>
<style>{font_faces(ASSETS / 'fonts', 'assets/fonts/')}</style>
{pres_links}<link rel="stylesheet" href="assets/explainer.css" />{'<link rel="stylesheet" href="assets/rail.css" />' if style == 'rail' else ''}
<style>{B.get("css", "")}</style></head>
<body>
<div id="root" class="{style}" data-composition-id="main" data-start="0" data-duration="{T.END}" data-width="1080" data-height="1920">
{scenes_html}
<div id="hud" class="{B.get("hudclass", "")}">{B.get("hud", "")}</div>
<div id="say">{"".join(ph_html(i, p) for i, p in enumerate(PH))}</div>
{"".join(f'<div class="ripple" id="rip{i}"></div>' for i in range(n_rip))}
{rail_html if style == 'rail' else ava_html}
<div id="vig"></div>
</div>
<script>window.DATA = {json.dumps(data)};</script>
<script src="assets/explainer.js"></script>{'<script src="assets/presenter.js"></script>' if pres_html else ''}
<script>
scenes(); say(); ava(); rail(); hookhit();
{B.get("js", "")}
{f"addPresenter(tl, {json.dumps(pres)});" if pres_html else ""}
window.__timelines = window.__timelines || {{}}; window.__timelines["main"] = tl;
</script></body></html>
'''
    (reel / 'index.html').write_text(doc)
    cues = []
    for c in B.get('sfx', []):
        t, sound, gain = (c['t'], c['sound'], c.get('gain', 0)) if isinstance(c, dict) else c
        cues.append({'t': round(t, 3), 'sound': sound, 'gain': gain})
    (reel / 'cues.json').write_text(json.dumps({'fps': FPS, 'total': T.END, 'cues': cues}, indent=1))
    print(f'{reel.name}: {len(SC)} scenes, {len(PH)} phrases, {T.END:.2f} s, {len(cues)} cues'
          f'{", character " + str(getattr(spec, "CHARACTER")) if pres_html else ""} -> {reel / "index.html"}')


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] in ('-h', '--help'):
        print(__doc__); sys.exit(0 if len(sys.argv) == 2 else 2)
    main(sys.argv[1])
