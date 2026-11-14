# Security X-ray

> The picture is a screening console: objects ride a belt through a scanner and come out as glowing density maps, orange where they are organic, green where they are mixed, blue where they are metal, black where nothing gets through. An operator marks, zooms, strips layers away and stamps a verdict, and every reveal is something the machine shows that eyes cannot. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): dual-energy baggage and cargo scanners (the four-colour material code, the scan curtain, the two views); industrial CT inspection (the orbiting volume, slice counters); procedural TV about border and customs checks (one case per bag, a rule, a verdict). Never copy a manufacturer's interface, logo, icon set or typeface, and never name a real airport, agency or machine in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The X-ray view is the hero and bleeds edge to edge; the console's chrome breaks up and stacks around it.

| Zone | Position | Content |
|---|---|---|
| Main view | full bleed x 0–1080, y 280–1060 | the top view, the object at 1.3–1.6× so it fills at least half the band; the object itself stays inside x 72–900 |
| Status chip | x 72, y 296, 52 px high | dot + one status word (scanning, review, clear, stop), 34 px |
| Readout card | x 72–900, y 700–1040, slides up over the lower view | name of the object, the one number, a gauge |
| Verdict stamp | x 110–870, y 1000, 92 px high | green check or red cross, one 40 px line |
| Caption plate | centred on x 540, ≤ 720 px wide, bottom edge y 1240 | one line, two at most |
| Side view and belt | y 1290–1560, full bleed | the second view as moving picture, never text |
| Bezel, clock, counter | above y 270 and below y 1560 | decoration; nothing there must be read |

- **The first 3 seconds.** Frame 1 is mid-scan: the curtain line is halfway across a bag, coloured on one side, grey ghost on the other. By 0.5 s the line has crossed the strange shape; by 1.5 s the operator's box grows round it and the status turns amber; by 3 s the caption asks the question the bag raises. No power-on sequence first.
- **Length and pace.** 20–45 s: two to four bags, a new bag every 4–8 s, one machine zoom per bag, one verdict held at least 1.8 s.
- **Captions.** The plate described in section 5, 44 px, one line; HUD numbers that must be read are at least 40 px.
- **Sound.** `tick` on every scan start, `ui-click` for the operator's keys and the box, `zoom-swish` on each sweep cut, `ui-pop` for readout cards and tags, `clean-ding` on a green verdict, `sub-impact` on a red one, `latch` when the belt stops. The X-ray buzz, belt motor, room hum and a pizzicato groove come from a free sample library.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. The status column and the caption plate stay above y 950; the side view under them is picture only.
- **Length and structure.** 3–8 min. One case per chapter (one bag, one parcel, one product), 40–90 s each: belt in → scan → question → zoom or layer strip → the rule → verdict. The shift clock jumps between chapters and the counter rolls, which carries length for free. Every new silhouette on the belt is a re-hook; save the CT orbit for the middle of the video, and a second, stranger CT for the last chapter.
- **The first 10 seconds.** The strangest image in the video first (already coloured, already boxed), the question by 5 s, the promise ("by the end you'll know what gets through and why") by 10 s. The console's boot comes after, if at all.
- **Captions.** Burned in on the plate; export the same lines as `.srt`.
- **Thumbnail.** The most surprising X-ray, machine-zoomed so the silhouette fills two thirds of the frame, the amber box round it, up to three words in the status font ("ALLOWED?").

### Good for

Airport and customs rules, parcel and cargo inspection, what is inside a product, teardown comparisons, packing tips, "can you take this on a plane?" series.

## 1. Essence, and what it is not

1. **Colour means material.** Hue comes from what an object is made of and brightness from how thick it is. Nothing in the image is coloured for emphasis.
2. **The machine reveals.** Each beat is the console showing more: the curtain uncovers, the zoom enlarges, a layer is stripped, the CT turns the flat shadow into a volume.
3. **An operator is present but unseen.** Boxes are dragged, keys light, the status changes; the viewer sits in the operator's chair.
4. **Every case ends in a verdict.** A rule, a number against it, a stamp.
5. **The world is still there.** The console sits in a room with a window and a clock; time passes behind the screen.

Not **Thermal Camera** (colour there is surface temperature; here it is material, seen through the wrapping). Not a medical radiograph: no greyscale film, no bones. Not a sci-fi hologram HUD: no floating wireframes; every image is a measured shadow on a flat screen, and the chrome is a working tool.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Bezel | x 36, y 26, 1848×996, radius 16 | dark plastic frame, gradient `#1B1E23` → `#0C0D10`, 1.5 px highlight at 10 % white |
| Screen | x 62, y 50, 1796×940 | `#03070C` glass |
| Top bar | text baseline y 80 | lane and mode (20–22 px), voltage, belt speed (live), throughput; the mode label right-aligned to x 1464 |
| Top view | x 80, y 108, 1392×632 | the main image; bag stamp top right, zoom factor bottom left (16–18 px) |
| Side view | x 80, y 752, 1392×214 | the same bag seen from the side |
| Right column | x 1492, 348 wide | clock (y 108–236, 64 px digits), bag counter (y 246–354, 58 px), material legend (y 364–616), keys (y 626–726), status (y 736–966, 32 px word) |
| Readout card | inside the top view's right half, ≈ x 904, y 116, 556×616 | object name, the label number re-set as type, the arithmetic, a gauge, the stamp |
| Caption plate | x 96, bottom edge y 936, 98 px high | see section 5 |
| CT frame | full screen; corner brackets at a 56 px margin | 20 px telemetry top left and top right |

Panels are `rgba(12,22,38,0.6)` with a 1.2 px border at 26 % blue and a 16 px title. Overlays are clipped to the view they belong to. The window behind the monitor shows the outside (sky, lights, an apron or yard) and moves with parallax at 0.45 of the camera.

## 3. Materials and rendering

- **A transmission image, not a render.** Every object is closed meshes, each tagged with a material class (organic, inorganic, metal or a mix) and a density. The scanner sums path length through each class per pixel; a colouriser turns the sums into the image. Hollow things are an outer solid minus an inner one, so walls get their real thickness.
- **Brightness rises, then falls.** Thin material is faint, medium is brightest, very thick goes dark and then black (opaque). Edges are sharpened from the gradient of the attenuation, so outlines glow even in dense stacks.
- **Texture belongs to the object.** Cloth gets a fine woven noise, food and soft goods a lumpy noise, both measured in millimetres on the object and anchored to it, so they move with it and never swim.
- **The scan.** Before the curtain passes, the bag is a pale grey ghost (`#8CA1BF` at about a third); a thin light-blue line (`#96D2FF`) with a soft halo crosses the view, and fresh columns flare briefly as they leave it.
- **The screen.** Bloom from two blurred copies added on top (8 px at 32 %, 26 px at 20 %); 1 px scanlines every 3 px at 13 % black; a faint glass reflection; per-frame pixel noise; a vignette to 38 % black. The operator's box lifts its inside to 112 % and dims the rest to 55 %.
- **CT.** The volume glows additively over a dark radial field (`#08142A` → `#02050A`) with concentric rings every 95 px and spokes that turn with the orbit; it settles out of noise over 0.55 s.
- **World and screen space.** The image, its texture and the boxes on it are world-anchored to the belt; the chrome is anchored to the monitor; scanlines, noise and vignette are screen-space and drawn last.

## 4. Colour logic

- **Four material colours, fixed meanings**: orange organic, green mixed or light inorganic, blue metal, black opaque. Mixtures land between hues, as on a real machine. They appear only inside the image and in the legend.
- **Ground is navy**: the belt shows through as dark blue with faint stripes; chrome is cool blue-grey.
- **The operator's accent is amber**: boxes, leader lines, count markers, the review status. It means "look here", never "danger".
- **Verdict colours are interface, not image**: green clear, amber review, red stop, as stamps, status and gauge bands; never painted onto an X-ray.
- **Never coloured**: captions (white on dark), the image by meaning, the outside world (it stays night-blue or dawn-grey).

| Role | Hex |
|---|---|
| Organic | `#FF8A1A` |
| Mixed / inorganic | `#6BDC2E` |
| Metal | `#2F7DFF` |
| Opaque | `#000000` |
| Belt ground | `#080F1A` |
| Scan line | `#96D2FF` |
| Chrome text / dim | `#AAC8F5` at 82 % / `#96B4E6` at 55 % |
| Review (amber) | `#FFB23A` |
| Stop (red) | `#FF4A40` |
| Clear (green) | `#60E88C` |
| Caption plate | `#030810` at 84 % |

## 5. Type and captions

- **IBM Plex Mono** (OFL), 400 and 500, for everything: chrome, numbers, readouts, stamps and captions. One face keeps it a machine.
- **Sizes (16:9)**: panel titles 16 px, chrome 20–22 px, legend 21/15 px, status 32 px, clock 64 px, counter 58 px with leading zeros, readout numbers 56–64 px, stamp line 36 px with a 20 px sub-line.
- **Label numbers are re-set as type.** Printed text never shows in an X-ray, so a label is shown as a photo-like card with the figure re-typed large, then the sum worked out in one line beneath it.
- **Captions** sit on a dark plate (`#030810` at 84 %, radius 4) with a 3 px white bar on its left: one line at 36–40 px in 16:9, 44 px in a reel, white `#F2F7FF`. The plate fades in 0.12 s; cues closer than 0.6 s share one plate, which morphs its width instead of blinking. The machine never speaks in captions: chrome text is the machine, the plate is the narrator. One language only, the spoken one.
- **Hold** every caption at least max(1.8 s, the spoken line + 0.6 s); a stamp holds at least 1.8 s.

## 6. Motion

- **30 fps, continuous**; no stepping. The belt runs at a steady speed shown live in the top bar; bags enter at constant speed and decelerate to rest over 0.15–0.5 s (never a dead stop).
- **Eases**: cubic ease-out for boxes, leaders and cards (0.2–0.35 s); cubic in-out for zooms (0.5–1 s) and camera moves; a back ease for count markers; stamps scale 1.25 → 1 in about 0.25 s and arrive at full opacity in 0.1 s.
- **The operator's hand**: a box grows from its top-left corner with corner brackets (22 px) and a dashed outline at half strength; a leader line draws out to its tag with a 5 px dot at the source.
- **Power-on**: panels light 0.1 s apart, each flickering for its first 0.25 s; a calibration bar sweeps the views.
- **Machine states**: amber status blinks at 4 Hz; a motion warning at 8 Hz for 0.5 s; the counter's panel flashes 0.3 s when it rolls.
- **Never moves**: the legend, the panel grid, the bezel (they move only with the camera).

## 7. Camera

| Move | Expresses | Serves |
|---|---|---|
| Slow push on the console from the room (0.72 → 1.04 over 4–5 s) | arriving at a post | openings, the start of a shift |
| Machine zoom inside the view (1 → 1.5–2.9×, 0.5–1 s, with a servo whine) | the operator looking closer | a detail, a label, a hidden part |
| Push onto the readout (1.0 → 1.22) | reading the rule | numbers, sums, thresholds |
| Bag passes and settles | the next case | lists, montages (one bag a second) |
| CT orbit (about 190°, from overhead down to a low three-quarter, pushing in on the detail, field of view 30°) | depth the flat image hid | the reveal, the peak |
| Pull back through the screen to the window (1.15 → 0.5) | time and scale | endings, chapter breaks |

Allowed transitions: the **scan sweep** (the next picture wipes in behind a bright line moving right to left, the belt's direction, 0.22 s for a montage cut up to 0.55 s for a big time jump); a dim **digital tear** (≤ 0.12 s each side) only into CT; the **rescan wipe** of the same bag; camera pushes and pulls. Forbidden: dissolves, white flashes, whip pans, 3D flips, cutting away from the console to live footage.

## 8. Sound palette

- **Machine bed**: room tone, a 100 Hz mains hum, the belt motor (its pitch follows the belt speed and runs down when it stops).
- **Foley from the console**: an X-ray buzz on every scan (120 Hz square wave plus hiss band-passed 2.4–7 kHz); a soft 2 kHz tone at scan start; four clicks 45 ms apart for a box; a servo whine on each zoom; a pop per card; a two-tone alarm (1760/1320 Hz); a tone and bell for clear; a low 220 Hz buzz (0.4 s) for no; a falling noise sweep when a layer is stripped; a crackle and a 48 Hz thump at the tear; a falling whine at power-down.
- **Music**: a 120 BPM groove (cello spiccato sixteenths, plucked bass, off-beat hats, plucked chords) in a minor mode; suspense pads under the reading; a plucked walk with staccato bassoon for absurd cases; harp and glockenspiel for a warm ending. Cuts and scans land on the beat.
- **Silence**: drop the groove a beat before a CT or a big verdict; let the hum alone carry it.
- **Mix**: voice about 10 dB over the music, the music band-cut 300 Hz–4 kHz while the voice speaks; foley steps back 30 % under the voice. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Curtain reveal.** The grey ghost turns to colour as the scan line crosses it. Build: a split position in the colouriser; ghost on one side, the image plus a fading flare on the other. Fits content like: a mystery object; a before/after; a "guess what this is" opener.
2. **Material tells.** A shape you assumed was one thing glows the wrong colour (metal blue inside a soft orange toy). Build: assign classes honestly per part; let the legend light the matching swatch. Fits content like: counterfeits; hidden parts; "what is it really made of".
3. **Layer strip.** A key removes the organic channel with a wipe; clothes and food vanish and only metal and glass remain. Build: multiply the organic sum by (1 − 0.94 × mask) behind a moving front over 0.5 s, dim the orange swatch. Fits content like: finding the one thing in a full bag; product internals; signal versus noise.
4. **Black means look.** A dense stack goes opaque; the operator zooms and the outline still reads. Build: the brightness curve falls past a thickness; edges stay lit from the gradient. Fits content like: shielding; packed food; why a bag gets opened.
5. **Rescan.** The removed item is gone in a new image that wipes over the old one with a light line. Build: render twice and clip the new one from a moving edge. Fits content like: fixes; "take it out and try again"; a corrected mistake.
6. **CT lift.** The flat shadow becomes a turning volume; a moving part leaves a ghost of its earlier pose, and the machine flags it. Build: same meshes, colouriser in additive mode, an orbiting perspective camera, a second pose drawn faintly a few frames behind. Fits content like: a living thing; a mechanism; the twist of the video.
7. **The number on the label.** A photo-card of the label slides in, the figure is re-typed, the sum works out, a needle drops onto a three-band gauge. Fits content like: battery and liquid limits; weight allowances; any rule with a threshold.
8. **Shift time-lapse.** One bag a second on the beat, the clock jumping, the counter rolling. Fits content like: volume and scale; a day in a job; a montage of a category.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js for the scan: each mesh uses a double-sided `ShaderMaterial` with additive One/One blending and no depth test; front faces write minus the view distance, back faces plus it, times density, into R (organic), G (inorganic) or B (metal) of a float or half-float target at 1.25× resolution. The sum is path length per class.
- A full-screen colouriser: high-energy attenuation `11·R + 30·G + 150·B`, low-energy the same with factors 1.45, 2.2 and 3.1; their ratio picks a hue on an orange → green → blue ramp, brightness `(1 − e^(−1.7A))·e^(−0.62·max(A − 1.3, 0))`, plus an edge term from the attenuation gradient. A mode flag switches to the additive CT look.
- A 2D canvas composites the frame: the outside world on a half-resolution canvas with parallax, the bezel, the views blitted from the WebGL canvas, two blurred `lighter` copies for bloom, chrome, overlays clipped to their view, then scanlines and vignette. A 2D camera transform (x, y, zoom) wraps the whole console.
- A film-time → story-time table lets verdicts hold longer without retiming the rest; every cut, scan, mark, zoom and stamp also goes to an events list that drives the sound cues.
- Seed every random choice (texture noise per object, per-frame noise from `floor(t·30)`), so any frame renders the same on any seek.

## 11. Pitfalls

- **Colouring for emphasis.** Once a hue means "important" instead of "metal", the whole code collapses. Emphasis is the box, the zoom and the dim outside it.
- **Wrong densities.** Too thin and an object vanishes into the belt; too thick and everything is black. Tune each object until its outline and its inside both read at phone size.
- **Text inside the image.** X-rays don't show print; labels, brands and numbers live on cards and chrome.
- **Chrome as must-read.** 16–22 px console text is texture at phone size; re-set what matters on a card.
- **Bright tears.** A white flash or a bright glitch over an additive image blows out; keep tears dim and short.
- **Teaching evasion.** Never show how to hide something from a scanner. Show rules, limits and verdicts, sourced from the authority that sets them; invent the console, the lane and the counts.
- **Real marks.** No real airport, agency, carrier or product logos on the console, the bags or the labels.
- **A frozen console.** Nothing still for over a second: run the clock, the belt stripes or the bloom.

## 12. Variation space

The agent decides per video: the place (airport lane, mail sorting, port cargo, a factory line), the time of day outside, the objects and their materials, which verdicts land green or red, the fictional lane and operator, the music's mode.

- **Three structures:** a shift (bags of rising strangeness, one CT in the middle, the count at the end); one object in three passes (top view → layer strip → CT); a rule tested on three cases that sit just under, on and over its line.
- **Three openings:** the curtain mid-way across a mystery silhouette; a machine zoom slamming into an opaque black mass; a motion warning flashing on an organic shape.
- **Three endings:** the belt runs down and the console powers off panel by panel; a pull back through the window as the sky turns to dawn; the shift's ledger with the final count rolling to its number.
