# Chalkboard

> A real classroom blackboard on which chalk writes itself, stroke by stroke in true stroke order, with no hand, no chalk stick and no eraser in sight. One idea is taught the way a teacher does it: write what people think, wipe it with one pass, write what is true in the same place. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): a primary-school literacy lesson on a sliding double blackboard; the way a teacher underlines the parts of a word, circles one component and wipes a wrong line. Take the order of a lesson, not any teacher's handwriting.

## Formats

### Reel (1080×1920)

- **Layout.** The camera still faces the board flat; in a medium frame the room fills the dead zones. Close shots fill the width with one big word or character (500–650 px). Stack, don't shrink: a long line is panned sideways through a narrower window or broken into rows down the slate; two boards in dialogue are reached by a pan or a cut on a line crossing the seam, never squeezed into one frame.

| Zone | Position | Content |
|---|---|---|
| Wall, clock | y 0–250 | the room; nothing to read |
| Slate | y ≈ 250–1290, full width | writing that must be read stays in x 72–900, y 300–1060 |
| Subtitle plate | centred on x 540, max 720 px wide, baseline y ≈ 1210 | one or two lines on a soft dark plate |
| Tray | below y 1290 | chalk sticks, the duster; picture only |

- **The first 3 seconds.** Frame 1 is a close shot with the chalk already half-way through the popular claim. By 0.5 s its keyword is finished on the narrator's word; by 3 s the accent chalk circles the doubtful part and the felt pass of the wipe begins on "but".
- **Length and pace.** 30–45 s, one question on one board: the claim, one wipe, the rewrite in place, one sliding panel at most; a cut or move every 3–6 s, one 1.5 s hold on the verdict.
- **Captions.** The subtitle plate is the only caption layer: ~46 px, at most six words a line.
- **Sound.** `zoom-swish` on a whip between boards, `latch` as a sliding panel hits its stop, `thock` on the verdict's underline, a low-passed `clean-ding` for a distant bell, `sub-impact` under the verdict. The chalk grains, the felt wipe and the plucked-string score come from free (CC0 / CC BY) recordings and a sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 6 as written. The subtitle plate sits just above the bottom 12 % (the player's controls), and frames held for the board's words keep them above the plate (y ≤ 820) and inside the 5 % margins.
- **Length and structure.** 3–8 min at 30 fps; the length follows how many steps the lesson has. **A chapter is one board, one question** (40–90 s). Its title card is the question chalked at the top of a freshly wiped slate and underlined once, with the chapter number in the corner like the date a teacher writes. **How the board fills and clears**: inside a chapter, claim, wipe, rewrite in place; between chapters the front panel slides to a clean back board, the camera whips along the wall to the next board, or the duster wipes the whole slate and the wet streak dries during the title. Never leave ghosts: the slate is clean at every chapter start. **Re-hook every 30–60 s**: a pupil's question in the pale second chalk, a wrong answer wiped, a panel sliding back, a line sewing two boards, the tracked component in accent chalk turning up in a new word. A wide shot of the whole wall works as the mid-video map and as the closing summary, whose quiet edges hold the end screen.
- **The first 10 seconds.** The chalk writing the popular claim large on frame 1; the accent circle and the voice's doubt by 5 s; by 10 s the wipe takes it away and the voice promises where the truth leads. Any channel sting comes after: the bell, and the channel's name chalked in the board's corner.
- **Captions.** The subtitle plate stays burned in; export the same lines as `.srt`.
- **Thumbnail.** A close shot of the big word or character with its tracked part in accent chalk beside the wipe's haze, plus up to three chalked words.

### Good for

Word origins, myth-busting, a worked maths or physics problem, one-concept lessons, language learning, exam tips.

## 1. Essence, and what it is not

- **A clean, freshly wiped board.** One even deep ink green with its own fine grain and very slow mottling. No history on the slate: no old swirls, no ghost lessons, no floating dust, no bokeh.
- **Writing that grows like a hand writes.** Strokes appear along their centre line in the correct stroke order, with pressure: pressed starts and corners, points that lift, feet that spread at the end of falling strokes, hooks flicked off.
- **Three chalks at most.** White for structure, one accent chalk for the single part the lesson tracks, one pale chalk for a second hand (a pupil, a visitor).
- **A real object in a real room.** Wooden frame, a tray with sticks of chalk, painted writing grids (ruled penmanship lines, or tian-zi squares for characters), sliding panels, a wall and a clock around it.
- **Few words, large letters.** The board holds keywords; the explanation is spoken.

Not Whiteboard Explainer: that style is a bright glossy board, coloured markers, floating marker props and magnets, ghost marks of old lessons, and a camera travelling across a knowledge map of many regions to explain how something works. Chalkboard is a dark matte slate with nothing floating in front of it, kept clean, one question per board, the camera facing it flat; it advances by writing a claim, wiping it and rewriting in place, and it lives in a classroom (panels that slide, grids painted on, a tray, a wall). Not a slide either: nothing is typeset, nothing fades in.

## 2. Materials & rendering

- Canvas 2D for everything visible; WebGL2 only for the post pass (camera motion blur, a light vignette, grade, dither).
- Each stroke is baked once into a board-space coverage sprite (coverage, arc length, lateral position). A partial stroke reveals pixels up to the current arc length with a round leading edge; the board's grain decides which grains take the chalk (deposit with a 2×2 supersample and a faint powder halo).
- Chalk edges are firm; loose powder only at the lift-off of a stroke (two to five grains). Never sugar the board.
- Writing strokes carry a width profile per stroke type (start bump, corner bumps, taper for left-falling and rising strokes, a foot for right-falling ones, quick lift for hooks) and a pressure profile (heavier at both ends, lighter in the middle). Straight strokes bow slightly; horizontals rise 2–3° to the right; horizontals, verticals and turns enter with a short pressed tick from the upper left. Latin handwriting gets the same pressed starts and corners.
- Board, panels, frame, tray, clock and wall are baked once in world units; the slate grain is a periodic tile drawn in world space (soft-light) only when the camera is close.
- Erasing is a blurred destination-out band along one smooth path on a layer that holds only the strokes being wiped; it leaves a very thin, even haze. One wipe per reel is plenty; at most one per chapter in a long video.
- A wet streak (a board just wiped with a damp cloth) is a soft mask with a wide blur at its drying edge, fading at top and bottom, that darkens the slate slightly; never a hard rim.
- Light: a gentle multiply falloff away from the windows and at most a faint warm window patch. Light never draws shapes across the writing in close shots.

## 3. Colour logic

- Ground: deep ink green slate, wood frame, warm white wall and a coloured dado if the room is seen.
- White chalk carries every structure: words, characters, lines, labels, arrows.
- The accent chalk (example: orange) is reserved for the one component the lesson tracks; it never decorates and never draws arrows or underlines that are not that component.
- A pale second chalk (example: yellow) marks another person's handwriting.
- No rainbow, no gradients in chalk, no glow. Painted grids are dull and thin so the chalk always wins.

## 4. Type & subtitles

- Board writing, in the spoken language, is a single-line OFL handwriting font (EMS family) drawn stroke by stroke by the chalk engine, never a font's outline; symbols missing from the font (arrows, plus) are drawn as strokes.
- When the lesson is about a Chinese or Japanese character, that character is picture: hand-authored stroke data (centre lines + stroke type per stroke) drawn by the same engine. Every character the topic needs is added to the data and checked against an OFL kai font behind it before shooting (how: §10, *New characters*).
- On the board: keywords only, one line each; the word or character the lesson is about is set large, its gloss a size smaller beneath it.
- Sizes at 1080p: big words and characters 300–450 px; labels ≥ 30 px cap height (a drawn character used as a label ≥ 55 px); small writing gets heavier chalk so no stroke is thinner than 3 px.
- Reading time: every block stays fully in frame ≥ words ÷ 3 + 1.5 s (a drawn character counts as a word), counted from the frame it is wholly visible. A block is fully written before it is read.

### Voice and subtitles

- When the style tells a story it is narrated: one calm teacher's voice in short spoken sentences, said as the matching chalk appears; what the voice names is being written or shown at that moment.
- A quiet subtitle plate sits above the bottom safe area: the spoken line only, in its own language, one or two lines of at most about eight words, a plain OFL text face (e.g. Alegreya Sans, subset to the lines used) on a soft dark plate, in and out with the voice. Long lines are split at sentence ends into several cues.
- Nothing the viewer must read on the board sits behind the plate; frames held for the board's words are composed above it.
- Pauses between voice lines are short (0.25–0.4 s); one longer hold (about 1.5 s) is kept for the verdict. Board action (a panel sliding, a wipe) runs under the voice instead of waiting for it.

## 5. Motion quality

- 30 fps, continuous, for both formats.
- Chalk speed that still reads as a hand: a big character or word takes about 0.1 s per stroke including the air between strokes (a ten-stroke character about 1 s), labels about 0.04 s per stroke. Writing speeds up rather than making the voice wait, but a big character written much faster than about 0.07 s per stroke stops looking like a hand.
- When reading time and chalk speed pinch in a short video, change the words, not the hand. Ways that work (choose per video): fewer and shorter blocks on the board; big writing only for what the lesson tracks, everything else at label size; start a block while the voice is still on the previous line, so it is finished when it is named; write the next block while the last one is still being read in the same frame; hold the frame instead of moving on; make the video longer.
- Camera eases in and out (cubic), never bounces except a whip landing.
- Things appear only by being written, wiped, revealed by a sliding panel or by drying. Nothing fades in.

## 6. Camera grammar

The camera always faces the board flat on (no perspective tilt).

| Move | What it expresses | Can serve |
|---|---|---|
| Close shot on the writing | attention on how a character or line is built | a component; a step of a proof; a spelling |
| Slow lateral pan along a line | time or sequence | a timeline; a derivation; a list of cases |
| Pull back to a fixed medium frame | the whole question at once | a comparison; a claim and its counter-claim |
| Same frame later | judgement | a correction; a before / after |
| Locked frame while a panel slides | a page turned in the room's own way | a new chapter; a hidden board |
| Whip with motion blur (≤ 0.5 s) | a jump to another part of the wall | a change of board |
| Cut on a line crossing a seam | a connection | cause and effect; the same part in two places |
| Wide shot of the whole wall | summary | the map of what was learnt |

The room is part of the style: at least once the frame opens wide enough to read board, frame, tray and wall as a classroom (where, and what else the room holds, is the video's choice). Close shots may show only slate and frame.

Rules: the subject is never smaller than a third of the frame in close shots; text blocks are never cut by the frame edge while they are read; no empty board for more than half a second. Transitions are hard cuts, a sliding panel or a line across a seam; no dissolves or page flips.

## 7. Sound palette

- Voice first: it is the loudest element; music sits 15–18 dB under it and comes up only in the pauses.
- Foley: real chalk recordings cut into grains, one grain chain per stroke, level from stroke size; a light knock on landings; the accent chalk slightly softer and duller. A felt pass for the wipe, the low roll of a sliding panel ending on a stop, room tone very low; school sounds (a distant bell) only as punctuation. Where the recordings come from and how to cut them: §10, *Sound*.
- Music: sparse plucked strings (a guqin model or nylon guitar) with marimba and pizzicato bass; a plucked note can be "born" from something drawn. Silence while a question or a verdict is read.
- Mix: master at −14 LUFS integrated, true peak ≤ −1.5 dBFS.

## 8. Native moves

- **Write, wipe, rewrite in place.** The wrong reading is written under its object, wiped with one pass, and the right one written in the same spot from the same camera position. *Fits content like:* a common misconception in physics; a misremembered date; a sum everybody gets wrong.
- **Tracked component in accent chalk.** One part keeps its colour and its height across several forms. *Fits content like:* a root through a word family; a variable through an equation's rearrangements; a gene through generations.
- **Sliding panel reveal.** The front panel slides away to show a clean back board, and can slide back to close the lesson. *Fits content like:* "but before that…"; the hidden proof; the answer kept back.
- **A line that sews two boards.** One accent line runs across the seam to join two places. *Fits content like:* the same constant in two formulas; a quote and its source; cause and effect.
- **Drying wet streak.** The freshly wiped board dries back and reveals what was left untouched. *Fits content like:* yesterday's question; a note left by a student; a reminder at the corner.
- **Second hand.** A different, childlike chalk colour and hand on the same board. *Fits content like:* a pupil's question; a visitor's comment; a wrong attempt.
- **Chalk as a measuring tool.** An accent object laid along a white line and ticked off, so a comparison is shown, not told. *Fits content like:* a unit's origin; a scale; how many of one thing fit another.

## 9. Pitfalls of the medium

- Dirty boards (old swirls, ghosts, floating dust) read as "messy", not "real". Keep the slate clean and let the grain carry the realism.
- Equal-width polylines look like a plotter and make characters misread. Use stroke-type width and pressure profiles.
- Character data that is structurally wrong is caught at once by native readers: check every character against a reference before shooting.
- Small writing at 1080p disappears with the same chalk width as large writing; give small text heavier chalk.
- Text written while the camera moves away fails reading time; hold the frame or keep the block in view.
- Accent colour spread over arrows and decorations stops meaning anything.
- A soft halo at the chalk's front reads as glow: draw only the leading grains, with no radial gradient under them.
- A wet streak with a hard edge looks like a cut-out.
- Board-speak in the voice ("A plus B", component names with no meaning) is not understood: every component is said with what it means the first time it appears.
- **The app and the player**: in a reel, writing below y 1248 or right of x 900 is hidden by the app's buttons; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **Rendering model.** Canvas 2D drawn from `t` for everything visible; WebGL2 only for the post pass (camera motion blur, vignette, grade, dither). Each stroke is baked once on load into its coverage sprite (bake resolution 2× by default) and revealed up to the current arc length; the deposit samples the slate's grain tile. Baking costs about 10 s per 500 strokes, then 20–50 ms per 1080p frame.
- **The room in world units.** A slate x 0…6400, y 0…1700 made of two 3200-wide panels, with frame, tray, clock, wall and painted grids baked once. Strokes live on layers: the sliding front panel (in panel-local units, moved by its slide offset), the right panel, the back board (drawn only once the front panel has moved) and a top world layer; front-panel strokes carry a phase (can be wiped, wiped, or written after the wipe). The camera is a function of `t` returning centre, scale and shot index; motion blur is averaged only within one shot.
- **The video as data.** Every stroke with its start and end, camera keys, the panel offset, voice starts, subtitle cues, and every board text block with its box and times for the reading check. The writing helpers (a character, a line of mixed script, Latin handwriting from an SVG single-line font) return strokes with times set and the time their last stroke ends, so the next block can be keyed to it; key each block to the voice's word timings so it is finished when it is named. The wipe is `{t0, t1, width, path}`, the wet streak a band with its drying edge and its own `t0`, `t1`. A video without a wet streak, a wipe, grids or a sliding panel removes or guards those parts instead of passing dummy values.
- **New characters** (only when the lesson draws Chinese or Japanese characters as picture). Each character is its strokes in standard stroke order (GF 0023-2020); each stroke is a type and its centre line through anchor points in a 100 × 100 box, y down. Types: horizontal, vertical, left-falling, right-falling, dot, rising, hanging-needle vertical, and turns (corners pressed); a stroke can end in a hook (its last point is the hook's tip), a point or a dot. Write only the centre line: the bow, the rise of horizontals and the pressed entry tick are added when drawing. Symbols (arrows, plus, a tick) are written the same way. A way that works:
  1. Take the stroke order and count from a dictionary that shows the standard order, and write down the type sequence first.
  2. Set the character large from a reference kai font (LXGW WenKai, OFL) on a 100-unit grid, e.g. with PIL: `ImageFont.truetype(font, 1000)` drawn into a 1000 × 1000 image at `(0, 880)` with `anchor='ls'` (baseline at 0.88 of the box), with 100-px grid lines; read each stroke's start, corners and end off it and divide by 10. Keep the anchors on the middle of the font's stroke, not its edge.
  3. Draw the chalk in red over the font at 400 px: check stroke count and order, which strokes touch, cross or stop short, the proportion of each component, hook directions and the feet of falling strokes; then look again at the size the video uses. Fix the numbers, not the font.
  4. Read it at video size the way a native reader would, before shooting (§9): a structure that looks right at 400 px over the font can still read as another character on its own.
- **Sound.** Cut CC0 / CC BY recordings of chalk on a board (Wikimedia Commons has several; credit them) into tagged `tap`, `stroke` and `squeak` grains, indexed with each grain's length, attack and brightness. Export one chalk event per stroke (time, duration, length, colour, pan, big or small) and place one grain chain on each: length from duration, level from stroke length, the accent chalk low-passed. `cues.json` carries the pack sounds on top (panel stops, whips, the verdict).
- **Reading check.** It counts from the first frame a block's box is on screen, which is when its writing starts: leave the reading time after the last stroke yourself (§4).

## 11. Variation space

The agent decides the topic, the board layout, the number of panels, the tracked component, the hands, the camera path and the pacing.
- **Structures:** a proof built on one board line by line; three wrong answers wiped one after another before the right one; two boards in dialogue, question on one, answer on the other.
- **Openings:** a duster's last pass revealing a formula; a close-up of the tray as one chalk starts writing; the bell ringing over an empty, freshly wiped board.
- **Endings:** the whole wall with the lesson complete; a final underline under one word; the board half-wiped for the next class with one line kept.
