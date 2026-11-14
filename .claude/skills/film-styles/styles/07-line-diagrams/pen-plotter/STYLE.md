# Pen Plotter

> A small machine drawing real data onto real paper, filmed like a tabletop miniature: a lamp-lit sheet in a dark room, a carriage that picks up coloured pens from a rack, and every line, hatch and letter laid down at true machine speed until the drawing ends on one number. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): pen plotters and the generative plotter-art scene (single-stroke lines, hatching instead of fills, a few pen colours, the order of drawing as part of the work); topographic survey maps (contours with index lines, hillshade hatching, graticule ticks, a scale bar); macro tabletop cinematography (shallow focus, one warm practical light, a dark room). Never copy their drawings, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The sheet turns portrait and the camera works above and close; the pen tip is the subject. Paper and machine bleed to every edge; the plotted words and numbers that must be read sit inside x 72–900, y 269–1248, framed large enough to read (plotted letters ≥ 40 px tall on screen).

| Zone | Position | Content |
|---|---|---|
| Pen tip | x 400–700, y 520–900 | the active stroke, in focus |
| Plotted text to read | inside x 120–880, y 320–1180 | single-stroke letters on the sheet, framed by the camera |
| Carriage and beam | enters from the top edge | dark metal, out of focus |
| Vignette | edges, strongest top and bottom | darkens toward the room |
| Caption (if narrated) | centred on x 540, ≤ 720 px wide, last baseline y ≈ 1210 | see section 5 |

- **The first 3 seconds.** Frame 1: a macro of the holder already coming down on a pen in the rack, the lamp pool on the sheet, the half-drawn sheet out of focus behind. By 0.5 s the gripper closes with a click; by 3 s the pen has touched down and the first line is running, and the subject of the drawing (a mountain, a record, a route) is readable.
- **Length and pace.** 30–50 s. Three or four pens, each a section; time jumps on every beat inside a section, one stretch at true speed, one held still frame before the final mark.
- **Captions.** The machine writes the words that matter; captions only if there is narration.
- **Sound.** `latch` when the gripper closes on a pen; `ui-click` on each pen-down tap; `tick` on each time jump; `clean-ding` for a key point plotted; `shimmer` under a relief lift; `sub-impact` when the final ring or number closes. Stepper whine, pen scratch and room tone are synthesised (band-passed noise), or come from a CC0 library such as Freesound; the score (marimba, vibraphone, glockenspiel, harp, pizzicato strings) from VCSL or VSCO 2 CE.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Plotted text that must be read is framed above y 950 and inside the 5 % margins.
- **Length and structure.** 3–8 min. One chapter per pen, and therefore per layer of the drawing: frame and labels (black), the main data (a colour), shading or context (grey), the highlight (red), the final values (black again). Each chapter opens with a pen change at the rack (an insert shot, the colour visible on the barrel) and ends on a pull-back showing the sheet so far. Re-hook every 30–60 s with something the machine does: a pen change, a relief lift, a jump to a new region of the sheet, a ring closing on a value, a switch from map to chart.
- **The first 10 seconds.** The finished sheet glimpsed first (a slow pass across it in the lamp light, 3 s), then a cut back to the blank corner and the holder picking up the first pen. The question by 5 s ("what do these numbers actually look like?"); the promise by 10 s ("by the end the machine will have drawn every one of them").
- **Captions.** Use the platform's captions (`.srt`); burn in only for sound-off cuts.
- **Thumbnail.** A macro of the red pen on the half-drawn sheet, shallow focus, the final number already plotted large beside it, at most three words.

### Good for

Maps and terrain, measurements and records, data drawings (profiles, charts, routes), generative art, "what the numbers look like" explainers.

## 1. Essence, and what it is not

1. **Everything is a stroke.** Contours, hatching, letters, frames, even bold titles (outlined, then hatch-filled): nothing is a fill or a font render. If a pen can't draw it, it isn't on the sheet.
2. **True machine time.** The pen accelerates, cruises and decelerates; it lifts, travels, drops and changes pens at a rack. The film cuts and jumps through that time but never fakes the speed.
3. **The order of drawing is the story.** What is plotted first, outward from where, in which colour, decides what the viewer understands and when.
4. **A real object under one lamp.** Warm pool of light on paper, the room falling to near-black, shallow focus, slight bloom: a physical miniature, not a screen graphic.
5. **Real data.** The drawing is computed from a dataset (elevation, a time series, a route, a measurement), so every line is true.

Not **Line-Art Cutaway** (that is a flat drafting sheet with an object traced in ink; here the paper and machine are a lit 3D scene). Not **Color-Coded Mechanism** (the machine here is the narrator, not the subject). Not a whiteboard or hand-drawn style (no hand, no wobble: machine-perfect lines with a slightly bleeding ink edge).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Pen tip and active stroke | upper-middle third, x 700–1200, y 250–550 | sharp; everything far from it falls out of focus |
| Sheet | fills most of the frame, tilted by the camera | grain, plotted layers, tape at corners |
| Carriage, beam, holder | entering from the top or a side | dark metal, specular edges |
| Lamp pool | centred on the area being drawn | 2–3 stops brighter than the sheet's far corners |
| Room | outside the sheet | near-black, a window with cool night light and blinds, shelves of tubes, all soft |
| Plotted text to read | wherever the shot frames it | ≥ 28 px letter height on screen; key values ≥ 60 px |

There is no screen-space layout: the camera composes the sheet. Keep plotted labels the shot must show away from the frame edges and from the bottom 12 %.

## 3. Materials and rendering

- **A physically lit scene.** three.js standard materials, ACES filmic tone mapping (exposure ≈ 0.45), soft shadows. One key: a warm spotlight from an architect's lamp (`#FFC68E`, cone ≈ 0.8 rad, soft penumbra) clamped behind the sheet; a weaker warm spill (`#FFB878`); everything else is the room's dark.
- **Post.** Ground-truth ambient occlusion (small radius, about 1.8 cm), depth of field per shot, bloom 0.12, a warm vignette (amount 0.62, warmth 0.35), contrast +0.14.
- **Paper.** A canvas texture of the whole sheet (about 10 px/mm), plus high-resolution patches (20–36 px/mm) swapped in for close shots; a 512 px grain tile (base ≈ `#F1ECDF`, ±4 levels of noise, faint brown fibres at 7 %) used as colour and bump; roughness 0.93.
- **Ink.** Each stroke is drawn into the sheet texture with `multiply` compositing, round caps and joins, and its pen's colour and nib width; partly drawn strokes are drawn up to the pen's current distance along them. Hatching and contour layers overlap and darken where they cross, like real ink.
- **The machine.** Bed, rods, beam, carriage, a Z holder with gripper jaws, a rack of pens with colour-coded barrels, a cable chain: built from boxes and cylinders in aluminium, steel, matte black and rubber. A small status window glows green, with no text.
- **Relief lift.** When data has height, a copy of its lines (fat lines, dark brown) rises from the paper at true scale, with a shadow copy sheared onto the sheet, then lies back down.
- **World-anchored:** everything. Screen-space: only captions, if any.

## 4. Colour logic

- **Four pens at most**, each with one job, chosen so they read on warm paper: black for frame, labels and final values; one earthy colour for the main data; grey for shading and context, drawn more transparent; red for the one thing the film is about.
- **Red is spent once per section**: the route, the ring, the highlight. Never for ordinary data.
- **Light colours the scene, not the ink**: warm lamp, cool blue night in the window, near-black room. Ink colours never change with grading.
- **No colour outside the sheet and the pens** except the lamp, the window and the machine's green light.

| Role | Hex | Nib |
|---|---|---|
| Room | `#07080B` | |
| Paper | `#F1ECDF` | |
| Lamp light | `#FFC68E` | |
| Window night | `#1A2C4A` | |
| Black ink (94 %) | `#16161C` | 0.30 mm |
| Brown ink (90 %) | `#763C1A` | 0.28 mm |
| Grey ink (70 %) | `#686662` | 0.20 mm |
| Red ink (93 %) | `#CC221A` | 0.58 mm |

## 5. Type and captions

- **Relief SingleLine** (OFL), a single-stroke face, for every plotted letter: each glyph is a path the pen follows. Sizes are set in millimetres on the sheet (labels 2.6–4 mm, titles larger); bold titles are outlined, then filled with 45° hatching at 0.42 mm. Index values sit in a gap cut into their own contour line.
- **Readability is a camera job**: frame each label the viewer must read at ≥ 28 px letter height, and the final number at ≥ 60 px.
- **Captions** are not part of the look. When there is narration, give YouTube an `.srt`; in a reel, set captions in Inter 500, 40 px, paper colour `#F1ECDF` with a soft dark shadow, centred above the safe line, spoken language only. Hold each ≥ max(1.8 s, the spoken line + 0.6 s).
- **End card**: the title plotted in paper-coloured lines on the dark, letter by letter, with a faint scratch under each line.

## 6. Motion

- 30 fps, continuous; the machine's own motion is never eased by hand.
- **Kinematics.** Pen-down drawing: up to 90 mm/s at 1300 mm/s² (a final number may run at 125 mm/s). Pen-up travel: 260 mm/s at 2600 mm/s². Drop 0.085 s, lift 0.07 s, holder up or down 0.32 s, gripper 0.16 s. Every move is a trapezoid: accelerate, cruise, decelerate.
- **Plot order.** Strokes are ordered as the story needs (outward from a summit, along a route, row by row), then by nearest neighbour inside a layer, reversing lines when shorter.
- **Time warp.** Film time maps to machine time in stretches: real speed inside each stretch, a jump between them. Jumps land on the beat (every 0.5 s at 120 bpm) and can accelerate (the gap grows as the layer fills). A jump is a cut in time, not in angle: the camera keeps moving.
- **Still frames.** One held moment per film where the pen is up and nothing moves except a slow camera creep.
- **Never moves:** the sheet, the lamp, the room; the camera never shakes.

## 7. Camera

Real lenses on a tabletop: field of view 17–42°, aperture chosen per shot (shallow on macros, deeper on overviews), focus always on the pen tip or the line just drawn.

| Move | What it expresses | What it can serve |
|---|---|---|
| Macro at the rack (FOV 34 → 27°, very shallow) | a tool being chosen | openings, chapter starts |
| Overhead pull-back as a layer grows (FOV 30 → 36°) | the drawing spreading | the main data, growth |
| Low angle from beyond the sheet edge (FOV 29 → 25°) | the data as landscape | relief lift, scale |
| Long lens tracking the pen (FOV 17 → 23°) | following a path | a route, a line chart, a timeline |
| Side pan with the pen across the sheet (FOV 28°) | connection between two parts | map to profile, value to label |
| Locked inset with a slow creep (FOV 30°) | "look at this number" | the key values, the held still |
| Pull-out to the whole table (FOV 24 → 42°) | the finished object in its room | the ending |

Transitions: hard cuts between angles, often on the beat; time jumps inside a shot; an insert at the rack between layers. No dissolves, no whip pans, no drone-like flights, no handheld shake.

## 8. Sound palette

- **Every pen has its own instrument**, entering with it: the main data pen on marimba (eighths), shading on vibraphone and bowed strings, the highlight on glockenspiel and harp (one bell per key point, climbing), black labels on pizzicato strings. A single piano note on the first touch-down. 120 bpm, a major key, a climbing figure that returns on violins and horn for the final value.
- **The machine is foley**: a stepper whine whose pitch follows the carriage speed (two coupled harmonics and a little grit); band noise of pen on paper while the pen is down, brighter with speed; a short servo buzz each time the holder moves; a clack as the gripper takes or releases a pen; a light tap on each pen-down.
- **The room**: a faint mains hum and the night outside. Microphone distance follows the shot: close shots louder, wide shots softer.
- **Silence**: everything stops before the final ring or number lands on one chord.
- **Mix**: narration, if any, about 10 dB over everything; master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Pen change.** The holder rises, carries to the rack, sets one pen down, grips the next (a colour visible on the barrel), carries it back. Fits content like: a new layer of data; a new chapter; switching from context to the point.
2. **Growing from a seed.** A layer plots outward from one point (contours from the summit, rings from an epicentre, branches from a root). Fits content like: elevation; spread over time; distance from a centre.
3. **Jump on the beat.** The drawing advances in time-jumps on the music's beats, the gaps growing, then one stretch at true speed. Fits content like: a long dataset in seconds; accumulation; "it took the machine 40 minutes".
4. **Relief lift.** The lines stand up into 3D at true scale, the camera low, then lie back down. Fits content like: terrain; a distribution or histogram; how big a difference really is.
5. **Route and profile.** A red line along the map, a bell at each waypoint, then the same journey drawn as a profile chart beside it. Fits content like: a climb, a race, a journey; any path with a value along it.
6. **The ring.** The pen draws a circle round one value in silence, closing on a chord. Fits content like: the record; the answer; the outlier.
7. **The number last.** The final value written large in single-stroke figures, the camera pulling back to the whole sheet. Fits content like: a height, a total, a date; the end of a countdown.
8. **Plotted end card.** The title drawn in paper-coloured line on black. Fits content like: a series ident; credits; a signature for your app.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Offline first: a Python step turns the data into `plot.json`, every mark as a polyline in sheet millimetres with its pen, its layer and its order (contours by marching squares on the lightly smoothed grid, simplified and rounded; hillshade as two hatch families at ±45° with spacing 0.8 and 1.1 mm; text from the single-stroke font).
- A kinematics module replays that program into timed operations (move, drop, ink, lift, swap), so `plotState(machineTime)` returns pen position, holder height, the pen held and how much ink is down. A warp table maps film time to machine time.
- three.js scene with the lamp, the room and the machine; the sheet as a canvas texture redrawn incrementally (reset when seeking backward), plus close-shot patches; a post chain with ambient occlusion, depth of field, bloom and a warm vignette. Supersample for thin lines.
- Sound events (pen speed, down, holder height, grips, taps, jumps, cuts) are exported per frame from the same state into `cues.json` and the machine foley is synthesised from them.
- For terrain, use public-domain elevation data (for example NASADEM or SRTM via OpenTopography: https://opentopography.org) and follow [directing](../../../references/directing.md#maps) for maps; credit the dataset.

## 11. Pitfalls

- **Fills and font renders.** A filled shape or a rasterised font on the sheet breaks the medium; outline and hatch.
- **Unreadable plotted text.** Letters 3 mm high on a sheet in a wide shot are a few pixels; plan which labels are read and frame them close.
- **Too fast to believe.** A pen moving faster than real limits reads as animation; jump time instead of speeding the pen.
- **Pen-up travel everywhere.** Bad stroke order makes the carriage zig-zag; order by nearest neighbour inside each layer.
- **Ink that doesn't stack.** Normal blending makes crossings flat; use multiply.
- **Dark, muddy frames.** Low exposure plus vignette can drown the sheet on a phone; keep the active area bright and check at phone size.
- **Shimmering hatching.** Dense 0.8 mm hatching aliases in wide shots; supersample, and pick angles that avoid moiré with the sheet's tilt.
- **Seeking.** The sheet texture accumulates; rendering out of order must rebuild it from the program.

## 12. Variation space

The agent decides per video: the dataset and its projection, the sheet format, the pens and what each draws, the plot order, the final value, where the time jumps fall, the room (night studio, daylight lab, workshop).

- **Three structures:** layer by layer, one pen per layer, ending on the number; one continuous path (route, timeline) followed by the long lens, with its profile drawn after; two datasets plotted side by side with the same machine, the comparison in red.
- **Three openings:** the holder picking a pen at the rack; the finished sheet in the lamp light, then a cut back to blank paper; a macro of the pen mid-stroke with the subject already half-drawn.
- **Three endings:** the number written last and a pull-out to the whole table; the red ring closing in silence; the plotted title on black.
