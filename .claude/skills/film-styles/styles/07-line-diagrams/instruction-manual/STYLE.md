# Instruction Manual Art

> A wordless assembly manual brought to life: true-isometric line drawings with flat fills and one ink weight, numbered steps on a single long printed page, faceless people doing the work, the newest part of each step in safety yellow, red crosses and blue ticks for don't and do. The camera travels over the page and falls into its drawings. A 9:16 reel, or a 16:9 how-to video for YouTube.
> References (grammar only): flat-pack furniture manuals (step numbers, parts call-outs with counts, dotted assembly paths, the do/don't panel); construction-toy building booklets (one new part per step, the build growing across pages); aircraft safety cards (faceless people, cross and tick, no words); Isotype pictograms (people as clear silhouettes at true proportions). Never copy their drawings, layouts, typefaces, logos or product codes, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The page reflows into one column: steps stack top to bottom and the camera travels down the page. Each step is framed as a 1080-wide cell; drawings bleed off the sides, while numbers, counts and captions sit inside x 72–900, y 269–1248.

| Zone | Position | Content |
|---|---|---|
| Step number | x 96, baseline y 440 | Inter 700, 170 px |
| Parts call-out | right-aligned to x 880, top y 300, ≤ 420 px wide | rounded white box, counts in 40 px |
| Main drawing | centred x 540, y 520–1180 | bleeds left and right |
| Magnifier | circle centred x 700, y 560, radius ≤ 170 | replaces the parts call-out while open |
| Caption | centred on x 540, ≤ 720 px wide, last baseline y ≈ 1210 | 40 px on a paper bed with a yellow bar |

- **The first 3 seconds.** Frame 1: the closed box (or the finished object) already drawn, close, step number "1" printed beside it. By 0.5 s the lid swings open and the first part lifts out along its dotted line; by 3 s the parts have landed in their counted spots and the question lands ("which of these will you get wrong?").
- **Length and pace.** 30–45 s, five to eight steps seen; most passed in a pan or a whip, two or three entered properly, one comic failure, one held step drawn in near silence.
- **Captions.** One caption layer; the page itself carries no words but numbers and counts.
- **Sound.** `thock` as each step number prints and each part lands; `ratchet` under a key or screw turning; `latch` for the click that matters; `zoom-swish` on whip pans; `ui-pop` when a magnifier or call-out opens; `clean-ding` when a blue tick lands. Score (pizzicato strings, marimba, glockenspiel, felt piano, woodblock) from a free CC0 library such as VSCO 2 CE or VCSL.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Captions sit on a bed above y 950; step numbers and counts stay inside the 5 % margins.
- **Length and structure.** 3–8 min. One page per chapter (a phase of the job: unpack, frame, fasten, finish, use), four to ten steps per page in a snake, 40–90 s each. Each chapter opens on the page's first step number printing and ends by pulling out to the whole page, so progress is always visible. Re-hook every 30–60 s with something the manual grammar does itself: a do/don't panel and a push through its tick, a dive into a magnifier, a step that goes wrong (red cross stamped), a ghosted part taken back out, a whip to a step further along.
- **The first 10 seconds.** The strongest frame first: the finished object with the people beside it, then a whip back to step 1. The question by 5 s ("where does it go wrong?"); the promise by 10 s ("by the end you'll do it once, right").
- **Captions.** Burned in on the paper bed, plus `.srt`.
- **Thumbnail.** One big drawing with its yellow part, a red cross or blue tick beside it, the step number in 260 px Inter 700, and at most three words.

### Good for

Assembly and set-up guides, safety instructions, product onboarding, repair how-tos, process steps for software or services told as a physical manual.

## 1. Essence, and what it is not

1. **True isometric, always.** Azimuth 45°, elevation 35.264°, orthographic: horizontal edges at 30°, no vanishing points. The drawing angle never changes; only the camera over the page moves.
2. **One ink weight, flat fills.** Every outline is the same line (2.6 px at 1:1); each surface has one of three flat shades by which way it faces. No gradients, no shadows except a flat floor tone.
3. **The page is the world.** All steps exist at once on one printed sheet, in numbered cells joined by dotted connectors; the video is a journey across it.
4. **Wordless except for numbers.** Step numbers, counts ("2×"), crosses and ticks, arrows and magnifiers carry the instructions; the narration and captions carry the story.
5. **Faceless people at true proportions.** About seven heads tall, limbs as tapered capsules, no faces; who is who is read from hair shape and shirt shade.

Not **Line-Art Cutaway** (that is a perspective 3D object traced into line with internal parts and no people). Not **Assembly-Line Diagram** (a flat cartoon factory with workers and a busy palette). Not stick figures or whiteboard (no hand-drawn wobble, no marker, no doodle faces).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Page | full bleed | `#F4F1EA` stock with faint fibres; cells about 2000×1150 page units, gaps 240 (across) and 380 (down) |
| Step number | cell's top left, x 96, baseline y 214 at 1:1 | Inter 700, 150 px, ink |
| Parts call-out | top right of a cell | white rounded box (radius 18), ink outline, columns of count + small drawing; counts Inter 600, 34 px |
| Main drawing | cell centre, about 60 % of the cell | the object in its current state, people around it |
| Do / don't panel | lower right of a cell, about 600×330 | white rounded box (radius 22) split by a vertical rule; red cross top left of the left half, blue tick top left of the right half |
| Magnifier | beside the detail, radius 120–220 | spot circle (radius 26) on the detail, a leader, then the enlarged detail in a circle filled `#FBF9F4` |
| Connector | between cells | dotted line, the snake's direction |
| Caption | x 128, bed from y 846 to 936 | see section 5 |

At 1:1 one cell almost fills the frame. Zoomed in, the camera centres the action; zoomed out, it shows two to four cells; fully out, the whole page with its footer.

## 3. Materials and rendering

- **A tiny 3D engine, drawn in 2D.** Objects are boxes, prisms, cylinders and hulls of spheres in centimetres; each face turned toward the viewer is projected and queued with its depth, then painted back to front. No WebGL is needed.
- **Three shades per material**, chosen by which way the face points: top, the +z side, the +x side. Finished parts: `#FFFFFF`, `#ECE8DF`, `#DCD7CC`. Metal: `#D9D7D1`, `#BDBAB3`, `#A3A099`.
- **Ink.** Ink `#1E1D1B`, round joins. Line weight follows the camera like print: LW = 2.6 × zoom^0.55, clamped 0.7–6.5 px, so zooming in thickens lines a little, as an enlargement of a printed page would.
- **People.** Each limb is the hull of two circles (in orthographic view a sphere is always a circle, so a figure turns correctly at any angle); the torso is a hull of several. A pelvis carries the weight and the chest leans and twists on it; heads aim at what they look at. The far leg is one shade darker so overlapping legs never merge. Hands become a single paddle at full-body scale; a close-up uses separately drawn hands.
- **Paper.** A tile of very fine fibres (4–20 px strokes at 5 % brown or 22 % white) and a few specks, anchored to the page so it moves with the camera.
- **Ghosts.** A part that has been removed is drawn as a dotted outline with no fill.
- **What is screen-space:** captions only. Everything else, including step numbers and the paper, belongs to the page.

## 4. Colour logic

- **White and warm greys for everything finished**; the paper is warmer than the parts so white boards always read.
- **Safety yellow marks what is new in this step** (the part being added, the thing that just arrived) and nothing else. Once the next step starts, it turns white like the rest.
- **People in greyscale**: one in a white shirt with mid-grey trousers, one in a light-grey top with dark-grey trousers, hair in dark grey. They are never yellow.
- **Red and blue are symbols only**: a red cross (stroke, never a glyph) for "don't", a blue tick for "do". No other red or blue anywhere.
- Never coloured: paper, arrows (solid ink with a paper halo), dotted lines, numbers.

| Role | Hex |
|---|---|
| Paper | `#F4F1EA` |
| Ink | `#1E1D1B` |
| Part top / side / side | `#FFFFFF` / `#ECE8DF` / `#DCD7CC` |
| New part (safety yellow) | `#F7D35A` / `#F2C230` / `#DEAA1F` |
| Greys (people, details) | `#CFCBC2`, `#9C988F`, `#6B6862` |
| Don't | `#D23A2E` |
| Do | `#2C66AC` |

## 5. Type and captions

- **Inter** (OFL) only: 700 for step numbers (150 px at 1:1, printed on the page so they scale with the camera), 600 for counts ("8×", 34 px), 500 for captions. No other words on the page; if a label is truly needed, it is a number with a symbol.
- **Captions**: Inter 500, 36 px at 1920 (40 px in a reel), ink, on a paper-coloured bed at 86 % with 10 px corners (it blends into the page, so it reads over drawings without looking like a box), with an 8 px safety-yellow bar on its left edge. Fade 0.12 s in and out. One language, the spoken one. Hold each ≥ max(1.8 s, the spoken line + 0.6 s).
- The narrator speaks plainly and a little dry; the page stays wordless, which is where the humour lives.

## 6. Motion

- 30 fps, smooth (not stepped).
- **Appearing in two passes.** A drawing first appears as complete line art (fills painted as paper) fading in over 0.45 s, then its colours fade in over it in 0.5 s. Nothing is ever shown half-built or floating.
- **Parts travel along their dotted lines.** A part lifts from where it lay, turns upright on the way and lands on its spot; its dotted line (dots 2 px, gaps 9 px, round caps) runs exactly along that flight and fades after it lands. Landing settles with a small overshoot.
- **People move like people.** Weight shifts over a foot, crouches, leans; walking carries at about 0.4 s per step. A jiggle of ±0.6 px at 9 Hz shows strain.
- **Turning.** A curved turn-arrow (arc round the axis, solid ink) draws first; then the key or screw rotates in six short steps about 0.22 s apart; a click mark (three short ink strokes radiating) pops on the last.
- **Crosses and ticks** draw in as strokes, 0.2 s.
- **Never moves:** the drawing angle, the page layout, a step number once printed.

## 7. Camera

A 2D camera over the page: centre and zoom, with zoom interpolated in log space so that the point being zoomed into stays put on screen (the feel of pushing into a detail).

| Move | What it expresses | What it can serve |
|---|---|---|
| Slow push into a cell (zoom 1.0 → 1.1) | attention | a step being explained |
| Pan along the snake to the next cell (1 s) | the next step | ordinary progress |
| Whip pan (0.7 s, motion-blurred) | skipping ahead | steps that go without saying, comedy |
| Push into a do/don't half (to ×7) | "this way, not that" | safety rules, the right technique |
| Dive into a magnifier (to ×7.6) | the small thing that matters | fasteners, clicks, alignment |
| Push to ×2 on a person | reaction | a comic beat, a realisation |
| Pull out to the whole page | the whole job | the ending, chapter ends |

Transitions: within the page by pans and whips; out of it through its own frames. **Portal**: pushing into the tick half of a do/don't panel until its small drawing fills the frame, then that drawing becomes the main drawing of the step at the same screen position (a 0.5 s white fade from the panel's fill). **Match cut**: from inside a magnifier to the same shape elsewhere on the page. **Hard cuts** on comic beats. Motion blur only on fast camera moves (a pan is smeared along its path; a zoom is sampled over half a frame). No dissolves, rotations, perspective, or shake.

## 8. Sound palette

- **Score**: a small, cheerful pizzicato machine in a major key at about 92 bpm that counts the steps: pizzicato strings, marimba, glockenspiel, felt piano, kalimba, woodblock, hand chimes, harp. One note per part as it settles, rising through the chord. Bowed strings play only once, for the final pull-out over the whole page.
- **It trips.** The music stops dead for a red cross, giggles (a quick marimba run) on a laugh, ticks like a clock through a montage step, and leaves the room before the last step.
- **Foley of paper and flat-pack**: a carton landing on a wooden floor; a lid; wood knocks as parts land; a pencil on paper while line art appears; a paper slide under pans; a whoosh on whips; footsteps; bolts dropping in; ratchet clicks; one clean click for the fastener that matters; a rubber stamp for each red cross; a soft thump as each step number prints.
- **Silence**: the final step is drawn in near silence, only the pencil; the first note after it is a chime.
- **Mix**: narration about 10 dB above music; music ducked under speech. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Box to inventory.** The lid opens; each part rises along its own dotted line, turns upright and lands on its spot beside its count. Fits content like: what's in the box; the tools you need; everything a process starts with.
2. **Do / don't panel, then the portal.** A white panel split in two: the wrong way with a red cross, the right way with a blue tick; the camera pushes through the tick into the right way at full size. Fits content like: safety rules; posture or technique; a common mistake and its fix.
3. **Magnifier on the detail.** A spot circle, a leader, an enlarged circle showing the fastener or catch, then a click mark. Fits content like: the screw people strip; the latch that must click; alignment marks.
4. **Turn until it clicks.** A curved arrow, the turn in short ratchet steps, the click on the last. Fits content like: tightening; dials and settings; anything with a "until you hear it".
5. **The failed step.** The build goes wrong (upside down, wrong hole), a red cross is stamped, the part is ghosted back out on its dotted line and tried again. Fits content like: the classic mistake; a troubleshooting story; humour in a dry topic.
6. **Footprint on the floor.** The finished object's footprint appears as a dotted outline before anything stands. Fits content like: space needed; placement; "measure first".
7. **The payoff cell.** The final cell shows the object in use, drawn line first in near silence; the yellow marks the result, not a part. Fits content like: the human payoff of a product; the result that matters; an emotional close for your app.
8. **The whole page.** Pull out until every step is visible as one sheet with a printed footer. Fits content like: the summary; a checklist to screenshot; a loop to step 1.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- One 2D canvas, `data-no-timeline`, the whole frame a function of `t`. An isometric module projects 3D points (azimuth 45°, elevation 35.264°, orthographic) and keeps a depth-sorted queue of faces; `flush` paints them back to front with the three-shade palette and one line weight.
- The page is one coordinate system of cells in a snake (`SLOT[k] → [column, row]`); each step is a function `step_k(g, cellContext, t)` drawing the object in that step's state, and only cells near the camera are drawn.
- Camera keys `{t, centre, zoom, ease}`; log-space zoom with a fixed point; a "re-base" key for the portal so the camera jumps from the small drawing to the large one at an identical screen transform.
- A figure rig with poses as data (stand, kneel, lean on, read, scratch head…) and blendable keys; hands aim wrist targets.
- The two-pass appear (line pass with fills overridden to paper, then the full drawing) on an offscreen canvas.
- Cue times from the narration's word timings; one sound event per visible action written to `cues.json`.

## 11. Pitfalls

- **Breaking isometric.** Any perspective, rotation of the view, or an object drawn at another angle breaks the manual.
- **Too many weights.** Thin hairlines and heavy outlines together make it a technical drawing; keep one weight.
- **Faces.** A smile or eyes turns the people into cartoon characters.
- **Yellow everywhere.** If old parts stay yellow, the "new part" signal is lost.
- **Painter's-order glitches.** Long thin parts behind flat boards poke through; sort boards by their nearest point and give rails small depth biases.
- **Hands that don't hold.** Wrists must sit short of the rail so the palm lands on it; check every grip at 0.2 s steps.
- **Words on the page.** Labels and sentences in the cells kill the wordless charm; put them in the captions.
- **Lines that shimmer.** Very thin lines when zoomed out flicker; keep the 0.7 px floor and hide cells far from the camera.

## 12. Variation space

The agent decides per video: the object or process, the number of steps and which ones are entered, the people (one, two, a team), the failed step, the do/don't rules, the final payoff.

- **Three structures:** the straight build with one failure and a payoff cell; a do/don't catalogue (each cell a rule, the portal through each tick); one step slowed into a full sequence (magnifiers and turns), with the rest of the page whipped past.
- **Three openings:** the closed box with "1" printing beside it; the finished object, then a whip back to step 1; a red cross stamped on the most common mistake.
- **Three endings:** the whole page with a printed footer; the last step's yellow payoff held in silence; a loop back to the closed box, now with a blue tick.
