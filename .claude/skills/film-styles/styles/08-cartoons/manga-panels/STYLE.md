# Manga Panels

> A printed black-and-white manga page that plays: solid ink, paper white and dot screentone, one vermilion accent, panels slammed onto the page one per beat, with hand-lettered sound effects, focus lines and speed lines that boil at 12 drawings a second. Cuts and panel splits ride the music's bar grid. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): weekly shōnen and seinen manga (tiered pages, slanted gutters, figures breaking the frame, effect lines, sound-effect lettering as picture); anime opening sequences (one panel per beat, impact frames, a chorus that bursts); street photography and the "decisive moment" (a frozen instant chosen out of motion); flip books (stills that become motion when riffled). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** A phone screen is already a manga page: three to five tiers of panels with slanted gutters, the page bleeding to all four edges.

| Zone | Position | Content |
|---|---|---|
| Page | full bleed, 34 px outer margin | three to five tiers, 22–26 px gutters slanting about 1° |
| Hero panel | the tier crossing y 500–1100 | the subject, breaking the frame into the tier above or below |
| Sound effects | anywhere, mostly over gutters | picture, not must-read; may run past the safe box |
| Balloons | inside x 72–900, y 300–1200 | one short line, horizontal |
| Caption box | centred on x 540, ≤ 720 px wide, bottom edge y 1230 | one or two lines |

  Splash pages and the panel-split burst use the full height; keep their must-read text inside x 72–900, y 269–1248.
- **The first 3 seconds.** Frame 1 is a panel already slamming in with its sound effect mid-bounce; a new panel lands on each beat (four panels by about 1.5 s at 160 BPM); an impact frame and a figure breaking out of its panel by 3 s.
- **Length and pace.** 20–40 s. One cut per bar, panels on beats, one burst (the panel split) at the peak, one silent "pause" panel before it.
- **Captions.** The caption box (narration or lyric) is the only caption layer; balloons carry speech only when a character speaks to camera.
- **Sound.** `hook-impact` on the first slam, `camera-shutter` on each impact frame, `camera-shutter-light` on every cell of the panel-split burst, `tick` while the focus box hunts, `metallic-riser` into the drop, `sparkle` on lens glints and sparkle stars. Drums, distorted power chords, bass and a square-wave lead from a free sample library such as [Freesound](https://freesound.org) (CC0 filter).

### YouTube (1920×1080)

- **Layout.** Section 2 as written: a 16:9 frame is a double-page spread. Keep the caption box and balloons inside the 5 % margins and above y 950.
- **Length and structure.** 2–6 min as chapters; each opens on a chapter-title page (the figure breaking the frame, a tall vertical title box, the chapter number) and closes on a full spread seen whole. Inside, alternate dense pages (panels per beat) with one splash page and one quiet "pause" panel; re-hook every 30–60 s with an impact frame into a splash or a panel-split burst.
- **The first 10 seconds.** The strongest image first: the subject breaking out of a panel at full size; the question by 5 s in a caption box ("what really happens in the second before the goal?"); the promise by 10 s, landing on a page split along its gutter.
- **Captions.** Caption boxes are burned in as part of the page; export the same lines as `.srt`.
- **Thumbnail.** One splash panel with the subject breaking the frame, focus lines behind, the vermilion object, and a sound effect or caption of at most three words.

### Good for

Music videos, product launches, anime-style openings, sports and action moments, one-second stories, character introductions.

## 1. Essence, and what it is not

1. **Print, not animation.** Every tone is ink dots or ink lines on paper; there is no smooth grey and no shading gradient anywhere. Motion comes from panels arriving, cameras moving over the page, and lines that boil.
2. **The panel is the cut.** Panels ink in one per beat; the gutter is the edit; a chorus can split one panel into thirty.
3. **Lettering is picture.** Sound effects are big hand-cut letters with a triple stroke, tilted glyph by glyph, part of the drawing.
4. **One accent colour** marks the subject (the product, the object that matters) and the focus box; everything else is black and white.
5. **Silence is drawn.** A wide calm panel with no effect lines and no lettering is how the page holds its breath.

Characters, products and backgrounds are drawn by an image model, then re-printed as screentone in code: the look needs an image model the user brings. Without one, use the user's own photos through the same screentone pass, or draw the subjects in code as inked silhouettes with tone fills.

Not **80s Cel Anime** (no colour cels, no painted backgrounds, no lens flares). Not **Comic History Cartoon** (no paper puppets or colour; the page is the medium, not a table prop). Not **Halftone Dossier** (dots here are manga screentone in black only, with no paper documents or redactions). Not **Pop Art** (no Ben-Day colour fields, no big primary palette).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Spread | full frame, 34 px outer margin | two to four panels per bar; outer border 7 px ink, mitred corners |
| Gutters | 22–40 px wide, slanted about 1° (a slope near 0.017) | paper; panels never touch |
| Subject | the largest panel, often right two thirds | breaks the frame with a paper halo when it matters |
| Chapter box | left, x 130–310, tall vertical box | chapter number in a black head, title set vertically |
| Caption box | pinned to the active panel's top-left corner, overlapping its border by 20 px | one or two lines; never below y 950 |
| Balloons | beside the speaker's head, inside the panel | elliptical, 6 px stroke |
| Sound effects | over the action and across gutters | 84–330 px glyphs |
| Focus box | on the subject | four vermilion corner brackets, a leader line to a small spec label |

Reading order is right to left for the panel sequence only if the user wants a Japanese page; otherwise left to right, top to bottom. Keep one page's tiers parallel; vary the slant from page to page.

## 3. Materials and rendering

- **The screentone pass** (applied to every generated image, once, at its display size): luminance below 0.30 × 0.7 is solid black; areas with high local contrast (a 2 px-radius standard deviation above 0.06–0.14) are line work, hard-thresholded at L 0.44–0.56; flat areas become a 45° round-dot screen with a 7 px cell (6–9 px reads as print), coverage at most 62 %; above L 0.86 is paper. Reds strongly above green and blue become the accent colour, with their shadows as dots over it. Output only ink, paper and accent.
- **Tone sheets in code** for backgrounds: a dot screen whose coverage follows a function of panel position (radial vignettes, bottom-heavy gradients), cells 5–9 px; and a parallel-line tone (lines 7–9 px apart at −12° to −20°, line width = coverage × 0.8 × gap). Cache each sheet by key.
- **Effect lines.** Focus lines are tapered wedges from an inner ellipse (rx 230–900) out to 1500–1800 px, 70–320 of them, up to 10 px wide; speed lines are long thin diamonds (200–900 px) scrolling at 1600–2600 px/s, in ink or in paper white over dark images; impact rings are broken concentric arcs.
- **Panel borders** 7 px ink (4–6 px when cells are small), mitred; a blank panel waiting for its beat has a dashed border.
- **Breaking the frame.** A figure that crosses a border gets a 12 px paper-white halo and a 3 px ink outline around it, so it sits on top of the page like a pasted cut-out.
- **Paper.** Paper `#F3F0E8`, ink `#121212`, never pure white or black. A 512 px noise tile (values 200–255) multiplied at 10 % over the whole frame, screen-space, drawn last.

## 4. Colour logic

- Two inks: paper and ink. Every grey is screentone or line tone, never a fill.
- One accent, vermilion, for the subject only (a product's body, a key object) and for the focus box and its underline. Never on skin, sky, text or effect lines.
- Inverted pages (paper lines on black) are for impact frames, night and the flip-book ground; use them for a beat or a page, not a sequence.
- Lettering is ink with a paper rim; it takes the accent only on a title underline.

Example palette: paper `#F3F0E8`, ink `#121212`, accent `#F03C1E`, flip-page edge `#D9D5CC`.

## 5. Type and captions

All faces are SIL OFL from Google Fonts.

| Role | Face | Size (16:9) | Rules |
|---|---|---|---|
| Sound effects | Dela Gothic One | 84–330 px | per-glyph tilt (±0.19 rad), offset, 0.88–1.18 scale; outer ink stroke 0.34 of size, paper rim 0.27, ink fill |
| Shouted lines (chorus, title) | Noto Sans 900 | 110–180 px | the same triple stroke, glyphs slam in one by one |
| Captions, balloons, chapter title | Noto Serif 900 | 56–64 px | ink on paper, horizontal in Latin scripts |
| Specs, page numbers, labels | Barlow Condensed 800 | 30–64 px | tracked 4–6 px for small labels |

- **Caption box.** Paper box, 5 px ink border, a solid ink offset shadow 9 px down and right; it pops from 0.7 to 1 scale with a back ease in 0.15 s, and its words ink in one by one across the first third of the line (0.08 s each). Hold ≥ max(1.8 s, spoken or sung line + 0.6 s). One language, the spoken one. Vertical columns only when the spoken language is set vertically.
- **Balloons** are ellipses with a 6 px stroke and a three-point tail; they pop in with a back ease (overshoot 1.5) over 0.14 s.
- **Sound effects** slam glyph by glyph (0.03 s stagger) from 1.9× to 1× in 0.13 s, then jitter ±1.5 px on the boil. Write them in the video's language; a foreign-script effect is allowed only as picture with nothing to read in it.

## 6. Motion

- **Frame rate.** 30 fps for both formats; impact frames last exactly two frames. Lines, lettering jitter and focus lines boil at 12 drawings a second (8–10 for calmer pages): reseed from `Math.floor(t * 12)`.
- **Panel arrival.** A panel wipes open from one side in 0.1 s (cubic out) while its contents slide 40–80 px in the same direction and settle over 0.22 s. One panel per beat; a whole page in one bar.
- **Easing.** Cubic out for arrivals, cubic in-out for camera, back with overshoot 1.4–2.2 for lettering and boxes.
- **Weight.** Each hit shakes the camera with random offsets decaying as e^(−t/0.07) over 0.5 s; amplitudes 6–12 px for panels, 20–26 px for impacts, 40 px for the climax. Figures drift 4 px and sway 0.008 rad between hits.
- **Stillness.** In a time-stop, the screentone retreats from the outside in toward the subject, speed lines fade over 1.5 beats and the boil freezes; the page becomes clean paper.
- **What never moves**: panel borders once inked, the gutters, and the page itself (only the camera travels over it).

## 7. Camera

| Move | What it expresses | What it can serve |
|---|---|---|
| Slow push (zoom 0.97 → 1.02 over a bar) with a 0.01–0.02 rad tilt | tension building on a page | verse, set-up |
| Punch into a panel (zoom ×2.6–3.6 in the last half bar, ease-in) | dive into a detail | an eye, a finger on a button |
| Gutter travel: panel to panel on each beat, pulling 14 % wide mid-move | a sequence of moments | a montage, a product's features |
| Pull out to the whole page or spread (1.4 beats) | it was all one page | the chorus end, a chapter end |
| Beat shake | a hit | every slam |
| Locked frame | silence | the pause panel |

Transitions: hard cut on the bar; a two-frame impact frame (white focus lines on black, or black on white) at a cut; a page split along its diagonal gutter, the halves sliding apart 1300 px over 0.34 s; a flip book. Forbidden: dissolves, cross-fades, blurs, smooth 3D camera, any colour grade.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Music | about 160 BPM anime-opening rock in a minor key: kick, snare, hats, crash, distorted power chords, bass, a square-wave lead where a vocal would sit; the pre-chorus drops the drums for sustained chords, a heartbeat and a riser | the lead; ducked under any voice |
| Voice | optional narrator or a vocal; the lyric lines drive the caption boxes | about 8 dB over the music |
| Foley | brush stroke 0.08 s before each panel lands, paper page turns, mechanical shutter (two clacks and a spring), aperture-blade iris clicks, focus beeps, impacts, wind, wings, footsteps, crowd murmur, a flip-book riffle, a tear for the page split | on the panel's beat |
| Silence | 0.75 s of true silence after the biggest hit | |

Pack ids as in Formats. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **One panel per beat.** Four slanted panels ink in on four beats, each with its own sound-effect word, then the camera punches into the last one. Fits content like: an opening; four features in a bar; a run-up before an action.
2. **The panel-split burst.** One panel splits every beat 1 → 2 → 4 → 8 → 16 → 30 (grids 1×1, 2×1, 2×2, 4×2, 4×4, 6×5), each cell a successive moment of the same action, then all cells flash paper in reading order. Fits content like: high-speed capture; a sports move frame by frame; a process in thirty steps.
3. **Breaking the frame.** The subject, haloed in paper white, steps over its panel's border onto the gutter. Fits content like: a character introduction; a product reveal; a title page.
4. **Time stops.** Screentone retreats to the subject, lines stop boiling, the vermilion focus box hunts in half-beat jumps and locks with a leader line and a time label. Fits content like: the instant that matters; a spec callout; a reaction time.
5. **The pause panel.** After the loudest hit, a hard cut to one wide, plain panel: the object at rest, a single glint, no lettering, true silence. Fits content like: after a climax; a reflective line; the beat before the drop.
6. **Blank panel, filled on the beat.** A dashed empty panel waits beside the action, then fills all at once. Fits content like: anticipation; "the next frame is now"; a product slot waiting for its reveal.
7. **The flip book.** The still panels become a thirty-page book riffled in one second, a small page number counting up in the corner. Fits content like: stills that become motion; a year in a second; a time-lapse.
8. **Same panel, three times.** Three identical compositions stacked; the surroundings blur into speed lines and then vanish to white, the subject stays sharp. Fits content like: focus amid noise; standing out in a crowd; a world falling away.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas, drawn from `t`. A `beats.json` holds BPM, offset, the bar of every cut and each lyric or caption line's start and end; every scene reads its times from it, so changing the song changes only that file.
- Images need an image model the user brings: generate one character reference first and every pose against it; generate the product once and edit it into other images ("replace only the object"); ask for plain mid-grey backgrounds or flat chroma green for cut-outs. Then run the screentone pass (numpy) at each image's display width. Without an image model, run the user's photos through the same pass or draw silhouettes with tone fills.
- A small kit of pure functions: `panel(t, polygon, tin, dir, draw)`, `tone()` and `lineTone()` cached sheets, `focus()`, `speed()`, `rings()`, `sfx()` lettering, `halo()` for frame-breaking cut-outs, `cam()` with the hit list for shake, `flash()` for impact frames.
- Every random choice seeded: `rng(seed + boil(t))` for boiling lines and lettering jitter.
- One sound event per panel landing, shutter and impact; the burst writes one shutter cue per cell, quarter-beat apart; write them to `cues.json`.

## 11. Pitfalls

- **Grey fills and gradients** creep in from generated images or canvas blurs; everything grey must be dots or lines.
- **Dots at the wrong scale.** Screentone made at source resolution and then scaled moirés or turns to mush; run the pass at display size.
- **Too many accents.** The second red object kills the first.
- **Boil on everything.** Panel borders and paper must stay still; only lines and lettering boil.
- **Lettering that must be read.** Sound effects are picture; information goes in captions or balloons.
- **Panels without a beat.** A panel landing off the grid reads as a glitch; snap every arrival to a beat or a half-beat.
- **Character drift between generated images.** Generate every pose against one reference and reject off-model results.
- **Text near the frame-breaking figure.** The halo swallows nearby captions; keep text 40 px clear of it.

## 12. Variation space

The agent decides per video: tempo and the bar grid, the subject and the one accented object, page shapes and gutter slants, which beats get impact frames, the sound-effect words, where the burst and the pause sit.

- **Three structures:** music-video form (intro pages, verse pages, a silent pause, a chorus burst, an end spread); a single action told as one page per second; a product page by page, each panel a feature, ending in a splash.
- **Three openings:** a panel slamming in mid-action; the shutter blades opening onto the first panel; a figure already breaking out of the title page.
- **Three endings:** the subject turning to camera with the only speech balloon; a pull back to every panel of the video on one spread, then a colophon box; the flip book closing on its last page.
