# Bauhaus Shapes

> An idea explained with nothing but circles, squares, triangles, arcs and straight lines in four flat colours on matte card, set beside big geometric type. A single dot becomes a line, the line becomes a plane, areas are the numbers, and the thin construction lines that measured one scene become the type grid of the next. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): the Bauhaus preliminary course of the 1920s (Johannes Itten, Josef Albers) for primary shapes and hard colour edges; Wassily Kandinsky's point, line and plane for the dot that travels into a line; Herbert Bayer's geometric type and 1920s exhibition posters for type as structure; Swiss grid posters of the 1950s–60s for the visible grid; minimalist mallet music for the score. Never copy their compositions, typefaces or posters, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** One large colour field (the blue) bleeds off one or two edges; the protagonist dot and its shapes sit in the middle third; type stacks above or below them, never beside. Shapes keep their true areas when the frame changes: scale the whole composition, don't squeeze one shape. Must-read text sits in x 72–900, y 269–1248.

| Zone | Position | Content |
|---|---|---|
| Headline | x 96, cap line y ≈ 320 | Jost 800, 130–160 px, tracking −4; a second word in Jost 300, 80 px, tracking 14 |
| Figure | centred on x 540, y 700–1000 | the shapes; at least a third of the frame height at its key moment |
| Big number | inside x 96–880, on the colour field | Jost 700–800, 200–260 px, in paper colour |
| Caption block | centred on x 540, ≤ 720 px wide, bottom edge y ≈ 1230 | paper block with an 8 px bar in the protagonist colour; Jost 500, 44 px |

- **The first 3 seconds.** Frame 1 already has two construction lines drawing across the card and a square snapping in; by 0.5 s the blue field swings up on its hinge; by 1.5 s the headline has risen out of its slot with the dot dropped in as its O; by 3 s the dot starts to move and the voice states the surprising number.
- **Length and pace.** 20–45 s. One mechanism per reel, three to five beats; something snaps, rises or draws every 0.3–0.7 s inside a beat; one held moment when the final shape lands and its chord rings.
- **Captions.** The paper block with the growing colour bar is the only caption; it never moves.
- **Sound.** `thock` for squares and bars snapping in, `ui-pop` for the dot appearing, `tick` for ruler ticks, `zoom-swish` for the zoom through a ring and the whip, `clean-ding` on the landing chord, `sub-impact` when a scene falls away. Pizzicato cello, marimba, vibraphone, kalimba and harp come from free sample libraries.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. The caption block's bottom edge stays at y ≤ 936; no must-read type below that line or within 96 px of the sides.
- **Length and structure.** 3–8 min in chapters of 45–90 s, one mechanism or comparison per chapter. Each chapter opens on its own construction grid drawing in, with its title rising out of a slot and the protagonist dot as one of its letters. The video carries length by **reusing its own pieces**: the dot, the field and the grid persist from chapter to chapter, so each chapter is a transformation of the last (it falls flat, it is cut apart, it is zoomed into). Re-hook every 30–60 s with a change of scale or a structural event: zoom through a ring into a colour that becomes the next field, whip to a scene beside this one, let the whole scene fall away, or cut a part out and prove it equals another.
- **The first 10 seconds.** The strongest image first: the finished figure (the grown shape, the full proportion) already drawn by 1 s, then rewound to the single dot; the question as a two-line reading by 5 s; the promise by 10 s, when the first construction line measures the thing the video will explain. The title card follows.
- **Captions.** The paper block is burned in; export the same lines as `.srt`.
- **Thumbnail.** The final figure on its blue field with the one number in paper colour, 300 px, and the title word with the dot as its O; at most three words.

### Good for

Finance and economics explainers, mechanisms and principles, ratios and proportions, rules of thumb, maths ideas, titles and chapter cards.

## 1. Essence, and what it is not

1. **Five primitives.** Circle (and ring), square, triangle, arc, straight line. Nothing else is drawn: no icons, no characters, no illustrations.
2. **Hard edges, flat colour.** Colours meet at a clean edge; no gradients, shadows, glows or transparency between shapes.
3. **Area is the number.** A value is the area of a disc or a square; rings grow by true area; comparisons are shapes side by side.
4. **The construction stays visible.** Thin ink lines, compass crosses at circle centres, ticks and tangents are drawn and retracted on screen; they measure, then become the grid the type sits on.
5. **Type is a shape.** Headlines are huge, geometric and tightly set; one letter can be the protagonist dot.

Not **Swiss Motion Graphics** (there the grid and type lead and shapes are bars; here primary shapes are the actors and their construction stays visible). Not **Data Storytelling** (no axes, gridlines, legends or pie charts; data is shapes and a few big numbers). Not **Pictogram Motion**: no figures or icons at all.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Colour field | one large shape bleeding off two edges (a slope from bottom-left to the right edge at y ≈ 410, or a half-frame block) | the blue; carries numbers in paper colour |
| Anchor square | top left, x −40 to 352, y 96–488 | yellow; the headline overlaps it |
| Headline | x 128, baseline y ≈ 330 | Jost 800, 196 px, tracking −4; second line Jost 300, 118 px, tracking 18, at y ≈ 480 |
| Reading | x 132, under the headline (y 560–620), or right of a column line at x ≈ 1300 | Jost 500, 38–46 px; a label row in Jost 700, 24–28 px, tracking 4–6 |
| Figure | right half or centre, 40–90 % of frame height | the shapes doing the mechanism |
| Big number | on the field, rotated with it if it slopes | Jost 700, 170–300 px, paper colour |
| Caption block | bottom right, flush to the right edge, bottom edge y ≤ 936 | paper rectangle, 8 px protagonist bar on its left edge, text 30–36 px |

Layouts are built on a few long construction lines (2 px ink): a cap line, a baseline, one or two column edges. Type aligns to them; shapes touch them. Leave at least a third of the frame as empty paper.

## 3. Materials and rendering

- **Matte card, opaque ink.** After the frame is drawn, a final pass adds a fixed tooth texture over the whole frame: per-pixel noise of ±7.5 levels (slightly stronger in dark inks, a little weaker in blue), a faint diagonal fibre made of two crossing sines, and a slow low-frequency drift in ink density. The result reads as screen-printed card, never glossy.
- **Construction layer.** 2 px ink lines for grids, axes and tangents; 3 px for a compass circle being drawn; crosses of 14 px arms at every circle's centre; 4 px paper-coloured ticks on the field. These are the only thin lines.
- **Paths.** When a shape travels, its trail is a 5 px ink line with butt caps; a trail that no longer matters fades to the tint colour as a ghost.
- **Geometry is exact.** Rolling discs turn by distance ÷ radius; growing rings stay tangent at the original dot; circle areas and square sides are computed from the values (side = √(value × unit)).
- **Everything is vector** and drawn from `t`; the tooth texture is screen-space and drawn last, so it never scales with the camera.

## 4. Colour logic

Colours are roles, not hues; swap the palette, keep the roles.

- **Protagonist:** the small thing the story follows (the first dot, the smallest amount). One shape at a time.
- **Field:** the one large area (blue). Only one per frame.
- **Pivot:** the base, the anchor square, the middle amount (yellow).
- **Tint:** secondary areas (a swept region, an outer ring, a ghost path).
- **Ink:** a deep slate, never black, for type and construction lines only.
- **Paper:** the ground, the holes left by cut-out shapes, and type reversed on the field.
- **Never:** two fields in one frame, colour on the construction lines, a gradient anywhere, a colour that isn't one of the six.

Example palettes from the code:

| Role | Cool palette | Warm palette |
|---|---|---|
| Paper | `#F8F7F3` | `#F5E8E1` |
| Protagonist | `#0E9F7A` | `#E9476B` |
| Field | `#2138C8` | `#3552E8` |
| Pivot | `#F4E04D` | `#F6B12F` |
| Tint | `#D5DCEE` | `#94D3BF` |
| Ink | `#161C3A` | `#1F3340` |

## 5. Type and captions

- **Face (SIL Open Font License):** Jost, variable (a geometric sans with round O, pointed A and M). Weights: 800 for headlines and big numbers, 700 for labels and numbers on the field, 500–600 for readings, 300 for a wide-tracked second word. For another script, Noto Sans in that script at matching weight.
- **Roles and sizes (16:9):** headline 196–214 px (tracking −2 to −4); formula numerals 300 px; big numbers 110–300 px; readings 38–46 px; label rows 20–28 px with tracking 3–6; ruler numbers 30–34 px.
- **Type rises from a slot.** Each line is clipped by a rectangle at its baseline and rises into place (ease-out, 0.3–0.5 s); letters of a headline stagger 0.06 s. A light second word is revealed by a left-to-right wipe while its tracking tightens from 60 to 18. Labels on a slope slide out from under the field's edge.
- **Symbols are shapes.** A "÷" is a bar with two dots dropping onto it, "=" is two bars sliding in, a decimal point is a small square.
- **Captions.** The paper block in the spoken language, one or two lines; the protagonist bar grows up its left edge in 0.3 s as each cue starts. Hold ≥ max(1.8 s, speech + 0.6 s).

## 6. Motion

- **Frame rate.** 30 fps for both formats, every frame drawn; nothing is stepped.
- **Easing.** Reveals ease out; exits and drops ease in; camera moves ease in-out. Shapes that snap into place use a back ease with overshoot 1.1–1.6 (squares, bars, the field hinging up); a dot that pops in overshoots more (2.2).
- **Drops with squash.** A falling disc eases in for 70 % of its 0.4 s, then squashes 16–18 % (width up, height down) and recovers on a half-sine.
- **Growth.** A rolling disc moves along its path with a slow-start, slow-finish curve; at each doubling a new ring appears and the number on the field pops from 110 % to 100 % in 0.22 s.
- **Lines** draw from one end in 0.7 s (ease-out), staggered 0.06 s, and retract in 0.55 s (ease-in). Compass circles sweep from 12 o'clock in 0.8 s.
- **Falling away.** A finished scene drops out of frame piece by piece: each layer 0.18 s after the previous, accelerating 1500 px downwards.
- **Weight.** Large fields move slowly and hinge around a corner; small dots are quick. Nothing wobbles, floats or bounces more than once.
- **What never moves:** the caption block, the tooth texture, and any shape that is currently being measured.

## 7. Camera

A 2D camera (centre and scale; scale interpolated geometrically).

| Move | What it expresses | What it can serve |
|---|---|---|
| Slow push (×1 → ×1.045–1.07 over 3–4 s) | attention while the voice lands a number | holding on a result |
| Pull back (×1 → ×0.78) | the bigger picture, a ruler underneath | comparisons, adding a second case |
| Zoom to a point (×1 → ×34 in 0.55 s, ease-in) into a colour band | entering a part; the colour fills the frame and becomes the next field | chapter turns, "inside this ring" |
| Pull out from a flat colour | arriving inside the part | the start of a new chapter |
| Whip (0.6 s, in-out) to a scene built beside this one, with long construction lines spanning both | the same world, one thing changed | variant B, the other option |
| Hold and let the scene fall away | reset, conclusion | the summary formula |

**Allowed transitions:** zoom through a colour, whip along shared lines, scene falling away, construction lines morphing into the next layout's grid. **Forbidden:** dissolves, blurs, 3D rotation, wipes with soft edges, any transition that brings in a gradient.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Score | 120 BPM, one bar = 2 s, a bright major key: pizzicato cello (root on 1, fifth on 3), marimba eighths, vibraphone holds; a kalimba note per doubling climbing the scale; a harp spread with vibraphone and glockenspiel on every landing | music about 10 dB under the voice by RMS, with a dip in the voice band |
| Silence | marimba drops out during builds, zooms, falls and for 1.6 s after each landing chord | |
| Foley: drafting table | a ruling pen along a straight edge for each construction line (high band-passed hiss with a tiny click); dry wooden ticks for ruler marks; the same knock for every equal step of anything that grows linearly | |
| Foley: shapes | a clack and 95 Hz thump for a square snapping in; a whoosh then 62 Hz thump for a field hinging; small rising clicks for letters; a 140 Hz thump and pop for a dropped dot; a felt rumble that grows with a rolling disc; a thump that falls in pitch as each ring is added | |
| Transitions | rising air through a zoom, a whoosh on the whip, a reversed pop as a shape drains, four staggered low thumps as a scene falls | |

Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Point to line.** The protagonist dot travels and leaves a 5 px ink trail; the trail stays as the record. Fits content like: growth over time; a journey of money or a signal; cause and effect.
2. **The rolling snowball.** A disc rolls up the field's slope, radius growing exponentially, a ring added at each doubling, all rings tangent at the original dot. Fits content like: compounding of any kind; network effects; habits that stack.
3. **Area is the number.** Two cases side by side as a disc and a row of squares whose areas are the values; the big numbers settle beside them. Fits content like: with vs without; budgets and shares; any "how much bigger".
4. **The grid becomes the type.** The construction lines that measured the figure slide and re-angle into the cap line, baseline and column of the next layout, and the formula rises onto them. Fits content like: deriving a rule; summaries; chapter cards.
5. **Cut out and prove.** A compass circles part of a shape, it slides out leaving a paper hole, tangent lines link hole and piece, two bars snap in as "=". Fits content like: where a total comes from; decomposition; one share against the rest.
6. **Through the ring.** Zoom ×34 into one colour band until the frame is that flat colour, then pull out inside the next scene. Fits content like: chapter turns; zooming into a component; scale shifts.
7. **The letter is the subject.** The O of the title is the protagonist dot, dropped in with a squash after the other letters rise. Fits content like: titles; logos; recurring sign-offs.
8. **The lever.** A beam on a triangle tips; wedges in the tint show how far each end travelled; a circle and a square of true weight sit on it. Fits content like: leverage and trade-offs; ratios; balance.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D, one frame from `t`, drawn with five helpers (disc, polygon, rectangle, line, arc) and a text function that can rotate type along a slope.
- A final tooth pass over the image data: precompute the noise field once from a seeded generator, then add it per pixel, weighted by luminance.
- Store each scene's timings in one object of named times; reveals are `ease(seg(t, a, b))`. Keep a `SHOTS` table and let neighbouring scenes share world coordinates so whips and falls are real camera moves.
- Compute geometry, don't place it: rolling phase as the integral of distance over radius, ring radii by √2 per doubling, square sides from areas.
- Reveal type with a clip rectangle at the baseline; record every readable text box for the reading-time check.
- One sound event per visible action (grid, snap, hinge, block, drop, ring, whip, fall) feeds the mix.

## 11. Pitfalls

- **Decoration creep.** A drop shadow, a gradient field or an icon breaks the style at once.
- **Fake areas.** Scaling a disc's radius by the value makes it look four times too big at 2×; always scale area.
- **Construction clutter.** More than five construction lines on screen reads as a technical drawing. Retract them once they have measured.
- **Black ink.** Pure black looks digital against the card; use the slate.
- **Two fields.** Two large blue shapes split attention; one field per frame.
- **Type on the field in ink colour** disappears; type on the field is paper-coloured.
- **Static stretches.** A held layout with nothing drawing dies within 2 s; let a line, a tick or a ring keep moving under the voice.

## 12. Variation space

The agent decides per video: the palette (keep the six roles), which shape is the protagonist, whether the field is a slope or a block, the headline word, the number of chapters, the key of the score.

- **Three structures:** one mechanism built step by step and summed up as a formula; two cases side by side (with vs without, fast vs slow), each run on the same field; a part-to-whole proof, cutting a shape apart until the surprising equality shows.
- **Three openings:** grid lines drawing in and the title rising with the dot as its O; the finished figure on frame 1, then rewound to a single dot; the field hinging up from flat with the big number already on it.
- **Three endings:** the scene falls away and its lines become the formula; zoom out to the title card where the protagonist dot is a letter again; every shape folds back into the single dot, held alone on the paper.
