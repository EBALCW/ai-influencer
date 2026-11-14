# One-line Drawing

> A single ink line that never leaves the paper. Everything on screen is that one line being drawn; scenes don't cut, they morph. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Osvaldo Cavandoli's *La Linea* (1971) — one line is both the world and the character, and transformations of the line are the jokes and the transitions; Gjon Mili's 1949 photographs of Picasso drawing with light — the confidence and speed of a single gesture; Norman McLaren's *Begone Dull Care* and *Boogie-Doodle* — lines drawn *to* the music. Do not copy La Linea's character, its gibberish voice, or any specific continuous-line illustration.

## Formats

### Reel (1080×1920)

- **Layout.** Paper bleeds to every edge; each picture the line makes is designed as a portrait, not cropped from a landscape. The soft clamp keeps the nib in x 160–920, y 380–1400; the line itself may run anywhere. Subtitles are written on centred at x 540, at most 720 px wide, last baseline y ≈ 1190, inside the safe box (x 72–900, y 269–1248); titles go in empty paper at y 330–560. Stack, don't shrink: a lateral scroll becomes a line falling or climbing down the page with the camera tilting after it; a mirrored framing stacks its two images top and bottom; the final reveal is a tall picture (a figure, a tree, a tower, a river from above).
- **The first 3 seconds.** Frame 1 is mid-line at speed in macro: wet ink, the pen's shadow, never blank paper. By 0.5 s the camera eases back to see the line turn; by 3 s it has become a first recognisable thing and starts to morph into a second while the voice asks its question.
- **Length and pace.** 20–40 s: three to five vignettes of 4–8 s, each morphing into the next; one stop of 1.5–2 s with the music out; the pull-back reveal in the last 4–6 s, ideally ending on the first stroke so the reel loops. On ones at 30 fps.
- **Captions.** The written-on handwritten subtitles are the only caption layer: 60–72 px, at most six words a line, two lines.
- **Sound.** `thock` on the nib's first touch, `sub-impact` very low under a stop and its blot, `shimmer` as the accent stretch begins, a soft `zoom-swish` into the pull-back, `clean-ding` as the final picture completes. The solo-instrument score from a free sample library or the user's music; the pen on paper synthesised from the nib's speed, or felt-pen-on-cotton-paper foley.

### YouTube (1920×1080)

- **Layout.** The composed frame of section 6, the nib clamped to the central ~70 %. Subtitles centred with their last baseline at y ≤ 920, clear of the bottom 12 % (player controls); titles inside the 5 % margins.
- **Length and structure.** 2–6 min at 24 fps, on ones. A chapter is one picture (40–90 s), joined to the next by a morph, never a cut; its title card is a word written in the connected script whose last letter becomes the chapter's first stroke. Re-hook every 30–60 s with a native move: an unexpected transformation, a stop, a change in the line's voice, a jump from macro to wide. If the topic allows, every chapter is a region of one final picture, revealed by the last pull-back.
- **The first 10 seconds.** The line at speed in macro on frame 1; the first picture and its morph by 5 s, with the question; the promise ("by the end, all of this is one picture") by 10 s. Any channel sting, written in script, comes after.
- **Captions.** The handwritten subtitles stay burned in; export the same lines as `.srt`.
- **Thumbnail.** The frame where one picture is half-way into the next, the accent stretch visible, with up to three handwritten words.

### Good for

Brand and founder stories, life or company milestones, minimal product ads, "how X became Y" explainers, tributes, a process from start to finish.

## 1. Essence, and what it is not

- **One continuous line** on warm white paper. The pen never lifts: in code the whole video can literally be one point array, from the first touch of the nib to the last frame.
- **Everything is a line**: characters, places, objects, even time. No fills, no shading, no second line weight, no background art.
- **We watch the line being drawn**: the camera follows the nib with a little lag and anticipation.
- Besides ink there is only the paper and a soft **shadow of the pen** (the real world above the paper). One accent colour at most, used once.

Not a whiteboard explainer (no hand, no marker, no erasing, no text-heavy boards), not ink wash (no tones, no brush bloom as a look), not a line-art animation with cuts and many strokes.

## 2. Materials & rendering

- **Paper**: warm white (around `#F4EFE4`), procedural mottling (soft-light, large tile), long fibres that fade out when zoomed out (or they shimmer), a sparse paper-tooth speckle over the ink at close zoom, light vignette. All textures anchored to the paper; they move with the camera.
- **Ink** is a filled polygon around the path (not `ctx.stroke`), mixed with paper colour to an opaque tone per point.
  - Width = base width of the current "voice" of the line × pen pressure × fine noise (±8 %); pressure from speed: `0.66 + 0.8·exp(−v/300)` (fast = thin, slow = fat).
  - The line's character can change along the path (base width, alpha, tremble, dryness); blend over a short stretch at boundaries.
  - Ink bleed: the same polygon slightly wider, blurred on an offscreen layer, composited at ~20 %.
  - Pooling: extra round dots where speed drops low.
  - Tremble (perpendicular noise) and dry-brush gaps (long-scale noise + thin bristle strands) for age, fear or fatigue.
  - A stop leaves a teardrop-shaped blot: tip at the nib, belly sagging downward as it spreads, a dark tide line at the rim.
  - **A screen-space minimum width**: widths scale with zoom like a line under a macro lens, but clamp the zoom used for width during pull-backs so a wide view keeps its weight.
- **The pen is never drawn**: a soft blurred wedge of shadow from the nib and a tiny contact dot. Hands, if any, appear only as shadows, each hand composited as one flat layer.
- **Path design**: chapters written as SVG path strings, sampled by arc length, joined by tangent-continuous connectors; time assigned per point weighted by curvature.

## 3. Colour logic

- **Ink on paper.** A warm black (around `#1D1A17`) on warm white; nothing else fills the frame.
- **One accent at most, used once**, on a stretch of the line that means something; it returns to ink afterwards and stays visible in the final picture if the picture is revealed.
- Examples of an accent's job: red for love or danger; blue for water or cold; gold for money or a prize. Never a second accent.

## 4. Type & subtitles

- **Text is written, like the line**: a handwriting face (e.g. Caveat) for subtitles, one language (the one spoken), ink at ~84 %, no box, centred near the bottom, **written on** left to right (~0.2 s + ~17 ms per letter) behind a soft paper-coloured halo so passing lines never cross the letters; fade out ~0.45 s. Hold ≥ max(1.8 s, speech + 0.6 s). Keep a line to about seven words; split longer sentences.
- Titles in a monoline connected script (e.g. Sacramento: itself a one-line drawing), written on in empty paper away from the drawing, gone before the camera moves into them.

## 5. Motion quality

- **Everything on ones** (24 fps for YouTube, 30 fps for a reel): the appeal is the continuous act of drawing; stepping breaks it.
- **Timing = chapter windows + curvature**: within a window, time per point is weighted by `1 + K·turn` (sharp turns get more time, smoothed so speed never jumps). Pin musical beats with marks: by arc-length fraction or by position ("the second time the pen passes here"). A stop is two marks at the same place.
- Corners (speed minima at high turn) can be exported to the soundtrack as candidate note onsets.
- Speeds: ~300–700 units/s for travelling lines, ~50–150 for small details. The most important stroke is usually the slowest.
- **Retracing** over an existing line is legal and invisible (it only thickens slightly).

## 6. Camera grammar

A vocabulary, not a route. The camera is one continuous move: composition centre, zoom, a few degrees of roll, and a follow weight (0 = composed, 1 = locked to the nib); the follow point averages the nib over roughly −0.55…+0.4 s (lag and anticipation), with a soft clamp keeping the nib inside the central ~70 % of the frame. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Follow the nib (high follow weight) | travel; momentum; a thread of time | a journey; a process; a timeline |
| Composed frame, low follow weight | a scene that must read as a whole | a vignette; a joke; a diagram |
| Macro on the nib | intimacy; the act of making | a first touch; a signature; a detail |
| Hold with a slow push-in | weight; a stop | a loss; a doubt; a decision |
| Mirrored framing | rhyme across time | parent and child; before/after |
| Continuous pull-back | everything was one picture | a reveal; a map; a word |
| Lateral scroll with the line running ahead | a horizon; a graph; a race | a stock chart; a heartbeat; a road |
| Roll with the line | vertigo; play | a loop-the-loop; a fall; a dance |

No cuts. Transitions are morphs: the last stroke of one image is the first stroke of the next.

## 7. Sound palette

- **Music: one solo instrument, one unbroken melodic line**, the sound equivalent of the drawing: a bowed or plucked string (cello, violin, viola, harp), a solo woodwind (clarinet, flute, bassoon), a hummed voice, a single guitar. A second colour only as a rare accent (a chime, a pizzicato stretch). No pads.
- **Write the score to the drawing**: key notes on marks and corners; fast line = short notes; a stopped line = one long note fading into silence; the highest note on the most important touch.
- **The pen on paper is the most important sound**, synthesised from the pen speed: band-passed noise (brighter when fast, duller when slow), random paper-fibre ticks with density ∝ speed, amplitude ∝ √speed, panned with the nib's screen position; broken up by dry gaps; lighter and jerkier for a young hand. Plus: a wooden tap on the first touch, a faint wet swell for a blot, a tiny rub for a handoff, a page lift.
- **Silence is literal**: zero the music bus including reverb tails; drop room tone.
- **Mix**: music ducks ~5 dB and the pen ~4 dB under voice; −14 LUFS; grain 0 (the paper is in the render).
- **Voice**: one warm narrator, unhurried, a few short lines that leave space for the line; place key words on picture beats using the voice's word timings.

## 8. Native moves

A menu: use the ones your story needs.

- **The pen never lifts.** Anything that is one continuous thing. *Fits content like:* a river from source to sea; a relay race; a production line.
- **The line is time.** The stroke's character changes with age, mood or strain. *Fits content like:* a building aging; a runner tiring; a machine wearing out.
- **Transformation.** One image morphs into the next. *Fits content like:* a seed becoming a tree becoming a table; a sketch becoming a product; a word becoming its object.
- **Stopping is an event.** The nib stops, ink pools, music cuts to silence (1.5–3 s). *Fits content like:* a power cut; a pause for a minute's silence; a hesitation before a signature.
- **Reverse-designed scale reveal.** Every vignette is secretly part of one big picture seen at the end. *Fits content like:* a city's landmarks forming its skyline; a company's milestones forming its logo; a recipe's steps forming the dish.
- **Handoff.** The pen passes to another hand (as a shadow) and a new line begins. *Fits content like:* a teacher and a student; a founder and a successor; one generation to the next.
- **Line as graph.** The line becomes a chart while staying a drawing. *Fits content like:* a heartbeat; a temperature record; a football match's momentum.

## 9. Pitfalls of the medium

- **Stray connectors ruin a reveal**: every extra line reads as a wrinkle, beard or mask. Fix the topology (where each chapter enters and leaves), not the drawing. Plan it like an Euler path: a closed motif is a circuit (you leave where you came in); retrace or reorder chapters.
- Each region of a final picture is drawn exactly once; connectors must fall on natural lines of that picture.
- **Test the reveal early and often**: render the whole path at once at final scale after every change.
- Lines drawn too close braid together once width is applied; keep a gap.
- A round blot reads as a mole → a sagging teardrop.
- Thin lines at wide zoom → clamp the width zoom.
- Translucent hand shadows double-darken where they overlap → one layer per hand.
- Titles collide with the drawing as the camera moves → check every frame of the title's window.
- The transcription that times the words mishears short lines → rephrase rather than fight it.
- **The app's buttons**: in a reel, a subtitle below y 1248 or right of x 900 is hidden; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **Canvas, drawn from `t`.** The whole line is one point array. Write each chapter as SVG path strings, sample them by arc length in the browser, join chapters with tangent-continuous connectors, and assign time per point weighted by curvature, with marks and holds pinned to the voice's word timings.
- **The ink renderer** rebuilds the filled polygon from the points drawn so far on every frame: pressure from speed, seeded fine noise, bleed on a blurred offscreen layer, pooling, tremble and dry brush, the accent stretch, the teardrop blot and the clamped minimum screen width.
- **Layers, bottom to top**: paper (mottling, fibres, tooth, vignette, all anchored to the paper and moved by the camera), ink, the pen's shadow wedge and contact dot, hand shadows (one flat layer per hand), written-on subtitles and titles behind their halo.
- **Camera** as composition keys (centre, zoom, roll, follow weight) interpolated over time, plus the nib follow and soft clamp. Keep two debug views: the whole path drawn at once at final scale, and many camera times rendered side by side.
- **Cues**: export corners and marks as candidate note onsets for the score; drive the pen sound from the same speed curve; `cues.json` gets the first touch, each stop and blot, the accent and the reveal.

## 11. Variation space

You decide what the line draws, whether it reveals one final picture, where it stops, the accent (or none), the opening and the ending:

- Structures: **a line that is a graph** (a data series drawn as a horizon; each peak and trough becomes a scene); **two lines** that start in opposite corners and are drawn in alternation until they meet; **a loop** (the line draws a scene and then retraces its way back to the start, which now means something else).
- Openings: **mid-line at speed**, the pen already running across the paper; **a finished drawing** whose line then unravels into the story; **a word written in script** whose last letter becomes the first scene.
- Endings: **the line runs off the edge** of the paper and keeps going; **the ink runs out** and the last stroke fades into dry scratches; **the pen stops in mid-air** over the paper before the last stroke.
