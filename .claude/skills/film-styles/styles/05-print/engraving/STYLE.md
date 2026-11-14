# Copperplate Engraving

> An intaglio plate that engraves itself: a burin cuts swelling lines into copper, a proof is pulled, and the figure builds up — outline, hatching, cross-hatching — until engraved lettering, magnified details and a hand-laid wash make a finished plate. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): 19th-century natural-history plates — Haeckel, Audubon, Westwood, the old encyclopedia copperplates (centred subject, numbered roundels, roman title over an italic name, "del." / "sculp." credits, the plate mark); Hogarth and Doré for the burin line (hatching that follows the form, crossing only in half-tones); hand-coloured plates for washes laid after printing. Never copy a plate, pose, border or title.

## Formats

### Reel (1080×1920)

- **Layout.** A natural-history plate is already a portrait page. Laid paper bleeds to every edge; the plate mark and ruled border sit just inside it (about x 36–1044, y 90–1830). The roman title is cut near the top of the safe box (y 290–360), the subject below it (y 420–1000). Roundels fly to the gaps above and below the subject, not the side margins, with leaders that run vertically; every label stays inside x 72–900. The subtitle slip sits centred on x 540, at most 720 px wide, its bottom edge above y 1240. A parts list is read with a tilt down the sheet; a scene too wide for the page becomes two plates in sequence.
- **The first 3 seconds.** Frame 1 is the loupe on the burin mid-stroke, swarf curling, the first swelling line already partly cut. By 0.5 s the camera rides the tip; by 3 s a log-zoom pull-out shows that the line was the edge of a wing, a coast or a gear, and the first hatching family sweeps across it.
- **Length and pace.** 20–45 s, following the use-case table in §11. A full build within a few seconds, a label held chars ÷ 12 + 1 s, one roundel per fact, colour once, late.
- **Captions.** Script on the deckled slip, in the language spoken, at 46–52 px so it reads at phone size; at most two lines, never over a label.
- **Sound.** `tick` on each burin lift and each cut letter, `clean-ding` as a roundel's ring is scribed, `zoom-swish` for a roundel's flight, `thock` for the press and the slip tapped down, `shimmer` as the wash blooms. Burin hiss, swarf pings, paper peel, a wet brush and the chamber score (harpsichord, string quartet, viola da gamba) come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. The subtitle slip sits above y 950 (the player's controls cover the bottom 12 %); labels and roundels stay inside the 5 % margins, while the plate mark and border may run into them.
- **Length and structure.** 3–8 min as a book of plates: each chapter is one plate, or one state of a plate, 40–90 s, opened by its title cut in roman capitals with a plate number in the margin. Re-hook every 30–60 s: a roundel opens on an invisible detail, a proof is pulled and the mirrored copper reads true, a region is burnished out and re-cut, colour arrives. Hold each finished plate ≥ 4 s. 24 fps.
- **The first 10 seconds.** The finished, coloured plate first; burnished back to its first line, with the question written as a script note by 5 s; the promise by 10 s. A channel sting comes after that.
- **Captions.** Burned in on the slip, plus an `.srt`.
- **Thumbnail.** The coloured plate with one magnified roundel, up to three words in Bodoni Moda capitals.

### Good for

Museum and collection explainers, natural history and science, anatomy lessons, brand heritage, maps and site plans.

## 1. Essence, and what it is not

An **intaglio print**: the line is ink held in a groove a burin cut into copper. Three rules:

1. **Tone is made of lines, never of fills.** Light is bare paper; half-tone is one family of parallel lines; shadow a second family crossing it; the deepest dark a third, lozenge-making family. No grey fill anywhere in the ink.
2. **Every line swells and tapers.** The burin enters fine, bites deeper mid-run and lifts out to a point. Lines thicken where the form turns from the light and vanish where it faces it; contours are cut in several runs and thin where runs hand over. A uniform-width line reads as a pen or vector drawing — never.
3. **Colour comes afterwards, by hand**: transparent watercolour laid flat region by region over the finished black print, spilling past the lines, pooling at its edges, ink always on top. A video may stay monochrome long; colour arriving is an event.

Not a **Woodcut Print** (black block, white gouges), not a pen sketch (loose broken lines — **Urban Sketch · Pen & Wash**), not an engineering drawing (**Blueprint**), not a sepia filter.

## 2. Materials & rendering

- **The sheet is the world**: 1920×1080 world units of laid paper (cream, ~`#f1e8d2`) with world-space texture (fibres, laid lines, sparse foxing) that zooms with the camera; a pressed, bevelled **plate mark** and a ruled border (rule + hairline) frame it.
- **Ink** is one warm near-black (~`#1c1510`). Width ratios: outlines heaviest (swelling ×0.45–1.35), first hatching from a hair (~0.18 px) to ~2 px, crossing ~0.8×, third family ~0.6×, hair and stipple finest. Spacing is **relative to the figure** (~1/180 of its height, a little wider per later family) so small figures never go grey.
- **Swell law** for every hatch line: width × (0.2 + 0.8·sin(πu)^0.7), tapered over its first and last ~22 %. Families switch on by tone thresholds (~0.14, ~0.5, ~0.75 on a 0–1 tone).
- **One light direction** for the whole video (upper left by convention); heavier outlines away from it; tone fields come from the shape (pillow lighting, analytic spheres and cylinders), never from texture. **Occlusion** is geometric: lines stop at the shapes in front.
- **Roundels**: double-ruled circle, ruled-machine ground with a white halo round the subject, content authored at a large radius and scaled in. **Leaders**: hairlines from a dot on the part to the rim, routed with clearance, a small italic figure number at the root.
- **Hand colouring** multiplies over paper and under ink: a few px of spill, slight misregister, tide-line at the wet edge, low-frequency density lift, occasional backruns, granulation; each region blooms from where the brush touched.
- **Copper** (when shown): polished warm metal, polishing hairlines, a soft reflected window; grooves = dark trough + bright burr toward the light. The **burin** (lozenge steel shaft, bevelled face, mushroom handle) is held low and turned ≤ 15° off the line so the fresh groove shows; **swarf** is a narrowing ribbon curling ahead of the point, one edge lit.

## 3. Colour logic

- The print is two values, paper and ink; all tone is line density.
- Colour is **transparent wash only**, in muted earth and mineral pigments, one stronger pigment at most. Never opaque, never on lettering, rules or paper outside the figure.
- Reserve it: the whole subject at one moment, or only the part that matters — or none.
- Example wash sets: an amber insect with blue-grey wings; a map with a sea-green coastal band on buff land; one madder-rose organ on an otherwise black anatomy plate.

## 4. Type & subtitles

- Lettering belongs to the plate: **roman capitals** (Bodoni Moda; title ~44–56 px, wide tracking; labels ~15–19 px in 16:9, about 1.4× that in a reel), **italics** for scientific names (~20–24 px), **script** (Pinyon Script) for notes, fixed size, balanced over two lines, never shrunk.
- Roman letters are **cut glyph by glyph**; script is **written** in one left-to-right stroke. Nothing fades in.
- Subtitles: one language, the one spoken, in script on a deckled paper slip, bottom centre, ≤ 2 lines, never over a label. Hold ≥ max(1.8 s, speech + 0.6 s). An engraved note stays in frame chars ÷ 12 + 1 s from when it starts writing.

## 5. Motion quality

- **Cutting order is the animation**: outline → first hatching sweeping across each form → crossing → darks, hair, stipple. Strokes run at constant burin speed, many at once (a few for outlines, dozens for hatching).
- A long single stroke may be followed by the camera; start it partly cut so no frame is empty. Keep a full build to a few seconds.
- Roundels fly on an eased arc with a small lift, growing log-linearly to size. Colour blooms from one point with a ragged front and a wet rim that dries; regions staggered.
- Nothing fades or slides like UI: lines are cut, text cut or written, colour blooms, sheets are pressed, peeled or laid down.

## 6. Camera grammar

The camera is a **loupe over a sheet**. A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| Loupe following the burin tip | One point of attention; making | a first mark; a signature |
| Log-zoom pull-out | The line was part of something larger | scale reveal; context |
| Push to a part, ride with its roundel | Where → what, in one take | an invisible detail; a mechanism |
| Tilt/pan along the sheet at reading zoom | Labels in order | a parts list; a coastline |
| Pull back while something flies | Everything placed in relation | acceleration; summary |
| Locked frame, or a ≤ 2 % breathing push | The plate as document | reading time; colour moving |
| Raking view across the copper | The groove as depth | the cost of craft |
| Cut from mirrored copper to true proof | Reversal | a hidden truth; before/after |

Framing: subject inside the plate mark, labels and roundels in the margins; order details so push-ins never crop a note early. Transitions from printmaking only (proof pulled, tissue guard laid over, region burnished out and re-cut, new sheet on the bed); no dissolves or wipes.

## 7. Sound palette

- **Foley by material**: paper (peel crackle, slip tapped down, tissue rustle, sheet whoosh); press (roller rumble, thump); copper and steel (high band-passed burin hiss with chatter and faint plate ring, swarf pings, a tick on lift, circular scribe, burnishing rub); ink and water (pen scratch, ticks for cut letters, a water plip and wet brush swish). Hatching = micro-scratches denser each pass.
- **Room**: a quiet workroom (faint clock), paper room once the print exists.
- **Instruments** (choose): harpsichord, string quartet, solo cello or viola da gamba, lute, chamber organ, glass harmonica for a cold subject. Plucked and dry while lines are cut; bowed or sustained only when something soft arrives; tiny tings for a scribed ring, a low pluck on landing.
- **Silence** is real: cut room tone too, keep at most one small sound.
- **Mix**: melody an octave above the voice, music ~half under speech, master −14 LUFS. Voice: one quiet curator or naturalist, unhurried.

## 8. Native moves

A menu: use the ones your story needs.

- **The cut.** Burin mid-stroke, swarf rising, nothing else. *Fits:* the first line of a treaty; a watchmaker's scribe; a coast being charted.
- **The three passes.** Form gains volume pass by pass. *Fits:* a building from its plan; a portrait emerging; a skill improving.
- **Magnification roundel.** Ring scribed, burnished, re-cut larger, flown to a margin with a leader, label cut on landing. *Fits:* a gear in a clock; a pollen grain; a harbour inset on a chart.
- **The proof.** Sheet peels off; mirrored copper becomes true paper. *Fits:* a secret out; a draft made final; a coin's die and strike.
- **States of the plate.** A region burnished out and re-cut. *Fits:* a border redrawn; before/after; a design revision.
- **Hand colouring.** Washes bloom after the print. *Fits:* one organ lit; a flag on a historical map; a ripening fruit.
- **Natural size.** A tiny true-scale figure beside the engraving. *Fits:* a seed by its tree; a chip by its circuit; a stamp by its enlargement.
- **The finished plate.** Every label and credit, locked. *Fits:* a museum label; a frontispiece; a certificate.

## 9. Pitfalls of the medium

- Uniform width reads as pen → swell every hatch, pinch contours where runs hand over, keep the minimum width hair-fine.
- Overlaps without occlusion → subtract the shapes in front ring by ring (an even-odd fill would cancel overlaps).
- Outline-only parts beside a hatched body → hatch along each part's axis, a dark at every joint.
- Burin along the cut hides the groove; big skew looks like poking → ≤ 15°. Regular swarf helix reads as a spring → vary winding, twist, light one edge.
- Reflections over grooves wash them out → copper light first. Roundels authored small freeze sub-pixel → author large, scale in. Leaders hugging the subject read as crossing it → clearance.
- A long early stroke never draws → when skipping strokes that have not started, look back by the longest stroke's duration.
- A push-in cropping a fresh note breaks the reading rule → put consecutive details on one side (in a reel, on the same side of the subject, above or below).
- Scientific names: the voice may manage them, the transcript that gives the word timings won't → give the aligner a plain spelling.
- Hair-fine lines vanish at phone size → in a reel, keep spacing relative to the figure and test the first frame at final size; the script slip and labels stay inside x 72–900, y 269–1248.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas, drawn as a pure function of `t`, at 2× size so hairlines survive. Paper texture lives in world space and zooms with the loupe; screen grain, if any, is drawn last.
- An **ordered stroke store**: every line is a polyline with a width profile (the swell law), a start time and a duration from constant burin speed. Drawing frame `t` means drawing every started stroke up to its cut length; the build order (outline → first family → crossing → darks, hair, stipple) is just the order of start times.
- Generators for tone: parallel hatching in up to three families switched on by tone thresholds, contour hatching along a form's axis, outlines cut in several runs with pinches at the hand-overs, stipple and fur; tone fields from analytic shapes and pillow lighting. Any SVG path becomes an engraved figure given a position, a light direction and a spacing; occluders are subtracted ring by ring.
- Plate furniture: the sheet with plate mark and ruled border, roman text cut glyph by glyph, script written along one stroke, roundel frames authored large and scaled in. The wash is its own layer, multiplied over paper and under ink, blooming from a seed point with a ragged front and a tide-line. Copper, burin and swarf are a separate shaded pass for the shots that show the plate.
- Labels are cut on the word that names the part; colour blooms on the word that names what it marks. Cues in `cues.json`: burin lifts, cut letters, each roundel's ring and landing, the proof peel, the press, the wash.

## 11. Variation space

You decide subject, details, order, opening, ending, camera path, colour, pacing and music. Use cases are **grammar for the order and duration of information**; build your own timeline from the user's facts.

| Use case | Information order | Hold per layer | Length |
|---|---|---|---|
| **Museum label / case screen** | title + scientific name → detail + term + note (×N) → where to see it | title ≥ 2.2 s; note ≥ chars/12 + 1 s; final ≥ 4 s | 30–40 s |
| **"One minute on …"** | question → name → 2–3 facts → one number → follow prompt | number ≥ 2.5 s alone | 35–60 s |
| **Textbook figure** | figure → parts labelled one by one → caption | label ≥ chars/12 + 1 s | 20–45 s |
| **Craft heritage** | object → 2–3 craft details → maker / edition | as above | 30–45 s |
| **Map / site plan** | place → insets → legend → visiting info | inset ≥ 3 s; legend ≥ 4 s | 30–45 s |

Push past the obvious single specimen plate:

- Structures: **states of one plate** (one view re-cut three times as a place changes); **a book of plates** (four small plates turned like pages, one fact each, no roundels); **a dissection** (parts labelled in teaching order, colour only on the part taught).
- Openings: **the finished proof burnished back** to its first line; **on paper at 1×** (title cut first, figure grows below); **raking light over blank copper** as the design is traced.
- Endings: **plate beside its proof**; **the natural-size figure** held alone; **a blank new sheet** laid on the stack.

Re-running an earlier video's code with new content only checks that the build re-flows; it is not a way to make a video.
