# Thermal Camera

> A handheld infrared camera surveys an ordinary scene and shows where the heat is: the world is rendered twice, once as a dark night picture and once as apparent temperature mapped to an iron palette, and a sweeping split line, spot meters, a temperature scale and an alarm colour turn the invisible into evidence. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): building energy surveys and the screens of handheld thermal imagers (spot meter, colour scale, isotherm, time stamp); wildlife-at-night documentaries (patience, a warm body found in the cold); before/after inspection reports. Never copy a camera maker's interface, logo, palette names or fonts, and never name a real product in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The thermal picture bleeds to all four edges; the camera's screen furniture moves inside the safe box.

| Zone | Position | Content |
|---|---|---|
| Picture | full bleed | thermal, visible, or both on either side of the split line |
| Subject | centred, y 360–1150 | at least a third of the frame height; the hot spot inside x 72–900 |
| Colour scale | x 846–870, y 420–1080 | 24 px bar; end values above and below at 34 px |
| Spot meter and reading | next to the spot, kept inside x 72–820 | reading at 44 px, a label at 32 px |
| Caption | centred on x 540, ≤ 720 px wide, baseline y 1200 | Inter 500, 46 px, dark halo |
| Time stamp | x 72, y 1236 | 26 px mono; decoration |

  Comparisons stack: before on top, after below, divided by a horizontal white line.
- **The first 3 seconds.** Frame 1 shows a familiar thing half thermal, half visible, the split line already a third across. By 0.5 s the line has passed the surprise (a glowing seam, a cold patch, a warm shape); by 1.5 s a spot meter locks on with its beep; by 3 s the reading and the question are both on screen.
- **Length and pace.** 20–45 s at a 72 BPM pulse: one sweep, one zoom or span change, one alarm, one answer. Hold each reading at least 1.8 s.
- **Captions.** As in section 5, 46 px in a reel; readings ≥ 44 px.
- **Sound.** `tick` for each meter lock, `ui-click` when the span or palette changes, `metallic-riser` under a long zoom, `ui-pop` for labels, `clean-ding` for a good verdict, `sub-impact` when the isotherm alarm trips. Wind, a camera fan, water and the score from a free sample library.

### YouTube (1920×1080)

- **Layout.** Section 2 as written; readings and captions stay above y 950, the scale inside the right 5 % margin line.
- **Length and structure.** 3–8 min. A survey in chapters of 40–90 s, each one place or one question (the outside, the windows, inside the walls, the roof, the surprise, the report). Each chapter starts on visible light and earns its thermal reveal with a sweep. Re-hook every 30–60 s with a span squeeze that reveals hidden structure, an isotherm alarm, the tracker jumping to a new hottest point, or a warm living thing found in the cold.
- **The first 10 seconds.** The strongest thermal image first (the leak glowing, the seam burning); the question by 5 s ("where is the heat going?"); the promise by 10 s ("by the end you'll see what fixing it changes").
- **Captions.** Burned in with halos; export the same lines as `.srt`.
- **Thumbnail.** The split frame at its best: one half dark visible, one half iron palette, the hot spot crossed by the line, a reading of it, up to three words.

### Good for

Building and energy inspection, wildlife at night, machines and electrics, cooking and kitchen science, sport and the body, "where does the heat go" explainers.

## 1. Essence, and what it is not

1. **Two pictures of one world.** Every frame exists as a dark visible image and as a temperature image; the drama is the line between them.
2. **Measured, not tinted.** Colour comes from apparent temperature through a stated range, and the scale says which range. Readings are read off the same image.
3. **Physics on screen.** Glass reflects the cold sky, shiny metal lies, warm water shows through plaster; the style teaches by showing these honestly.
4. **The camera's own furniture.** A crosshair spot meter, a box with an average, a hot-spot tracker, a scale bar, a time stamp; white with dark halos.
5. **A survey with a verdict.** Look, find, explain, compare before and after.

Not **Security X-ray** (that sees through objects and colours by material). Not **Radar Sweep Documentary** (a black world revealed by a beam). Not night vision: no green intensifier glow, no scanlines. Not a data heat map: the colours belong to surfaces in a 3D scene, not to a chart.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Picture | full bleed | visible, thermal, or a split |
| Subject | centre or a third, 40–70 % of the frame height | buildings frontal; small subjects tight with shallow depth of field |
| Colour scale | x 1838, y 170–880, 18 px wide | iron gradient, 1.2 px white outline, ticks every 1, 2 or 10 °C; end values 24 px above and below; the unit 20 px on top |
| Spot meters | on the measured point | crosshair 14 px radius; reading 34 px to one side, label 28 px and a sub-label 22 px under it |
| Area box | round the region measured | 2 px white with 14 px corner brackets; its average in the same reading style |
| Labels | at the end of a leader line | 1.8 px white leader with a 4 px dot at the point |
| Alarm legend | top left, x 46, y 52 | a 22 px swatch and the threshold in 24 px |
| Caption | centred on x 960, baseline y 900 | see section 5 |
| Time stamp | x 46, y 1028, 22 px mono | date and time of the survey; decoration |

Everything that must be read sits on the picture with a 5 px dark halo, never on a panel; only a verdict gets a box.

## 3. Materials and rendering

- **Two passes per frame.** Every mesh carries a visible material and a thermal material, swapped per pass.
- **The visible picture** is a night scene: HDR with bloom from lamps and windows, an ACES tone curve, a grade that cools the shadows and warms the highlights, a 28 % vignette, and depth of field (48-tap disc) when the camera is close.
- **The thermal picture** writes apparent temperature in °C, not a colour. A surface's true temperature is a base value plus a gradient, up to six soft hot spots, an offset for faces that point up (snow, frost) and fine noise; the camera reads emissivity × that + the rest × the temperature of what it reflects. Emissivity falls at grazing angles; the reflected environment is a cold sky above (−11 → −26 °C in a winter night) and the ground below. So glass shows the sky, not the room.
- **The sensor.** Rendered at 3× and blurred down to a 640×360 detector: per-frame noise, column and row fixed-pattern noise, a little darkening toward the corners. That buffer is read back so every reading on screen is measured from the picture.
- **The display.** Bicubic upscaling of the detector, detail enhancement (the image minus its local mean, ×0.55), a faint edge emphasis from depth so outlines read, the iron palette mapped through the shot's range, the isotherm overlay, and per-frame grain. Texture and hot spots are world-anchored; the HUD, scale and grain are screen-space.

## 4. Colour logic

- **The iron palette is the only colour in the thermal image**: black → indigo → violet → magenta → red → orange → yellow → near-white as the temperature rises through the range.
- **Range is a decision.** Each shot has a level and span (a winter facade about −9 → 7 °C; a 10 °C span to find faint structure; −10 → 36 °C when a body is in frame). The scale always shows it.
- **One alarm colour**: green, for everything above a threshold. It never appears anywhere else.
- **HUD is white** with dark halos. A verdict box is the only filled shape.
- **The visible world** is a real night: sodium-warm lamps, cool shadows, never saturated.

| Role | Hex |
|---|---|
| Iron 0.00 / 0.10 / 0.25 | `#000008` / `#120554` / `#4D0894` |
| Iron 0.40 / 0.55 / 0.70 | `#991294` / `#DB3352` / `#FA7812` |
| Iron 0.86 / 1.00 | `#FFBF21` / `#FFFADB` |
| Isotherm swatch / label | `#2BD14A` / `#B5FFBF` |
| HUD / halo | `#FFFFFF` / `#080414` at 55 % |
| Verdict box fill / line / text | `#0A1E14` at 72 % / `#7DFFA0` / `#C9FFD6` |
| Split-line glow | `#FF8C33` at 10 % |

## 5. Type and captions

- **IBM Plex Mono** (OFL), 400 and 500, for readings, scale values and the time stamp: the camera's voice. **Inter** (OFL), 500, for labels and captions: the narrator's voice.
- **Readings**: one decimal, a true minus sign, the unit after a thin space ("−3.4 °C"), 34 px in 16:9. They refresh at 6 Hz with ±0.1 jitter, so they feel live.
- **Labels**: 28 px with a 22 px sub-line, at the end of a leader; the leader draws out with an ease-out first, the text follows.
- **Captions**: Inter 500, 40 px in 16:9 and 46 px in a reel, white with the 5 px dark halo, centred, one line (two at most in a reel). No plate. One language only.
- **Hold** every caption at least max(1.8 s, the spoken line + 0.6 s). With no voice, labels and readings carry the story; hold each for letters ÷ 15 + 1.5 s.

## 6. Motion

- **30 fps**, continuous; the detector noise changes every frame, the meters every sixth of a second.
- **Camera like a handheld survey**, smooth because it is on a crane or a slider: slow ease-in-out pushes and cranes, a short hold with a slow creep after each zoom.
- **The split line** crosses the frame with an ease-in-out over 1–2.7 s, leaning about 5 % off vertical; a fixed split eases in from the edge in 0.55 s.
- **Spot meters** lock by shrinking from 3.2× to 1× with an ease-out (about 0.3 s) and a beep; boxes draw their outline and corners together.
- **Range changes** step at a click, never fade: the image re-maps on the frame the scale changes.
- **Heat doesn't jump.** Temperatures in the world change slowly (seconds), except a living thing stirring.
- **Never moves**: the scale bar, the time stamp, the alarm legend.

## 7. Camera

| Move | Expresses | Serves |
|---|---|---|
| Frontal push from across the street, field of view 46° | the survey begins | openings, the whole subject |
| Crane up and push in (46° → 38°) | singling out a floor or a part | the first suspect |
| Optical zoom (38° → 16°) and a slow creep | the camera looking closer | a leak, a joint, a detail |
| Lateral truck along a surface, field of view 36°, fixed split | comparing as it passes | hidden structure, a row of similar things |
| Dolly down a row, settling tight (46° → 17°) with shallow focus | finding something alive | the surprise |
| Crane over the top and tilt down | the part nobody sees | roofs, tops, the last suspect |
| Locked frontal view | the report | before/after |
| Pull back wide (20° → 54°) | resolution | endings |

Allowed transitions: the **split sweep** (visible ↔ thermal across a slanted line with a white edge and a warm glow on its thermal side), a hard cut with a soft thump, the **divider** that opens a before/after, a short whoosh into a time jump. Forbidden: dissolves, flashes, palette fades, whip pans.

## 8. Sound palette

- **The camera**: a quiet fan whenever it is on; a sweep sound for each split (a low hum near 110 Hz with harmonics, air and a high hiss); a servo whine for cranes and zooms (rising 260 → 420 Hz, higher for optical zoom); a lock beep for each meter; a 1650 Hz beep and a tick for labels; a 1900 Hz beep for a box; a click and a 2600 Hz beep for a range change; two rising beeps (2900/3500 Hz) when the tracker finds a new maximum; the detector shutter (a clack and a click) every 10–15 s; a soft thump on cuts.
- **The world**: wind as brown noise with slow gusts (louder up high, softer close in), water gurgling in pipes, fur rustle and small sounds from a living subject, distant traffic.
- **Score**: a slow 72 BPM pulse in a minor key; bowed vibraphone and glass shimmer over a low drone for the first sweep; harp eighths over a cello pedal for the survey; a plucked heartbeat for things flowing inside walls; the major key, glockenspiel and harp for the living surprise; strings rising with the crane; a held fifth while the report is read; a warm major chord on the verdict.
- **Mix**: voice about 10 dB over the bed; the music ducks a little under the camera's beeps. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Split sweep.** The slanted line crosses a familiar view and turns it into temperature. Build: one composite pass; a pixel's side of the line `dot(px − A, n)` chooses visible or thermal, with a 1–2 px white line and a warm glow fading over 26 px. Fits content like: a reveal; the first look at a subject; "what you can't see".
2. **Span squeeze.** The range narrows to 10 °C or less and structure appears in what was flat: pipes, studs, cold bridges. Build: change level and span on a click; the scale's end values change on the same frame. Fits content like: hidden services; insulation gaps; "look closer".
3. **Isotherm alarm.** Everything above a threshold turns green, the legend lights, a box lands on the worst area. Fits content like: leaks; overheating parts; fever or effort.
4. **Hot-spot tracker.** A marker jumps to the warmest point and settles. Anchor it to a world point measured over a hold, not to each frame's maximum. Fits content like: a living animal's eyes; a failing joint; the source of a leak.
5. **The honest lie.** Glass or polished metal reads cold because it reflects the sky; a caption explains it. Fits content like: myth-busting; how the camera works; why a reading can mislead.
6. **Before and after.** The locked view splits into two renders of different years or settings, one shared scale; the averages are boxed and the verdict lands. Fits content like: a retrofit; a repair; a product comparison.
7. **Warm thing in the cold.** A dolly settles on a small warm body in a dark frame with shallow focus. Fits content like: wildlife at night; a sleeping animal in a cold yard; the one radiator that works.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js; every mesh registered with a visible and a thermal `ShaderMaterial`, swapped per pass. One uniform block holds time, outdoor temperature and a before/after switch.
- The thermal material writes `ε·T + (1 − ε)·T_env(reflect)` into the red channel of a float target at three times the detector size, with ε dropping as `1 − 0.55·(1 − n·v)^5`.
- A detector pass at 640×360 (7×7 Gaussian optics, temporal noise from the frame number, column and row fixed-pattern noise, lens shading), read back with `readRenderTargetPixels` so spot, box and maximum readings come from the same pixels.
- The final pass: Catmull-Rom sampling of the detector, detail enhancement, depth-edge emphasis, the iron ramp as eight stops, isotherm, the visible picture (bloom, 48-tap depth of field, ACES, night grade, vignette), the split by a line equation, a divider, grain.
- The HUD on a 2D canvas: text with a dark stroke halo, the crosshair drawn twice (offset shadow, then white), the scale as 1 px gradient rows; every readable text registered for the read-check; events (scan, lock, label, box, span, max, shutter, cut) drive the sound.

## 11. Pitfalls

- **Wrong physics.** A window glowing because the room is warm, a shiny pipe glowing with its water: both are wrong. Glass and bare metal reflect; paint, brick and skin emit. People who know thermal will notice.
- **Auto-range everywhere.** If the range changes silently, colours lie. Choose a range per shot and show it on the scale.
- **Too clean or too noisy.** Without detector noise it reads as a filter; with too much it reads as broken. The noise should be visible only on flat areas.
- **Rainbow palettes.** One palette per video; iron reads as heat to everyone.
- **Invented readings.** Read values from the buffer; estimates (heat loss, savings) come from a stated method and are labelled as estimates.
- **Privacy.** Use fictional buildings and never suggest seeing people inside homes; thermal cannot see through walls, and the video must not imply it.
- **Halo-less text.** White text without its dark halo vanishes on the yellow end of the palette.
- **A tracker that jitters** between equally hot pixels; anchor it in the world.

## 12. Variation space

The agent decides per video: the subject (a building, an animal, a machine, a kitchen, a body), season and outdoor temperature, the range per shot, the alarm threshold, whether there is a voice, the before/after pair.

- **Three structures:** a survey (outside → closer → inside the wall → the surprise → the report); a hunt with three suspects, the culprit found by the third sweep; a before/after of the same view a year apart.
- **Three openings:** the split line already crossing a familiar object; an isotherm alarm flashing green on a dark scene; a spot meter locking on with a reading that should not be possible.
- **Three endings:** the report with its verdict box; the split sweeping back to visible as the camera pulls back wide; the tracker settling on a small warm life while lights go out one by one.
