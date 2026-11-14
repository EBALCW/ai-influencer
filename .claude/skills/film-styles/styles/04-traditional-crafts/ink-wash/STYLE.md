# Chinese Ink Wash

> Xieyi ink painting on rice paper, animated: blank paper is space, one brushstroke is a mountain, a wave, a gesture or a cut. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Shanghai Animation Film Studio's *Feelings of Mountains and Water* (1988) (blank-paper space, ink bloom, guqin pacing, figures in a few strokes); the bamboo-forest fight of *Crouching Tiger, Hidden Dragon* (weightlessness, stillness before action). Copy none of their characters, compositions or music.

## Formats

### Reel (1080×1920)

- **Layout.** The reel is a hanging scroll: paper bleeds to every edge, 60–80 % of it empty. Height is the native axis, so stages stack (sky, peaks, mist, river, ground) and the handscroll's right-to-left pan becomes a slow tilt from sky to ground; a lateral chase keeps its lead room but frames the figure smaller in more paper. Inscriptions sit in whichever band of the safe box is empty paper (y 300–560 or y 960–1240), as a block centred on x 540, at most 720 px wide; a vertical title column and its seal sit upper right, inside x 900. Dark foreground may pass along the bottom, under the app's buttons.
- **The first 3 seconds.** Frame 1 is already ink in motion: a figure painted mid-stride with the world washing in around it, or a wet stroke filling the frame. By 0.5 s a stroke is visibly growing or a bloom spreading; by 3 s one fast flying-white stroke crosses the frame out of a short silence, or the stroke lifts to reveal what it drew.
- **Length and pace.** 25–45 s: four to six paintings joined by blooms, pans or mist; one held stillness (1.5–2 s) before the decisive stroke; one literal silence. Render at 30 fps, figures stepping at 12 fps.
- **Captions.** The inscription subtitles are the only caption layer: 54–64 px, at most six words a line, two lines.
- **Sound.** `thock` under the seal pressing, `sub-impact` on the decisive stroke or a mass splitting, a faint `tick` for an ink drop, a soft `shimmer` under an ink-bloom transition. Guqin, xiao, drums and the brush and water foley come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Sections 2 and 6 as written. Inscriptions stay out of the bottom 12 % (the player's controls) and inside the 5 % margins; dark foreground may still pass along the bottom.
- **Length and structure.** 2–6 min at 24 fps, figures on twos. The video is one long handscroll: a chapter is one section of it (40–90 s), and its title card is a vertical column brushed into empty paper with a seal pressed under it. Re-hook every 30–60 s with a move the style owns: an ink bloom into a new state, a flying-white stroke out of silence, the one hard cut to an extreme close-up, a pull-back that shows the scene was part of something larger. The last chapter shows the whole scroll at once.
- **The first 10 seconds.** The strongest image on frame 1 (a figure in motion, a stroke crossing); the question in the voice by 5 s; the promise by 10 s. Any channel sting comes after: the channel's seal pressed onto empty paper.
- **Captions.** The inscriptions stay burned in; export the same lines as `.srt`.
- **Thumbnail.** A high wide frame: a tiny figure carrying the vermilion accent in vast blank paper, or the flying-white stroke mid-frame, with up to three brushed words and the seal.

### Good for

Heritage and craft brands, poetry and quotes, history stories, tea and calm products, meditative pieces, martial-arts tales.

## 1. Essence, and what it is not

An ink painting painted and unrolled before you: black ink on warm rice paper in five tones, plus **one** red, the vermilion seal. No Western outlines: forms are made by **loaded brushstrokes** whose dark edge *is* the contour (*mogu*, "boneless" painting), by **wet washes** that bleed into the paper, and by **dry, fast strokes** where the paper shows through the bristle tracks (*feibai*, "flying white").

Most of the frame is **empty paper** (*liubai*, "leaving white"): water, sky, mist, silence. Things are *painted into existence*, not cut to.

Not watercolour (no colour washes), not vector art with a brush texture (no flat fills or closed outlines), not a calligraphy title sequence.

## 2. Materials & rendering

- **Paper** is procedural, in the compositor, never a texture file: warm rice paper (around `#F2ECDE`), cloud mottling, long fibres, pulp flecks, grain that fades when zoomed out (or it shimmers), a light vignette; anchored to the world.
- **Ink** is stroke opacity multiplied onto paper (never an overlay), in five tones ("ink has five colours"):

| Tone | Opacity | Use |
|---|---|---|
| jiao (burnt) | ~.96 | calligraphy, the sharpest lines, moss dots |
| nong (thick) | ~.82 | contours, dark edge of loaded strokes |
| zhong (heavy) | ~.60 | secondary lines, folds |
| dan (light) | ~.34 | mountain bodies, robe and body washes |
| qing (clear) | ~.16 | far mountains, faces, mist |

- **Brushstroke model**: centreline × pressure profile × width noise, plus 4–60 **bristles** whose ink load drops along the stroke and breaks on long-scale noise. `dry` runs from a solid wet stroke to flying white (dry strokes are bristle tracks only).
- **Loaded stroke**: bristles darker on one side, so the stroke carries its own contour: this makes bodies, rocks and waves read as ink, not vectors.
- **Two layers**: the wet one bleeds in the compositor (noisy blur, **edge pigment accumulation**, granulation); the dry one only gets fibre jitter and paper tooth.
- **Masses**: soft polygons, jittered edges, a gradient; never flat fills.
- **Landscape**: mountains dissolve downward into mist bands, with hemp-fibre texture strokes (*pima cun*) and moss dots on near ranges only; rocks are outline → axe-cut texture → shadow wash → dots.
- **Water is blank paper**, moved by faint dry streaks and open ink rings. Solid water: Song-dynasty **parallel wave lines** (dense near the edge) or a pale body with a few huge loaded strokes along its face.
- **Figures are xieyi**: one pale body mass plus two loaded strokes, burnt-ink lines for limbs; features, if ever shown, in 3–5 strokes.
- **Calligraphy**: an OFL brush font is only a **skeleton**: trace centrelines in stroke order, pressure from glyph thickness, hidden-tip entry (*cangfeng*), tapered exits.

## 3. Colour logic

- Ink only, from cool grey at low density to warm black at full density. No other hue in the world.
- **One vermilion** (around `#B02E22`), for the seal and at most one tiny accent in the story (an object the protagonist carries). The accent finds the protagonist in wide shots and can rhyme with the seal. Never a red wash, never red type.
- Values carry depth: far = pale and soft, near = dark and textured. If a frame gets busy, remove ink rather than add tone.

## 4. Type & subtitles

- Subtitles are **inscriptions** (*tiba*, a painter's colophon), in the one spoken language: a classical italic serif (Cormorant Garamond italic), ink-coloured, no box, ≤ 2 lines of about eight words, placed in each shot's empty paper. A small vermilion square marks the start of each line. They appear wet and dry in a fraction of a second. Hold ≥ max(1.8 s, speech + 0.6 s).
- Titles are written on the painting itself, in its empty space, with a vermilion *baiwen* seal (white lines knocked out of a slightly irregular red square, with ink-paste speckles) drawn by code. A title in Chinese characters is brushed in vertical columns and is picture: its meaning is given by the voice or an inscription. Titles move with the world.
- Screen-space overlays reset the camera transform.

## 5. Motion quality

- **Figures step at 12 fps** (on twos); their position, the camera, blooms, ripples and splatter move on ones at 24 fps (30 fps in a reel).
- **Stable strokes on twos**: seed every stroke by its index and compute bristle breaks along *normalized* arc length × a fixed reference length, so flying-white gaps don't crawl every drawing. Allow only a small "boil" on the width noise.
- **Painted into existence**: strokes appear in drawing order.
- **Stillness before action** (when a decisive stroke is the event): hold, with at most a slow push-in, then let the stroke cross the frame in a few frames. Consequences start only after the stroke has finished.
- Nothing is tweened like a vector shape: things are painted, bloom or dissolve into mist.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| Locked frame on the paper | The page is the stage; things are painted in | a thing forming; a line being read; a still decision |
| Right-to-left pan (handscroll) | Time and distance as one painting | a journey; a history; a process |
| Vertical tilt (hanging scroll) | Height, stages stacked | seasons; a climb; generations |
| Lateral tracking, lead room, slow far parallax | Motion through a world | travel; a chase; a commute |
| High wide, a tiny figure in blank paper | Smallness, solitude | loneliness; nature's scale; one life among many |
| Low angle, dark mass towering, slow push-in with shake | Weight, threat | an obstacle; a storm; pressure |
| Hard cut to an extreme close-up | A break in the flow (the style's only hard cuts) | a decision; a shock; a memory |
| Push into an ink bloom or mist | Passing between states | memory; dream; a season turning |
| Pull back until a mark joins the whole | The part was inside something larger | a summing-up; irony of scale |
| Return to an earlier framing | The rhyme shows what changed | aftermath; growth; before/after |

Framing: 60–80 % empty paper; dark foreground may pass along the frame bottom. Transitions are ink blooms, pans along the scroll or mist; never a generic dissolve or a wipe.

## 7. Sound palette

- **Guqin-led, not piano and strings**: guqin (open and stopped strings, slides, vibrato, glassy harmonics, sweeps; sampled or physically modelled), a low breathy xiao, big drum and timpani for mass, frame drum for steps, a small gong for a seal. Chinese pentatonic modes.
- **Cue to the picture, never loop**: unmetred plucks suit emptiness, a pulse suits movement, rolls suit mass; painted strokes can each land on a pluck.
- **Silence is literal**: zero the whole bus (music, ambience, reverb tails) with short fades. At most one sound inside it (a drip, one ring). Place it where the story holds its breath.
- **Foley follows the material**: ink drop (short "tink" + soft wet thud), brush air (band-passed noise with bristle grains, never a metal whoosh), steps on water (small splash), splatter (wet ticks), seal (wooden thump + paper crackle).
- **Voice**: one calm narrator, few lines, like colophons that don't explain the picture. Duck music ~8 dB and ambience too; check each line against a transcript of the final mix. Master −14 LUFS.

## 8. Native moves

A menu: use the ones your story needs.

- **One stroke is everything.** *Fits content like:* a product born from one line; a city growing from a single street; a day beginning with one bird.
- **Emptiness is matter.** Removing ink reveals paper white. *Fits content like:* a door opening in a wall; a crowd parting; an absence in a family portrait.
- **Brush = gesture = action.** Stroke order becomes choreography. *Fits content like:* a dancer's phrase that spells a word; a signature; a chef's knife work.
- **Flying white.** One fast dry stroke across the frame, strongest out of a silence. *Fits content like:* a sprint finish; a decision; a comet.
- **Ink bloom transition.** The next scene grows inside a spreading drop with a dark tide-line (noisy radial mask; world-anchored for elements, in the compositor for scenes). *Fits content like:* memories; seasons; one era giving way to the next.
- **The handscroll.** One long painting panned right to left, seen whole at last. *Fits content like:* a history; a supply chain from field to hand; a day in a street.
- **Splitting a mass.** Halves clipped either side of the cut; one rises and fades, one slumps; splatter stays. *Fits content like:* breaking a record; a barrier falling; an idea splitting in two.

## 9. Pitfalls of the medium

- Dry brush looks like dashed lines → breaks from long-scale noise and an ink load that drops along the stroke.
- Parallel semi-transparent strokes make bodies look like organ pipes → one base mass + two loaded strokes.
- Big side-brush strokes look like a hairbrush → a gradient mass + a few low-dryness strokes. Gradients in vertical bands leave seams → a cached per-pixel layer.
- A stroke body split between wet and dry layers loses density → full body in the dry layer plus a wet halo.
- Clipping calligraphy with the font outline notches the junctions → font as skeleton only.
- Uniform hatching inside a wave turns it into a wire mesh → loaded strokes along the face.
- **Inscriptions under the app or the player**: in a reel, keep them inside x 72–900, y 269–1248; on YouTube, above the bottom 12 %.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **Canvas brush engine, drawn from `t`**: strokes (centreline × pressure × width noise, 4–60 bristles with a falling ink load), loaded strokes, masses (cached per-pixel gradient layers) and blots, each seeded by its index, appearing in drawing order. Figures read their pose from a stepped clock (`Math.floor(t * 12) / 12`); camera, blooms, ripples and splatter use full-rate `t`.
- **A WebGL rice-paper compositor** over two ink layers: the wet layer gets noisy blur, edge pigment accumulation and granulation; the dry layer only fibre jitter and paper tooth; both multiply onto procedural paper anchored to the world. Ink-bloom transitions are noisy radial masks with a dark tide line, world-anchored for elements and in the compositor for whole scenes.
- **A kit of painted parts**: mountains with texture strokes, cliffs, pine, reeds and ripples; a gestural wave; a xieyi figure rig (one body mass, two loaded strokes, burnt-ink limbs); skeleton-traced calligraphy; the code-drawn seal; the inscription subtitles. Build test pages that draw model sheets, poses and single frames from the real engine before shooting.
- **Timing**: key each decisive stroke and each painted-in element to the voice's word timings; let the score's plucks land on strokes. `cues.json` gets the seal, the decisive stroke, ink drops and each bloom.

## 11. Variation space

You decide the structure, the characters (or none), the landscape, the opening, the ending, the camera path, the pacing and where the red goes:

- Structures: **one character, stroke by stroke** (no figure; each stroke of one large character opens into a vignette of the topic); **a hanging scroll** (a tilt from sky to ground through four stages, tone deepening); **two brushes in dialogue** (alternating strokes answer each other until they meet in one bloom).
- Openings: **in motion** (a figure already painted and moving; the world washes in around it); **ink first** (a fully inked frame; ink is lifted where light or a road appears); **the bristles** (a wet stroke fills the frame; only when it lifts do we see what it drew).
- Endings: **one small mark** (close on a footprint or a leaf while the ink around it dries; no pull-back); **evaporation** (the painting un-paints in reverse stroke order); **mid-gesture** (the brush stops before the last stroke lands).
