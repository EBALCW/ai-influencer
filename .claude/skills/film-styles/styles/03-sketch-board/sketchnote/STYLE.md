# Sketchnote

> A page of lecture notes on dot-grid paper that writes itself: black fineliner, grey marker for volume and one yellow marker for what matters, while the camera rides close behind the pen and finally pulls back to show the finished page as a poster. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Mike Rohde's sketchnote practice (a clear hierarchy of title, containers, connectors and one accent); live graphic recording at talks (the page fills in the order of the speech, and the whole wall is the payoff); student notebooks on dot-grid paper (margins, numbered steps, a circled answer); information posters (the finished page must read on its own). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The page is portrait, 1080×1920 in world units, dot grid to every edge. Title banner across y 290–420; the steps stack as a single column of boxes (or a 2×2 grid) joined by fat yellow arrows pointing down, inside x 72–900, y 440–1150; the takeaway (a big number or an equation box) sits at y 1150–1248. Below y 1248 the page carries only doodles, the footer and the caption slip's paper. During the ride the camera works at zoom 1.6–2.6, so at any moment the words being written sit inside the safe box.
- **The first 3 seconds.** Frame 1 is a close-up (zoom about 3) of a small drawing already half inked in the corner where the takeaway will live; the pen's line is moving on frame 1; the hook number is written by 1.5 s and swiped yellow by 2.5 s; the caption asks the question by 3 s.
- **Length and pace.** 25–45 s for three or four steps. One step every 5–8 s, each ending on a 1 s hold; a whip tilt to the title around 6–8 s; the last 4 s are the pull-back to the whole page.
- **Captions.** A paper slip with a strip of washi tape, centred on x 540, at most 720 px wide, bottom edge at y 1236, one or two lines of 42 px. It sits on top of the page, not on it.
- **Sound.** The pack's `zoom-swish` (the whip tilt and the final pull-back), `ui-click` (a pen tap on each bullet and number), `sparkle` (yellow rays round a key drawing), `shimmer` (the page finished), `clean-ding` (the last stroke circling the answer). Pen and marker scratch, paper and the mallet score come from a free sample library.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. The caption slip and every word being read stay above y 950 and inside x 96–1824; the page's own footer may sit lower, since it is read only on the final pull-back.
- **Length and structure.** 3–8 min as a notebook. **One chapter is one page** (60–90 s, three to five steps); its pages lie side by side in world coordinates, 160 px of desk between them. Each page follows the same arc: a hook drawing in its corner, a whip tilt up to its ribbon title, the steps written left to right with the camera riding the pen, a dive into one tiny drawing, the takeaway band, and a pull-back to the whole page held 2–3 s as that chapter's poster. **The turn**: the last arrow on a page runs off its right edge; the camera follows it across the desk gap onto the next blank page, where it becomes the first stroke. The final chapter pulls back over every page at once (zoom 0.84 ÷ pages), then pushes into the first page's hook to circle the answer, so the video ends where it began.
- **Re-hooks every 30–60 s.** Rotate through: a dive into a drawing too small to read at page zoom (×6–14); a match cut on a yellow shape; a big number written then swiped; a margin question with a "?" that a later page answers with a yellow arrow back to it; a callback, where the camera returns to an earlier page and adds one stroke.
- **The first 10 seconds.** Strongest image first: the hook drawing being finished in close-up, its number already yellow. The question by 5 s in the caption; by 10 s the whip tilt has revealed the title banner, which is the promise of the video.
- **Captions.** The paper slip is part of the look, so it stays burned in; export the same lines as `.srt`.
- **Thumbnail.** A real frame of one finished page, cropped to the title banner and the biggest drawing, with the one yellow-swiped word; at most three words, all written in the page's own lettering.

### Good for

Lecture and course notes, science and how-it-works explainers, book and talk summaries, one-page recaps of a process, onboarding guides.

## 1. Essence, and what it is not

1. **One page, written in order.** Everything on screen belongs to a single finished page; the video is the order in which it was written. Nothing appears that the pen didn't draw.
2. **Three tools only.** A black fineliner for every line and letter, a grey marker in three strengths for volume and shadow, one yellow marker for the point.
3. **Hierarchy you can see.** Ribbon title, numbered step ribbons, rounded boxes, fat arrows, a big number, a circled answer: the structure of the idea is the structure of the page.
4. **The camera is the reader's eye.** Close behind the pen while it writes, diving into small drawings, then pulling back so the page reads as a poster.
5. **The ending is the page.** The pull-back to the whole page is the payoff and the thumbnail.

Not **Whiteboard Explainer** (no hand in frame, no white board, no erasing; the page only grows). Not **Marker on Paper** (one black felt-tip working a single problem, no grey, no yellow, no containers). Not **Tablet Sketch Explainer** (pencil construction lines and colour fills that slip off their outlines; here colour is marker and only yellow). Not **Stick-figure Explainer** (typeset headings and clean vector figures; here every letter is handwritten).

## 2. Frame and layout (1920×1080)

The page is 1920×1080 in world units; the camera shows part of it at zoom 1.5–2.6 while writing, all of it at zoom 0.84 at the end (with the footer just below the page edge).

| Zone | World position | Content |
|---|---|---|
| Title banner | x 180–1140, y 40–170 | ribbon with folded tails, 72 px caps, the key word 82 px over a yellow swipe |
| Course tag | right-aligned to x 1836, y 86 | 30 px small caps, ruled underneath |
| Step row | y 230–640, four columns about 330 px wide | numbered yellow ribbons (36–40 px), rounded boxes 330×380 (r 28), drawings, a 36 px label and two 28 px notes each |
| Connectors | between the columns, y ≈ 430 | fat yellow arrows 30 px thick with 36 px heads and a grey drop shadow |
| Takeaway band | y 690–850 | the hook drawing and its number, the big number (54 px over a yellow swipe), the equation box |
| Footer | under the page, y 1082–1114 | dashed rule, the video's name in 32 px, read only on the pull-back |
| Caption slip | screen space, centred, bottom at y 940 | one line, 40–42 px |

Leave 120–200 px of bare dot grid round every group; a sketchnote page breathes. One idea per box, at most two lines of notes under a drawing.

## 3. Materials and rendering

- **Paper**: `#FBFAF6` with a dot grid every 26 px (1.3 px dots, warm grey at 55 %) and a scatter of faint brown specks. Grid and specks belong to the page, so they move with the camera.
- **Fineliner**: every path is resampled every 3 px and pushed sideways by three octaves of smooth noise (about 1.5 px). Two passes: the main line at 3.6 px and 94 %, then a thinner second pass at 62 % width, 50 % opacity and 1.4× the wobble, so lines look gone over twice. Width breathes ±22 %. Closed shapes start at a random point and overshoot their join by 2–5 %.
- **Marker**: semi-transparent, `multiply`, laid as parallel strokes 18 px wide at −0.55 rad and 0.62 stroke-widths apart, each slightly bowed, clipped to the shape and swept across it; when finished, a 4 px darker edge appears where ink pooled. Grey comes in three strengths (16 %, 28 %, 45 %); a 45 % grey stroke is a fold or a cast shadow.
- **Drop shadows** are grey marker offset 9–10 px down-right for boxes, 5–6 px for arrows. Fills under ribbons and arrows are paper-coloured, so lines behind them disappear.
- **Small hidden detail**: drawings can be inked at 0.3 px lines inside larger ones; they are invisible at page zoom and appear only when the camera dives in.

## 4. Colour logic

- **Yellow means "this"**: the key word, the number, the step ribbons, the arrows of the process, the finished product. Never decoration, never a background, never two competing yellows in one shot.
- **Grey means form**: shading, wings, shadows, the parts that matter less. Black is only line and lettering.
- **A darker yellow** is a pen, not a fill: rays, the loop round the answer, swooshes.
- **Never coloured**: the paper, lettering, the caption slip. If a second hue seems necessary, the idea needs a second page.

| Role | Hex |
|---|---|
| Paper | `#FBFAF6` |
| Dot grid | `#969084` at 55 % |
| Fineliner | `#1E1E22` |
| Secondary pen (small notes) | `#5B5852` |
| Accent marker | `#FFCD28` at 80 %, multiply |
| Accent pen (rays, loops) | `#F5AA00` |
| Accent shade | `#E88C00` at 22 % |
| Grey marker, light / mid / dark | `#64646E` 16 % / `#50505C` 28 % / `#343440` 45 % |

## 5. Type and captions

- **Faces**: Kalam Bold (OFL) for capitals: titles, step names, big numbers, equations. Patrick Hand (OFL) for small notes and the caption slip, in the secondary pen colour. Nothing else.
- **Written along skeletons**: each glyph's centre line is revealed by a fat mask at about 2,200 px of skeleton per second; each glyph sits ±3 % of its size off the baseline and turns ±0.045 rad.
- **Sizes on the page**: title 72 px, key word 82 px; step names 36–40 px; big numbers 52–54 px; notes 28–32 px. At working zoom (about 2×) a 28 px note reads as 56 px on screen.
- **Emphasis is marker, not type**: a yellow swipe 34–58 px tall drawn just before or with the word, or a darker yellow loop drawn round it afterwards.
- **Caption slip**: paper-coloured at 95 %, radius 10, a soft grey shadow (5 px), a strip of grey washi tape across its top-left corner turned −0.16 rad; it rises 6 px over 0.3 s and fades in and out over 0.2 s. Text Patrick Hand 40–42 px, centred. Hold each for at least max(1.8 s, speech + 0.6 s), ending 0.12 s before the next line.

## 6. Motion

- **24 fps** for YouTube; a reel renders at 30 fps but steps its own clock. The fineliner's wobble boils on twos (12 drawings a second), cycling three drawings; shapes and positions never change.
- **Everything is a stroke with a start and a length.** Lines draw along their path; marker fills sweep across their shape; letters write in pen order. Typical durations: a box 0.32 s, an arrow 0.22 s, a ribbon 0.3 s, a bullet 0.06 s, a yellow swipe 0.2–0.3 s.
- **Sketch speed**: complex drawings can be time-stretched (×1.4–1.6) so the eye can follow them; repeated drawings get faster each time (the ninth repeat takes 60 % as long as the first).
- **Order inside a group**: outline → paper fill → marker → shadow → label. Shadows always land last, about 90 % of the way through their object.
- **Easing**: camera keys use cubic in-out; whip moves use quintic in-out; zoom interpolates in log space so a push feels even.
- **Never moves**: anything already drawn. No bounce, no scale-in, no slide.

## 7. Camera

The camera is `(x, y, zoom)` over the page; two keys at the same time are a cut.

| Move | What it expresses | What it can serve |
|---|---|---|
| Ride the pen (zoom about 1.45, trailing the tip slightly; blends in over 0.4 s, out over 0.8 s) | thinking as it happens | a process step, a border being drawn round an idea |
| Slow push while writing (zoom +3–6 % over a line) | attention | any held explanation |
| Whip tilt (0.8 s, quintic, a short paper whoosh) | "here's the big picture" | jumping from the hook to the title, between distant parts |
| Dive (zoom to ×8–14, 1–2 s) | there is more inside | the gears inside a watch, a part inside a part |
| Match cut on a yellow shape (same size on screen) | this becomes that | transformation, cause → effect |
| Pull-back to the whole page (3–4 s, to zoom 0.84) | the summary | the end of every chapter, the end of the video |

When zooming a long way, move the centre in step with 1/zoom so the target never swings. Allowed transitions: cuts on a matching shape, the whip tilt, the arrow that carries the camera to the next page. Forbidden: dissolves, page-curl effects, rotation, any move during which nothing is being drawn for more than 2 s.

## 8. Sound palette

| Layer | What |
|---|---|
| Score | about 100 BPM in a major key, chords that follow the chapters: marimba pulses, pizzicato cello on the bass, one kalimba note at the start of every step, glockenspiel on each reveal, bowed vibraphone held during a dive, harp and vibraphone for the finished page. |
| Foley | driven by the strokes: fineliner scratch (band-passed noise with a wobble, louder on long lines), marker squeak on fills, a soft tap on dots and bullets; every sound panned to where it draws. Camera moves are paper-and-air whooshes, low-passed. |
| Silence | the score starts only with the title (about 8 s in); before that, pen and voice alone. |
| Mix | voice about 10 dB over everything; pens step back 50 % under the voice; the music ducks 45 % and gives up about 4 dB at 300 Hz–4 kHz. Master −14 LUFS, true peak −1 dB. |

## 9. Native moves

1. **The poster pull-back.** After the last stroke the camera pulls back to the whole page and holds; the page reads as a finished one-page summary. Build: a last key at zoom 0.84 centred on the page, the footer written just as it arrives. Fits content like: the recap of a process; a book summary; a lecture's last slide.
2. **Ride the pen.** The camera trails the pen tip while it draws a box border or a long arrow, then hands back to the keys. Build: sample the path at the current progress minus 3.5–7 %, blend with the key camera. Fits content like: a cycle; a journey between steps; the border that frames the key idea.
3. **Match cut on yellow.** Push into a yellow circle until it fills a third of the frame, cut to a different yellow circle of the same screen size elsewhere on the page. Fits content like: an ingredient becoming a product; a cell becoming an organ; an input becoming an output.
4. **The hidden drawing.** A tiny diagram inked inside a larger drawing, unreadable on the page, revealed by a ×14 dive. Fits content like: the gears inside a watch; the chip inside a device; the clause inside a contract.
5. **Multiplying pens.** The same small drawing repeated, each starting before the last finishes and drawn faster. Fits content like: "a thousand of these"; growth over time; a crowd adding up.
6. **The callback loop.** The last stroke of the video is a darker yellow loop round the hook's number, back where the video began. Fits content like: a surprising stat explained; a question answered; a promise kept.
7. **Arrow to the next page.** A fat arrow runs off the page edge and the camera follows it onto a blank page, where it becomes the first line. Fits content like: chapter turns; "and then"; the next stage of a process.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D, one canvas, the whole frame redrawn from `t`: paper, then every stroke whose start has passed, with its progress `clamp((t − t0) ÷ d)`, then the caption slip in screen space.
- A stroke list (`EL`) of `{t0, d, kind, draw}`, built once in z-order by helpers (`ink`, `marker`, `text`, `box`, `ribbon`, `fatArrow`, `bullet`); each stroke owns a fixed seed so its shape never changes and only the boil phase does.
- World coordinates are the finished page; a camera function maps world to screen as `(x − cx) × z + W/2`. Design the finished page first as a poster, then decide the order and timing of its strokes.
- Handwriting from glyph skeletons: thin each glyph of Kalam and Patrick Hand to a centre line once, then reveal it by stroking a wide mask along that line with `destination-in`.
- Timing comes from the voice: a cue table (hook, title, each step, dive, pull-back) set to line starts, and helpers to stretch a group to sketch speed.
- Export one event per stroke (kind, time, length, pan from its screen x) for the foley layer and `cues.json`, and every written text with its screen box for the reading check.

## 11. Pitfalls

- **A page too full to read as a poster.** If the pull-back frame doesn't read at phone size, cut a step or give it its own page.
- **Yellow everywhere.** More than one yellow focus per shot and the accent stops meaning anything.
- **Notes too small at working zoom.** Check every note at the zoom it is read at; 28 px on the page is the minimum at zoom 2.
- **Camera swing on big zooms.** Interpolating centre and zoom linearly makes the target slide off; tie the centre to 1/zoom.
- **Waiting with nothing drawing.** A held frame with no pen moving feels frozen after about 2 s; add a shadow, a swipe or a slow push.
- **Lines too perfect or too shaky.** Wobble under 1 px reads as vector art; over 3 px reads as a child's drawing. Stay near 1.5 px.
- **The app's buttons.** In a reel, nothing that must be read below y 1248 or right of x 900 at the moment it is read; on YouTube nothing in the bottom 12 %.

## 12. Variation space

The agent decides per video: the page layout (row of steps, cycle, tree, comparison, timeline), the accent hue if yellow fights the subject (one hue only), the hook drawing, how many pages, which drawing hides a dive, and the voice.

- **Three structures:** a numbered process across one page; a cycle drawn as a ring of boxes with the pen riding round it; a two-column comparison that ends on an equation box.
- **Three openings:** the hook number in the corner half-written on frame 1; a single yellow shape that a match cut turns into the subject; the blank dot grid with the title already being written and the camera whipping down to the first drawing.
- **Three endings:** the poster pull-back held with the footer written; the loop back to the hook's number; the final equation box written and swiped, then the pull-back.
