# Whiteboard Explainer

> An explainer drawn live on one glossy dry-erase board: single-line handwriting that is actually *written* stroke by stroke, floating markers with no hand, magnets that can move, an eraser that can rewind, and a camera that travels across the board instead of cutting. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): the long-form whiteboard animations of the 2010s (one continuous board, the camera travels instead of cutting, a full-board view); one-sentence-one-drawing physics explainers (the simplest geometry that carries the idea); Steve Reich's *Piano Phase* (two copies of one figure at two tempi as a structure). Never copy their drawings, characters, hands or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The board bleeds to every edge and is laid out tall (e.g. 4500×8000): regions stack down the board, so the camera tilts and rides the pen downward instead of tracking sideways. Everything that must be read is written inside the safe box (x 72–900, y 269–1248), with board writing above y 1060 and the band y 1080–1248 kept free for the subtitle label. Ghost marks, parked magnets and the sheen may sit anywhere; markers park off the top and right edges. A side-by-side duet becomes two regions one above the other, framed together.
- **The first 3 seconds.** Frame 1: the pen is already mid-stroke on the hook (the surprising number, or the object in question), ink pooling, its shadow on the gloss. By 0.5 s the term finishes on the narrator's word and the camera starts to pull back; by 3 s the pull-back has made it tiny inside something bigger, or a huge question mark is drawn beside it.
- **Length and pace.** 30–45 s: three or four regions of 6–10 s, a label in 0.3–0.8 s, a ride or a whip of 0.6–1 s between regions, one 1.5 s hold on the answer, and the full-board view for the last 2–3 s.
- **Captions.** The burned subtitle label: centred on x 540, at most 720 px wide, ~52 px, six words a line, two lines at most, baseline y ≈ 1200.
- **Sound.** `thock` for each magnet landing, `ui-click` for a marker cap off and on, `zoom-swish` on a whip to a new region, `sub-impact` on the full stop before a surprise, `clean-ding` as the answer is circled. The marker strokes, squeaks and eraser rub come from felt-on-gloss foley in a free sample library (or are synthesised from each stroke's speed); the music is a small figure from a free library or the user's own.

### YouTube (1920×1080)

- **Layout.** Sections 2 and 6 as written: a board of about 8000×4500 seen through a moving 1920×1080 camera. Labels stay inside the 5 % margins and out of the bottom 12 % (the player's controls); the band just above it (y ≈ 830–950) belongs to the subtitle label in every shot.
- **Length and structure.** 3–8 min at 24 fps; the length follows how many ideas the board must hold. **One chapter is one region** (40–90 s): its title card is the chapter's question written large (120–200 px cap height) at the top of the empty region in the accent, and the chapter ends with the answer circled or boxed. The pen's last line in one region leads the camera into the next. **How the board fills and clears**: plan the board as a map of the whole video, four to six regions; when it is full (every three or four chapters), the eraser wipes it in one long pass and the ghosts stay, so the second half is drawn over the first and can call it back. **Re-hook every 30–60 s** with a native move: a whip to a new region on a "but", a magnet entering with the hero, a two-pen duet, the eraser rewinding, a return to an earlier region, a slow push into one symbol. Leave one box empty early on and fill it in the last chapter. End on the full-board view, which doubles as the summary and as quiet edges for the end screen.
- **The first 10 seconds.** The strongest drawing or number mid-stroke on frame 1; the question written huge by 5 s; by 10 s the camera pulls back over the empty regions the video will fill, with the promise in the voice. Any channel sting comes after: a magnet with the channel's name dropping onto the board's edge.
- **Captions.** The subtitle label stays burned in; export the same lines as `.srt`.
- **Thumbnail.** A push on the hero drawing with its accent circle and a floating marker's shadow, plus up to three words in the board's own hand.

### Good for

Science and "how does X work" explainers, online course lessons, product mechanics, money maths, a comparison drawn as a duet.

## 1. Essence, and what it is not

- **One physical whiteboard.** Everything the viewer learns is drawn in dry-erase marker in front of them, in real handwriting order.
- **The board is a map**: each idea lives in its own region; the camera travels between regions, often led by the pen. Distance on the board = distance in the argument.
- **Real marker, not animated text**: ink pools where the nib lands, dry streaks and speckle, strokes overshoot and don't quite close, ghosts of old lessons remain, a glossy sheen drifts slower than the board, and **every stroke makes a sound**.
- **No hands.** Markers float with a real cast shadow that grows when they lift, park outside the frame between phrases and fly back in. Magnets and the eraser move on their own. Never draw a hand, an arm or a cursor.

Not Blueprint (no blue sheet, no drafting conventions), not Crayon Picture Book (no wax texture, no children's story), not a kinetic-type explainer (text is handwritten stroke by stroke, never animated as blocks).

## 2. Materials & rendering

- **Board**: a warm white gradient, a faint scuff and micro-scratch tile, a few dozen **ghost marks** (old words, circles, arrows) at 5–10 % in grey or pale blue, and a soft diagonal **window sheen** (white, 10–16 %) moving at ~0.35× the camera: this one detail sells "glossy".
- **Ink**: alpha ~0.94, composited with **multiply** so overlaps darken like real marker. Width 6–11 px for drawing, ~13 % of cap height for lettering.
- **Stroke character**: resampled every ~0.6 × width; low-frequency hand wobble along the normal (a few px, long wavelength) plus a finer tremor; chisel-tip width modulated by direction; a pressure ramp at the start and a small taper at the end; circles start at an angle and **overlap past closure**; rectangles are four strokes with small corner overshoot; a darker pooled dot *inside* the start of long strokes.
- **Dry-marker texture**: a speckle-and-streak tile subtracted from the ink layer (destination-out), locked to board space, faded out when the camera is wide.
- **Lettering**: a single-line (single-stroke) font written in stroke order, each glyph with small rotation, baseline and scale jitter. Missing symbols (μ ≈ → × − ✓ ² ° ±) are hand-defined.
- **Props**: dry-erase markers (white barrel, colour band and cap in the ink colour, felt nib), a felt eraser, magnets (glossy, with specular highlight and soft cast shadow). Frame, tray and wall appear only if the camera ever goes past the board edge.

## 3. Colour logic

- **Three marker colours at most**, each with a meaning held for the whole video: one dark ink for things and structure, one for signals / measurement / process, one accent for the thing that matters (one accent per region).
- **Monochrome variant**: everything in the dark ink, one element in the accent (the "only colour").
- Ghost marks and board stay neutral; the accent never appears on props except its own marker cap and the hero magnet.
- Example sets: black `#23262c` / blue `#2a5cb3` / orange `#d97757`; black / green `#2e8b57` / red `#c8363a`; navy `#1f2a44` / teal `#1f8a8a` / purple `#7a4fb3`.

## 4. Type & subtitles

- **Handwriting only**: a single-line hand (e.g. EMS Tech, OFL) for all board text; titles large (~120–200 px cap height), labels 30–70 px.
- **Title and end card are written on the board** in the same hand.
- **Burned subtitles**, in the one spoken language: an off-white rounded label (~90 %), a handwriting-like face (e.g. Architects Daughter ~44 px in 16:9), dark text, a short accent-colour marker dash. Split at clauses, at most eight words a line; in 16:9 the band just above the bottom 12 % of the frame is kept free for them in every shot (the bottom 12 % itself belongs to the player's controls). Hold ≥ max(1.8 s, speech + 0.6 s).
- **Writing finishes on the word**: a term appears exactly when the narrator says it.
- A label is fully in or fully out of every shot it appears in.

## 5. Motion quality

- **Hand speed**: every stroke follows a slow-fast-slow curve (`u − sin(2πu)/2π × 0.8`). Strokes are scheduled into a **time window** and the speed is solved, so writing always finishes on time.
- **Pen hops** between strokes lift in proportion to distance (shadow slides and blurs); long gaps send the pen off-frame to park and back shortly before its next stroke.
- **Magnet**: drop with a shrinking shadow; slide with a small lift; lift-off and sink possible.
- **Eraser**: constant speed along a path, a wide band at ~90 % strength (a ghost always remains).
- **Speed**: faster than real hands (a sped-up lesson) but never so fast the stroke order is lost: a label ~0.3–0.8 s, a title ~3 s.
- Camera on ones with real motion blur when it moves fast.

## 6. Camera grammar

A 2D camera over a large board (e.g. 8000 × 4500): position, zoom interpolated in 1/z so pushes feel like dollies, a little roll. A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Pull back from a tiny drawing | scale | a surprising size; context |
| Ride the line the pen is drawing | one idea leads to the next | a transition; a process; a path |
| Hold still | read now | an equation; a definition; a list |
| Whip to a new region | a new idea after a pause | a twist; a "but" |
| Return to an earlier region | a callback, for free | reusing a result; a comparison |
| Split view of two regions (zoomed out enough for both) | two things at once | a duet; before/after |
| Slow push into one symbol | this term is the point | a unit; a variable; a name |
| Track along a long diagram | sequence, time | a timeline; a pipeline; a journey |
| Pull back past the board edge to the wall | the whole lesson as one picture | a summary; a scale jump |

Motion blur: when the camera moves more than ~14 px per frame, render and average sub-frames (≤ 4 px apart). No cuts on the board; if a cut is needed, it is a whip.

## 7. Sound palette

- **Every stroke sounds**: band-passed felt-on-gloss noise (a hiss band ~2–7.5 kHz + body ~0.5–1.5 kHz) enveloped by the stroke's own speed curve, a tiny nib tick at the start, stick-slip grains, and on some long strokes the **dry-erase squeak** (a 1.5–2.6 kHz sine with 7–13 Hz vibrato). Each colour sounds slightly different. Pan = the stroke's screen x; closer camera = louder.
- **Props**: magnet on steel = click + metal modes + a low board thump; eraser = felt rub modulated by its zig-zag; cap off/on; marker tray bounce.
- **Room**: low room tone; a single diegetic ticker (a wall clock, a fridge hum, a projector fan) can own a silence.
- **Music** options: a solo piano figure; a small jazz trio with brushes; plucked strings and kalimba; a synth arpeggio for tech topics; clockwork minimalism (marimba, pizzicato, woodblock, glockenspiel). Mickey-mouse details: a rising whistle for growth, pings for signals, a harp run for a fall.
- **Techniques to pick from**: adding one instrument per step of a mechanism; a key change when the frame of reference changes; a full stop into silence before a surprise; the previous cue reversed and squeezed for a rewind; two copies of one figure at two tempi (phasing) for anything that diverges, snapping into unison when resolved.
- **Voice**: one clear, curious narrator at an easy teaching pace.
- **Mix**: voice on top (compressed, light room), music well under voice and ducked further under speech, foley ~11 dB under voice; −14 LUFS.

## 8. Native moves

A menu: use the ones your story needs.

- **Writing in stroke order.** The reveal is the explanation: a formula term by term as it is spoken. *Fits content like:* compound interest; the Drake equation; a recipe's ratios.
- **The pen leads the camera.** Transitions are drawn lines the camera rides. *Fits content like:* a nerve signal; a supply chain; the water cycle.
- **Magnets.** The only things allowed to move on a board: give the hero to a magnet; slide, lift, drop, sink it. *Fits content like:* a delivery truck on a route; a cell in a bloodstream; a player on a pitch.
- **The eraser rewinds.** Wiping a trail backwards reads as undoing time. *Fits content like:* an undo in software; reversing a chemical reaction; "what if we hadn't…".
- **Two pens at once.** A live duet comparing two quantities. *Fits content like:* two savings plans; two runners; a population vs its food supply.
- **Ghosts of the old lesson.** A faint previous drawing becomes relevant. *Fits content like:* a theory replaced; last year's forecast; a first draft.
- **The full-board view.** Every region seen at once as one picture. *Fits content like:* a system diagram; a history; a map of a field.

## 9. Pitfalls of the medium

- **One pen, too many jobs** drifts later and later → give each drawing a deadline window and let overlapping jobs go to another pen.
- **Minimum stroke duration × many dashes** makes a dashed line take seconds → dashes need their own floor.
- **A pooled-ink dot bigger than the stroke start** leaves halos on every letter → keep it inside.
- **Punctuation vanishes** (a font period is a 1 px stroke) → render sub-width strokes as dots.
- **Labels half-cut by a push-in** look sloppy.
- **Motion blur with few sub-frames** strobes text.
- **Eraser paths** crossing labels you want to keep.
- **Voice and phoneme set mismatch** (a British voice with US phonemes) mispronounces → match the language code to the voice; check the result against a transcript.
- **Writing under the app or the player**: in a reel, a label below y 1248 or right of x 900 is hidden by the app's buttons; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **Canvas, drawn from `t`**, over a board in its own coordinates (about 8000×4500 for YouTube, a tall board for a reel) seen through a keyed 2D camera: position, zoom interpolated in 1/z, a little roll. The board at any `t` is every stroke whose window has started, each drawn up to its progress, so any frame can be rendered alone.
- **A small shape library** (line, curve, poly, arc, circle, rect, arrow, dashed, hatch) that turns geometry into resampled hand strokes with seeded wobble, tremor, chisel width, pressure ramp, overshoot and pooled dot; text written in stroke order from a single-line font, with missing symbols defined by hand.
- **A scheduler**: each drawing gets a window that ends on the word that names it, taken from the voice's word timings; it solves hand speed to that deadline, hands overlapping jobs to a second pen, sends a pen off-frame to park in long gaps, and gives dashes their own minimum.
- **Compositing**: ink with `multiply`; the dry tile and the eraser bands as `destination-out`, locked to board space; the sheen over the board at 0.35× the camera; props, magnets and pen shadows on top; the subtitle label last, in screen space. When the camera moves more than ~14 px a frame, average sub-frames ≤ 4 px apart.
- **Cues**: export each stroke's start, end and speed curve for the marker foley; `cues.json` gets magnet drops, caps, whips, the stop before a surprise and the circled answer.

## 11. Variation space

You decide the topic's object, the board layout, the colours within the logic, the voice, the music family, the camera route, the opening, the ending and the length.

- Structures: **a proof** (one claim at the top, the board fills downward step by step, each step boxed when proven); **a debate** (two pens, two halves of the board, each drawing its side until the drawings meet in the middle); **a timeline** (one long horizontal line ridden left to right, with events hanging off it).
- Openings: **a question mark** drawn huge in the centre, then shrunk to become a dot in the first diagram; **an erased board** where the ghost of a wrong answer is still visible; **a magnet dropping** onto an empty board with a clack.
- Endings: **the answer circled** twice and the pen capped; **the board wiped** except for one line that survives; **a push into the smallest symbol** on the board, which becomes the title.
