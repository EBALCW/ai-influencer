# Pop Art

> A screen-printed world: three process inks and a black key on warm paper, colour only as solid ink or round halftone dots, plates slightly out of register, and one everyday object stamped, repeated, rotted and recoloured until it says something about the many. The camera lives inside the print, diving through dots and pulling back to walls of copies. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): 1960s silkscreen repetition (Andy Warhol's grids of one image, each pull a little different), enlarged comic dots (Roy Lichtenstein's Ben-Day screens and heavy contours), four-colour comics and supermarket posters of the 1950s–60s, and 1960s exotica records for the score. Take the repetition, the dot as a visible unit, the slipped plates and the flat inks. Never copy their characters, paintings, layouts, typefaces or melodies, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The sheet bleeds to every edge; one subject fills 60–80 % of the width (a 600-unit tile at zoom ≈ 1.4). Grids stack as columns of one or two tiles, never shrunk five across. Must-read text sits in x 72–900, y 269–1248.

| Zone | Position | Content |
|---|---|---|
| Sheet | full bleed, page space | prints, tiles, walls, the object |
| Label | top left at x 84, y 290, rotated −1.5° | Anton 84–100 px line, 40 px second line, paper block with a red or blue offset plate |
| Headline printed on the sheet | inside x 96–880, centred on y 700 | Anton 150–220 px, two short lines, moves with the camera |
| Caption strip | centred on x 540, ≤ 720 px wide, bottom edge y ≈ 1230 | Archivo Black 46–52 px, one or two lines |

- **The first 3 seconds.** Frame 1 is already inside the dots: huge round dots, rotating slowly, pulling out. By 0.5 s they are visibly shrinking; by 1.5 s they resolve into the object; by 2–3 s the headline prints beside it and the first copy stamps next to it, while the voice says the surprising claim about the object.
- **Length and pace.** 20–45 s. A new print, stamp or flip every 1–2 s; one dive or pull every 4–6 s; one held hush (1–2 s, the groove gone) before the turn.
- **Captions.** One paper strip, bottom centre, in the spoken language; its red offset plate sits 7 px down-right. Labels carry the nouns and numbers; the strip carries the sentence.
- **Sound.** `hook-impact` on the first stamp, `thock` on each later stamp and label, `zoom-swish` on dives and pulls, `tick` on ring marks and counters, `latch` when the black key snaps into register, `clean-ding` on the end card. Squeegee drags, paper flicks and the exotica score come from free sample libraries.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. The caption strip's bottom edge stays at y ≤ 936 (above the player's controls); labels stay inside x 96–1824, y 54–936.
- **Length and structure.** 3–8 min in chapters of 40–90 s. Each chapter is one print: one object, one fact, one lead ink. The chapter card is a label slammed on a fresh sheet with the chapter number printed huge behind it; the camera dives through that number into the chapter. Re-hook every 30–60 s with something only print can do: a dive through a letter, a wall flipping colour, a late plate, dots eating a print. Alternate scales: a close-up chapter (dots visible) follows a wall chapter (a hundred tiles).
- **The first 10 seconds.** The strongest image first: out of the dots onto the object (0–2 s); a wall of copies stamping around it by 4 s; the question on a red label by 5 s; the promise by 10 s, spoken over a first tile flipping to a new colour (what the viewer will understand by the end). The title card, if any, comes after.
- **Captions.** The paper strip is burned in as part of the look; export the same lines as `.srt`.
- **Thumbnail.** A wall mid-colour-wave (half the tiles still identical, half flipped to variety), pushed in so the dots show, with one paper label holding at most three words, its first word or number in red.

### Good for

Everyday-object explainers, brand and product posters, small data stories, mass production and sameness, consumer history.

## 1. Essence, and what it is not

1. **Ink, not light.** Every colour is red, yellow or blue ink, or two of them overprinted, on warm paper, plus a black key. Tints exist only as round dots. No gradients, no glows, no transparency.
2. **The dot is a unit you can visit.** The halftone screen lives on the page, so the camera can push until a single dot fills the frame or pull back until a dot is a tint.
3. **Off register, on purpose.** The colour plates slip 1–8 px from the black key; the key never slips. The slip is the hand of the printer and grows with age.
4. **One image, many pulls.** The core gesture is repetition: one object printed again and again, each copy jittered, then changed (recoloured, rotted, flipped) to make a point about the whole.
5. **Labels as paper.** Every word that matters is printed type or a paper label with a coloured offset block, slammed onto the sheet.

Not **Halftone Dossier** (dots there reproduce photos of evidence; here they are the ink of bright drawn objects). Not **Silkscreen Travel Poster** (flat layered inks for places and scenery, no dot screens, no walls of repeats). Not a comic: no panels, balloons or acting characters; the object is presented like a product.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Sheet | full bleed, page space under the camera | paper `#F8F2E2`, prints, tiles; nothing letterboxed |
| Subject | centred or on the right third; fills 40–70 % of frame height | the object, drawn with a black contour |
| Printed headline | page space, left-aligned beside the subject, x ≈ 350 from the subject's centre | Anton 120 px (lines), 250 px (a two-word claim), 520 px (a single number or year) |
| Label | screen space, top left at x 96, y 80; rotated −1.7° to +1.2° | Anton 104–124 px first line, 44–50 px second; a big number at 190 px |
| Stamp | page space, over a print, rotated ≈ −11° | white ribbon 300×112 with red 74 px type and a 6 px black frame |
| Caption strip | centred on x 960, 100 px tall, bottom edge y ≤ 936 | Archivo Black 34–40 px |
| Tile caption | inside the tile, 248 units below its centre | Archivo Black 44 px, letter-spaced 3 px; decoration unless it repeats elsewhere |

Grids use square tiles of 600 page units: a solid ink square, a paper disc of radius 226–238 inside it, the object on the disc rotated −20° ± 30°. Labels exit to the left (1400 px in 0.35 s) before the next one arrives; never two labels at once.

## 3. Materials and rendering

- **Three layers, one print.** Draw into three offscreen canvases: *plates* (the RGB channels hold red, yellow and blue ink densities, 0–1), *key* (black as alpha) and *spot* (a rare unscreened colour). One WebGL2 pass prints them: paper multiplied by each ink at its coverage, then the spot, then the black key on top.
- **Ben-Day dots.** Densities between 0.05 and 0.95 become round dots on a 45° lattice of 5.6 page units (round holes in solid ink above 0.5); each plate's lattice is shifted half a cell. The lattice is anchored to the page, so pushing in makes dots bigger; under ≈ 2–4 px per cell on screen, coverage fades to flat tint.
- **Ink and paper.** Solid ink loses up to 6 % in low-frequency blotches, the key up to 4 %; warm cream paper with fine fibre noise. An age term yellows the paper (×1, 0.96, 0.86) and darkens it in broad patches: 0.12 is fresh, 0.42 is old. All texture is anchored to the paper.
- **Contours.** A black brush ribbon around every object, tapered ends (25 % width), heavier on the side away from an upper-left light, round caps; interior lines at 45 % weight. Width compensates for zoom with an exponent of 0.4, so a pulled-out wall keeps its lines.
- **Shading.** Never darker paint: a second ink overprinted as dots on the shadow side (red 0.34 on a yellow object), and a paper-white tapered sliver along the lit edge.

## 4. Colour logic

- **Four inks and the paper.** Secondary colours only by overprint: orange = red 0.55 + yellow, green = yellow + blue 0.6, purple = red 0.7 + blue; pale sky = blue 0.32 and flesh = red 0.34, both as dots.
- **Each ink has a job.** Yellow is the hero and the positive; blue is the cool ground; red is the claim, the number, the warning and the offset behind labels. Black is only line and type.
- **One lead ink per shot.** Grounds meet at a hard black rule (10 units), never a blend.
- **Decay is density.** Loss is red and blue dots overprinted at rising density until the image goes nearly black-purple.
- **Never coloured:** the black key, and the paper outside a print. No red type on blue or blue on red.

Example palette (from the print pass):

| Role | Hex |
|---|---|
| Paper | `#F8F2E2` |
| Red ink | `#E4232B` |
| Yellow ink | `#FFD21F` |
| Blue ink | `#1E62B0` |
| Black key | `#141414` |

## 5. Type and captions

- **Faces (SIL Open Font License):** Anton for headlines, labels and numbers (condensed, all caps); Archivo Black for captions and anything under 44 px, where Anton clogs. For another script, Noto Sans Black in that script.
- **Type is printed.** The colour fill slides in from 90 px right and 40 px up (ease-out), its red or blue drop plate 9–12 px down-right trailing it; the black outline (4.5 % of the size, at least 3 px) snaps on halfway. Coloured letters knock the black out.
- **Labels.** Paper block, 5 px black frame, solid offset block 12 px down-right (red; blue for the positive), padding 34 × 24 px; lines staggered 0.12 s, each sliding 26 px in over 0.5 s.
- **Numbers.** 190 px in a label, 520 px on the sheet with a 16 px solid red drop. Digits print; they never roll like a counter.
- **Captions.** The paper strip: cream, 4 px frame, red offset 7–9 px, text rising 6 px in 0.14 s. One language, the spoken one. Hold ≥ max(1.8 s, speech + 0.6 s); split a sentence rather than set three lines.

## 6. Motion

- **Frame rate.** 24 fps for YouTube, 30 fps for a reel, every frame drawn; the dots and paper never boil.
- **Easing.** Arrivals ease out; camera moves ease in-out; dives and exits ease in. A landing may overshoot with a back ease of 1.2 (zoom 1.3 → 1).
- **Stamping.** A copy appears in 0.14 s: scale 1.14 → 1 while its colour plates slide from 60 px off register to their resting slip. Wall copies stamp in a ripple, each delayed 0–0.3 s by a hash of its position.
- **The flip.** A tile turns in 0.3 s by scaling its width with |cos(πp)|, the new face swapping in at the midpoint. In a wave, each tile starts 0.13 s × its distance in tiles from the origin, plus up to 0.09 s jitter.
- **Weight.** Resting objects turn slowly (0.06 rad/s); growing things ease out from 16 % to full in 0.5 s. Nothing floats or bobs.
- **What never moves:** the dot lattice relative to the page, the screen angle (45°), the paper texture, and the registration of the black key.

## 7. Camera

One 2D camera (centre, rotation, zoom) for every layer; zoom interpolates in log space.

| Move | What it expresses | What it can serve |
|---|---|---|
| Pull out of the dots (×18 → ×1.5, with 0.55 rad of rotation unwinding, 4 s) | "what you are looking at is printed"; the object assembles from its dots | the opening; a mystery object |
| Pull back to a wall (×1.9 → ×0.4, 1.5–1.6 s) | one becomes many | repetition, scale, mass production |
| Dive (ease-in, 0.4–0.7 s, ×3–×6) into a disc, a letter's counter, a tile | going inside; the next idea is within this one | chapter turns, causes, "zoom into" |
| Lateral pan (2.8 s, ease-in-out) along a strip | sequence, propagation | copies, timelines, spreading |
| Slow push (×1.6 → ×1.9 across a shot) | attention, unease | a held fact, a hush |
| Extreme pull to mosaic (×0.19 → ×0.085) | the tiles are pixels of something bigger | the ending; many make one |

Tilts stay within ±0.035 rad. **Allowed transitions:** the dive, the flip, the next image printing plate by plate, a hard cut on a print slam. **Forbidden:** dissolves (ink can't dissolve), blurs, light leaks, perspective card flips, zooms that scale the dots in screen space.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Score | 1960s exotica at 112 BPM: jazz bass on 1 and 3, shaker eighths, off-beat conga and vibraphone comping, a four-note marimba motif each bar, claps on 2 and 4 when bright, muted trumpet for "the old days", a staccato trumpet lift at a reveal | ducked 45 % under the voice |
| Dark and hush | the groove drops out: bass pedal, bowed vibraphone over two bars, a low conga; before the turn, one contrabass note alone for 1–2 s | |
| Foley: the print shop | squeegee drag (band-passed noise, 0.3 s) then a ≈ 95 Hz stamp thump per print; a short stamp per copy; a paper flick per flip (at most one per 45 ms); whoosh on pulls and dives; a dry paper snap on a hard cut; a crackle bed while dots eat a print | ducked 45 % under the voice |
| Colour wave and end | one marimba note per flip, climbing a major scale every five flips; the end is a spread vibraphone chord (40 ms apart) with glockenspiel | |

A faint room tone under everything. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Out of the dots.** Open at ×18 inside a halftone field, rotated half a radian; pull out in log space over 4 s while the rotation unwinds. Fits content like: "what is this?" openings; a detail becoming a whole; anything mass-made.
2. **The wall of copies.** One print stamps; copies stamp around it in a ripple, each slightly off register; pull back until the wall fills the frame. Fits content like: sameness and mass production; viral spread; brand ubiquity.
3. **Colour wave.** The wall flips tile by tile outward from one origin, each copy turning into a different variant, a marimba note per flip. Fits content like: hidden diversity; product ranges and variants; options and choice.
4. **Plate by plate.** A new image prints yellow, red, blue, then black, 0.13 s apart, the colour plates settling from 30 px off register to 1 px over 0.7 s. Fits content like: a replacement arriving; "how it's made"; a product reveal.
5. **Dots eat it.** A front of red and blue overprint dots sweeps across a print or a wall, density rising to 0.9 over 2,400 units, under a crackle bed. Fits content like: contagion and decay; debt or inflation; a risk spreading through a system.
6. **Through the counter.** A year or number at 520 px fills the screen; the camera dives through the hole in a 0 or an 8 into the next scene. Fits content like: dates; a statistic that opens a story; chapter cards.
7. **The mosaic giant.** Pull out until each tile is a pixel; a black contour draws itself along tile edges, outlining one giant object made of the small ones. Fits content like: many make one; totals; communities.
8. **The aged pull.** The same print at age 0.42, plates slipping 2–3 px, beside a fresh one. Fits content like: then vs now; original vs copy; nostalgia.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas and WebGL: three 2D canvases (plates, key, spot) sharing one camera matrix, then one fragment-shader pass for dots, slip, paper and age, all drawn from `t`.
- Compute the dot lattice in page space through the inverse camera matrix, so it is world-anchored by construction.
- Misregistration is a per-plate offset in page units multiplied by zoom and clamped (7 px normally, 8 px for aged prints, up to 40 px only while a plate settles); the key plate has no offset.
- Every jitter (tile rotation, variant choice, stamp delay, slip) comes from a hash of the tile's grid position, never `Math.random()`.
- For walls, draw only tiles in view and switch to a lighter object drawing (fill and contour, no shading) below zoom 0.16.
- Text goes into the plates, not over them: colour fills knock out the key, outlines go into the key, and every readable box is registered for a reading-time check.

## 11. Pitfalls

- **Moiré.** A dot cell of 1–2 px on screen aliases into stripes; fade to tint, and never scale a pre-rendered dotted bitmap.
- **Screen-anchored dots.** If the halftone stays fixed while the camera moves, the picture seems to slide under a mesh. The lattice belongs to the paper.
- **Mud.** Three inks overprinted at high density turn brown-black; keep a shape to two inks, and save the near-black for decay.
- **Unreadable slip.** Type colour may slip; the black outline may not.
- **Gradients, glows and soft shadows** break the print instantly. Shadows are solid offset plates.
- **Vibrating pairs.** Red type on blue, or blue on red, shimmers on a phone; put words on paper labels.
- **The wall as wallpaper.** If every shot is a grid, the wall means nothing. Earn it with a single print first.

## 12. Variation space

The agent decides per video: the object and its variants, which ink leads, the tile ground order, the dot cell (4–9 page units), how much age and slip, the label wording, the tempo (100–120 BPM).

- **Three structures:** one print → a wall of copies → a threat eating the wall → variety flipping in; then vs now as two pulls of one image, aged and fresh, compared fact by fact; a countdown of five prints, the camera diving from each number into the next.
- **Three openings:** out of the dots onto the object; a single print stamping onto blank paper as the headline prints beside it; a 520 px number filling the frame, then the dive through its counter.
- **Three endings:** the mosaic giant drawn from the tiles; the colour wave settling under a verdict label; back inside the dots of the first print, now in another ink, so the video loops.
