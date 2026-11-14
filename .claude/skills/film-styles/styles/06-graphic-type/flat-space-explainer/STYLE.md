# Scale Zoom Explainer

> Flat vector science on a night-blue ground: solid shapes with one shade step, hard-edged halos instead of glows, and a small guide whose eye is a zoom lens. It aims a dotted sight line at the next stop, a ring locks on, and the camera dives through the ring to the next power of ten while a field-of-view readout and a log-scale ribbon keep count. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Charles and Ray Eames' *Powers of Ten* (1977) and Kees Boeke's *Cosmic View* (1957) for one continuous journey by factors of ten with a running measure; flat-vector science explainers of the 2010s for solid colour, two-tone shading and rounded forms; picture-book mascots for a guide who reacts rather than lectures. Never copy their characters, frames, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The subject fills the upper two thirds and bleeds off the sides; the guide sits low left; the instruments move to the top of the safe box. Must-read text sits in x 72–900, y 269–1248.

| Zone | Position | Content |
|---|---|---|
| Readout | x 96, label y 300, number baseline y 356 | FIELD OF VIEW 16 px caps; number Jost 600, 52 px + unit 30 px |
| Ribbon | x 96–880, track y 400 | 10 px track, stop glyphs above, decade labels below |
| Stop headline | x 96, y 470–580 | 16 px caps label + Jost 700, 80–96 px name |
| Subject | centred on x 540, y 650–1100 | 60–90 % of the width, bleeding off the edges |
| Guide | x ≈ 250, y ≈ 1000, 200–240 px tall | reacts, aims, fires |
| Caption | centred on x 540, ≤ 720 px wide, bottom edge y ≈ 1230 | sun tick + Jost 600, 44 px |

- **The first 3 seconds.** Frame 1 is a close-up of the guide's lens eye, iris already scanning; by 0.5 s it blinks and focuses with a servo whir; by 1.2 s the camera pulls back to the first scale, huge, behind the guide; by 3 s the readout has counted up and the voice has asked how far the journey goes.
- **Length and pace.** 25–45 s, three to four stops: one dive every 6–10 s, each stop holding one comparison or event; one silence (the wind-up before the first sight line).
- **Captions.** One line, cream over a sun-coloured tick; on bright daytime scenes it sits on a night plate.
- **Sound.** `ui-click` for blinks and focus, `tick` for the readout counting and each sight-line dot, `latch` when the ring locks, `zoom-swish` on every dive, `ui-pop` for labels and glyphs, `sparkle` when the ribbon lights a stop. Each scale's instrument bed comes from a free sample library.

### YouTube (1920×1080)

This style is made for long YouTube explainers: one unbroken journey across scale, where the camera move itself is the chapter break.

- **Layout.** Section 2 as written. The readout, the ribbon and the caption all sit above y 936 (the player's controls cover the bottom 12 %); stop headlines and labels stay 96 px in from the sides.
- **Length and structure.** 4–8 min, one chapter per stop (typically 5–8 stops, 40–70 s each). Every chapter has the same five beats, which is what lets the format run long without feeling repetitive:
  1. **Arrive** (3–5 s): the dive lands, the camera settles with a small overshoot, the readout ticks to its new value, the ribbon lights the stop, the headline rises.
  2. **Orient** (8–15 s): one familiar comparison at true scale (shrink the subject to a ball, lay a tape along the dots, open a magnifier inset).
  3. **Act** (15–30 s): one thing happening at this scale, in real proportion: light walking between bodies with a running clock, a cell dividing, an orbit sweeping.
  4. **Aim** (3–5 s): the guide turns, winds up, fires the sight line; the ring locks on the next stop with its label.
  5. **Dive** (2 s): through the ring, or through the medium (clouds, layers of skin, the guide's own lens).
  The dive is the re-hook: it lands every 40–70 s and each one previews the next question. Vary the dive type every chapter, and break the rhythm once mid-video with a **true-size reveal** (the guide shown at its real size), which resets the viewer's sense of scale. The ribbon is the chapter bar on screen: name the chapters in the description after the ribbon's stops. End on the ribbon finale, with the last 20 s clear at the edges for the end screen.
- **The first 10 seconds.** 0–1.2 s the lens close-up, focusing; 1.2–2.9 s the pull back in log space to the biggest image of the video (the starting scale, full frame) with the guide in front; by 4 s the title words have landed on the beat and the readout counts up; by 5 s the question ("how far down does it go?"); by 10 s the promise, spoken while the sight line fires and the ring locks on the first stop: "N powers of ten, from here to there". The dive at 10 s starts chapter one. No channel sting before it.
- **Captions.** Burned in as part of the frame (the tick and type are the style's own); export the same lines as `.srt`.
- **Thumbnail.** The guide at left firing its dotted line into a locked ring on the subject, the readout number set at 160–200 px (one number and unit, e.g. a power of ten), at most three words. Choose the frame where the ring has just locked.

### Good for

Science explainers, scale and size, space and biology journeys, "how big / how small / how far", classroom lessons, product deep-dives that zoom from system to part.

## 1. Essence, and what it is not

1. **One journey across scale.** Every stop is a factor of ten (or several) from the last; nothing is shown without its scale.
2. **Flat, but lit.** Every object is one base colour plus one shade step, lit from the upper left; glows are hard-edged rings; no gradients, blur, outlines or transparency.
3. **The camera is the narrative.** Dives through rings, clouds, layers and lenses are the cuts; zoom is always in log space.
4. **The guide aims, the world answers.** A small character whose eye is the zoom lens looks, winds up and fires a dotted sight line; a ring locks on; the camera follows the line.
5. **Instruments keep honesty.** A field-of-view readout and a log ribbon are always on screen and computed from the camera; anything drawn larger than life is admitted with a true-size reveal.

Not **Microscope Story** (that imitates a real instrument's images; here every scale is flat illustration). Not a 3D space flight: no perspective, depth of field or lens flare. Not a slideshow of diagrams: each scene is already inside the last.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Title | x 116, baselines y 268 and 392 | Jost 700, 132 px, tracking −2; subtitle 32 px mist at y 458 |
| Stop headline | x 120, y 150–260 | label Jost 600, 16 px caps, tracking 3; name Jost 700, 96 px |
| Subject | centre-right (x ≈ 1230, y ≈ 470), 50–100 % of frame height | the world at this scale |
| Guide | left third (x ≈ 470, y ≈ 700), 250–290 px tall | drawn big for clarity until the true-size reveal |
| Next-stop ring | on the target, 26 px radius locked | label 200–300 px away along a leader |
| Readout | x 1220, label y 790, number baseline y 846 | FIELD OF VIEW + Jost 600, 52 px and a 30 px unit |
| Ribbon | x 1220–1800, track y 890 | 10 px track, glyphs 34 px above, labels 46 px below (≤ y 936) |
| Caption | x 96–1150, baselines y 880 and 916 | sun tick 5×74 px at x 96; text from x 122 |

No stars behind the title or headline; the subject and guide never cross the ribbon.

## 3. Materials and rendering

- **Vector, flat.** Solid fills. Two-tone shading: the shape in its shade colour, then a copy clipped to it, offset toward the upper-left, in the base colour: the lit side is a crisp crescent.
- **Soft forms.** Blobs are closed Catmull-Rom curves through jittered polar points; clouds are pills; rods have round caps.
- **Halos, not glow.** A bright object sits on two hard-edged discs one and two steps lighter than the night (`#252A63`, `#30367C`).
- **Stars.** Seeded, in mist (55 %), cream (30 %) and sun (15 %), radius 1.4–4.6 px; a few four-point sparkles breathe ±16 % at 0.32 Hz.
- **Parallax** is the only depth: layers take a power of the camera's zoom (stars z^0.18, far objects z^0.42, the subject z^0.75, the guide z^1).
- **Grain.** Fine fractal noise at 5 %, screen-space, drawn last, keeps night fields alive.
- **Nesting.** The next scale is drawn inside a clipping circle (the ring, a layer, the lens) and grows to fill the frame.

## 4. Colour logic

- **Ground by scale:** night for space and the microscopic, daylight blue for human-scale scenes (captions then sit on a night plate).
- **Sun yellow is the instrument colour:** sight-line dots, rings, leaders, ribbon progress, the caption tick; in the world, only stars are sun yellow.
- **Mint** is life and land, **coral** danger or the thing being chased, **blue** water and planets, **cream** light and type, **mist** secondary type.
- **Never:** gradients, transparency for depth, colours outside these pairs.

Example palette:

| Role | Base | Shade |
|---|---|---|
| Night ground | `#1D2052` | halos `#252A63`, `#30367C` |
| Mist | `#9298D4` | |
| Blue | `#4D7CFE` | `#3A5FD9` |
| Mint | `#3FD8AE` | `#22B38C` |
| Coral | `#FF6B5E` | `#E14B45` |
| Sun | `#FFC84A` | `#F2A12F` |
| Cream | `#FFF4E2` | `#F0DCC0` |

## 5. Type and captions

- **Face (SIL Open Font License):** Jost, variable. 700 for titles and stop names, 600 for numbers, labels and leaders, 500 for subtitles and units. For another script, Noto Sans in that script.
- **No fades.** Words rise from behind a clip line on a spring (stiffness 15, damping 7.5) or wipe left to right (0.25–0.5 s, ease-out). Title words land one per beat.
- **Labels:** a 16 px caps line in sun or mist (tracking 3) over a 28 px cream line, on a 2.5 px leader that draws in 0.3 s.
- **Numbers** count in log space and switch units at thresholds (light-years, million km, km, m, cm, mm, µm, nm); exponents are superscripts at 62 %.
- **Captions.** One language, the spoken one; cream 36 px (Jost 600) rising 14 px in 0.16 s, an optional second line in mist 26 px. Hold ≥ max(1.8 s, speech + 0.6 s).

## 6. Motion

- **Frame rate.** 24 fps for YouTube, 30 fps for a reel; smooth, never stepped.
- **Easing.** Camera moves ease in-out (cubic); dives accelerate with an ease-in applied to the logarithm of zoom; arrivals use a spring with one soft overshoot (≈ 2 %). Pops use a back ease (overshoot 2.2).
- **The guide is performed, not slid.** Every state is a number blended over time (look, blink of 0.22 s, lens zoom, iris widening, smile, squash ±12 %, tilt, antenna, thruster flame). It idles with a 3 px sway at 0.3 Hz and a 6 px bob at 0.45 Hz; the antenna lags its vertical speed.
- **Anticipation and release.** Before firing, 0.5 s of squash and pull-back; on release a stretch, a decaying wobble and a 10 px recoil. A hop: crouch 0.12 s, a 30 px arc in 0.5 s, a squash on landing.
- **Sight line.** Dots of 3.4 px radius every 17 px leave the lens over about 1 s, each popping in with a back ease; the line stops 48 px short of the ring, then creeps forward like a conveyor.
- **Ring lock.** A 4 px ring springs in from 3.6× its radius; a dashed halo (2.5 px, 3/9 dash) forms around it and slowly rotates; the leader draws, the label wipes.
- **What never moves:** the stars' colours, the instruments' positions, the light direction.

## 7. Camera

One camera for everything: screen = (point − centre) × zoom + frame centre, zoom interpolated in log space.

| Move | What it expresses | What it can serve |
|---|---|---|
| Pull back from the lens (×7.4 → ×1 in 1.6 s, 2 % overshoot) | "look through this eye" | the opening, a chapter start |
| Slow drift in (+2.5 % over 4–5 s) | the world is alive while the voice speaks | every hold |
| Push toward the target (+4.5 %, accelerating) | aiming | the beat before a dive |
| Dive through the ring (×50 in 2 s, accelerating; next scale already inside) | down one or more powers of ten | the standard chapter cut |
| Through the medium (clouds scaling past, layers opening as circles 0.15 s apart, into the lens ×34) | crossing a boundary | atmosphere, skin, the very small |
| Zoom about a fixed point (×26–×90 in 0.8–1 s) | that exact spot, closer | "you are here", a cell, a city |
| Shrink into a glyph (a scene scales down onto its ribbon icon) | summary | the finale |

**Allowed transitions:** only those above. **Forbidden:** hard cuts between scales (the journey must be continuous), dissolves, whip pans, 3D fly-throughs, motion blur.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Score | 96 BPM (a bar is 2.5 s), one key throughout; each scale has its own instrument colour: bowed vibraphone and harp for space, a walking marimba for planets, nylon guitar for the human scale, pizzicato cellos in the minor for the body, bells and hand chimes for the smallest; the finale plays them all | ducked about 68 % under the voice and dipped 300 Hz–4 kHz |
| Silence | two real ones: the wind-up before the first sight line, and inside the lens before the smallest scale | |
| Guide | servo whirs for iris and focus, a click per blink, flaps on panel sweeps, a puff for a hop, a 120 Hz landing thump | |
| Instruments | a blip per sight-line dot rising an octave along the line, a clack and short bell on the lock, fine clicks as the readout counts, a pop per glyph, a glockenspiel note per stop in the finale | |
| Journeys | a filtered whoosh with low wind on each dive, a 60 Hz thump on arrival, whooshes per cloud bank, descending thumps per layer, a gulp or boing for small comedy | |

Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **The lens open.** Extreme close-up on the guide's eye: iris scans, a blink, a focus click; pull back in log space to reveal the first scale. Fits content like: series openers; "let's look closer"; any first frame.
2. **Aim, fire, lock.** The guide winds up and fires dots that pip upward in pitch; the ring springs in and the NEXT STOP label wipes on. Fits content like: chapter turns; pointing at one detail in a crowd; setting a goal.
3. **Dive through the ring.** ×50 in 2 s, the next world growing inside the ring until it fills the frame. Fits content like: each power of ten; zooming into a component; entering a map region.
4. **Through the layers.** Concentric discs in each layer's colour open from one point, 0.15 s apart, growing exponentially, the next world inside the last. Fits content like: skin and tissue; soil, crust and mantle; layers of a system.
5. **True-scale comparison.** Shrink a huge thing to a familiar object, lay a tape along the sight line, and open a ×6 magnifier inset on the tiny gap. Fits content like: heights and depths; "how thin is…"; distances people get wrong.
6. **The true-size reveal.** The guide, drawn big all along, drops onto a fingertip or a coin at its real size while the camera pulls from ×3.2 to ×1. Fits content like: honest scale; "it's actually this small"; resetting expectations mid-video.
7. **Light walks.** A dot travels between two bodies at true relative speed with a clock running beside it. Fits content like: the speed of light; signal delays; travel times.
8. **The ribbon finale.** The corner ribbon slides to centre stage, grows ×2.3, the last scene shrinks into its glyph, and dots stream along the track lighting each stop with a wobble and a bell. Fits content like: recaps; series summaries; end screens.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- SVG rebuilt each frame from `t` (or canvas), with helpers for clip paths, blobs, two-tone shapes, halos, sparkles and wipe-in text; every scene is a pure function of film time.
- Nest scenes in a circle clip at the ring's screen position, scaled so the next scene grows from a point.
- One camera function per stretch of film, keyframed with in-out easing; dives use `exp(log(K) × easeIn(p))` and keep the target point fixed on screen.
- The guide as continuous pose numbers (look, lid, zoom, wide, smile, squash, tilt, antenna, flame) eased between keys, plus springs and decaying wobbles for follow-through; a lens function gives the eye's position for the sight line.
- Compute the readout from the camera and a log track of field of view in metres; every sight-line dot and ribbon glyph emits a sound event.

## 11. Pitfalls

- **Unadmitted exaggeration.** A guide drawn bigger than life needs its true-size reveal, or a spoken "drawn big so you can see it".
- **Linear zoom.** Zooming in linear scale feels like braking; always interpolate zoom in log space.
- **Same dive every time.** Five identical ring dives become a screensaver; alternate the dive types.
- **Glow creep.** Blurred glows and gradients turn it into generic space art; halos are hard rings.
- **A lecturing guide.** The guide never holds text or explains; it looks, aims, reacts and is the scale reference.
- **Wrong readout.** A readout that disagrees with the picture breaks trust; compute it, and check each stop's value against a source.

## 12. Variation space

The agent decides per video: the direction (down, up, or down and back up), the stops, the guide (any simple character whose eye or tool is the zoom: your mascot if you have one), each scale's instrument, the ground colour per scale, how many chapters.

- **Three structures:** a single descent by powers of ten, one chapter per stop; a round trip (down to the smallest, then back up to where we started, faster); a comparison ladder (the same question asked at five scales: "what moves fastest here?").
- **Three openings:** the lens open; the biggest image already full frame with the readout counting on frame 1; the guide at true size on a coin, then a pull out to the largest scale.
- **Three endings:** the ribbon finale; the guide looks back into the camera from the smallest scale and the camera pulls all the way back to frame 1 so the video loops; the last dive lands on an everyday object, showing the whole journey happened inside it.
