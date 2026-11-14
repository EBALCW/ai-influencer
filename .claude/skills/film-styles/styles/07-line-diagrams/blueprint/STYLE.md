# Blueprint

> Engineering drawings that come alive on a sheet of cyanotype paper: white technical line work on Prussian blue, drawn in drafting order, with annotations that move. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only, never copy): the moving technical drawings in the *Iron Man* (2008) end credits, Leonardo's *Codex Atlanticus* pages, 19th-century US patent drawings (Fig. 1 / Fig. 2, part balloons, fine-line shading), the automaton drawings in *Hugo* (2011). No elements of any franchise, no real patents, no real inventor's machine or signature.

## Formats

### Reel (1080×1920)

- **Layout.** The sheet turns upright and fills the frame; the table cloth shows only in wides. The header is lettered near the top of the safe box (y 280–360); the main figure takes about 80 % of the safe box's height (y 400–1150). The title block lives at the sheet's foot: tilt down to it when its verdict matters, so its fields land above y 1248. Fig. 1 → Fig. 2 becomes a pan down the sheet; tracks follow something vertical (a pipe, a chain); explosions fan downward and diagonally.
- **The first 3 seconds.** Frame 1 is a close on the mechanism, outlines already drawn, the glowing nib mid-hatch. By 0.5 s a part moves on the beat and its live dimension number changes; by 3 s the camera pulls back to the whole figure and a lettered note asks the question.
- **Length and pace.** 25–45 s on one sheet: a drafting layer per beat, hard cuts on downbeats between sections, one voiceless slow push-in on the payoff.
- **Captions.** The drawing notes, in the language spoken, at most 720 px wide, centred on x 540 in whatever sky the shot leaves empty, never over the figure.
- **Sound.** `typing-tick` as a note letters on, `tick` for escapement steps (a gear tooth per subdivision), `ui-click` as exploded parts return, `ratchet` for winding and chains, `thock` for the stamp. Paper foley and the contrapuntal score (harpsichord, bassoon, celesta) come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Sections 2, 4 and 6 as written: one sheet on the table, notes placed per shot in empty sky. When the title block is read, frame it so its fields sit above y 950 (the player's controls cover the bottom 12 %); notes and dimension figures stay inside the 5 % margins. The full sheet on the table makes the end-screen frame.
- **Length and structure.** 4–8 min as a drawing set: each chapter is one figure or one sheet ("FIG. 3 · SECTION A–A", "SHEET 2 OF 6"), 40–90 s, titled by a fig-number rewrite or a header lettered on. A natural order: plan → elevation → section → exploded view → assembly → in operation → the verdict in the title block. Re-hook every 30–60 s: a section line sweeping to show the inside, the oblique factor turning a plan into an object, an explosion, a dimension changing as its part moves, a revision cloud marking what changed. Let a layer finish drawing before the narrator explains it. The notes column fills with the voiceover and becomes the recap. 24 fps.
- **The first 10 seconds.** The machine running, gears meshing in a 2× close-up; the question as a lettered note by 5 s; the promise ("how it works, part by part") lettered into the header by 10 s. A channel sting comes after that.
- **Captions.** The notes burned in, plus an `.srt`.
- **Thumbnail.** The exploded view mid-flight, or a 2× close-up with section hatching and a numbered balloon, with two or three hand-lettered words.

### Good for

How-it-works explainers, hardware launches, architecture and renovation plans, inventions and patent history, engineering lessons.

## 1. Essence, and what it is not

- **The whole video happens on one sheet of blueprint paper** (a set of sheets in a long one) lying on a dark drafting table. The camera moves over it like an eye reading a drawing.
- **White line work on uneven Prussian blue**: centre lines, outlines, hatching, dimension lines, leader lines with numbered balloons, a title block, a notes column.
- **A 2D line-drawing language**: orthographic and oblique/isometric projection are allowed, **3D rendering never**.
- **Rigorous convention carries the tone**: the drawing is dry and exact; the notes can carry wit, warmth or gravity.
- **The designed thing is the character.** A machine, object, building or plan acts through its parts; people appear only as a hand shadow with a pen, or a signature.

Not **Sci-fi Hologram HUD** (no glowing wireframe, no 3D orbit), not **Whiteboard Explainer** (no marker on white), not **Copperplate Engraving** (no burin tonal hatching as the whole look).

## 2. Materials & rendering

- **Sheet**: procedural cyanotype in a shader in *sheet coordinates*, crisp at any zoom: fbm between two Prussian blues, coating streaks, fibres, fold creases (bright edge, dark edge, whitening), bleached edges, specks. Around it: dark drafting cloth with a drop shadow.
- **Lines**: pale blue-white, slightly soft (mipmap bleed), a faint ink breakup driven by paper grain. Four weights (outline, detail, thin, hair; e.g. 3.2 / 2.0 / 1.25 / 0.9 sheet units). **Screen width = sheet width × zoom^0.65**, so close-ups don't turn into sausages and wides don't vanish.
- **Dash conventions**: centre line (long-short), hidden (short dashes), phantom / cutting plane (long-short-short), scaled with zoom so the pattern stays on the paper.
- **Occlusion by painter's order**: every solid is filled with "paper" before its outline is stroked. Oblique extrusion: stroke the outline at N depth steps at 2× width, then fill the same steps with paper; a clean silhouette survives.
- **Composite in buffers**: ink (white = exposed line); fx (shadow, wetness, stamp ink as channels); a subtitle overlay last. Shadows darken lines too: that is how a lifted object proves it has left the paper.
- **Hatching** (fine-line shading) for sections, soil, weights, at 45°, spacing 8–14 units.
- **Cyanotype and water**: a drop blooms deeper blue with a pale tide line; white lines inside the stain go soft; ink signatures bleed.
- **The one real thing** (optional, at most once): a drawing symbol that leaves the drawing language gets soft volume, one gradient across its whole shape, glow, and a shadow falling across the lines. It leaves a pale unexposed imprint where it was drawn.

## 3. Colour logic

- **Blue and white only.** The blue varies in value (coating, stains, folds); the white varies in weight and softness, never in hue.
- **One non-blue colour, used exactly once**: a rubber-stamp ink (red is classic; a green APPROVED or black VOID work too). It carries the verdict.
- The "real" object at the climax may carry light (white glow, soft value), not a new hue.
- Example blues: `#18336B` → `#2A58A6` with lines `#E7F0F9` and table `#0D1116`; a faded sun-bleached sheet `#3A6DA8` → `#5B8CC4`; a deep over-exposed sheet `#0F2350` → `#1D3F80`.

## 4. Type & subtitles

- **Hand lettering** for header, labels, notes and subtitles (e.g. Architects Daughter); a technical sans for title-block fields (e.g. B612); a script only for the signature (e.g. Allura). All OFL.
- **Text is written on left to right** with a glowing nib, like everything else.
- **Subtitles are drawing notes**, in one language, the one spoken: a light translucent box with double white rules, a "NOTE / n" cell, the text lettered on in ~0.35 s, a small leader tick. **Placed per shot in empty sky**, never fixed to the bottom (the bottom of a drawing is ground line, base and title block). Wrap at ~880 px (~680 px in a reel). Hold ≥ max(1.8 s, speech + 0.6 s).
- Every subtitle is also lettered into the sheet's **GENERAL NOTES** column, so the final wide shows the whole voiceover as drawing notes.
- The **title is the sheet header**; the **title block** holds status and verdict fields.

## 5. Motion quality

- **Camera and draw-on on ones (24 fps).** Continuous moves within a section, hard cuts on downbeats between sections; tiny camera bumps only for physical impacts (paper slap, stamp).
- **Draw-on** truncated by arc length with a glowing nib at the head; items staggered within a layer; each layer starts on a beat.
- **Drafting order**: centre lines → outlines → detail → hatching → dimensions → balloons → labels.
- **Exploded views**: parts leave in sequence on subdivisions of the beat, eased, and return one per beat-group with a click.
- **Mechanisms step on the grid** like an escapement: a gear advances one tooth per subdivision with a short ease-out; meshing phases computed so teeth really interlock; chains move with their sprockets.
- **Machine acting**: angles, droops, volumes and gauge needles are the face. Failure = slowing, sagging, winding down over ~1.5 s; joy = snapping upright, a needle overshooting (back-ease).

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Whole sheet on the table | scale, the document as an object | establishing; a verdict; a series of sheets |
| Medium on a figure, subject ~80 % of height, sky on one side | the design being drawn | drafting; explaining a part |
| Track along a path of force (chain, pipe, wire, beam) | cause and effect | how it works; a sequence of operations |
| 2× close-up cut on a downbeat | the mechanism's heart | gears meshing; a valve; a joint |
| Locked-off, hold a beat | deliberation | a hand revising; a decision |
| Oblique depth factor 0 → 0.5 | the flat drawing "turns" and gains thickness | from plan to object; a reveal of depth |
| Section line sweeping across | inside vs outside | a cutaway; hidden structure |
| Lateral pan across Fig. 1 → Fig. 2 → Fig. 3 | versions, steps, time | revisions; stages of construction |
| Slow push-in, no voice | wonder | the one real thing |

Keep storytelling shots close; full-sheet wides are rare. Keep the main figure at least half the frame's extent ÷ zoom from any sheet edge you will frame (960/zoom across a 16:9 frame; in a reel, 540/zoom from the sides and 960/zoom from top and bottom). Transitions: cuts on downbeats, or fig-number rewrites on the sheet; no dissolves.

## 7. Sound palette

- **Contrapuntal, mechanical music**: harpsichord, bassoon, strings spiccato, harp, celesta, music box, clavichord, a small wind ensemble. Imitative lines (an invention, a canon, a fugato) feel like interlocking parts; a short repeated motive can be the "gear".
- **Foley follows materials**. Paper: roll crackle and slap, T-square wood slide, technical pen scratch (2–6 kHz grain, length = stroke length), lettering bursts, compass squeak, hatching strokes, eraser rub, tracing-paper rustle. Brass and wood: part clicks (resonances ~3–5 kHz), escapement ticks, chain rattle, spring twang, wind-down ticks that slow geometrically. Water: soft damped pats per drop, a light rain bed. Rubber stamp thump, pen cap click.
- **Options for the arc** (in any order, use what the story needs): instruments dropping out with a written-out ritardando into true silence; a single questioning figure alone; a suspended chord held without resolution under the magic; a full cadence on the stamp; the theme in augmentation for a close; adding a section per mechanism that joins.
- **Silence** may contain paper sounds only.
- **Voice**: one dry, understated narrator reading design notes, a few short lines. Leave the most emotional moment voiceless.
- **Mix**: music ducks well under voice (~0.36 ×), foley by half; whooshes low-passed so they don't mask consonants. Master −14 LUFS. Little added grain (the paper already has it).

## 8. Native moves

A menu: use the ones your story needs.

- **Drafting order.** The object draws itself as an engineer would, a layer per beat. *Fits content like:* a bridge; a violin; a kitchen renovation.
- **Live annotations.** Dimensions measure moving parts and the numbers change; balloons fly with parts; a section line reveals the inside. *Fits content like:* a heart valve; a folding bicycle; a rocket stage separating.
- **Fig. numbers as transitions.** "FIG. 1" struck through and rewritten "FIG. 2 · EXPLODED VIEW". *Fits content like:* versions of a product; phases of a construction; a recipe's stages.
- **Projection as camera.** The oblique factor animates; exploded parts fly along the depth axis. *Fits content like:* a floor plan becoming a building; a circuit board; flat-pack furniture.
- **A symbol made real** (once, if at all). A convention leaves the drawing language: a dimension arrow flies, a hatch becomes rain, a centre line becomes a road, a weld symbol sparks. *Fits content like:* an invention finally working; a city plan becoming a street; a dream becoming a plan.
- **Cyanotype and water.** Drops bloom and soften lines. *Fits content like:* a flood-defence design; grief; a harbour wall.
- **The title block as story.** Status field = the verdict; revision rows = history. *Fits content like:* a rejected permit; REV. 1–5 of a city; an approval after years.

## 9. Pitfalls of the medium

- **Main figure near the sheet edge** → wides show the desk. Keep margins or enlarge the sheet.
- **Upward explosions hit the header** → explode sideways and flatten long parts during the explode (in a reel, downward and diagonally).
- **Subtitles on the ink buffer** vanish off-sheet and can't occlude lines → separate overlay, premultiplied alpha.
- **An object darkened by its own shadow** → zero the shadow channel only in its area.
- **Per-lobe shading on a blobby shape reads as grapes** → one gradient across the union; crescents from a union-minus-shifted mask; fill unions as one path (`nonzero`) or overlapping fills make bubbles.
- **A small payoff undersells the return** → the payoff object ~⅓ of frame height, centred, drawn stroke by stroke, subtitles off it.
- **Line weights not scaled with zoom** → sausages in close-ups, vanishing wides.
- **The title block under the app's buttons or the player's controls** → frame it above y 1248 in a reel, y 950 on YouTube.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **A WebGL2 compositor, drawn from `t`**: the procedural cyanotype sheet in sheet coordinates (fbm between two blues, streaks, fibres, creases, bleached edges, specks), the drafting cloth and drop shadow, and three inputs combined per pixel: an **ink buffer** (white = exposed line, softened by mipmap bleed and broken by paper grain), an **fx buffer** with shadow, wetness and stamp ink as separate channels (shadows darken lines too; wet stains bloom with a tide line and soften the lines inside), and the **notes overlay**, premultiplied, last.
- **A drafting engine on canvas** that feeds the ink buffer: a camera over the sheet, oblique projection with an animatable depth factor, polylines drawn on by arc length with a glowing nib, solids filled with paper before their outline (extrusions stroked at N depth steps at 2× width, then filled), 45° hatching, live dimensions, balloons with leaders, text written on left to right. Line width = sheet width × zoom^0.65; dash patterns scale with zoom.
- **Sheet furniture**: border, header, title block with status and revision rows, parts list, GENERAL NOTES column (it repeats every subtitle), revision cloud, rain, a hand shadow with a pen, the stamp. A new machine is its own module of parts: polylines, solids, pivots, gear tooth counts.
- **Mechanisms on the beat grid**: each layer starts on a beat; gears advance one tooth per subdivision with a short ease-out, meshing phases computed so teeth interlock; exploded parts leave on subdivisions and return one per beat-group. A part draws on, moves or gets its dimension as the voice names it, from the word timings.
- **Cues in `cues.json`**: each stroke's pen scratch (its length is the stroke's), lettering bursts, part clicks, escapement ticks, explosions and returns, the stamp, paper slaps

## 11. Variation space

You decide what is designed, its figures, the flaw or turn (if any), the voice, the one real thing (or none), the camera path, the opening, the ending and the length.

Push past the obvious single machine drawn and assembled:

- Structures: **a city through revisions** (one site plan, REV. 1 to REV. 6, each revision a decade, the title block filling with dates); **two sheets, one table** (two designs drawn in parallel that turn out to fit together); **a teardown in reverse** (the sheet starts full and parts are erased one by one until only the centre line of the idea remains).
- Openings: **a single centre line** crossing an empty sheet on the first beat; **the stamp first** (REJECTED lands, then we see what was rejected); **tracing paper** lifted off a finished drawing to reveal a blank sheet underneath.
- Endings: **the sheet folds up** along its creases into a pocket-sized square; **a coffee ring** lands on the title block and the tide line becomes the last circle of the design; **the lights go off** and the white lines glow faintly on the dark sheet.
