# Marker on Paper

> A worked problem in three felt-tip markers on plain white paper: black draws the situation, blue marks what we know, red marks what we want, and the same colours carry into the algebra until the red answer is circled; the camera follows the nib, pushes through a mark into the next sheet, or peels the sheet away. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): a teacher working a problem on a pad under a document camera (one pen at a time, nothing prepared in advance); back-of-the-envelope physics in the tradition of Fermi problems (estimate, drop what is tiny, get a number); colour-coded maths teaching where a quantity keeps its colour from picture to equation; napkin sketches (a few strokes, then the point). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The sheet is portrait, 1080×1920, and the camera never shows beyond its edges. The question is written at the top (x 96, baselines y 340 and 450, 96 px); the drawing takes y 520–900; the algebra runs down y 940–1180 at 64 px; the answer, 96 px red, circled, sits at y 1150–1240. A circled sheet number sits at x 860, y 330. Every line of algebra stays inside x 72–900; break long equations in two rather than shrinking them.
- **The first 3 seconds.** Frame 1 shows the black ground line already half drawn, the nib moving; by 1 s a small figure stands on it; the question is written by 2.5 s while it is spoken; at 3 s the first red stroke marks the unknown.
- **Length and pace.** 25–45 s, two or three sheets. One sheet for the situation, one for the algebra, one for the comparison; a push or a peel between them.
- **Captions.** A torn slip of the same paper, centred on x 540, at most 720 px wide, bottom edge at y 1236, one or two lines of 40 px.
- **Sound.** The pack's `zoom-swish` (the push through a mark), `latch` (the sheet number circled), `ratchet` (a term scribbled out), `clean-ding` (the answer circled), `sub-impact` (the contrast reveal). Marker squeaks, paper and the woodwind score come from a free sample library.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Lift the caption slip so its bottom edge is at y 940; the 5 % margins hold the sheet number and the question.
- **Length and structure.** 3–8 min as a pad of sheets. **One chapter is one problem step** (45–90 s, one or two sheets): set up the picture, mark knowns in blue and the unknown in red, write the relation, simplify, substitute, circle. Sheets are numbered in circles top right, so the number is the chapter marker. **Sheets turn two ways**: a push through a mark (the camera dives into a right-angle box or a symbol until it fills the frame, and the next sheet arrives with the same mark at the same size and turn), used when the next step looks closer; and a peel (the corner lifts and a fold sweeps from bottom right to top left in 0.8 s), used when the next step starts over. The last chapter peels back to sheet ① and writes the answer in red on the very first drawing.
- **Re-hooks every 30–60 s.** A wrong turn scribbled out with a note above it; a tiny term dropped; real numbers substituted (blue becomes digits); a to-scale bar chart that contradicts intuition; the answer circled with a double underline; a guess written early in pencil-thin red and checked later.
- **The first 10 seconds.** Strongest image first: the situation half drawn, the nib moving. The question written by 5 s; by 10 s the red line marks exactly what we'll calculate, which is the promise.
- **Captions.** Burned in as the torn slip (it is part of the sheet); export the same lines as `.srt`.
- **Thumbnail.** A real frame of the circled red answer next to the drawing that asks for it, the sheet number visible; at most three words, written in the same marker.

### Good for

Worked problems, physics and maths explainers, estimates and "how big/far/fast" questions, lessons and revision, engineering back-of-the-envelope checks.

## 1. Essence, and what it is not

1. **Three markers, three meanings.** Black draws and writes the structure, blue is what we know, red is what we want. A quantity keeps its colour from the drawing into the algebra.
2. **Worked live.** Nothing is pre-printed: the question is written as it is asked, the picture before the maths, the maths in steps, the answer last.
3. **Real felt-tip ink.** A bullet nib of near-constant width with a soft touch-down, ink that pools at corners and darkens where strokes of the same colour cross, a faint breathing wobble.
4. **The page moves by paper.** Sheets are pushed into or peeled away; no slides, no wipes.
5. **One circled answer per sheet.** Every sheet ends on a red number or rule, circled and underlined.

Not **Sketchnote** (no grey, no yellow, no boxes, no poster layout; this is maths on scrap paper). Not **Whiteboard Explainer** (no hand in frame, no whiteboard sheen, no erasing; mistakes are scribbled out). Not **Stick-figure Explainer** (figures are a few marker strokes in service of the geometry, not actors). Not **Tablet Sketch Explainer** (no pencil, no colour fills).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Question | x 122, baselines y 200 and 318 | 112 px Kalam Bold black, underlined with one long stroke |
| Sheet number | circle r 34 at x 1806, y 104 | the numeral 52 px inside; drawn in 0.28 s when a sheet starts |
| Drawing | left half, or full width under the question | the situation, black; known lengths blue; the unknown red |
| Algebra | x 1060 onward, lines 160 px apart from y 320 | 70 px; same colours as the drawing |
| Answer | under the algebra, about y 810 | 112 px red, circled with an ellipse, two underlines |
| Notes | above or beside a term, 40–48 px | "tiny", "known", short words in black regular |
| Caption slip | centred, bottom edge y 940 | 31–38 px |

The camera never shows past the sheet's edges at zoom ≥ 1. Give every equation a full line; when the algebra needs more room, follow the pen down rather than shrinking type.

## 3. Materials and rendering

- **Paper**: white `#FAF9F5`, a per-pixel grain, a fine tooth, a cloudy formation at 90 px scale, a few hundred faint 1 px fibres, and one barely visible light fall-off from the top left, as if a lamp sits over the desk. Paper is drawn through the camera; when the camera moves, the tooth is replaced by its mean so it never crawls.
- **The nib**: each stroke is a ribbon of near-constant width (8–9 px for figures, 5 px for circles and guides), starting at 86 % width and swelling over three widths, lifting 10 % over its last two widths, with round ends.
- **Hand wobble**: a slow offset of up to 1.9 px over 260 px of path plus 0.35 px of fine jitter; straight lines bow by 1 % of their length; corners are found before the wobble so they never flicker.
- **Ink density**: each colour is its own coverage layer; one stroke adds one unit, overlaps of the same colour add more and darken by transmittance to the power 1 + 0.6 × (units − 1); corners where the nib turns sharply pool a little extra ink. Different colours multiply.
- **Hand habits**: rectangles are four separate strokes overshooting each corner by 7 px; circles overlap their start by 0.22 rad; arrows are a shaft and two separate head strokes 30 px long; hatching is separate parallel strokes 18 px apart at −0.9 rad; dashed lines 26 on, 16 off; wavy arrows for heat or light.
- **No shadows, no blur, no outlines on letters.** Ink stays inside its stroke.

## 4. Colour logic

- **Black** draws the world and writes everything that is neither known nor wanted: operators, words, the question.
- **Blue** is a known quantity: a measured length, a constant, a given number. It appears in the drawing first, then in the algebra in the same colour.
- **Red** is the unknown and, at the end, the answer. One red thing per sheet until the answer; the answer circle and underlines are red.
- **Colour follows the quantity, not the step**: when `d` is red in the picture it is red in every equation.
- **Never**: a fourth colour, coloured fills, coloured paper.

| Role | Hex |
|---|---|
| Paper | `#FAF9F5` |
| Black marker | `#1B1C20` at 97 % |
| Red marker | `#E23B2E` at 90 % |
| Blue marker | `#2456D6` at 90 % |
| Peel flap (back of the sheet) | `#E2E0D9` → `#F7F6F2` |

## 5. Type and captions

- **Faces**: Kalam (OFL), Bold for everything written on the sheet, Regular for small notes and captions. For another script, a marker-style open face such as LXGW Marker Gothic (OFL).
- **Written with the nib**: each glyph is revealed along its centre-line skeleton; finished glyphs are filled whole. Each glyph sits ±1.75 % of its size off the baseline, turns ±0.0225 rad and scales ±2 %. Between items the pen lifts for the equivalent of 22 px of travel.
- **Sizes**: question and answer 112 px; algebra 70 px; superscripts about 60 % of their line; notes 40–48 px; sheet number 52 px.
- **Mixed colours in one line** are written left to right, switching markers mid-line exactly where the quantity changes.
- **Captions**: a slip of the same paper with torn ends (7 px jagged edges), centred, fading over 0.12 s; one line of 31–38 px Kalam Regular in black. Hold each for at least max(1.8 s, speech + 0.6 s), ending 0.05 s before the next.

## 6. Motion

- **24 fps** with the drawing on twos: every mark advances 12 times a second and the boil cycles three drawings of every line (0.85 px). Letters never boil. The camera moves on every frame, smoothly. A reel renders at 30 fps with the same 12 fps drawing clock.
- **Stroke speed**: the nib moves at a steady pace inside a pen action; a whole equation line takes 1.5–3 s, a figure 0.6–1 s, a circle 0.2–0.5 s.
- **Order**: the picture before the numbers; black structure, then blue knowns, then red unknown; the relation, then simplification, then substitution, then the answer.
- **Scribble-out**: a dense zig-zag of black over a term (0.3–0.5 s), then a small note above it. Nothing is ever erased.
- **Easing**: camera keys use cubic in-out by default, cubic out for arrivals, `t^2.6` for pushes; zoom interpolates in log space.
- **Never moves**: ink already on the sheet.

## 7. Camera

| Move | What it expresses | What it can serve |
|---|---|---|
| Hold on the whole sheet (zoom 1) | the problem as a whole | the question, the final answer |
| Follow the nib (zoom 1.3–1.8) | thinking step by step | algebra lines, labelling a drawing |
| Push in on a term or mark (zoom ×2–3, `t^2.6`) | "look here" | the term to drop, the right angle, the answer |
| Push through a mark into the next sheet (match cut at zoom ~7, a few degrees of turn) | looking closer at the same thing | from the situation to its geometry |
| Pull back across the sheet (2–3 s) | the comparison revealed | a to-scale chart, a contrast |
| Peel to a new sheet (0.8 s) | a new start | a new case, a new chapter |

Rotation only on a match cut. At zoom ≥ 1 the view is clamped inside the sheet. Forbidden: dissolves, slides, shake, any view of the desk.

## 8. Sound palette

| Layer | What |
|---|---|
| Score | about 100 BPM (a bar = 2.4 s), modal and light: a walking pizzicato bass under the drawing, clarinet and bassoon filling the pauses in the algebra, shaker, claves and woodblock for pulse, glockenspiel climbing into a push, a major chord when the answer lands, a harp run on the biggest reveal. |
| Foley | a bullet-tip felt marker on matte paper: a soft squeak for each stroke, scaled by its speed; a tap for each touch-down; quick flicks for hatching; a scratchy scribble for crossing out; air for the push; a corner lift, crackle and slide for the peel. |
| Silence | the music stops during a peel (paper only) and almost vanishes during the big pull-back. |
| Mix | a calm narrator about 15 % slower than conversational, so the nib keeps up; voice compressed, music about 10 dB under it and EQ'd out of 300 Hz–4 kHz, foley about 7 dB under. Master −14 LUFS, true peak −1 dB. |

## 9. Native moves

1. **Colour-coded algebra.** Known quantities written in blue in the drawing reappear in blue in the equation; the unknown stays red throughout. Build: mixed-colour text lines laid out once, written left to right with marker changes mid-line. Fits content like: any formula derived from a picture; unit conversions; finance with knowns and unknowns.
2. **Drop the tiny term.** A term is scribbled out and a one-word note written above it, then the simplified line follows. Fits content like: approximations; ignoring air resistance; rounding small costs.
3. **Push through a mark.** The camera dives into a small symbol until it fills the frame; the next sheet arrives with the same symbol at the same size and angle and pulls back to a closer view. Fits content like: zooming from a scene to its geometry; from a map to a detail; from a system to one part.
4. **The peel.** The bottom-right corner lifts, a fold line sweeps diagonally, the flap shows the sheet's back, and a clean sheet lies under it. Fits content like: a second case; "now try bigger numbers"; a new chapter.
5. **To-scale contrast.** Three rows of growing size, each with a bar drawn to scale in red; the last bar runs across the whole sheet as the camera pulls back. Fits content like: area versus length; costs versus scale; numbers that grow slower than expected.
6. **Circle the rule.** The general rule is written last, top right, and circled in red as the final stroke of the video. Fits content like: a formula worth remembering; the takeaway of a lesson; a rule of thumb.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D with one float-free coverage canvas per ink colour; every stroke is added with `lighter` so overlaps accumulate units, then a compose pass multiplies the inks onto the paper per pixel.
- Strokes are drawn through the camera matrix (crisp at any zoom); paper is drawn through it too.
- Each sheet is a list of pen actions `[t0, t1, items]`; items are strokes and laid-out texts, drawn in order with pen-lift gaps, up to the nib's length at `t`. Build each sheet three times with the same seeds for the three boil drawings.
- Quantities are computed from a facts table, so every number on the sheet is the arithmetic of its inputs.
- Handwriting from glyph skeletons: thin the font's glyphs to centre lines once; reveal the glyph being written by stroking a wide mask along its skeleton.
- Export one event per stroke and per glyph (time, length, speed, pan) for the marker foley and `cues.json`; export every written line with its on-screen box for the reading check.

## 11. Pitfalls

- **A fourth colour** or a highlighter ruins the code; the viewer must be able to trust blue and red.
- **Algebra too small.** If an equation needs zoom 0.8 to fit, split it across two lines or sheets.
- **Boiling letters.** Only lines breathe; text that jitters reads as broken.
- **Rushed narration.** The nib needs time; a fast voice leaves half-written equations on screen while the next idea starts.
- **Numbers that don't add up.** Compute every value from its inputs; never type a rounded number by hand.
- **Scribble-outs that hide the thing.** Leave a hint of the term visible through the scribble.
- **The app's buttons.** In a reel, nothing that must be read below y 1248 or right of x 900; on YouTube nothing in the bottom 12 %.

## 12. Variation space

The agent decides per video: the problem and its sheets, which quantities are blue and red, where a push or a peel turns the page, whether a figure appears, the narrator.

- **Three structures:** one problem worked end to end; the same formula applied to three cases of growing size; a wrong intuition written first, then corrected with the maths.
- **Three openings:** the situation half drawn with the nib moving; the question written large on an empty sheet; a red guess written and circled with a question mark.
- **Three endings:** the circled answer with a double underline; a peel back to sheet ① to write the answer onto the first drawing; the general rule written top right and circled as the last stroke.
