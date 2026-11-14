# Neon Tubes

> Hand-bent glass tubes on a rainy night street: letters and characters made of single glowing lines with black-painted joins and electrode caps, lighting the wet wall and the puddles beneath them. Characters move the way real animated signs do, by switching between bent poses on the beat, and a street of signs strikes, chases, fails and comes back to the music. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): the craft of the neon bender (single-stroke lettering, corners bent over a flame, blockout paint on the double-backs, electrodes and tie wires); mid-century animated signs (pose switching, chasing arrows); rainy night-street photography (wet reflections, coloured light on concrete); 1980s city-pop videos (colour and groove); silent cartoon shorts (acting without words). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** A vertical slice of street: wall and windows above, the hero sign in the middle, the wet pavement and its reflections at the bottom, all bleeding off the edges.

| Zone | Position | Content |
|---|---|---|
| Hero sign | centred on x 540, y 420–1060 | the character tube and its sign; vertical blade signs suit the format |
| Neighbouring signs | cut by the frame edges, above and below | colour spill and life; never read |
| Wet street | y 1250–1920 | pavement, puddle, reflections of every lit tube |
| Captions (if any) | centred on x 540, ≤ 720 px wide, last baseline y ≈ 1200 | over the dark lower wall |

  For a street run, the camera tracks vertically down a stack of signs instead of sideways along a facade.
- **The first 3 seconds.** Frame 1 is an extreme close-up of an electrode sparking and the first tube striking (two flashes, done by 0.23 s). By 1.1 s the camera has pulled back to show the whole sign filling with light; by 3 s the character has switched its first pose and looked at something it wants.
- **Length and pace.** 20–45 s on a 120 BPM grid (a beat every 0.5 s, a bar every 2 s). Verse, a break with one dead stop of music, a chorus where the whole street chases, a quiet close.
- **Captions.** Wordless is native: the story is told by acting and light. If there is a voice, captions follow section 5.
- **Sound.** `hook-impact` on the frame-1 strike, `latch` for each circuit that strikes or switches off, `ui-click` for every pose step, `zoom-swish` on whip pans, `sub-impact` on the chorus downbeat, `shimmer` when a dead tube comes back. The city-pop score, transformer hum and rain come from a free library or are synthesised.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Captions stay above y 950 and inside x 96–1824.
- **Length and structure.** 2–5 min as a music video or a narrated tour. One sign (one shop, one idea) per chapter, 40–90 s, each opening with that sign striking from dark. Re-hook every 30–60 s with a whip pan to a new sign, a failure (flicker, crack, a sign going out), or a chorus where every sign on the street chases.
- **The first 10 seconds.** The finished hero sign at full glow on frame 1, with rain; the character's wanting look by 5 s (the question); by 10 s a second sign strikes down the street, which is the promise of where it goes.
- **Captions.** If spoken, burned in and exported as `.srt`; wordless videos export the on-screen sign words only if they matter.
- **Thumbnail.** The hero sign close, one character pose mid-action, rain streaks lit by it, at most three words bent in tube on the sign itself.

### Good for

Shop openings and mascot stories; nightlife and city-pop music videos; city and festival night idents; menus and opening hours; product reveals with one colour per item; short wordless gags.

## 1. Essence, and what it is not

1. **Real tubes.** Every glowing line is a glass cylinder of fixed diameter (11–16 mm), with rounded bends, black-painted joins between strokes, electrode sleeves and caps at both ends, tie wires holding it to the board.
2. **Light falls on a world.** The tubes light the wall, the backing board, the rain and the wet street; there is almost no other light.
3. **Gas decides colour.** Clear glass glows red-orange (neon) or blue (argon); every other colour is a phosphor coating that looks milky when off.
4. **Animation is switching.** A moving character is a set of separately bent poses, one on at a time, switched on the beat grid; there are no in-betweens.
5. **Electricity has behaviour.** Tubes strike with a double flash, hum, flicker when failing and die section by section.

Not **Oscilloscope Math** (one beam drawing mathematics on black glass). Not **Firefly Pointillism** (points of light, no objects). Not synthwave (no chrome, no grid floor, no magenta-to-cyan gradient sky). Not a CSS glow on a font: neon letters are single-stroke tubes with joins and electrodes, never filled outlines with a blur.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Hero sign | centre, about x 500–1780, y 370–910 (backing board) | character tube, object tube, lettering |
| Character | on or above the board, its head near the upper third (y ≈ 300–380) | 0.95 m tall at sign scale; its eye is the visual target |
| Lettering | right of the object, cap height ≈ 0.12–0.25 of the board height | one word bent per tube unit, single-stroke |
| Wall | full bleed behind | tiles or concrete, grime and rain streaks, dark windows above |
| Wet street | below the wall's base when the camera is low | reflections and a puddle |
| Captions (if any) | centred on x 960, baseline y ≈ 920 | one line |

Sign scale: the camera sees about 4–5 m of facade at the standard framing (420 px per metre), a whole street (about 17 m) in the wide (112 px per metre), and a single electrode in the extreme close (3,600 px per metre).

## 3. Materials and rendering

- **Layers.** Draw in Canvas 2D, shade in WebGL2. Six layers: the tube profile (cross-section height and material: clear, coated, black paint, metal), the gas colour × power, painted and built surfaces, self-lit extras (lit windows, sparks), the emission at half resolution, and rain in screen space. The world layers extend two screen heights above the frame so a low camera can reflect signs above it.
- **The tube profile.** Each tube is stroked as up to 28 concentric bands whose value is the height of a cylinder section; the shader reads the height, takes a Sobel normal, and shades glass: Fresnel rim (0.04 + 0.96·(1 − h)⁵), a tight specular (power 90) and a soft one (power 30), refraction of what is behind, and the gas column inside the bore. Coated tubes glow across their whole width; black-painted ranges are near-black with a faint sheen; metal ties are grey and shiny.
- **Light on the wall.** The emission is blurred into an eight-level pyramid and the levels are weighted by physical lobes (2 cm, 6 cm, 18 cm, 50 cm, 1.4 m and 3.2 m, weights 1.3, 1.0, 0.65, 0.45, 0.32 and 0.13), so light falls off the same way at any zoom. The light's gradient gives its direction, which shades the wall's bumps (tiles, grout, grime).
- **The wet street.** A floor plane under the wall reflects the same layers, rippled by drops; fine paving detail fades out at grazing angles before it aliases.
- **Rain.** About 2,400 streaks in world space, falling 6.5–8.5 m/s, each 18 ms of travel long and lit by the light at its position; near drops are wide and faint, far ones thin and brighter.
- **Post.** Camera-velocity motion blur (6–24 samples when moving), chromatic aberration growing toward the edges, exposure, tone map `1 − exp(−1.15·x)`, a slight lift, vignette and ±0.5/255 dither.
- **World vs screen.** Tubes, wall, street and rain are world-anchored; captions and dither are screen-space.

## 4. Colour logic

- **Night first.** The sky is almost black; the wall is a dark neutral that takes the colour of whatever sign is nearest. Nothing is lit except by tubes, windows and sparks.
- **One gas per meaning.** Give each character, object and shop its own tube colour and never swap them; the viewer follows colour before shape.
- **Hot cores, coloured edges.** A bright tube's core reads almost white after tone mapping; its colour lives in the glass edge, the halo and the light on the wall.
- **Black is structure.** Painted joins and electrode caps are always black, and they are what make the lettering read as tubes.
- **Never coloured:** the black blockout, the rain (it carries the sign's light, not its own), and captions.

Example palette (gas colours from the code, as emitted):

| Role | Hex |
|---|---|
| Neon, clear glass (red-orange) | `#FF1C09` |
| Argon and mercury, clear glass (blue); its warm-up violet | `#3D75FF`; `#8C4DD9` |
| Coatings: green, turquoise, yellow | `#38FF5C`, `#1FF2D9`, `#FFB829` |
| Coatings: pink, purple, white | `#FF3D9E`, `#A847FF`, `#EBE6FF` |
| Sky | `#030305` |
| Blockout paint | `#050506` |

## 5. Type and captions

- **Bent lettering.** Sign words are not set in a font: they are tube centrelines laid along a font's stroke skeleton, single-stroke, with black double-backs between strokes. Barlow Condensed (OFL) gives good Latin skeletons; Noto Sans SC (OFL) for CJK when it belongs to the picture. Track letters at about a quarter of the cap height; round every corner with a fillet.
- **Stencilled text.** Titles and end cards that are not lit are painted on the wall: Barlow Condensed Bold, or Noto Sans SC Black for CJK, in a pale wall paint, lit only by the signs.
- **Captions (when there is a voice).** Barlow Condensed SemiBold, 44 px in 16:9 and 60 px in a reel, warm white `#F2EEE6` at 92 %, a 12 px soft dark shadow, centred. They may arrive with a two-frame strike flicker but never flicker while held. One language, the spoken one.
- **Hold.** ≥ max(1.8 s, speech + 0.6 s). Words bent on signs stay lit at least 2 s before anything happens to them.

## 6. Motion

- **Frame rate.** 30 fps, with the world on a 120 BPM grid: every pose switch, chase step and strike lands on a beat, an eighth (0.25 s) or a sixteenth (0.125 s).
- **Strike.** Full for 0.05 s, dark until 0.12 s, 70 % to 0.17 s, 8 % to 0.23 s, then a ramp from 60 % to full in 0.08 s; each circuit gets a 0–30 ms random offset so a sign never lights as one block. Circuits of one sign strike 60–130 ms apart.
- **Argon warm-up.** Blue tubes start as dim violet at 35 % and warm to full blue over 1.1 s.
- **Off.** 25 % for 40 ms, a 70 % kick to 70 ms, then dark.
- **Hum.** A 3 % random flutter stepped at 30 Hz on every lit tube. A failing tube switches randomly at 24 Hz between full and 15 %.
- **Poses.** A character holds each pose for a beat or an eighth; a jump is a push pose, flight poses on a parabola one per eighth, and a landing pose. Draw at least eight distinct poses for a short; the silhouette must change clearly between them.
- **Chases.** Arrows chase in sixteenths, bubbles in eighths, alternating frames swap on the beat.
- **Never moves:** the signs themselves (they are bolted down), the wall, and the captions. Only light, rain, water and the camera move.

## 7. Camera

| Move | What it expresses | Can serve |
|---|---|---|
| Extreme close on an electrode or eye (3,600 px/m), pull back to the sign (420 px/m) over 2.4 s | waking up | openings, a new chapter |
| Whip pan, about 16 m in 0.25 s, with motion blur | desire, "over there" | cutting to the thing wanted |
| Match cut on a shape (a round eye lands where a round bowl was, same screen point and radius) | connection | linking two signs or two ideas |
| Tracking along the street at sign scale with a 1 cm hand-held breath | journey | a run, a chase |
| Low street camera (eye 0.3 m) | the city's reflection | the chorus, the escape |
| Wide (112 px/m) | the whole street at once | the turn, the finale |

Camera keys interpolate scale in log space through a monotone cubic, so no move overshoots. Allowed transitions: whip pans, match cuts on shape, pulls from a close-up, a sign striking from dark, a sign going out to black. Forbidden: dissolves, wipes, zoom punches without a reason, camera roll, and shake (rain and flicker already carry the energy).

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Score | electronic city pop at 120 BPM in a major key: drum machine, synth bass, electric piano, pads, a lead with glide, bells and plucks with a ping-pong echo; each sign the character lights plays the next note of a rising pentatonic line, each sign that goes out a falling one | ducked under foley so every strike is heard |
| Strikes and offs | a 100 Hz buzz with its harmonics and a rasp, shaped by exactly the visual strike envelope, plus a relay click on each flash | the loudest foley |
| Transformer hum | a filtered 100 Hz buzz under everything, growing with the number of signs lit; the last sign's hum alone at the end | low |
| Character foley | footsteps as relay clicks; a purr as the hum trembling at 25 Hz; glass contacts as an inharmonic ting (partials 1, 2.32, 4.25, 6.63) | |
| Weather and water | rain bed (band-passed noise 900 Hz–9 kHz), drips after it stops, gurgles, splashes | ducked by the music's sections |
| Silence | one dead stop of the music (0.5 s) at the hush before the turn, filled only by hum and rain | |

No voice is needed. Master at −14 LUFS, true peak −1 dB; the last 0.8 s fades.

## 9. Native moves

1. **Strike.** The sign lights circuit by circuit with the double flash; blue tubes warm from violet. Fits content like: an opening; a launch; "we're open".
2. **Pose switch.** The character acts in bent poses on the beat. Fits content like: your mascot doing one job; steps of a process; a three-beat gag.
3. **Chase.** Sections light in sequence and carry something along. Fits content like: direction and wayfinding; progress; a call to action.
4. **Failing tube.** Random 24 Hz flicker, then death section by section from the break toward each electrode, with a sizzle. Fits content like: something breaking; a warning; decline.
5. **Draining level.** Water lines go out a level at a time, each line in four steps of 0.125 s. Fits content like: a resource running low; a countdown; a budget.
6. **The street answers.** Each sign the character passes dips for 70 ms and recovers, and a chase wave runs down the street on the chorus. Fits content like: momentum; an idea spreading through a city; a launch day.
7. **Revival.** A dead tube strikes again with the full envelope, its colour back. Fits content like: a comeback; a restart; a happy ending.
8. **Closing time.** Signs go off one by one on falling notes, the rain stops, one eye strikes open again. Fits content like: an ending; good night; a sign-off.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- A canvas page drawn from `t`: Canvas 2D layers (profile, gas colour, surfaces, extras, emission, rain) uploaded as textures each frame; WebGL2 passes for surface plus tube shading, the street and reflections, and post. Use half-float targets for the light pyramid.
- A tube is a polyline in metres: strokes filleted at every interior corner (radius clamped to 45 % of each leg), a black-painted range for each double-back, 2.5 cm painted electrode sleeves and a dark dome at each end, tie wires every 0.22 m. Lettering units come from the font's skeleton as stroke lists on a 10 × 10 grid.
- Power is a pure function per circuit: a table of on and off times, plus strike, off, hum, warm-up, flicker and chase functions of `t`; a character is a key list `{t, pose, x, y, facing}` that selects one bent tube.
- Light lobes are defined in metres and converted to pyramid weights from the current camera scale, so a zoom never changes how far light spreads.
- Camera keys `[t, x, y, ln scale, eye height]` per shot, each channel through a monotone cubic.
- `cues.json` from the same tables: every strike, off, step, landing, crack and drop, so sound and flash share one envelope.

## 11. Pitfalls

- **Filled glowing letters.** Outlines with a blur read as a font effect; bend single strokes with black joins.
- **Tween-animated characters.** Smoothly morphing tubes break the craft; switch poses.
- **Glow without light.** If the wall, rain and street don't take the tube's colour, the sign floats; the light pass is the style.
- **Everything at full.** A sign that never hums, flickers or strikes looks printed; a street where everything flickers looks broken. One failing tube at a time.
- **Too many colours on one sign.** Two or three gases per sign; the character keeps one.
- **Aliasing on thin tubes at wide shots.** Keep at least 1.3 px for the outer band and fade fine floor detail at grazing angles.
- **Banding in the dark wall gradients**: dither after tone mapping.
- **Unreadable bent words** at reel size: four to eight letters per tube line, cap height at least 90 px on screen.

## 12. Variation space

The agent decides per video: the street (shops, hotel corridor, workshop bench, a single window), the character and its object of desire, the gases per sign, the weather, the song's sections, and which sign fails and which comes back.

- **Three structures:** a caper (wants, tries, breaks something, flees, puts it right); a tour (sign after sign strikes as the camera walks the street, each one an item or idea); a shift (opening time to closing time, signs on, the rush, signs off).
- **Three openings:** the electrode spark in extreme close-up, pulling back as the sign fills; the whole street dark, then one sign strikes on the downbeat; a whip pan from a wanting eye to the thing it wants.
- **Three endings:** closing time with falling notes and one eye reopening; a revival strike and the full street chasing on the last chorus; the camera pulling back from the hero sign to a wide street in the rain while the stencilled title is lit by its glow.
