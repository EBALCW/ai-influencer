# Scratch Film

> Pictures cut by a needle into black film emulsion and tinted with transparent dye: cream lines of light that boil because every drawing is cut again, colour laid in streaky hatching, and a soft halation glow around anything bright. The black is the world (night, deep water, space); everything you see is a mark. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): direct-on-film animation of the 1930s–60s, scratched and painted straight onto the strip (take the boiling line, the hatch-filled colour, the rhythm of marks to music); hand-cut experimental shorts (take light as something carved out of darkness); natural-history drawings in field notebooks (take accurate, diagrammatic anatomy); scale-of-the-universe films (take one continuous pull back from a detail to a system). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The black bleeds everywhere; the horizon or the main line of the picture sits high (y 520–700) so the subject can live in the middle third.

| Zone | Position | Content |
|---|---|---|
| Horizon / main cut | y 520–700, full width | the first mark of the video |
| Subject | centred, y 700–1200 | drawn at 600–900 px across |
| Ruler or scale marker | left, x 72–220, y 300–1200 | ticks, a "you are here" arrow and a mono number |
| Caption | centred on x 540, ≤ 720 px wide, bottom edge y 1230 | one or two lines, cut in from the left |
| Split views | stacked top and bottom, divider cut left to right at y 960 | two views of the same moment |

- **The first 3 seconds.** Frame 1 already shows the needle's hot tip mid-cut across the black (a line half-drawn, sparks flying); by 0.5 s the line has crossed the screen with its squeal; by 3 s the first creature or object has been scratched in and its eye glints.
- **Length and pace.** 30–45 s at about 84 BPM: four or five shots, each built around one mark being cut (a line, an outline, a row of lights, a divider), and one long pull back.
- **Captions.** One caption layer, cut in from the left like a scratch.
- **Sound.** `zoom-swish` on pushes and pull-backs, `tick` on ruler marks and each ring cut, `shimmer` as lights switch on, `sparkle` on an eye glint, `sub-impact` on a snap or bite, `metallic-riser` under the long pull back. Vibraphone (struck and bowed), glockenspiel, pizzicato and bowed double bass, log drum and brushes from the [Versilian Community Sample Library](https://github.com/sgossner/VCSL) (CC0).

### YouTube (1920×1080)

- **Layout.** Section 2 as written; captions sit lower left with their bottom edge at y 940, above the player's controls; the ruler stays inside x 96.
- **Length and structure.** 3–6 min in chapters, one scale or one place per chapter (surface, mid-depth, deep; cell, organ, body). Each chapter opens on a single new cut across the black and closes on a pull back. Re-hook every 30–60 s with a new mark being cut: a split divider, a row of lights coming on, a hatched title, a drop into silence.
- **The first 10 seconds.** The strongest image first: the subject already glowing in the dark at full scale; the question by 5 s ("what happens here when nobody is watching?"); the promise by 10 s, when the needle cuts the first line of the answer.
- **Captions.** Burned in as part of the look, and exported as `.srt`.
- **Thumbnail.** The brightest frame: the subject hatched in its dye colour, halation around it, black all round, at most three words cut in cream.

### Good for

Things that happen in the dark, night and deep-sea nature, one detail opening onto a whole system, light and bioluminescence, small heroic journeys, music-led poems.

## 1. Essence, and what it is not

1. **Black is the ground; light is the mark.** Nothing is lit; everything bright has been cut or dyed. A frame with nothing cut is pure black emulsion.
2. **Every drawing is cut again.** Lines are redrawn 15 times a second with fresh tremor, skips and chips, so the whole picture boils while its shapes hold still.
3. **Colour is dye, laid in hatching.** Transparent streaks that overshoot the outline, never a flat fill.
4. **The cut is an event.** The needle is never shown, only its hot point: lines, titles and dividers appear as they are cut, with a spark and a squeal.
5. **Scale is honest.** Line widths come from the world (millimetres × pixels per millimetre), so the same engine can draw an eye at 500 px/mm and a whole sea at 2 px/m.

Not **Printed Long Take** (that is white board scratched in one continuous camera move; here marks boil drawing by drawing and carry dye). Not **Chalkboard** (no board, no dust smears, no writing hand). Not **Neon Tubes** (no glass tubes or electric hum; light is carved, not wired). Not **1920s Silent Film** (no perforations, frame lines, title cards or sepia; the film is the medium, never a prop).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Sky and horizon | top third; horizon y 300–360 when the surface is in frame | stars, moon, the boiling surface line |
| Subject | centre or left of centre, 500–1100 px across | the creature or object, scratched and dyed |
| Background layer | everywhere, behind | specks drifting (falling slowly in world space), out-of-focus shapes |
| Ruler | left edge, x 96–140, never below y 860 | a scratched vertical line with ticks every step, labels every second tick |
| Position marker | fixed on screen beside the ruler | a cut arrow and the current value in mono |
| Split | vertical divider at x 960 | two halves, two views of one moment |
| Caption | lower left, x 96, bottom edge y 940 | one or two lines |

Composition is open and dark: at least half the frame stays black. Bright things are placed against black, never against other bright things.

## 3. Materials and rendering

- **Emulsion.** Black `#050403` with 200 soft blotches (40–280 px, 16–34 % alpha, alternately warm `rgb(32,22,16)` and cold `rgb(14,16,24)`); four variants cycled one per drawing, so the black itself breathes.
- **The needle line.** A spline through the points, drawn in two or three near-parallel passes (the first at 95 %, the others at 50–90 % and 45 % width), each offset by a jitter of 0.7 × width (0.25–5 px) with a slow sine drift; segment widths vary 55–130 % and taper toward both ends; 1.2 % of segments skip for 1–4 steps; lines wider than 2.5 px throw small triangular chips; 55 % of lines end with an overshoot tail 4–14 px long. Cream `#FFF4DC`.
- **Dye.** Transparent brush streaks along a path: 4–8 bristles across the band, each 40–100 % of 55 % alpha, starting and ending at random points, tapering in the middle.
- **Hatching fill.** Back-and-forth zigzag hatching across a polygon at a chosen angle, gap 2–18 px (scaled with the subject), strokes overshooting the edge by up to 1.6 × the gap, two strands per pass, two passes. Body colour in one dye, a sparser second pass in a darker one along the top.
- **Light on top.** After the picture: the frame drawn again blurred 9 px in `lighter` at 40 % and blurred 28 px at 20 % (halation); a dust layer of 520 specks, 70 hairs and 40 dark specks, four variants; a radial vignette to 42 % black; a per-drawing flicker of up to 5 % black; a weave of ±0.9 px x and ±1.1 px y per drawing; grain of 26,000 1.5 px dots (8 % white, 10 % black), three tiles cycled at 30 fps.
- **Depth of field.** A blurred copy of the frame masked by a radial gradient around the subject; background creatures are drawn into their own blurred layer.
- **World-anchored vs screen.** Lines, dye and specks are in world units and move with the camera; emulsion, dust, grain, vignette and the position marker are screen-space.

## 4. Colour logic

- Black ground and cream light always. Dye adds one or two hues per subject: one for the body, a deeper one along the back or in shadow.
- Each kind of thing owns a dye: the hero one (teal), the threat another (red), the warm source a third (yellow for sun, moon, dawn).
- Blue is for light falling from above and for small living lights; yellow is for celestial and dawn light only.
- Dye never fills evenly and never covers a needle line; cream lines are drawn last, over the dye.
- Dawn arrives as warm hatching growing over the horizon, not as a gradient.

Example palette: emulsion `#050403`, ink `#030202`, cream `#FFF4DC`, teal `#1FB39A`, blue `#2F86FF`, red `#FF3220`, yellow `#FFC81C`, green `#46D65A`, caption second tone `#E6D8B8`.

## 5. Type and captions

All faces are SIL OFL from Google Fonts.

| Role | Face | Size (16:9) | Rules |
|---|---|---|---|
| Captions | Jost 600 | 38–42 px | cream, cut in from the left over 0.3 s, out over 0.18 s |
| Titles | LXGW Marker Gothic | 90–160 px | each letter turned up to ±0.045 rad and shifted ±5 px; filled by diagonal cuts every 7–10 px |
| Numbers, units | IBM Plex Mono SemiBold | 38–44 px | ruler labels and the position marker |

- Every text image is a cut: a canvas with 14 thin `destination-out` streaks across it where the needle skipped. Text boils by at most ±0.4 px, much less than lines, so it stays readable.
- Captions and titles appear by a clip that sweeps left to right; a title's sweep carries the hot tip (a 2.2 × radius glow, a white core and twelve sparks thrown upward).
- Captions hold ≥ max(1.8 s, spoken line + 0.6 s). One language, the spoken one.

## 6. Motion

- **Frame rate.** Render at 30 fps; drawings change 15 times a second (`dn = Math.floor(t * 15)`). Every random choice of a mark is reseeded from `dn`, so lines boil on the drawing, not on the frame. Grain alone changes every frame. For a 24 fps YouTube render, step at 12.
- **Easing.** Cubic out for arrivals and cuts, cubic in-out for camera moves, smoothstep for slow parameters; zoom interpolated in log space.
- **Drawing on.** Subjects are scratched in, in a fixed stroke order (outline, fins or limbs, then details), the needle tip leading; dye sweeps in from the head after the outline; the eye is cut last with a glint.
- **Weight.** Small creatures move with a tail beat and a three-part flick: anticipation, flick, recover. Big shapes drift; nothing snaps unless it bites.
- **Lights.** Each small light is cut first as a ring, then lit over 0.18 s (cubic out), one every 0.25 s along the body, with a short dye ray thrown downward.
- **What never moves**: the stars and the moon are fixed on screen (they are at infinity), and the position marker stays where it is while the world scrolls past.

## 7. Camera

| Move | What it expresses | What it can serve |
|---|---|---|
| Push into a point of light (log zoom over 1.6 s, specks rushing past) | finding the hero in the dark | an opening, a detail that matters |
| Tracking alongside, with parallax specks (far ones slow, near ones streaked and soft) | a journey | a climb, a migration, a long process |
| Tilt from below to the threat | danger from beneath | a predator, a risk |
| Split with a cut divider (0.4 s, top to bottom) | two points of view at once | hunter and hunted, inside and outside |
| Long pull back (log scale over 7 s, ×5,000) | one becomes many | one creature to a whole system |
| Sink | ending, return to the dark | a coda |

Transitions: a hard cut on a drawing; a new line cut across black; the split divider; a drop to black emulsion. Forbidden: dissolves, motion blur, smooth vector zooms that thin or fatten lines, any light source that is not a mark.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Voice | one warm, unhurried narrator | about 8 dB over the music; the 300 Hz–4 kHz band of the music ducks under speech |
| Music | about 84 BPM, hand-played instruments: vibraphone struck and bowed, glockenspiel, pizzicato and arco double bass, log drum, brushes (snares off); no piano, no strings section | low, sparse |
| The cut | a gritty needle squeal for every line, title and divider, panned along the cut's direction | foreground |
| Drawn tones | each light gets a sine tone read at 24 drawings a second so it flutters like a hand-drawn soundtrack | soft |
| Ambience | the sea above the surface (wash) and below (a low, slow swell) | bed |
| Silence | two real silences: one before the key reveal (about 1 s), half a beat before the ending | only a breath of the bed |

Pack ids as in Formats. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Cut the horizon.** The first mark crosses the black left to right with its hot tip and squeal; the world begins above and below it. Fits content like: an opening; a before/after line; a threshold.
2. **Scratch the subject in.** Outline in stroke order, dye swept in, eye cut last with a glint. Fits content like: introducing a character; anatomy explained part by part; building a product sketch.
3. **Lights on, one by one.** A row of rings is cut, then each lights with its own drawn tone, 0.25 s apart. Fits content like: counting; a system coming online; bioluminescence.
4. **The divider.** A vertical (stacked in a reel) cut splits the frame into two views of one moment, then the halves merge back on a whoosh. Fits content like: predator and prey; user and server; inside and outside.
5. **Vanish into light.** A dark silhouette seen from below against a hatched glow loses its edge segment by segment as its lights match the glow. Fits content like: camouflage; blending in; disappearing from view.
6. **The ruler.** A scratched scale on the left counts as the camera moves, a fixed arrow shows "you are here". Fits content like: depth, altitude, time, money.
7. **One to countless.** The long pull back from one subject at 7,000 px/m to a field of thousands of tiny glowing marks. Fits content like: one person to a population; one transaction to a market; one star to a galaxy.
8. **Dawn hatching.** Warm yellow strokes grow over the horizon while everything below sinks. Fits content like: an ending; time passing; relief.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas, drawn from `t`: the shot function receives the time stepped to 15 drawings a second and the drawing number `dn`; every mark reseeds from `dn` (`rs(seed + dn)`).
- A small 3D line camera (position, target, roll, focal length) projects world polylines to the screen; widths are world millimetres × the projected scale, so marks keep their weight at any distance. Flat shots use a 2D world-to-screen map in metres with a log-interpolated scale.
- Three primitives do everything: `scratch(points, {w, a, passes})`, `dye(points, {w, col, n})`, `hatch(polygon, col, {gap, ang, lw})`. Creatures are lists of strokes in local units in cutting order, so "drawing on" is a prefix of the list.
- Draw the scene into an offscreen canvas, then composite: emulsion, scene, halation (two blurred `lighter` copies), dust, vignette, flicker, weave, grain, captions.
- Bake text images once per string and size; bake emulsion, dust and grain variants at load.
- One sound event per cut (with its duration and pan sweep), per light, per tick and per whoosh, written to `cues.json`; the drawn tones are generated from the same light times.

## 11. Pitfalls

- **Flat fills.** One solid shape and it reads as vector art; fill only with hatching and dye.
- **Boil on text.** Lines boil; captions must not, or they cannot be read.
- **Boiling every frame.** Reseeding at 30 per second turns the boil into noise; step at 15.
- **Too much light.** With halation, bright areas bloom into each other; keep half the frame black and space bright marks apart.
- **Lines that change weight with zoom.** Compute widths from the world, then clamp (0.7–80 px), or a pull back turns into hairlines and a push into blobs.
- **Film props.** Sprocket holes, frame lines and leader numbers are a different style; the film is felt, never shown.
- **Inaccurate anatomy.** The scratched look invites trust; check the creature or object against a reference before drawing.

## 12. Variation space

The agent decides per video: the world (night sea, night sky, the inside of a body, a city at night), the hero's dye, the threat's dye, which marks get cut on camera, the ruler's unit, where the silences fall.

- **Three structures:** a journey through one dimension (depth, altitude, time) with the ruler counting; one encounter told from two sides through the split; one detail pulled back into a whole system.
- **Three openings:** the horizon cut across black; a point of light far below, then the push in; the hero's eye cut first, then the outline around it.
- **Three endings:** the long pull back to countless marks; dawn hatching over the horizon while everything sinks; the last line cut, then black emulsion and grain only.
