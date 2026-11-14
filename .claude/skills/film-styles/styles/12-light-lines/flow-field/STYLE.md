# Flow-field Wind Lines

> Thousands of fine ink streamlines, computed from real data, cover an engraved paper chart; short strokes run along them at the speed of the flow, and the ink turns from charcoal to ochre to vermilion as the flow crosses each threshold. A perspective camera flies over the chart, low and grazing or high and still. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): the first printed wind maps of the late 1600s and the mid-1800s wind-and-current charts drawn with strokes along the wind (direction as texture); engraved admiralty and topographic charts (paper tone, double coastline, hatched relief, a ruled legend box); scientific flow visualisation (streamlines, line-integral textures); generative flow-field drawing (density and line economy). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The chart bleeds to all four edges; the camera is tilted so the haze and horizon sit in the top 15 % (behind the app's header), and the flow fills the rest.

| Zone | Position | Content |
|---|---|---|
| Chart and flow | full bleed | the subject of the flow (eye, current, jet) centred on x 540, y 600–900 |
| Pinned tag | x 72–900, beside its ground point, y 300–1000 | date, value in mono, grade name; leader to the point |
| Legend card | x 96–900, y 300–760, on the chart plane or screen-facing | the threshold table, rows stacked; slides in only when the verdict lands |
| Captions | centred on x 540, ≤ 720 px wide, last baseline y ≈ 1200 | one or two lines on a soft paper wash |

  Stack, don't shrink: the legend and the subject never sit side by side; one is above the other, or the legend replaces the wide shot for its beat.
- **The first 3 seconds.** Frame 1 is already the flow at work: lines running, the camera moving across the chart toward the subject. By 0.5 s the strokes are visibly travelling; by 3 s the colour has turned toward vermilion near the subject and the first number is pinned.
- **Length and pace.** 20–45 s. One camera shot per idea, 4–8 s each, blended (never cut) into the next; one grazing pass as the signature shot; the pull-back to the whole path at the end.
- **Captions.** Burned in on the paper wash (section 5); the legend and tags carry the numbers, captions carry the sentence.
- **Sound.** `tick` for each data point as the path draws, `zoom-swish` on every rise and dive of the camera, `sub-impact` on the threshold moment (landfall, peak, record), `ui-pop` as a tag pins, `clean-ding` as the legend pointer lands on its row. The synthesised wind and a low string-and-piano score (free CC0 libraries such as VS Chamber Orchestra Community Edition and VCSL) carry the rest.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Captions, tags and the legend stay above y 950 and inside x 96–1824.
- **Length and structure.** 3–8 min. One chapter per phase of the flow (it forms, it peaks, it meets land or an obstacle, it comes apart) or per place it passes. Each chapter opens high and still over the chart with its title printed on the chart plane, then descends. Re-hook every 30–60 s with a change of camera height, a threshold crossed (colour change plus pointer), or a pinned record.
- **The first 10 seconds.** The flow at its strongest on frame 1 (the eye, the jet, the flood front), the question by 5 s ("how fast?", "how did it get here?"), the promise by 10 s, pinned as the first dated tag.
- **Captions.** Burned in on the paper wash; export the same lines as `.srt`.
- **Thumbnail.** The grazing pass at the strongest point: vermilion strokes sweeping round the subject, the coastline crossing them, at most three words in the title face on a paper halo.

### Good for

Storms, monsoons and other weather; ocean currents and floods; any flow measured against a threshold; air quality and smoke plumes; migration or traffic shown as a field; science explainers about fluids.

## 1. Essence, and what it is not

1. **The field is computed, never hand-drawn.** Every line is a streamline of a real or modelled vector field at time t; when the data changes, the drawing changes with it.
2. **Ink on paper.** A warm, mottled paper chart with engraved relief; lines are thin dark ink, not light.
3. **Speed is shown twice:** by running strokes that move faster where the flow is faster, and by colour bands tied to named thresholds.
4. **A flying camera over a flat chart.** Perspective, haze toward the horizon, labels printed flat on the chart plane.
5. **The legend is the verdict.** A ruled threshold table on the chart, its row lit and a pointer counting to the value, is the climax, not decoration.

Not **Firefly Pointillism** (points of light on black, no data). Not **Oscilloscope Math** (one glowing beam on black). Not **Circuit Board** (flow as light along fixed copper routes). Not a live wind-particle web map (white specks with fading trails on a dark basemap): here whole ink lines are drawn every frame over an engraved chart. Not a TV weather map: no filled heatmaps, arrows or glossy globe.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Horizon haze | top 0–25 % on low cameras | the chart fades to paper `#ECE0C4` between 2× and 3.6× the target distance |
| Subject of the flow | centred or on the left third, x 500–1100 | the eye, the current's core, the flood front |
| Legend card | right side, x 1120–1840, y 70–850, laid on the chart plane | title (31 px), source code in mono (14 px), six rows (26 px name, 17 px italic gloss, 19 px mono range), the reading in mono vermilion (26 px) |
| Pinned tags | beside their ground point, 14 px offset, leader line | date (36 px), value in mono (38 px), grade name (36 px) |
| Place labels | flat on the chart, next to a ring-and-dot pin (4.5 px ring, 1.6 px dot) | name 34 px semibold, italic gloss 23 px below |
| Path | a dashed line with a dot at each data record | dates in mono 21 px under every fourth dot |
| Captions | centred on x 960, baseline y ≈ 925 | one line on a paper wash |

Keep the legend and the subject on opposite sides of the frame. Text never sits on raw lines: every label carries a 4–6 px paper halo stroke.

## 3. Materials and rendering

- **Paper.** Base `#ECDBB8` with three octaves of world-anchored mottling (at roughly 180, 47 and 13 map-km) of ±1.75 %. A screen-space fibre texture (value noise plus a stretched horizontal grain) blended in `overlay` at 70 %, and a `multiply` vignette from white at a 380 px radius to `#CEBCA0` at 1200 px.
- **Sea and land.** The sea darkens slightly with depth and carries a pale coastal wash over the shelf; land is an umber wash with hill shading (light from the north-west) and engraved 45° hatching on slopes, world-anchored and blended across octaves so it never pops when the camera zooms.
- **Chart vectors.** A graticule every degree (16 % ink, 0.8 px; every fifth at 30 %, 1.1 px), depth contours in blue-grey at 34 %, relief contours in brown at 32 %, and the coastline in two passes: a soft 5 px blue-grey underlay at 22 % and a crisp ink line of 1.1–2.2 px at 86 % (thicker as the camera nears).
- **Streamlines.** Seeds sit on a jittered grid fixed in world space, one grid per level of detail (spacing halving from 1,024 km to 2 km). The level whose on-screen spacing is nearest 36 px is drawn; neighbours cross-fade so density stays constant while zooming. Each line is integrated for a fixed number of steps both ways (half-length 4 spacings, 7 steps per spacing, second-order Runge–Kutta) and tapered at both ends (sin^0.8).
- **Running strokes.** On top of each 1 px base line (62 % alpha), a 2.2 px stroke runs along it like a comet, brightest at its head, occupying 42 % of each cycle. Its phase is the line's time-of-flight compared with one global flow clock, so faster flow means faster strokes.
- **Haze and focus.** Low cameras fade the far chart into paper; outside the area of interest the chart pales a little, like a lifted print.
- **World vs screen.** The chart, hatching, lines and place labels are world-anchored and in perspective; tags, captions, paper fibre and vignette are screen-space.

## 4. Colour logic

- **Paper is the light; ink is the dark.** No black, no white: the darkest ink is a warm charcoal, the lightest value is the paper.
- **Colour means a threshold.** Lines below the first band that matters stay ink; above it they warm through olive, ochre and orange to vermilion at the top band. The same ramp prints the legend, so a colour on the map can be read off the table.
- **One accent:** vermilion is reserved for the top band, the current reading and the verdict row.
- **Cool grey-blue is for water and names on water;** brown for relief.
- **Never coloured:** the paper, the captions (ink only), and the land beneath the lines.

Example palette (from the code):

| Role | Hex |
|---|---|
| Paper / haze / caption wash | `#ECDBB8` / `#ECE0C4` / `#F0E5CB` |
| Ink / secondary ink | `#26221F` / `#3A332C` |
| Names on water | `#3D4A52` |
| Bands, calm → top | `#262C38` · `#2C3A4A` · `#3E525C` · `#705C3A` · `#9E6828` · `#C46C26` · `#C83A24` |
| Accent (reading, verdict) | `#B8432A` |
| Legend card | `#EEE4CC`, 2.2 px ink rule plus a 0.9 px inner rule 7 px inside |

## 5. Type and captions

- **Faces (all SIL OFL).** Newsreader for names and captions, Newsreader Italic for glosses, sources and secondary names, IBM Plex Mono Medium for every number (speeds, dates, pressures, ranges). Noto Serif SC only when CJK place names are genuinely part of the picture.
- **Two kinds of text.** *Printed* text lies flat on the chart plane and tilts with the camera (place names, the title, the legend); *pinned* text faces the screen and hangs from a ground point by a leader (the live reading). Choose per element and keep it.
- **Title.** 52 px bold with +8 % tracking, printed on the chart where the opening shot leaves it, italic subtitle 32 px, source line 24 px.
- **Captions.** Newsreader, 40 px in 16:9 and 54–58 px in a reel, ink `#26221F`, centred, on an elliptical paper wash (`#F0E5CB` at 93 % in the centre, 82 % at mid-radius, 0 at the edge; about 150 px wider than the line). Fade 0.18 s in and out. One language, the spoken one.
- **Hold.** ≥ max(1.8 s, speech + 0.6 s). Numbers on screen are in mono and match the voice exactly.
- **The legend card** builds row by row, 0.14 s apart; the pointer counts up to the reading over about 1 s and its row turns vermilion with a 2 px frame.

## 6. Motion

- **Frame rate.** 30 fps, continuous; nothing steps. The film clock may run faster or slower than data time: a monotone map from film time to data time lets a week pass in seconds and the peak hour take five.
- **The flow clock.** Strokes travel about 95 px/s on screen at the reference speed, whatever the zoom: the clock advances by screen pixels, not map kilometres. Time-of-flight uses speed^0.6, so strong winds look fast without strobing.
- **Data in motion.** Positions between records are interpolated with a Catmull–Rom curve; intensities with a monotone cubic, so nothing overshoots a measured value.
- **Calm stays calm.** Near a calm centre the integration step shrinks with speed (below 2.5 m/s), so lines settle into the centre instead of jittering across it; inside half to one radius of maximum wind the lines fade, which opens an empty eye.
- **Overlays.** Tags and labels fade in over 0.2 s with a cubic ease; the path draws along its length with an ease-in-out; table rows arrive 0.14 s apart.
- **Never moves:** the paper fibre, the vignette and the captions. Seeds never move: lines change shape only because the field does.

## 7. Camera

| Move | What it expresses | Can serve |
|---|---|---|
| High wide drift (1,500 → 1,050 km away, tilt 56° → 50°) | arrival, overview | the opening; where we are |
| Follow and orbit (820 → 330 km, heading swung ~110°, tilt 48° → 34°) | the flow as a living thing | growth, the peak |
| Rise to near-vertical (to 2,500–3,100 km, tilt 14° → 10°) | taking stock | the legend, comparisons, context |
| Grazing pass (150–175 km, tilt 66°, heading swinging) | being there at the worst moment | landfall, impact, a record |
| Exponential pull-back (700 → 3,500 km, tilt 12° → 6°) | the whole life in one look | the ending, the recap |

Distance is interpolated in log space; every move uses a cubic ease in-out; shots are functions of time that overlap by 0.35 s and blend their parameters across the overlap, so the film is one continuous flight. Forbidden: hard cuts, dissolves, wipes, camera shake, roll beyond a few degrees, and any jump of the camera that makes the lines rebuild.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Wind (the lead) | three noise bands (90–420 Hz body, 400–1,600 Hz mid, 1.8–6.5 kHz air) whose levels follow the mean and peak flow speed under the camera, sampled on a 5×3 screen grid every 0.1 s; a narrow whistle whose pitch follows the peak (420 Hz + 24 Hz per m/s); panned toward the strongest flow on screen; slow deterministic gusting | the loudest bed, ≥ 8 dB under the voice |
| Score | low minor-key cellos and double bass in long swells, piano low octaves on the threshold moments, harp notes for legend rows, vibraphone for path records late in the film, timpani on the verdict, a string chord under the ending | music falls almost silent in the grazing pass so the wind takes over |
| Foley | a dry pen tick (20 ms of high-passed noise) for each data point drawn; a 52 Hz thump plus a low rumble on every landfall or impact; filtered whooshes 0.2 s before each rise or dive | |
| Silence | the wind drops to near nothing on the high, still overview before the verdict | |
| Voice | one calm, factual narrator | ≥ 10 dB over the music, ≥ 8 dB over the wind; both dip in 300 Hz–4 kHz under every line |

Master at −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **The eye opens.** As intensity rises the lines curl tighter, warm toward vermilion, and fade inside the radius of maximum wind until an empty eye appears. Fits content like: something reaching its peak; a crisis forming; the calm centre of a busy system.
2. **Crossing the threshold.** Lines change band colour as speed passes a named threshold, the legend row lights, the pointer counts to the value. Fits content like: a metric passing a limit; a ranking or grade; a record broken.
3. **Grazing pass.** The camera drops to 66° tilt close to the surface and sweeps along the strongest edge while strokes rush past and the horizon hazes. Fits content like: landfall; the moment of impact; a close look at one place.
4. **Flow meets terrain.** The up-slope part of the flow is removed in proportion to slope, and the flow weakens over land, so lines bend round mountains and loosen ashore. Fits content like: an obstacle; friction or regulation; a barrier that changes the course.
5. **A whole path in one line.** The camera pulls back exponentially while the path draws as a dashed line, a tick and a dot for each record, dates in mono. Fits content like: a recap; a timeline; a journey summed up.
6. **Coming apart.** As intensity falls the spiral loosens, colour cools to ink, and lines straighten into the background drift. Fits content like: decay; aftermath; dispersal.
7. **Printed on the chart.** The title and place names lie flat on the chart and tilt as the camera flies over them. Fits content like: chapter titles; place introductions; a map-first opening.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- A canvas page drawn from `t` alone, at 1.5–2× size. A WebGL2 full-screen fragment shader prints the chart (paper, depth tint, hill shade, hatching) from height grids uploaded as float textures and a camera ray per pixel; Canvas 2D draws vectors, streamlines and type over it. Map geometry and relief from public-domain sources (Natural Earth, ETOPO1); maps follow [directing](../../../references/directing.md#maps).
- The field is a function `flow(x, y, state)`: a parametric profile driven by a data track (for storms, a Holland-type vortex fitted to the recorded maximum speed and pressure, plus inflow angle and a share of the translation speed), or bilinear interpolation of gridded data (currents, reanalysis winds, river velocities). Work in projected kilometres.
- The streamline engine: fixed world seeds per level of detail, a fixed step count, no collision tests, level cross-fades by on-screen spacing. Bucket segments by colour, alpha and width (quantised to 64 steps) and stroke each bucket once; that keeps tens of thousands of segments per frame fast.
- Text has two helpers: one sets the canvas transform to the chart plane's local frame at a ground point (printed text), one draws in screen space (pinned text); both add a paper halo stroke.
- Camera shots are a table of `{t0, t1, f(t)}` returning target, distance, tilt, heading and field of view; overlapping shots blend over 0.35 s.
- Export the flow speed under the camera every 0.1 s, plus a cue for each record, row, landfall and camera move, to `cues.json`; the wind is synthesised from the speed curve.

## 11. Pitfalls

- **Boiling lines.** Seeds that move with the camera, or collision-based placement, make lines jump each frame; fix seeds in the world and the step count.
- **Density pops while zooming** without level-of-detail cross-fades.
- **Hairlines vanish on phones.** In a reel, thicken base lines to about 1.3 px and strokes to about 2.8 px; the running strokes are what the eye reads.
- **Too many colours.** Colour only above the band that matters; a full rainbow ramp is noise.
- **Moiré** between hatching and streamlines: keep hatching faint (≤ 30 %) and on land only.
- **Unreadable labels over lines.** Always a paper halo; never a label on vermilion strokes.
- **Invented data.** The field must come from a source or be called a model on screen; units on every number; the voice says exactly what the tag shows.
- **Borders and disputed areas.** Draw coastlines and relief, not borders, unless the video is about them; frame regionally and keep disputed areas out of shot.

## 12. Variation space

The agent decides per video: the flow (wind, current, river, smoke, crowd), the data source and the model, the thresholds and their names, the chart's region and projection, which moment gets the grazing pass, and the words of the legend.

- **Three structures:** a life story (forms, peaks, meets an obstacle, comes apart); a threshold story (calm, rising, crossing the named line, the verdict on the legend); a place story (one town or coast, the flow arriving, passing and leaving).
- **Three openings:** a high drift toward a flow already at full strength; a grazing pass on frame 1 that rises to reveal the shape; the title printed on the chart as the first strokes begin to run across it.
- **Three endings:** the exponential pull-back to the whole path with the dated dots; the legend card held with its row lit while the lines cool to ink; the flow dissolving into calm drift until only the paper and one line remain.
