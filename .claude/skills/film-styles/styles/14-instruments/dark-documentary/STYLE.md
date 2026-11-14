# Radar Sweep Documentary

> A black world that exists only where a scanning beam has passed: terrain, machines and sites light up in a cold blue as the beam crosses them, then settle into contour lines, range rings and edge echoes that slowly fade. A second scan can rewrite the same place into another time. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): lidar and sonar survey imagery (a world built from returns, contours and range rings); night-time science documentaries (patience, one subject, a slow camera); planetarium and observatory graphics (thin type, spaced capitals, a single warm light in the dark). Never copy their interfaces, typefaces, footage or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The subject stands tall in the middle of the frame with sky above it; the beam crosses the full bleed, and the type stacks in the safe box.

| Zone | Position | Content |
|---|---|---|
| Terrain and sky | full bleed | the beam crosses bottom → top or left → right; range rings and contours run to the edges |
| Subject | centred on x 540, y 420–1150 | at least a third of the frame height, low camera, a clean silhouette against the sky |
| Title or chapter | x 72, baseline y 330 | Plex Sans 200, 88 px; a mono line (26 px) under it |
| Readout | x 72–900, y 1000–1120 | one big figure (Plex Sans 200, 72 px) with a 24 px mono label above |
| Caption | centred on x 540, ≤ 720 px wide, baseline y 1210 | Plex Sans 300, 46 px, one line, two at most |
| Corner ticks | 40 px from each edge | decoration |

- **The first 3 seconds.** Frame 1 is never black: the beam is already a third of the way across, the ground behind it glowing, the base of the subject catching light. A ping lands on the first beat (0 s); the subject is fully lit by 1.5 s and its rim light comes on; the question is written on by 3 s.
- **Length and pace.** 25–45 s at 96 BPM: one sweep, one rescan or one change of space, one held moment of near-silence, one final ping.
- **Captions.** The plate-less caption of section 5, at 46 px; any label the viewer must read is at least 24 px.
- **Sound.** `sub-impact` as the first scan ignites, `shimmer` when the subject is revealed, `typing-tick` under labels being written, `latch` when a machine locks into position, `zoom-swish` on scan wipes. Sonar pings, wind, drones and bowed vibraphone from a free sample library.

### YouTube (1920×1080)

- **Layout.** Section 2 as written; captions and readouts stay above y 950, inside 96 px margins.
- **Length and structure.** 3–8 min, in chapters of 40–90 s. Each chapter opens with its own scan: a new space (the site, the target, the room where it was received) or a rescan that moves the same place to another time. The beam itself is the chapter card: it writes the chapter title as it passes. Re-hook every 30–60 s with a ping, a rescan, a threshold crossed on a strip chart, or a cut into a new black space that has to be scanned to be seen.
- **The first 10 seconds.** The strongest image first: the subject half lit, the beam still moving. The question (a date, a risk, a number against a limit) written on by 5 s; the promise of the video said by 10 s. The title can come after that, written by the beam.
- **Captions.** Burned in as the look requires; export the same lines as `.srt`.
- **Thumbnail.** The subject at the moment the beam crosses it: half echo-blue, half black, the rim lit, one warm point of light, up to three words in thin Plex Sans.

### Good for

History of science and engineering, archaeology and reconstructions of sites, astronomy and deep-space tracking, survey and mapping stories, "the night it nearly failed" pieces, anniversaries.

## 1. Essence, and what it is not

1. **Darkness until measured.** Nothing is lit by a sun or a lamp; everything visible has just been swept by the beam or is fading after it.
2. **Echoes, not surfaces.** Surfaces stay nearly black; what reads are edges, contours, rings and grid lines, cold blue and glowing.
3. **Scans carry time.** A second sweep rewrites the world: night to storm, then to now, ruin to reconstruction. The edge of the new scan erases the old labels as it passes.
4. **Thin type written by light.** Every word arrives under a scanning bar with a bright leading edge, and leaves when the next scan arrives.
5. **One warm thing.** A single warm accent marks the signal, the target or the payoff; everything else is cold.

Not **3D Map Explainer** (that is lit daylight terrain with data on it; here the world is black and the data is the light). Not **Security X-ray** (that sees through objects and colours by material). Not a radar screen: there is no round display and no rotating arm; the beam moves through the world itself. Not neon sci-fi: no cyan grid floors, no glow on everything, no panels.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Subject | left or right third, rising from a horizon at y 650–780 | 30–45 % of frame height; sky and stars or cloud fill the other two thirds |
| Title block | x 96, baseline y 178 | Plex Sans 200, 64 px; a short rule (46 px) at y 258; mono date line 14 px at y 288; coordinates 12 px at y 312 |
| Subject tag | 300 px left of and 40 px below the subject's base | angled leader; name 13 px mono over a 12 px descriptor |
| Point tags | on the terrain | a 10 px cross, a 20 px stem, an 11 px mono label above |
| Readout | at the end of a dashed reference line from the subject | Plex Sans 200, 56 px figure; 14 px mono label 52 px above; a 14 px note 30 px below |
| Strip chart | x 130, y 170, 560×220 | a scrolling trace, a dashed limit line, labels in mono |
| Caption | x 132, baseline y 920 | a 1 px vertical rule at x 114; see section 5 |
| Corner ticks | 40 px from each corner, 16 px arms | 20 % grey |

No boxes and no panels: text sits on a **quiet patch**, a soft black radial shadow (55–80 %) a little larger than the text. In daylight scenes the patch fades to a quarter, because a dark blot would show on a grey sky.

## 3. Materials and rendering

- **The scan.** A front moves across the ground along one direction. Each point's brightness is the sum of a narrow Gaussian beam (1.6–2 m wide, with a 10 m halo), a short exponential afterglow (70–120 m behind the front) and a long faint trail (400–520 m). Ahead of the front, nothing exists. A faint vertical light curtain stands over the beam, fading with height. The previous scan keeps fading behind the new one, so two times briefly overlap.
- **Terrain.** Height-field ground, nearly black, carrying world-anchored lines: contours every 1 m of height, range rings every 100 m around the subject, a 25 m grid at a quarter strength, and faint lines every 7 m parallel to the beam. All lines are antialiased in the shader and fade out where they would alias in the distance. Fog closes in from about 2,600 m (1,500 m in storm).
- **Objects.** Simplified models with near-black surfaces lit only by the beam, plus every hard edge drawn as an additive echo line. After the reveal, a cold rim light keeps the silhouette readable while the afterglow fades. Panels and dishes can carry a fine panel grid that lights with the beam.
- **Motion echoes.** A moving part leaves three or four ghost copies, each about 0.11 s behind the last, at 24 % strength falling by 0.72 each.
- **Sky.** Night: a near-black gradient, stars and a soft star band, revealed only behind the first scan. Storm day: a layered grey cloud deck, brighter toward the horizon. Weather is streaks of line echoes that wrap around the camera.
- **Pings.** A ring expands from the subject across everything (radius `R·(1 − e^(−t/τ))`, fading as it goes, with a trail behind it): small when something locks, large at the end.
- **Post.** Bloom (strength 0.5, radius 0.5, threshold 0.6), a vignette darkening the corners by about 20 %, a soft highlight roll-off, and ±1/255 dither against banding. World lines are world-anchored; type, ticks and the dither are screen-space.

## 4. Colour logic

- **Black is the ground**, not dark blue. The frame is mostly true black.
- **One cold hue for everything measured**: beam, echoes, contours, rings, rim light. Brightness says how recently it was swept.
- **One warm accent per video** for the signal or the target (a moon, a lamp, a received picture, a glint at the payoff). It appears late and rarely.
- **Red only for limits**: a threshold line, an alarm word, a value past the limit. Never for mood.
- **Daylight is grey**, overcast and neutral; never blue sky, never colour grading.
- **Text is grey in three tiers** (bright, mid, low); labels on the terrain may take the echo colour.

| Role | Hex |
|---|---|
| Ground | `#000000` |
| Echo (beam, lines, rings) | `#B3DBFF` |
| Rim light | `#80B3FF` |
| Text bright / mid / low | `#EEF2F6` / `#C4CED8` / `#96A2B0` |
| Terrain labels | `#BEDCFF` |
| Warm signal | `#F2C48D` |
| Limit | `#FF8C78` |
| Storm sky, dark → light | `#101215` → `#3B3F44` |

## 5. Type and captions

- **IBM Plex Sans** (OFL) at weight 200 for titles (64 px) and big readouts (56 px), 300 for captions. **JetBrains Mono** (OFL) at 300 for every label, in capitals and letter-spaced 1.2–2.6 px, at 11–16 px in 16:9. Labels are drawn character by character so the spacing is exact.
- **Written by the scan.** Each line reveals left to right behind a clip that grows with an ease-out over 0.45–0.7 s, led by a 1.2 px bright vertical edge; lines in a block start 0.18 s apart. Blocks fade in 0.25 s, or are erased by the edge of the next scan.
- **Captions** have no box: one line of Plex Sans 300 at 34 px in 16:9 (46 px in a reel), `#ECF0F5`, letter-spaced 0.6–2 px, on a quiet patch, with a 1 px echo-coloured rule (55 %) to their left. They fade in over 0.18 s from 0.15 s before the line starts and out over 0.2 s. One language only.
- **Hold** every caption at least max(1.8 s, the spoken line + 0.6 s), and stay up to 0.45 s past the end of the line.
- **Numbers** use the field's own units and notation (degrees and arcminutes, metres, km/h, UTC times); an illustrative trace is labelled as such.

## 6. Motion

- **24 fps**; the scan and the cuts follow a 96 BPM grid (0.625 s a beat).
- **Pulse and glide.** On each beat the front surges forward with an ease-out, then glides: about 60 % of each beat's travel in the first 0.7 of it. Later scans move at a constant speed after a short ease-in.
- **Machines move like machines**: slow eased tilts and turns on motors, then a lock. A force (wind, impact) answers with a damped rattle, `e^(−3x)·|sin 17x|`, never a bounce.
- **Camera wobble** is a sum of three slow sines, amplitude 0.0015 rad when calm and up to 0.03 rad in a gust.
- **Light fades, objects don't.** Afterglow decays exponentially; nothing pops on or off.
- **Never moves**: written text (no drift, no float), corner ticks, stars relative to the sky.

## 7. Camera

| Move | Expresses | Serves |
|---|---|---|
| Slow dolly forward over the terrain, easing in to ≈ 2 m/s, field of view 36° | patience, approach | openings, arrival at a site |
| Low side view orbiting a few degrees across the shot, field of view 40° | measuring the subject | angles, sizes, limits |
| Close detail with force-driven shake (42–44°) | strain, risk | the crisis, the near-failure |
| Low wide from behind the subject | waiting, scale against the sky | the pause before the turn |
| Schematic space (a globe, a cross-section) entered by its own scan | the link between places | distances, signals, routes |
| High wide pull-back, field of view 46° → 38° | resolution, aftermath | endings |

Allowed transitions: the **scan wipe** (the outgoing view wiped left → right by a bright vertical edge over 0.5–0.55 s, ease-in-out, the new space already being scanned behind it); the **rescan in place** (same camera, the world rewritten); a **match cut** into a screen whose picture grows to fill the frame; a **collapse** of that screen to a vertical line that becomes the next beam; one squared fade to black at the very end. Forbidden: dissolves, white flashes, glitches, cuts to photographs or archive footage.

## 8. Sound palette

- **Pings**: a sine with a short second harmonic, attack 4 ms, decay τ ≈ 0.18 s, with two echoes at 0.21 s and 0.42 s; one per beat of the sweep, pitched on a major pentatonic around D6 (1174.7–1760 Hz) and panned left to right with the beam. Each rides a band-passed noise surge (1.8–7 kHz).
- **Ignition**: a 41 Hz sub drop with a rush of high air. **Reveal**: one inharmonic bell ring (partials over D4) as the subject lights.
- **Rescan**: a long low air surge and a darker ping a fifth lower.
- **Machines**: motor hum near 52 Hz with harmonics, gear ticks every 0.31 s, a metal clank on the lock.
- **Ambience** follows the time state: a still night, then wind and rain hiss with roaring gusts; a thin radio hiss in space; a muffled room tone indoors; a 50 Hz line buzz under any old screen.
- **Score**: a contrabass drone on D, bowed vibraphone fifths, glockenspiel sparks when the sky appears; for danger, low cellos in a minor key, tremolo violins and timpani on each blow; near-silence before the turn; a vibraphone pulse on half beats that builds; one bright major chord with a harp roll at the payoff. A medium room reverb over the music.
- **Mix**: narration about 10 dB over the bed; music ducked about 45 % and dipped 300 Hz–4 kHz under the voice. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **The sweep.** The beam crosses on the beat, one ping per beat, and the subject lights at the moment the front reaches it. Build: one scan uniform shared by every material; time the front so it reaches the subject on a downbeat. Fits content like: the first look at a site; an instrument introduced; a landscape that matters.
2. **The rescan.** A second scan rewrites the same place into another time while the old one fades behind it; old labels are erased by its edge, new ones written on behind it. Fits content like: then and now; the day it happened; ruin versus reconstruction.
3. **Range ping.** A ring leaves the subject and runs across the terrain and objects. Fits content like: a signal sent or received; a lock achieved; the ending.
4. **Motion echoes.** A moving part leaves a trail of fading copies, so motion stays readable in a dark world. Fits content like: a machine at its limit; a structure flexing; a sequence of positions.
5. **Written by light.** Titles, readouts and dates appear under the scanning bar. Fits content like: dates and coordinates; a measured value; a chapter title.
6. **The limit line.** A scrolling strip chart crosses a dashed red threshold; the label for the spike writes on. Fits content like: wind and load limits; temperatures; any "it went over" moment.
7. **Into the screen and out.** A monitor's picture grows to fill the frame; later it collapses to a line, and that line becomes the next beam. Fits content like: a broadcast; data arriving; the switch from witness to world.
8. **A space that must be scanned.** A cut into total black: the new space appears only as its own scan crosses it. Fits content like: the far end of a link; an interior; the target of the search.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js with custom `ShaderMaterial`s that share one uniform block: the scan front's position along a ground direction, the previous front, the beam intensity, ping radius and strength, the rim and daylight amounts. Every material computes its own brightness from its world position against that front.
- Near-black surface shading (Lambert plus rim) with the beam, glow and trail terms added in the echo colour; hard edges as `EdgesGeometry` (25–30° threshold) in an additive line material; terrain lines from `fract` with `fwidth` antialiasing, faded out where they would alias.
- Post with `EffectComposer`: render, `UnrealBloomPass(0.5, 0.5, 0.6)`, then a grade pass (vignette, `c / (1 + 0.25c)`, dither) into a half-float target with 4× MSAA at pixel ratio 2.
- Scan wipes render two views at once (two renderers or two targets) and clip the outgoing one with an `inset()` that moves with the edge.
- All type on a 2D canvas over the WebGL view: 3D points projected to place tags, letter-spaced text drawn per character, clipped reveals with a leading edge, radial quiet patches instead of boxes.
- Every ping, reveal, rescan, motor run, lock, gust, alarm and wipe goes from the same timeline into an events list that drives the sound.

## 11. Pitfalls

- **Black frames.** The look starts from black; a first frame or a cut that lands on nothing is dead air. Start each scan 0.2 s before its cut.
- **Glow everywhere.** If surfaces are lit, or the bloom threshold is low, the world turns into neon soup. Surfaces stay near black; only the beam and edges glow.
- **Aliasing.** Contours and grids crawl in the distance; fade them by their screen-space density.
- **Scans without a reason.** Each scan must bring a new time or a new space; a sweep that changes nothing is wallpaper.
- **Unreadable labels.** 11–16 px tracked mono is atmosphere at phone size; anything that carries the story is a caption or a big readout.
- **Blue daylight.** Day is grey; colour grading toward blue or teal breaks the single-hue rule.
- **Presenting drawings as archive.** Models are simplified from published shapes; illustrative traces and pictures are your own and say so in the credits. Dates, numbers and events come from sources.
- **Panels and boxes.** A boxed HUD turns it into a security console; keep the quiet patches.

## 12. Variation space

The agent decides per video: the subject and its site, the time states the scans move between, the scan direction and speed, the warm accent, the weather, the key of the score.

- **Three structures:** a calm night, then a rescan into the day it mattered (the rescan is the turn); three spaces linked by one signal (source → target → receiver), each entered by its own scan; a reconstruction (scanned as it is now, rescanned as it was, then back).
- **Three openings:** the beam mid-sweep lighting the subject's base on the first beat; a ping ring already crossing dark terrain toward the subject; a readout being written beside a half-lit machine.
- **Three endings:** a last ping runs out to the horizon as the music resolves and the world sinks back to black; a high pull-back while the afterglow fades; a screen collapses to a line that becomes one final beam.
