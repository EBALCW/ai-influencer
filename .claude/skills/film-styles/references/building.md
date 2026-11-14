# Building a video in any film style

Every style in this library is drawn in code and rendered by HyperFrames on your
machine. `edit-video` owns the voice, the sound mix and the review; this page is the
part in between: turning a style and a voice into a composition, either a 1080×1920
reel or a 1920×1080 YouTube video.

## Two formats

| | Reel | YouTube |
|---|---|---|
| Size | 1080×1920 | 1920×1080 |
| Frame rate | 30 fps | the style's own (24 fps unless it says otherwise), or 30 |
| Must-read area | x 72–900, y 269–1248 (the app's text and buttons cover the rest) | inside 5 % margins, and above the bottom 12 % (the player's controls) |
| Length | 15–45 s | 2–8 min, in chapters |
| Layout | the style's **Reel** section | the style's section 2 and the rest of its body |

Each `STYLE.md` describes its picture in 16:9, the YouTube layout, and translates it
for a phone in its **Formats → Reel** section. A reel is not a crop of the 16:9 frame:
stack the layout and let pictures bleed.

## The project

Work in a run folder from `edit-video` (`scripts/new-edit.mjs`). Each reel is a
folder `work/<reel>/`:

| File | What it holds |
|---|---|
| `index.html` | the composition: one page at the format's size, everything drawn from time `t` |
| `assets/` | fonts (woff2, licence-free), images, prepared footage, vendored libraries |
| `voice/vo.wav`, `voice/timing.json` | the locked voice and every line's and word's start and end, from `edit-video`'s `scripts/voice.py` |
| `cues.json` | one sound cue per visible event, for `edit-video`'s `scripts/sfx-sync.mjs` |
| `TREATMENT.md` | the plan from [directing](directing.md) |

The root element carries the composition's size and length:

```html
<div id="root" data-composition-id="main" data-start="0" data-duration="32.4"
     data-width="1080" data-height="1920"> … </div>
```

## Two ways to move time

Pick by what the style draws.

**DOM and SVG with GSAP** (type, cards, captions, charts, footage layers, cut-outs).
Build one paused timeline and register it; HyperFrames seeks it frame by frame.

```js
const tl = gsap.timeline({ paused: true });
// each shot adds its tweens at its start time
window.__timelines = window.__timelines || {};
window.__timelines.main = tl;
```

Copy `gsap.min.js` next to the page instead of loading it from a CDN.

**Canvas or WebGL** (painted marks, ink, grain, particles, point clouds, 3D).
Draw the whole frame as a pure function of `t`, on HyperFrames' seek event, and hold
the render until everything has loaded:

```html
<div id="root" … data-no-timeline><canvas id="c" width="2160" height="3840"></canvas></div>
<script>
  window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {};
  window.__hf.buildReady.scene = new Promise((r) => { window.__sceneReady = r; });
</script>
<script type="module">
  // … load fonts, images and textures, then:
  window.addEventListener('hf-seek', (e) => draw(e.detail.time));
  document.fonts.ready.then(() => { draw(0); window.__sceneReady(); });
</script>
```

Draw at twice the size (2160×3840 for a reel, 3840×2160 for YouTube, scaled down by
CSS) for clean edges; at YouTube lengths, 1.5× keeps render times sane. For 3D,
vendor three.js next to the page and import it through an import map; the
`3d-character` style is a working example.

## Rules that keep a render deterministic

- **Time is the only input.** No `Math.random()` without a seed (hash the frame or
  the element's index), no `Date`, no `performance.now()`, no state carried from one
  frame to the next. Seeking to any `t` in any order gives the same picture.
- **A stepped style steps its own clock.** Render at 30 fps; a look animated on twos
  or at 12 fps draws with `const ts = Math.floor(t * 12) / 12`. Boil, jitter and
  paper grain change on those steps, not every frame.
- **Grain and texture are anchored.** World textures move with the world; screen
  grain is drawn last, over everything, and never scales with the camera.
- **Everything is local.** Fonts as woff2 files awaited with `document.fonts.ready`,
  images and footage preloaded, no network at render time.
- **Footage is prepared at its display size** before the render (crop, lanczos,
  light `unsharp`), so nothing scales up in the page.

## The voice is the clock

Lock the voice first: `python3 <edit-video>/scripts/voice.py work/<reel> --engine files|hyperframes|elevenlabs`.
`voice/timing.json` holds `lines` (each with `start`, `end` and `words`, each word
with `w`, `s`, `e`) and `duration`. Cut, slam, light and click on the word that
names the thing. Captions are built from the same words, so they are always in sync.

## Sound

Write one cue per visible event as `{"t": seconds, "sound": "<pack id>", "gain": dB}`
in `cues.json`, using `edit-video`'s sound pack (`hook-impact`, `sub-impact`,
`zoom-swish`, `ui-pop`, `ui-click`, `tick`, `typing-tick`, `thock`, `latch`, `ratchet`,
`clean-ding`, `sparkle`, `shimmer`, `camera-shutter`, `camera-shutter-light`,
`metallic-riser`). A style that needs other foley or a score uses a free sample
library or the user's own music; mix it under the voice, master at −14 LUFS.

```bash
node <edit-video>/scripts/sfx-sync.mjs mix work/<reel>/cues.json --voice work/<reel>/voice/vo.wav --video previews/<reel>-v01.mp4 --out work/<reel>/mix.wav --mux exports/<reel>-v01.mp4
```

## Look, render, review

1. **Look before rendering.** `hyperframes snapshot work/<reel> --describe false --at 0,0.5,3,…`
   at the first frame, half a second in, three seconds in, each cut and the last
   second. Or serve the folder locally and fire `hf-seek` events from the console.
2. **Lint.** `hyperframes lint work/<reel>`.
3. **Render.** `hyperframes render work/<reel> --fps 30 --quality high --workers 2 --output previews/<reel>-v01.mp4 < /dev/null`
   (`--fps 24` for a 24 fps YouTube video). Allow about 10 s of rendering per second of
   video; render a long YouTube video chapter by chapter and join the chapters with ffmpeg.
4. **Review the encoded file** with `edit-video`'s review: the first second, the
   must-read area of the format, reading time, every sound on its frame, loudness.
