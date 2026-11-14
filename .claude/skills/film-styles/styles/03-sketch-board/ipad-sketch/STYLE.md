# Tablet Sketch Explainer

> A drawing app's page on warm paper: a stylus pencils clean outlines over faint construction lines, then flat colour blocks are scribbled in slightly off-register, and things change by being recoloured one colour at a time while the canvas is panned, pinched and turned like a tablet in someone's hands. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): food and travel sketchbooks (loose pencil line, colour that doesn't quite fill it); mid-century screen-printed cookbook illustration (flat colour plates shifted off the key line); live-drawing tutorials on tablets (the stylus visible, the canvas moved with two fingers); process diagrams in craft manuals (one object transforming through labelled stages). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The page is portrait, 1080×1920 in world units. The process runs down the page: the title at y 290–430, the first object near y 560, each next stage 300–400 px lower, the finished object at y 1000–1200. Labels sit beside their objects inside x 72–900; below y 1248 the page holds only colour, construction lines and the bottom of the last drawing. The camera works at zoom 1.3–2.0 and pans down with the process; the final pinch-out shows the whole page at zoom 1.
- **The first 3 seconds.** Frame 1 is a close-up (zoom about 2.7, canvas turned −2°) of the finished end product's first line being drawn, the stylus on it; by 1.5 s its colour is going in; at 2.8 s a quick pinch-out reveals what it is; the question lands in the caption by 3 s.
- **Length and pace.** 25–45 s, four to six stages. Each stage: outline 0.6–1.2 s, colour 0.3–0.5 s, label 0.2–0.3 s, then a 1–2 s drift while the voice explains.
- **Captions.** A paper chip centred on x 540, at most 720 px wide, bottom edge at y 1236, one or two lines of 42 px; it wipes in left to right like a colour block.
- **Sound.** The pack's `zoom-swish` (canvas gestures), `thock` (the colour morph landing), `tick` (each swatch filled), `sparkle` (heat or shine marks), `clean-ding` (the finished object). Pencil, scribbled colour, nylon guitar and shaker come from a free sample library.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. The caption chip and labels stay above y 950 and inside x 96–1824.
- **Length and structure.** 3–8 min. **One chapter is one page** (45–90 s, three to five stages), and the pages are artboards laid side by side on one large canvas, 200 px of grey canvas between them. Each chapter: the camera starts close on its first mark, works across the page stage by stage, and ends with a pinch-out to that whole page held 2 s. **The turn** is the colour morph: the camera pushes into the last object's colour until it fills the frame, a new colour sweeps across with a ragged front, and it shrinks to land as the first object of the next page. **The swatch strip is the table of contents**: every chapter adds one labelled swatch to a strip that lives at the top of the first page; the final chapter pinches out over all the artboards, then lands on that strip as the recap.
- **Re-hooks every 30–60 s.** A recolour on the key word (the same block re-registered in a new colour); a half-coloured object finished later; a punch-in on a sudden change; colour leaving an object as flying flakes while its outline stays empty; a match cut that magnifies a small object ×2–3 to explain it.
- **The first 10 seconds.** Strongest image first: the end product being drawn in close-up. Its identity by 3 s; the question by 5 s; by 10 s the colour morph has carried us to where it starts, which is the promise of the journey.
- **Captions.** Burned in as the paper chip; export the same lines as `.srt`.
- **Thumbnail.** A real frame of a whole page with the title's key words on mustard blocks and the hero object mid-change (one half in each colour); at most three words.

### Good for

Food and drink explainers, craft and how-to, how something is made, lifestyle science, before-and-after transformations, product origin stories.

## 1. Essence, and what it is not

1. **Line first, colour second.** Every object is pencilled first (light construction lines, then a clean graphite outline); flat colour follows as a separate pass.
2. **Colour off-register.** Colour blocks are shifted 5–9 px down-right from their outline, with ragged edges and visible scribble direction; they may stop half done.
3. **Change is recolouring.** An object changes state by having its colour block re-laid in the next colour, one change at a time, so the process reads as a colour sequence.
4. **A real tablet.** A white stylus touches every mark as it is made and lifts between marks; the canvas pans, pinches and rotates a degree or two like a hand-held device.
5. **Finished lines never move.** A digital canvas does not boil: the drawing is perfectly still once made.

Not **Sketchnote** (no dot grid, no boxes and banners, no grey marker; the page is a drawing, not notes). Not **Colored-Pencil Science Illustration** (no hatching layers or 3D world; colour is flat digital blocks). Not **Marker on Paper** (no felt-tip, colour is central). Not **Watercolor Brush** (no blooms; blocks are opaque-ish and flat).

## 2. Frame and layout (1920×1080)

The page is 1920×1080 in world units; the camera usually shows part of it at zoom 1.25–1.95 and the whole page only at chapter ends.

| Zone | World position | Content |
|---|---|---|
| Title | x 80, baseline y 182 | 104 px bold script, key words on mustard blocks, a coral underline |
| Second title line or kicker | x 90, y 270 | 40 px, graphite |
| Swatch strip | x 960–1350, y 108–166 | 58 px squares 110 px apart, labels 32 px under them |
| Stage objects | the rest of the page, flowing left → right or along a curve | one object per stage, 150–400 px across, a light guide ellipse round groups |
| Labels | beside their object, 32–46 px | short, often turned ±0.05 rad, with a coral arrow when they point |
| Numbers | beside the object, 52 px bold coral | temperatures, times, counts |
| Credit note | a pinned card top right, turned −1° | written last, only in the final whole-page shot |
| Caption chip | screen space, bottom left at x 96 (or bottom right when the subject is left), bottom edge y 940 | 40 px |

Stages read in one direction; objects never touch; 120 px of bare paper round each.

## 3. Materials and rendering

- **Paper**: `#F3EADB` with a two-scale grain baked once at buffer resolution and fixed to the canvas; a warm multiply vignette, 0 % at 45 % of the height from centre to 10 % at the corners; a light film grain in the final encode.
- **Pencil brush**: round dots stamped every 0.55 px along a smoothed path, radius about 1.4 px times pressure. Pressure rises over the first 18 % and falls over the last 22 % of each stroke; a slow noise wobble of 0.8 px. Pencil coverage is cut by the paper grain (`clamp((coverage × 0.9 − grain × 0.85 + 0.32) × 2.1)`), so lines break up on the paper's tooth.
- **Three pencils**: light construction (55 % opacity) for guides, ellipses round groups, centre lines and cross-hairs; graphite (95 %) for outlines and lettering; coral (95 %) for arrows, heat marks and numbers.
- **Circles** start anywhere and overlap their start by about 7 %.
- **Colour blocks**: the outline polygon shifted (7, 5) px, roughened by 1.5 px of noise along its normal, laid with `multiply` at 92 %. They reveal along a back-and-forth scribble path at −0.5 rad, rows 9 px apart, so colour visibly goes in by hand. Holes are erased for highlights and creases; objects in front cut them.
- **Occlusion**: an object drawn in front erases lines and colour already inside its outline.
- **Buffers** at 2×, composited per frame as paper × colour × three pencil layers.

## 4. Colour logic

- **Warm paper, warm graphite.** Lines are brown-grey, never black.
- **Colour is the story.** Each stage has one main colour; a transformation is a sequence of blocks re-laid on the same shape. Show the sequence once as a swatch strip.
- **Darker version for shade**: each colour has a deeper sibling for the shaded half of a round object.
- **Coral is a pencil, not a fill**: arrows, heat squiggles, numbers.
- **Mustard is the highlighter**: only behind title words.
- **Never coloured**: the paper, labels, construction lines.

| Role | Hex |
|---|---|
| Paper | `#F3EADB` |
| Graphite | `#43362E` |
| Construction pencil | `#A8998A` at 55 % |
| Coral pencil | `#DC6A4C` |
| Highlighter | `#F1C04F` |
| Example stage colours | `#C3C75E` → `#EC8D3E` → `#D9463C` (with shade `#A8352D`) |
| Leaf / leaf shade | `#8FB47C` / `#5F8F5A` |
| Pale fill / dark fill | `#F3D9A4` / `#4A2A1C` |
| Caption chip / its shadow | `#FBF7EE` / `#E4D6BD` |

## 5. Type and captions

- **Faces**: Caveat (OFL), Bold for titles and numbers, Medium for labels and captions. For a script Caveat lacks, Long Cang for page lettering and LXGW WenKai for captions (both OFL).
- **Written with the stylus**: page lettering is revealed along each glyph's centre-line skeleton at about 900 px of skeleton a second, glyphs ±2.5 % off the baseline and turned ±0.035 rad; the stylus follows the writing.
- **Sizes**: title 104 px; stage labels 36–46 px; swatch labels 32 px; numbers 52 px bold in coral.
- **Title last**: in a short film the title is written near the end, once the page has earned it, then its key words get mustard blocks and an underline.
- **Caption chip**: `#FBF7EE` at 95 %, radius 10, a flat shadow offset (9, 8) at 75 %; wiped in left to right over 0.2 s, text fading in 0.08 s later; out over 0.18 s. 40 px Caveat Medium in graphite. Hold each for at least max(1.8 s, speech + 0.6 s). Move it to the right side whenever the subject is on the left.

## 6. Motion

- **24 fps.** A reel renders at 30 fps. No boil and no stepping: a digital canvas is still.
- **Order per object**: construction guide (light) → outline (graphite) → details → colour block → label. Colour goes in 0.1–0.5 s per block; a cluster of similar objects is coloured in a wave, 0.05–0.1 s apart.
- **The stylus** is always on the mark being made; between marks less than 1.1 s apart it lifts in an arc (up to 26 px of shadow offset) and travels with cubic in-out; in longer gaps it leaves to the bottom right in 0.45 s and comes back in 0.45 s before the next mark. It leans a few hundredths of a radian with its motion.
- **Recolour**: the old block is erased under the new one as the new scribble passes.
- **Particles** only when something physically breaks up (crumbling, shattering, scattering): small five-sided flakes in the object's colour fly out on an ease-in curve while the outline stays behind, empty.
- **Never moves**: a finished line or block (until it is recoloured), the paper.

## 7. Camera

The camera is a hand on a tablet: `(x, y, zoom, rotation)`, zoom in log space, rotation within ±2°.

| Move | What it expresses | What it can serve |
|---|---|---|
| Drift (cubic in-out, a few px and 0.2° over 1–4 s) | the page is held and alive | any explanation over a finished stage |
| Gesture (fast start, soft settle) | the user moves to the next thing | stage to stage; a pinch-out to reveal what something is |
| Follow the stylus | thinking as it draws | a long branch, a path, a flow line |
| Push in, accelerating (`u^2.4`) | going into the colour | the start of a colour morph or a match cut |
| Punch (0.15 s, ease-out, +15 %) | a sudden event | a crack, a pop, a threshold |
| Pinch out to the whole page (1.4 s) | the summary | chapter ends, the final frame |

Allowed transitions: the colour morph; a cut hidden by a frame-filling colour; a match cut that rescales the same object ×2–3 at the same angle. Forbidden: dissolves, slides, page curls, rotation beyond ±2°.

## 8. Sound palette

| Layer | What |
|---|---|
| Score | a light café bossa on a 96 BPM grid (a bar = 2.5 s) in a major key: nylon guitar, a jazz double bass, an egg shaker, one soft vibraphone note on each new idea. |
| Foley | driven by the marks: a graphite scratch for each line, a faster papery scrub for colour going in, a soft glass swipe for each canvas gesture, a dry crack for a punch, a sprinkle for particles, a pour or fizz where the subject does it. |
| Silence | two near-silences of about half a second: before the colour morph and before the punch. |
| Mix | voice about 10 dB over the bed; music ducks and gives up 300 Hz–4 kHz under speech. Master −14 LUFS, true peak −1 dB. |

## 9. Native moves

1. **The colour morph.** Push into an object's colour until it fills the frame, sweep a new colour over it with a ragged front, then shrink it onto the next object, where the outline is drawn round the landed colour. Build: a screen-space ellipse grows over 0.27 s, a zig-zag-clipped fill sweeps in 0.21 s, then a disc lerps to the target over 0.7 s; the camera cuts underneath. Fits content like: the end product back to its raw material; one chapter to the next; then and now.
2. **Recolour in sequence.** The same block re-laid several times, each colour named on a swatch as it lands. Fits content like: ripening; bread browning; rust, tan or fade.
3. **Half done on purpose.** One object in a group keeps only its outline, another stops its colour halfway; the voice explains why. Fits content like: unripe versus ripe; the step not yet taken; what is missing.
4. **Outline left behind.** The colour leaves as flakes and flies to the next stage, the empty outline stays. Fits content like: crumbling; dissolving; one thing becoming many.
5. **Magnify by match cut.** Push into a small object and cut to the same shape drawn 2–3× larger elsewhere on the page. Fits content like: a cell in a leaf; a part inside a tool; a single grain of sand.
6. **Cutaway circle.** A sketched circle round an object, cross-hair guides through it, and the inside drawn as concentric colour rings. Fits content like: the layers of a cake; the rings of a tree; a pipe's cross-section.
7. **Back to the first frame.** The video ends by returning the camera to its opening close-up, now coloured, then pinching out to the whole page with the title written last.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D with offscreen buffers at 2× for three pencil layers (float coverage) and one colour canvas; each frame composites paper × colour × pencils through the grain, then places the result with the camera's translate, rotate and scale.
- A mark list of `{t0, d, kind, apply(progress), nib(progress)}`: pencil strokes, colour blocks, occlusions, lettering. Stroke geometry is precomputed and seeded, so progress only decides how much is drawn.
- Finished marks are cached for speed only; render any `t` from scratch and it must look the same.
- The stylus is drawn last in screen space from the active mark's nib, or from an arc between marks.
- Dynamic layers (colour morph, particles, pours) are screen-space functions of `t` with their own windows.
- Export one event per mark, gesture, morph, punch and particle burst for the foley and `cues.json`.

## 11. Pitfalls

- **Colour that fills the line exactly** looks like vector clip art; keep the offset and the ragged edge.
- **Too many colours at once.** One stage, one new colour; more and the change stops reading.
- **Stylus over the subject.** The pen sits down-right of the nib; check it never hides the word being written.
- **Rotation creep.** More than ±2° makes the page feel like it is falling.
- **Empty stretches.** If no mark is being made for more than 2 s, a drift alone is not enough; colour something.
- **Labels under the caption chip.** Swap the chip to the other side.
- **The app's buttons.** In a reel, nothing that must be read below y 1248 or right of x 900; on YouTube nothing in the bottom 12 %.

## 12. Variation space

The agent decides per video: the subject's colour sequence, the page direction (left → right, a loop, top → bottom), how many pages, the paper warmth, the score's instruments within the light acoustic palette.

- **Three structures:** backwards from the result (start at the finished thing, morph to its origin, walk forward); a straight recipe of stages; a comparison of two objects drawn side by side and recoloured in turn.
- **Three openings:** the finished object's first line in close-up; an empty swatch strip being drawn, its first square filled; a half-coloured object with a question beside it.
- **Three endings:** back to the opening close-up then a pinch-out with the title written last; the swatch strip completed; the final object recoloured once more into something unexpected.
