# Oscilloscope Math

> Mathematics written by one green electron beam on the black glass of an analogue oscilloscope: rotating circles, a trace scrolling from a write head, a formula typed glyph by glyph, all glowing phosphor with a white-hot core. The camera flies through an endless graticule, and zooming is turning the time-per-division knob. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): analogue oscilloscopes and their green phosphor screens (dotted graticule, knob settings as readouts, RUN and STOP); vector displays and the Lissajous figures of 1960s science films (one beam draws everything, text included); oscilloscope music (the picture is also a sound); the rotating-circle tradition of Fourier explainers; laboratory instrument type. Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The black screen and its graticule bleed to every edge. The scope is turned on its side: time runs downward.

| Zone | Position | Content |
|---|---|---|
| Formula | x 72–900, y 280–420 | the expression being built, its changing term lit |
| Machine (circles, mechanism) | centred on x 540, y 480–900 | the rotating chain; its tip projects straight down |
| Write head and trace | write head at x 540, y 940; trace scrolls down to the bottom edge | the signal, newest at the head |
| HUD | x 72, y 1000–1100 when needed, else top right of the safe box | N, t, f(t) and the knob row, 30 px mono |
| Captions | centred on x 540, ≤ 720 px wide, last baseline y ≈ 1220 | one or two lines on the dark scrim |

  Below y 1248 only the trace and the graticule run; nothing there needs to be read.
- **The first 3 seconds.** Frame 1 is a dot igniting and already writing: the beam draws an ideal square wave, a corner every 0.7 s, the camera riding it at 1.7×. By 3 s the question is on screen, typed by the beam.
- **Length and pace.** 20–45 s. A slow first half (one circle, one term at a time, each held until the trace shows its effect), one acceleration (a rush of many terms in 2 s), then STOP and silence, a dive, and a measured verdict.
- **Captions.** On a dark scrim so the trace never runs through words; the beam itself never writes the captions.
- **Sound.** `tick` for every glyph and corner the beam writes, `latch` for RUN and STOP, `ratchet` for each new term (detent), `zoom-swish` for the dive and the pull-back, `clean-ding` when the key number is named, `metallic-riser` under the rush of terms. The lead synth, drone and bells are synthesised or from a free CC0 library (VCSL).

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Captions and the HUD stay above y 950; the formula and HUD keep 96 px from the sides.
- **Length and structure.** 3–8 min. One idea per chapter (a term, a theorem, a limit, a surprise). Each chapter opens with its title typed by the beam in the open graticule, then the title's outlines morph into the first object of the chapter (a circle, an axis, a curve). Re-hook every 30–60 s with a knob change (a dive to 14× or a pull-back to 0.5×), a STOP freeze, or an amber measurement.
- **The first 10 seconds.** The finished, surprising shape on frame 1 (the square with its overshoot, the spiral, the figure), the question typed by 5 s, the promise by 10 s as the first circle appears out of the question's letters.
- **Captions.** Burned in on the scrim, and exported as `.srt`.
- **Thumbnail.** A dive frame: the trace huge and white-hot at the feature that matters, the amber cursor and its number, at most three words in the title serif.

### Good for

Maths and physics lessons; signals, audio and electronics; science explainers; "how does this formula behave" pieces; engineering intros; data with a waveform at its heart.

## 1. Essence, and what it is not

1. **One beam draws everything.** Circles, trace, axis, formula, titles: each appears by being traced by the spot, which leaves a white-hot core and a green glow.
2. **An instrument, not a slide.** A dotted graticule, readouts in mono, ms/div and V/div, RUN and STOP; the numbers on screen are the live values of the thing drawn.
3. **The world is bigger than the frame.** A camera flies through it; zoom is the time-base knob, and the graticule subdivides as you go in.
4. **Monochrome light plus one second channel.** Green phosphor for the signal; amber only for measurements.
5. **Exact.** Every curve is computed from the formula at that frame; the readouts and the voice agree to the last decimal.

Not **Flow-field Wind Lines** (ink on paper, many lines). Not **Neon Tubes** (bent glass in a street, warm and multicoloured). Not **Circuit Board** (light running along copper traces on a board seen from above). Not a flat vector maths explainer (white strokes on charcoal, no bloom, no instrument). Not a retro CRT filter: no scanlines, no RGB split, no VHS noise, no curved-glass frame.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Formula | top left, x 56, y 34, 520 px wide | typeset expression in the phosphor's text colour |
| HUD | top right, x 1500, lines at y 52, 80, 108 | `N =`, `t =`, `f(t) =` at 21 px mono, 80 % opacity |
| Knob row | x 1500, y 142 | `250 ms/div   0.50 V/div   RUN` at 19 px, 62 % |
| Machine | left half, centred near x 560, y 540 | the circle chain, arm and joints |
| Write head | x ≈ 910, on the tip's height | a dot (6 px hot core, 14 px glow) joined to the tip by a dashed connector (6 px dash, 13 px period) |
| Trace | from the write head to the right edge | the signal scrolling right, newest at the head |
| Time axis | y 540, full width | 1.3 px at 40 %, ticks 9 px (major) and 5 px (minor) |
| Amber cursors | full width at their levels; measuring arrow at x 1380 | dashed reference level, solid peak level, Δ readout to the right |
| Captions | left aligned at x 140, baseline y ≈ 900 (two lines: ≈ 860 and 900) | a 2 px rule at x 118, 50 % |

Titles are typed on the open graticule at x 150, baseline y 210–260, before they become objects.

## 3. Materials and rendering

- **Three light channels.** Draw each frame into separate channels: the beam (trace, circles), the interface (graticule, text), and the white-hot cores; a fourth for amber measurements. A post pass colours them, adds bloom and the screen. This keeps the beam's glow strong and the text's glow faint.
- **Bloom.** The emitting light is blurred at four sizes (½, ¼, ⅛ and 1/16 resolution, σ 1.2, 2.0, 2.6 and 3.0 at that scale, weights 0.50, 0.42, 0.30, 0.20) and added back at 0.95. Text emits at only 22 %, hot cores at 130 %.
- **Saturation.** Where light piles up above 0.9 it pushes toward white (+30 % of the excess), then a soft shoulder from 0.78 replaces clipping.
- **The screen.** Near-black glass with a faint green ambient glow centred slightly low (falling off over about 1,150 px, at 55 %), a vignette that darkens the edges by up to 55 %, and ±0.8/255 dither so the glow never bands.
- **Beam physics.** The trace dims with age (full brightness at the head, 38 % after six seconds of signal) and dims where it is steep, because a fast-moving spot deposits less light; intensity is quantised to 12 levels. Line widths are in screen pixels (trace 3 px, the first four circles 2.4 px, smaller ones 1.6 px), so the beam stays a beam at any zoom.
- **Afterglow, sub-frame.** At 24 fps a frame-to-frame persistence strobes. Instead, draw the eight previous instants of moving parts 9 ms apart, fading with (1 − i/9)^2.2 from 28 %, and the tip's trail as 32 samples 4 ms apart.
- **World vs screen.** Circles, trace, axis, graticule and typed titles live in the world and are seen through the camera. The formula, HUD, captions and scrim are screen-fixed.

## 4. Colour logic

- **One phosphor.** The signal is green; its core is near white; the interface is a paler green. No other hue in the main channel.
- **Amber is the second channel** and means "measured": cursors, the Δ readout, markers on the feature. It never draws the signal.
- **White means new or hot:** the spot itself, a glyph the instant it is written, a term the instant it is born. White always decays back to green in 0.3–0.6 s.
- **The glass is never pure black and never coloured;** the ambient glow is the only light it has.

Example palette (from the code):

| Role | Hex |
|---|---|
| Screen black | `#010402` |
| Ambient glow | `#0B2412` |
| Beam phosphor | `#4DFF88` |
| Graticule and text | `#8DFFB0` |
| White-hot core | `#E6FFEC` |
| Measurement (second channel) | `#FFB547` |

## 5. Type and captions

- **Faces (all SIL OFL).** JetBrains Mono for every readout, tag and number; STIX Two Text for titles and captions, with the key word in its italic; formulas typeset to SVG with MathJax's TeX fonts. Noto Serif SC only when CJK is part of the picture.
- **Sizes (16:9).** Titles 62–84 px; chapter subtitles 36–40 px; tags beside circles 24 px mono (`×3 · r = 1/3`); HUD 21 px; knob row 19 px; Δ readout 30 px; captions 32–36 px. In a reel, captions 50–56 px, the HUD 30 px.
- **How text is written.** Each glyph is first traced as an outline by a 1.5 px hot stroke over 0.35 s (glyphs staggered across the line), its fill fades in 0.2–0.45 s later, and it flashes white for 0.4 s. Formula glyphs appear left to right over 0.8 s; the changing part (an upper limit, a count) flashes each time it updates.
- **Captions.** STIX Two Text, the phosphor's text colour at 95 %, left aligned with a 2 px rule beside them, over a soft dark scrim (three stacked rectangles at 22 % each, growing outward) so the trace never cuts the words. Fade 0.15 s in and out. One language, the spoken one.
- **Hold.** ≥ max(1.8 s, speech + 0.6 s). Numbers in captions match the HUD exactly.

## 6. Motion

- **Frame rate.** 24 fps, continuous; smoothness comes from the sub-frame afterglow, not from more frames. Reels at 30 fps keep the same 9 ms and 4 ms ghost spacing.
- **Two clocks.** The film clock, and the signal clock that starts on RUN and freezes on STOP. Everything on the trace is a function of the signal clock; the camera and the text run on film time.
- **New terms grow.** A new circle grows from radius 0 over 0.45 s (smoothstep) and flashes white; a rush of later terms arrives on a square-root schedule (fast, then slower) at 0.3 s each, and bursts of hundreds at 0.25 s each.
- **Easing.** Cubic in-out for camera moves and morphs; cubic out for typed hairlines; smoothstep for fades.
- **Morphs.** A title's glyph outlines are resampled to match their target (a circle, a segment of the axis) and move there one by one, 0.6 s each, the stroke thickening from 1.2 to 2.4 px while the fill fades out and a white edge peaks mid-way.
- **Never moves:** the formula's position, the HUD, the captions and the glass. The trace never jitters: it is recomputed exactly from the formula every frame.

## 7. Camera

| Move | What it expresses | Can serve |
|---|---|---|
| Ride the beam (1.7×, following the write head) | the signal being born | cold opens, the first edge |
| Pull out (1.7× → 0.9× over 1.6 s) | the whole machine | introducing the setup |
| Push and ride the tip (1.5× → 2.6× while following it) | how one rotation makes the curve | explaining a single term |
| Match cut on a shape (the tip's arc to the previous crest) | "this is that" | linking cause and result |
| Dive (to 14× over 2.2 s) | the detail nobody sees | the overshoot, the error, the edge case |
| Pull-back (to 0.55× over 2.6 s) | it's everywhere | the ending, generalising |

Zoom is interpolated in log space, and the centre moves so that zooming feels like flying toward the target (the centre's progress follows 1/zoom). The graticule's major step changes by ×5 to stay between 70 and 520 px, minor divisions fade in once they are 18 px apart, and the knob row's ms/div and V/div change with it. Allowed transitions: morphs of text into objects, match cuts on a shape, a dive or pull-back, STOP. Forbidden: dissolves, wipes, slides, flat hard cuts to an unrelated layout, camera shake, rotation.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Ambience | the instrument's electrical air (noise low-passed at 900 Hz) and a mains hum at 150, 250 and 350 Hz, from first light to switch-off | barely audible |
| Signal | the partial sum itself played as a tone (110 Hz), with exactly the terms on screen | low, from RUN to STOP |
| Score | 96 BPM; lead is a pluck whose timbre is the current partial sum (a pure sine with one circle, filling toward a square as circles stack); a sine bass with soft second and third harmonics; bowed vibraphone chords; glockenspiel for the named number and the ending | ducked under the voice |
| Foley | ignition; a tick per corner and per glyph; rising sweeps (500 → 3,800 Hz) when text becomes a circle, falling (3,500 → 400 Hz) when it becomes an axis; relay clack plus a 60 Hz thump on RUN and STOP; a detent click plus a bell at the term's harmonic for each new term; blips for cursors; a chirp from 1,800 to 60 Hz and a thump for the switch-off | |
| Silence | STOP cuts the music dead: the first silence; under the dive only a 55 Hz drone and a soft clock tick per beat | |
| Voice | one clear teacher, unhurried | about 10 dB over the music; music carved by half in 300 Hz–4 kHz under speech |

Master at −14 LUFS, true peak −1 dB. The switch-off ends the sound with the picture.

## 9. Native moves

1. **The beam writes the question.** Each glyph traced as a hot outline, then filled; one tick per glyph. Fits content like: the opening question; a chapter title; a definition.
2. **Words become the machine.** The title's outlines fly into the first circle or into the time axis. Fits content like: "this sentence is the model"; naming a concept and then showing it; a product name becoming its mechanism.
3. **One more term.** A new circle grows with a detent and a bell, the formula's limit flashes, the trace changes shape from the next sample on. Fits content like: adding features one at a time; approximation; compounding.
4. **RUN / STOP.** The signal clock freezes with a relay clack and the music dies; the picture is still but the camera keeps moving. Fits content like: "look closer"; the moment before a reveal; a freeze on an anomaly.
5. **Knob dive.** The camera dives to 14× into a corner, the graticule subdivides, ms/div becomes µs/div. Fits content like: an error that never goes away; a detail at a tiny scale; the edge case.
6. **Amber measurement.** Dashed and solid cursors close on the feature, an arrow spans them, the Δ readout appears and re-measures with each burst of terms. Fits content like: quantifying a gap; a constant that stays; a before-and-after number.
7. **Switch-off.** The picture collapses to a bright horizontal line, then to a dot that fades over 0.2 s while the glass glow dies. Fits content like: the ending; "that's all it takes"; a loop closed.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- A canvas page drawn from `t`: render the light channels into separate float buffers (or separate canvases), then composite the phosphor colours, bloom pyramid, saturation, shoulder, ambient glow, vignette and dither in one WebGL pass. A Python route (Manim's Cairo renderer for the channels, OpenCV for the post pass) works too and can be fed into HyperFrames as an image sequence.
- One world, one camera `(cx, cy, zoom)`: world-to-screen is `(x − cx)·zoom + 960`; line widths in screen pixels. A `cam(t)` function strings together holds, log-zoom tweens and follows.
- The signal is a pure function: for a Fourier-style chain, the value at signal time s seen at film time t is Σ aₙ·gₙ·sin(nωs), where gₙ is each term's growth gate; keep each sample's terms as they were when written, unless the scene says the whole curve updates. Sample the trace every 2 screen px, plus 121 extra samples round every edge in view so steep edges and thin spikes are never missed.
- Text from font outlines: get each glyph's path, resample it so it can morph to any target path, and draw partial outlines for the write-on.
- Formulas typeset once with MathJax to SVG, stored as paths; swap whole formula variants when a number changes.
- Events for `cues.json` from the same timeline: each glyph, corner, term birth, RUN, STOP, cursor, dive and switch-off.

## 11. Pitfalls

- **Strobing persistence.** Frame-to-frame afterglow at 24 fps leaves a stepped smear; draw the ghosts sub-frame instead.
- **Missed spikes.** Uniform sampling skips thin overshoots at edges; add dense samples round every edge.
- **Lines that fatten when zooming.** World-scaled stroke widths turn the beam into a ribbon; keep widths in screen pixels.
- **Text in the trace.** The scrolling trace will cross the captions; the scrim is required.
- **Too much amber.** If amber appears outside measurements, the second channel stops meaning anything.
- **Readouts that disagree** with the drawing or the voice; compute them from the same functions, to the same decimals.
- **Bloom that eats small type.** Text must emit far less than the beam (about a fifth).
- **Thin lines lost on phones.** In a reel, widen the trace to 4 px and keep tags at 30 px or more.

## 12. Variation space

The agent decides per video: the mathematics or signal, which object the title morphs into, the number of terms and their schedule, where the dive goes, what the amber cursors measure, and whether the ending switches off or loops.

- **Three structures:** build up (one term at a time, a rush, the limit); the anomaly (a perfect shape, STOP, a dive to the flaw, its measurement, why it never goes away); compare (two channels, the signal in green and its approximation or reference measured in amber).
- **Three openings:** the beam igniting and writing the finished shape; the question typed in the empty graticule; a dive already in progress that pulls back to reveal what it was inside.
- **Three endings:** a pull-back to 0.5× with amber pulses running along every feature; the formula's limit flipping to ∞ with a bell; the switch-off to a single dot.
