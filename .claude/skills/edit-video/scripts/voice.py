#!/usr/bin/env python3
"""Lock the voice for an animated reel (animated-explainer, 3d-character): one take per line, levelled, placed back to back, with every word's
start and end. Everything the reel shows or plays is keyed to these word times, so make the voice first.

    python3 <edit-video>/scripts/voice.py <edit>/work/<reel> --engine files|hyperframes [--tempo 1.05] [--redo 0,3]

Engines (see edit-video's references/voice.md):
  files        takes you made elsewhere (your own recording, Chatterbox, ElevenLabs or any TTS): voice/takes/00.wav, 01.wav, ...
               one per line, in LINES order (.wav, .mp3 or .m4a). Word times come from `hyperframes transcribe`, or from
               voice/takes/NN.words.json ([{"text", "start", "end"}] in the take's own time) when a service gave timestamps.
  hyperframes  free and local: HyperFrames' Kokoro voices (`hyperframes tts`), then `hyperframes transcribe`.
This script never calls a hosted voice service and never reads a key.

The reel's spec.py supplies LINES (the same markup the style's build.py reads), GUEST (default 'Agent'), SPOKEN = {'shown word': 'how it is
said'} for the voice only, and VOICES = {'host': '<voice>', 'guest': '<voice>'}: a Kokoro voice such as 'am_michael' for
hyperframes. Writes voice/vo.wav and voice/timing.json. Existing takes are reused; --redo
regenerates the listed lines. Needs python3, numpy and ffmpeg; HyperFrames comes from edit-video's workspace runtime
(FAVSTASH_HYPERFRAMES overrides).
"""
import argparse, difflib, importlib.util, json, os, pathlib, re, shutil, subprocess, sys, tempfile
import numpy as np

SR = 48000
AT, TAIL = .10, .8                  # the first word starts at AT; the reel runs TAIL past the last word
GAP_SAME, GAP_SWITCH = .14, .30     # the pause before the next line: same speaker, other speaker
TARGET_RMS = -21.0                  # dBFS over each line's speech
NUMS = {w: str(n) for n, w in enumerate('zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen '
                                             'fifteen sixteen seventeen eighteen nineteen twenty'.split())}
norm = lambda s: (lambda w: NUMS.get(w, w))(re.sub(r"[^a-z0-9%$']", '', s.lower().replace('’', "'")))   # "six" matches a heard "6"


def load_spec(reel):
    p = reel / 'spec.py'
    s = importlib.util.spec_from_file_location('spec', p); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
    return m


def find_hyperframes(start):
    env = os.environ.get('FAVSTASH_HYPERFRAMES')
    if env: return [env]
    for base in (pathlib.Path(start).resolve(), pathlib.Path.cwd()):
        for p in [base, *base.parents]:
            c = p / '.favstash-studio/runtime/node_modules/.bin/hyperframes'
            if c.is_file(): return [str(c)]
    raise SystemExit("HyperFrames not found. Run edit-video's scripts/init-workspace.mjs --workspace <project> --install, "
                     "or set FAVSTASH_HYPERFRAMES to its executable.")


def lines_of(spec):
    """[(speaker, display tokens, spoken text, spoken tokens with the display index each belongs to)]"""
    mark = f"[{getattr(spec, 'GUEST', 'Agent')}] "; said = getattr(spec, 'SPOKEN', {})
    out = []
    for line in spec.LINES:
        who = 'guest' if line.startswith(mark) else 'host'
        text = (line[len(mark):] if who == 'guest' else line).replace('*', '').replace(' | ', ' ')
        disp = text.split(); spoken = []
        for i, tok in enumerate(disp):
            core = tok.strip('.,!?:;"')
            for w in (said[core].split() if core in said else [tok]):
                spoken.append((w, i))
        out.append((who, disp, ' '.join(w for w, _ in spoken), spoken))
    return out


def decode(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'])
    return np.frombuffer(raw, np.float32).copy()


def write_wav(path, x, channels=2):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-ac', str(channels),
                    '-c:a', 'pcm_s24le', str(path)], input=x.astype(np.float32).tobytes(), check=True)


def trim(x):
    """Cut the take to its speech: 0.03 s before the first sound, 0.12 s after the last (-40 dB under its peak)."""
    fr = int(.01 * SR); n = len(x) // fr
    rms = np.sqrt(np.mean(x[:n * fr].reshape(n, fr) ** 2, axis=1)) + 1e-9
    on = np.where(20 * np.log10(rms / rms.max()) > -40)[0]
    if not len(on): raise SystemExit('a take is silent')
    a, b = max(0, on[0] * fr - int(.03 * SR)), min(len(x), (on[-1] + 1) * fr + int(.12 * SR))
    return x[a:b]


def tts_hyperframes(hf, text, voice, out):
    r = subprocess.run([*hf, 'tts', text, '-v', voice, '-o', str(out), '--json'], capture_output=True, text=True)
    if r.returncode or not out.exists(): raise SystemExit(f'hyperframes tts failed: {(r.stdout + r.stderr)[-500:]}')


def heard(hf, wav):
    """Word times in a trimmed take, from `hyperframes transcribe`."""
    with tempfile.TemporaryDirectory() as d:
        r = subprocess.run([*hf, 'transcribe', str(wav), '--dir', d, '--json'], capture_output=True, text=True)
        p = pathlib.Path(d) / 'transcript.json'
        if r.returncode or not p.exists(): raise SystemExit(f'hyperframes transcribe failed: {(r.stdout + r.stderr)[-500:]}')
        return json.loads(p.read_text())


def place_words(spoken, ndisp, words, offset):
    """Map heard (or aligned) words onto the script's display tokens; a token nobody heard is placed between its neighbours."""
    got = [norm(w['text']) for w in words]; want = [norm(w) for w, _ in spoken]
    times = [None] * len(spoken)
    for blk in difflib.SequenceMatcher(None, want, got, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            w = words[blk.b + k]; times[blk.a + k] = (w['start'] - offset, w['end'] - offset)
    disp = [None] * ndisp
    for (_, i), t in zip(spoken, times):
        if t: disp[i] = (min(disp[i][0], t[0]), max(disp[i][1], t[1])) if disp[i] else t
    missing = [i for i, t in enumerate(disp) if t is None]
    known = [i for i, t in enumerate(disp) if t]
    if not known: raise SystemExit('none of the script\'s words were heard in a take: check the take matches its line')
    for i in missing:
        a = max([k for k in known if k < i], default=None); b = min([k for k in known if k > i], default=None)
        s = disp[a][1] if a is not None else max(0, disp[b][0] - .3)
        e = disp[b][0] if b is not None else disp[a][1] + .3
        span = (e - s) / (sum(1 for k in missing if (a is None or k > a) and (b is None or k < b)) + 1)
        before = sum(1 for k in missing if (a is None or k > a) and k < i)
        disp[i] = (s + span * before, s + span * (before + 1))
    return disp, len(missing)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('reel'); ap.add_argument('--engine', choices=['files', 'hyperframes'], required=True)
    ap.add_argument('--tempo', type=float, default=1.0, help='speed every take up (pitch kept), e.g. 1.05')
    ap.add_argument('--redo', default='', help='comma-separated line numbers to regenerate')
    a = ap.parse_args()
    reel = pathlib.Path(a.reel).resolve(); spec = load_spec(reel)
    voices = getattr(spec, 'VOICES', {}); takes = reel / 'voice/takes'; takes.mkdir(parents=True, exist_ok=True)
    redo = {int(n) for n in a.redo.split(',') if n.strip()}
    hf = find_hyperframes(reel) if a.engine == 'hyperframes' else None   # files: only needed to transcribe
    bus, t, LN = np.zeros(SR * 180, np.float32), AT, []
    for i, (who, disp, text, spoken) in enumerate(lines_of(spec)):
        found = sorted(p for p in takes.glob(f'{i:02d}.*') if p.suffix in ('.wav', '.mp3', '.m4a'))
        if a.engine != 'files' and (i in redo or not found):
            if who not in voices: raise SystemExit(f"spec.py VOICES needs a '{who}' voice for the {a.engine} engine")
            for p in found: p.unlink()
            tts_hyperframes(hf, text, voices[who], takes / f'{i:02d}.wav')
            found = sorted(p for p in takes.glob(f'{i:02d}.*') if p.suffix in ('.wav', '.mp3', '.m4a'))
        if not found: raise SystemExit(f'line {i}: no take at voice/takes/{i:02d}.wav ("{text}")')
        x = trim(decode(found[0]))
        if abs(a.tempo - 1) > 1e-3:
            raw = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', f'atempo={a.tempo}',
                                  '-f', 'f32le', '-'], input=x.tobytes(), capture_output=True, check=True).stdout
            x = np.frombuffer(raw, np.float32).copy()
        x *= 10 ** ((TARGET_RMS - 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)) / 20)
        n = int(.008 * SR); x[:n] *= np.linspace(0, 1, n); x[-n:] *= np.linspace(1, 0, n)
        aligned = found[0].with_suffix('.words.json')
        if aligned.exists():   # a service's timestamps: times in the untrimmed take, so find the trim offset and the tempo
            raw_take = decode(found[0]); fr = int(.01 * SR); nn = len(raw_take) // fr
            rms = np.sqrt(np.mean(raw_take[:nn * fr].reshape(nn, fr) ** 2, axis=1)) + 1e-9
            lead = max(0, np.where(20 * np.log10(rms / rms.max()) > -40)[0][0] * fr - int(.03 * SR)) / SR
            words = [{'text': w['text'], 'start': (w['start'] - lead) / a.tempo, 'end': (w['end'] - lead) / a.tempo}
                     for w in json.loads(aligned.read_text())]
        else:
            hf = hf or find_hyperframes(reel)
            with tempfile.TemporaryDirectory() as d:
                tw = pathlib.Path(d) / 'take.wav'; write_wav(tw, x, 1); words = heard(hf, tw)
        times, guessed = place_words(spoken, len(disp), words, 0)
        if guessed: print(f'line {i}: {guessed} word(s) not heard, placed between their neighbours; listen to the take', file=sys.stderr)
        if LN: t += GAP_SWITCH if LN[-1]['speaker'] != who else GAP_SAME
        s0 = int(round(t * SR)); bus[s0:s0 + len(x)] += x
        ws = [{'w': tok, 's': round(t + s, 3), 'e': round(t + e, 3)} for tok, (s, e) in zip(disp, times)]
        LN.append({'text': ' '.join(disp), 'speaker': who, 'start': ws[0]['s'], 'end': ws[-1]['e'], 'words': ws})
        t += len(x) / SR
    dur = round(t + TAIL, 3)
    write_wav(reel / 'voice/vo.wav', bus[:int(dur * SR)])
    (reel / 'voice/timing.json').write_text(json.dumps({'duration': dur, 'engine': a.engine, 'tempo': a.tempo, 'lines': LN}, indent=1))
    nw = sum(len(l['words']) for l in LN)
    print(f'{reel.name}: {len(LN)} lines, {dur:.2f} s, {nw / dur:.2f} words/s -> voice/vo.wav, voice/timing.json')
    for k, l in enumerate(LN): print(f"  {k} {l['speaker']:5} {l['start']:6.2f}-{l['end']:6.2f}  {l['text']}")


if __name__ == '__main__':
    main()
