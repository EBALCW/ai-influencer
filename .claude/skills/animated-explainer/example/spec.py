"""Worked example: "I need a reel by six." A ~16 s two-voice explainer with the sample cartoon as the cursor.
Copy its structure, not its content: one scene per beat, one hero card per scene, every event on a word time.

    cp <skill>/example/spec.py <edit>/work/reel-six/spec.py
    python3 <edit-video>/scripts/voice.py <edit>/work/reel-six --engine hyperframes
    python3 <skill>/scripts/build.py <edit>/work/reel-six
"""

LINES = [
    'I need a reel by *six.* | No camera.',
    "[Agent] Send me the script. | I'll *animate* it.",
    'Captions? | *Sound?*',
    '[Agent] Every word lit. | Every click on its *frame.*',
    '[Agent] Rendered on your *laptop.*',
    'Done before *six.*',
]
BIG = [0]                 # line 0's first phrase is the hook, shown big
DARKTXT = [2]             # line 2 sits on the cream field
CHARACTER = None          # upstream: 'ali' (a sample from the cartoon-character skill, not vendored here); a rig folder, or None
HOST, GUEST = 'ali', 'Agent'
VOICES = {'host': 'am_michael', 'guest': 'bf_emma'}   # Kokoro voices for --engine hyperframes

CSS = r"""
.cal { left: 108px; top: 690px; width: 864px; padding: 40px 44px 30px; }
.cal .k { margin-bottom: 22px; }
.row { position: relative; display: flex; align-items: center; gap: 26px; padding: 24px 26px; border-radius: 24px; margin-bottom: 12px;
  background: #F4F1EC; font: 600 44px/1 var(--sans); letter-spacing: -.02em; }
.row b { width: 110px; font: 500 34px/1 var(--mono); color: #8A8578; }
.row span { flex: 1; }
.row i { padding: 12px 18px; border-radius: 999px; font: 600 26px/1 var(--sans); font-style: normal; }
.row .ok { background: #E3F1E8; color: #1F8A5B; }
.row .bad { background: #FBE3DE; color: #C2412B; }
.row.due { background: #FFF4F1; box-shadow: inset 0 0 0 3px #F3B5A8; }
.row.due .ok { position: absolute; right: 26px; }
.stamp { position: absolute; padding: 14px 24px 12px; border: 7px solid currentColor; border-radius: 16px; background: rgba(251,244,234,.94);
  font: 900 58px/1 var(--sans); letter-spacing: -.01em; transform: rotate(-7deg); }
.doc { left: 108px; top: 700px; width: 864px; padding: 40px 44px 44px; }
.doc p { margin: 0 0 30px; font: 500 40px/1.25 var(--sans); letter-spacing: -.015em; }
.doc em { margin-right: 18px; font: 500 24px/1 var(--mono); font-style: normal; color: #9A9387; }
.go { display: inline-block; padding: 24px 36px; border-radius: 22px; background: #15161A; color: #FBF4EA; font: 700 40px/1 var(--sans); }
.phone { position: absolute; left: 108px; top: 660px; width: 470px; height: 590px; border-radius: 56px; background: #15161A; padding: 18px;
  box-shadow: 0 42px 84px -24px rgba(8,6,4,.48); }
.scr { position: relative; width: 100%; height: 100%; border-radius: 40px; overflow: hidden;
  background: radial-gradient(80% 60% at 50% 40%, #5147F0 0%, #2A22B8 100%); }
.cap3 { position: absolute; left: 34px; right: 34px; top: 70px; font: 800 64px/1.05 var(--sans); letter-spacing: -.03em; color: rgba(251,244,234,.35); }
.wave { position: absolute; left: 40px; right: 40px; bottom: 70px; height: 150px; display: flex; align-items: center; gap: 12px; }
.wave i { flex: 1; height: 100%; border-radius: 8px; background: #F4C95D; transform-origin: 50% 50%; }
.sx { position: absolute; left: 640px; padding: 22px 30px; border-radius: 999px; background: #15161A; color: #FBF4EA; font: 600 36px/1 var(--mono); }
.tlc { left: 108px; top: 700px; width: 864px; padding: 38px 40px 40px; }
.trk { display: flex; align-items: center; gap: 22px; margin-top: 26px; }
.trk b { width: 140px; font: 600 30px/1 var(--sans); color: rgba(251,244,234,.7); }
.lane { position: relative; flex: 1; height: 86px; border-radius: 16px; background: rgba(251,244,234,.08); }
.lane i { position: absolute; top: 10px; bottom: 10px; border-radius: 12px; background: #7C5CFF; }
.lane.wv i { background: #F4C95D; opacity: .9; }
.mk { position: absolute; top: 14px; width: 14px; height: 58px; margin-left: -7px; border-radius: 7px; background: #4ED890; }
.play { position: absolute; top: 120px; bottom: 30px; width: 4px; margin-left: -2px; background: #FBF4EA; border-radius: 2px; }
.rc { left: 108px; top: 720px; width: 864px; padding: 44px; }
.pct { margin: 18px 0 22px; font: 720 180px/1 var(--sans); letter-spacing: -.05em; }
.bar { height: 26px; border-radius: 13px; background: #E8E1D5; overflow: hidden; }
.bar i { display: block; height: 100%; background: #1F8A5B; border-radius: 13px; transform-origin: 0 50%; }
.done5 { margin-top: 30px; background: #E3F1E8; color: #1F8A5B; font-size: 32px; }
"""


def cal(n, clock, due_done=False):
    pills = '<i class="bad" id="bad{n}">not started</i><i class="ok" id="ok{n}">ready ✓</i>'.format(n=n)
    return (f'<div class="card cal" id="cal{n}"><div class="k">Today · {clock}</div>'
            '<div class="row"><b>4:00</b><span>Team call</span><i class="ok">done</i></div>'
            f'<div class="row due" id="due{n}"><b>6:00</b><span>Reel due</span>{pills}</div>'
            '<div class="row"><b>7:30</b><span>Gym</span></div></div>')


def build(T):
    f, L, E = T.find, T.L, T.E
    six, cam = f('six', line=0), f('camera', line=0)
    script, anim = f('script', line=1), f('animate', line=1)
    capt, sound = f('Captions', line=2), f('Sound', line=2)
    word, lit, click, frame = f('word', line=3), f('lit', line=3), f('click', line=3), f('frame', line=3)
    lap, done, six5 = f('laptop', line=4), f('Done', line=5), f('six', line=5)

    s1 = cal(1, '5:12 PM') + '<div class="stamp" id="nocam" style="left:430px;top:1150px;color:#C2412B">NO CAMERA</div>'
    s2 = ('<div class="card cream doc" id="doc"><div class="k" style="margin-bottom:26px">script.md</div>'
          '<p id="d1"><em>HOOK</em>I need a reel by six.</p><p id="d2"><em>BEAT</em>No camera, no editor.</p>'
          '<p id="d3"><em>END</em>Done before six.</p><div class="go" id="go">Animate ▸</div></div>')
    s3 = ('<div class="phone"><div class="scr"><div class="cap3"><span id="c3a">every</span> <span id="c3b">word</span> '
          '<span id="c3c">lit</span></div><div class="wave">' + ''.join(f'<i id="wv{k}"></i>' for k in range(9)) + '</div></div></div>'
          + ''.join(f'<div class="sx" id="sx{k}" style="top:{760 + 130 * k}px">{n}</div>' for k, n in enumerate(['pop', 'tick', 'click'])))
    marks = [(word, 22), (lit, 41), (click, 63), (frame, 86)]
    s4 = ('<div class="card inkc tlc" id="tlc"><div class="k" style="color:rgba(251,244,234,.55)">timeline · 30 fps</div>'
          '<div class="trk"><b>Picture</b><div class="lane"><i style="left:0;width:36%"></i><i style="left:38%;width:30%"></i><i style="left:70%;width:30%"></i></div></div>'
          '<div class="trk"><b>Voice</b><div class="lane wv"><i style="left:4%;width:40%"></i><i style="left:50%;width:44%"></i></div></div>'
          '<div class="trk"><b>Sound</b><div class="lane" id="sl">' + ''.join(f'<span class="mk" id="mk{k}" style="left:{x}%"></span>' for k, (_, x) in enumerate(marks))
          + '</div></div><div class="play" id="play" style="left:202px"></div></div>')
    s5 = ('<div class="card rc"><div class="k">hyperframes render · 4K</div><div class="pct" id="pct">0%</div>'
          '<div class="bar"><i id="bar5"></i></div><div class="pill done5" id="done5">✓ on your laptop · nothing uploaded</div></div>')
    s6 = cal(6, '5:58 PM') + '<div class="stamp" id="st6" style="left:560px;top:1150px;color:#1F8A5B">DONE</div>'
    scenes = [dict(id='s1', t0=0, field='night', html=s1),
              dict(id='s2', t0=L(1), field='ultra', html=s2, at=[230, 900]),
              dict(id='s3', t0=L(2), field='cream', html=s3, enter='scroll'),
              dict(id='s4', t0=L(3), field='forest', html=s4, at=[540, 960]),
              dict(id='s5', t0=L(4), field='ink', html=s5, enter='cut'),
              dict(id='s6', t0=L(5), field='clay', html=s6, enter='scroll')]

    js = f"""
gsap.set(['#ok1', '#ok6', '#nocam', '#st6'], {{ opacity: 0 }});
nudge('#due1', {six:.3f}, 1.04);
gsap.set('#nocam', {{ scale: 2.2, rotation: -22 }});
tl.to('#nocam', {{ opacity: 1, duration: .05 }}, {cam - .2:.3f}); tl.to('#nocam', {{ scale: 1, rotation: -7, duration: .2, ease: 'power3.in' }}, {cam - .2:.3f});
rise(['#d1', '#d2', '#d3'], {script:.3f}, {{ stagger: .12, y: 30 }});
pop('#go', {anim - .05:.3f}, {{ y: 10 }}); nudge('#go', {anim + .35:.3f}, 1.08);
[['#c3a', {capt:.3f}], ['#c3b', {capt + .18:.3f}], ['#c3c', {capt + .36:.3f}]].forEach(([s, t]) => tl.to(s, {{ color: '#FBF4EA', duration: .08 }}, t));
gsap.set('#s3 .wave i', {{ scaleY: .12 }});
tl.to('#s3 .wave i', {{ scaleY: (i) => [.5, .9, .4, 1, .7, .35, .85, .55, .3][i], duration: .25, ease: 'expo.out', stagger: .03 }}, {sound:.3f});
pop('#sx0', {sound:.3f}); pop('#sx1', {sound + .22:.3f}); pop('#sx2', {sound + .44:.3f});
gsap.set('.mk', {{ opacity: 0, scaleY: .2 }});
{''.join(f"tl.to('#mk{k}', {{ opacity: 1, scaleY: 1, duration: .07, ease: 'none' }}, {t:.3f}); " for k, (t, _) in enumerate(marks))}
tl.fromTo('#play', {{ x: 0 }}, {{ x: 560, duration: {E(3) - L(3) + .4:.3f}, ease: 'none', immediateRender: false }}, {L(3):.3f});
count('#pct', 0, 100, {L(4) + .1:.3f}, {lap - L(4) - .05:.3f}, (v) => Math.round(v) + '%');
gsap.set('#bar5', {{ scaleX: 0 }}); tl.to('#bar5', {{ scaleX: 1, duration: {lap - L(4) - .05:.3f}, ease: 'power2.out' }}, {L(4) + .1:.3f});
pop('#done5', {lap:.3f});
tl.set('#bad6', {{ opacity: 0 }}, {six5:.3f}); pop('#ok6', {six5:.3f}, {{ y: 0, from: .6, d: .35 }});
gsap.set('#st6', {{ scale: 2.2, rotation: -22 }});
tl.to('#st6', {{ opacity: 1, duration: .05 }}, {six5 + .2:.3f}); tl.to('#st6', {{ scale: 1, rotation: -7, duration: .2, ease: 'power3.in' }}, {six5 + .2:.3f});
"""
    rest = [640, 1330]
    ava = dict(path=[[0, *rest], [six - .5, 210, 860, .45], [six + .3, *rest, .5],
                     [anim - .45, 250, 1110, .4], [anim + .45, *rest, .5],
                     [six5 - .42, 210, 860, .4], [six5 + .3, *rest, .5]],
               clicks=[[six, 210, 860], [anim + .35, 250, 1110], [six5, 210, 860]])
    pres = dict(poses=[[0, 'shrug'], [six - .1, 'point'], [L(1), 'neutral'], [L(2), 'point'], [L(3), 'neutral'], [done - .1, 'thumbs']],
                upper=[[0, L(1), 'worried'], [done, T.END, 'excited']], bounces=[six, done])
    sfx = [[.03, 'ui-pop', -4], [six, 'ui-click', 0], [cam, 'thock', -8],
           [L(1) - .12, 'zoom-swish', -6], [script, 'typing-tick', -10], [anim, 'ui-pop', -2], [anim + .35, 'ui-click', 0],
           [L(2) - .12, 'zoom-swish', -6], [sound, 'tick', -10], [sound + .22, 'tick', -12], [sound + .44, 'tick', -12],
           [L(3) - .12, 'zoom-swish', -6]] + [[t, 'tick', -10] for t, _ in marks] + \
          [[L(4) + .1, 'ratchet', -10], [lap, 'clean-ding', -8],
           [L(5) - .12, 'zoom-swish', -6], [six5, 'ui-click', 0], [six5 + .02, 'latch', -8], [six5 + .4, 'thock', -6]]
    return dict(scenes=scenes, js=js, css=CSS, ava=ava, pres=pres, sfx=sfx, hud='')
