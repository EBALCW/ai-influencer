# Text Flash Cuts

> A story told in three colours (red, black and off-white) by full-screen words that flash for a few frames, chapter cards with one giant character, dialogue set on vertical rails that slam in from the edges, and stark one-point-perspective architecture, cut on a strict beat between a few held, slowly pushing images of the characters. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): the episode-title cards of 1990s–2000s TV anime (Hideaki Anno's *Neon Genesis Evangelion* and the text-frame editing of Studio Shaft under Akiyuki Shinbo) for heavy serif words set huge and cut in for a few frames; Jean-Luc Godard's coloured intertitles of the 1960s for words as shots; constructivist posters for red, black and white as the whole palette. Never copy their characters, cards, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Cards and architecture fill the frame and bleed; the giant word is cropped by an edge. Rails become full-width bands: one voice slams down from the top of the safe box, the other up from the bottom. Must-read text sits in x 72–900, y 269–1248.

| Zone | Position | Content |
|---|---|---|
| Flash card | full bleed | one word, 500–800 px, cropped by the frame edge, never needed for reading |
| Top rail (voice A) | full width, y 269–700, black, 10 px red inner edge | the line, 110–140 px heavy serif, stacked one or two words per row |
| Bottom rail (voice B) | full width, y 820–1248, red, 10 px black inner edge | the reply, same size |
| Character | centred, head in y 400–1000 | one held image, pushed in slowly |
| Caption line | centred on x 540, ≤ 720 px wide, bottom edge y ≈ 1230 | italic serif, 44 px |

- **The first 3 seconds.** Frame 1 is a tunnel of nested frames already rushing; at 0.1 s the first word card hits; three single-word cards on half-beats (0.2 s each) spell the hook; by 0.7 s a stark architectural push with a rail slamming in carries the premise; by 3 s the line that makes people stay is on screen and held.
- **Length and pace.** 20–45 s at 150 BPM: flash runs of 3–6 frames per card for at most 1.5 s, separated by held shots of 1.5–3 s; one silence of about 1 s before the reveal.
- **Captions.** Rails carry the dialogue; narration goes on the italic caption line. Flash cards are never the only place a word is said.
- **Sound.** `hook-impact` on the first card, `thock` on each later card (pitched up through a run), `ui-click` on hard cuts, `tick` as a clock, `sub-impact` on the reveal, `metallic-riser` into the last flash run. Harpsichord, timpani, gong and bells come from free sample libraries.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Rail subtitles and caption lines sit above y 936; vertical rail text starts below y 120 and ends above y 900.
- **Length and structure.** 2–6 min, in "episodes" of 30–90 s, each opened by its own chapter card (the style's native chapter mark: one giant character, a chapter number, a coloured bar cutting in). The video carries length by alternating speeds: each episode is one held scene (architecture or a character, 4–15 s of slow push), one exchange on rails, and one flash run that ends it. Rotate the chapter card's colourway and layout every episode. Re-hook every 30–60 s with a flash run, a red/black inversion or a rail answering the last one; put the longest silence just before the final reveal.
- **The first 10 seconds.** The strongest image first: the giant hook word on frame 1 (or the tunnel burst into it); the three-card hook by 1 s; the question on a rail by 5 s; the promise by 10 s, on the opposite rail, followed by a red slit into the first chapter card. Any channel sting comes after.
- **Captions.** Rails and caption lines are burned in; export every spoken line as `.srt`.
- **Thumbnail.** The held character frame (or the stair) beside a red rail holding at most three words; one giant character can sit behind as a cropped shape.

### Good for

Suspense and drama trailers, title sequences, manifesto films, launch teasers, "five rules" countdowns, poetry and lyric videos.

## 1. Essence, and what it is not

1. **Words are shots.** A full-screen card with one or two words is a shot of 3–18 frames, cut on the beat like any image.
2. **Three colours.** Red, near-black and off-white, with greys only inside images; every frame is a hard-edged arrangement of them.
3. **Rails speak.** Dialogue is never a subtitle under a picture: each speaker owns a coloured rail that slams in from their side.
4. **Architecture as mood.** Stairs, corridors, window walls and lockers drawn in one-point perspective with extreme symmetry; a red pulse travels through them.
5. **Few images, held long.** The characters appear in a small number of images (from an image model), pushed in slowly, posed by splitting the head from the body; everything else is drawn in code.

**Needs an image model the user brings** for the character images (keyed on a green background, one reference image driving the others for consistency). Without one, draw the characters in code as flat silhouettes (black or off-white cut shapes from simple vector paths, red accents only) and close-ups as type-only cards; the style survives on type and architecture alone.

Not **60s Spy Title Sequence** (no playful cut-paper shapes or jazz; three colours and hard cuts only). Not **Constructivist Montage** (no footage, no diagonal photo montage). Not **Manga Panels** (no panel grids or speech balloons). Words never fly or morph: they cut.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Flash card | full bleed, one colour ground | heavy serif, 620–980 px, baseline y 820–1000, x 40–1000, cropped by the edge |
| Chapter card | full bleed | 820 px character; chapter number set vertically at 64 px in the accent; an English or secondary line in italic serif 40 px; a 26 px bar cutting in at y 960 (or y 120) |
| Rail, voice A | left edge, 300–560 px wide, full height, black with a 10 px red inner edge | the line in off-white heavy serif 118–150 px (vertical in CJK, stacked words in Latin scripts); speaker tag 40 px at top |
| Rail, voice B | right edge, same, red with a 10 px black inner edge | the reply in black |
| Rail subtitle | centred in the rail, baseline y ≈ 900 | italic serif 40 px, grey on black, black on red |
| Architecture | full bleed, vanishing point at x 960, y ≈ 330 | stairs, corridors, window grids |
| Character | right or left two thirds, often cropped at the frame edge | one image, slowly pushed |
| Red band | a vertical red stripe 210–700 px wide dropping in behind a character | frames the figure |

Compositions are asymmetric: a giant word pushed to one side, a rail on the other, the figure between.

## 3. Materials and rendering

- **Flat fills only** for everything drawn in code: cards, rails, architecture, weather lines, props, window grids. No gradients, shadows or textures.
- **Architecture.** One-point perspective built from nested trapezoids with a geometric ratio (each step 0.87 of the last); risers in black, treads in off-white, every third side panel in dark grey; two red rails converge on the vanishing point. A red "wave" lights one step at a time (14 steps per second) running up the stair.
- **The tunnel.** 16 nested frames rushing toward the viewer, alternating colours on their side panels, four diagonals to the corners, speed 4–30 frames per second; with a white bar bursting open from the centre line on frame 1.
- **Character images** come in on a green background, are keyed (alpha from how far green exceeds red and blue, a one-pixel edge trim, green spill turned into a warm rim), and stray reds are pulled back to the film's red. The head is cut from the body along a polygon so it can turn on a neck pivot; the same image tinted black or off-white gives silhouettes.
- **Inversion.** A red/black swap: the frame is turned to greyscale, contrast pushed to 5, inverted, then multiplied by red, so white becomes black and black becomes red. Used for 1–6 frames at a time.
- Everything is screen-space; there is no world camera, only per-shot zooms.

## 4. Colour logic

- **Red is the voice of the other**, the alarm and the accent: the second speaker's rail, the pulse in the architecture, the slit transition, the inversion.
- **Black and off-white** are ground and figure, swapped from card to card so consecutive cards never share a ground.
- **Each chapter has one ground** (off-white, black or red) and an accent from the other two.
- **Greys** live only inside images and secondary lines.
- **Never:** a fourth hue, gradients, or soft colour washes; generated images whose reds drift toward orange or pink are corrected to the film red.

Example palette:

| Role | Hex |
|---|---|
| Red | `#D4162B` |
| Black | `#0A0A0C` |
| Off-white | `#F2EFE8` |
| Ink | `#1B1B1F` |
| Dark panel | `#26262A` |
| Grey (secondary type) | `#8D8A84` |
| Pale | `#D8D4CC` |

## 5. Type and captions

- **Faces (SIL Open Font License):** Noto Serif in its Black weight (900) for cards, rails and titles (Noto Serif SC, JP or TC for CJK scripts); Noto Sans Black for tags and chapter numbers; Cormorant Garamond SemiBold Italic for the small secondary lines.
- **Cards** hit at 108 % scale on their first frame, 102 % on the second, then 100 %, shaking ±14 px for two frames and ±3 px after. A card may carry a 14 px rule wiping under the word in 0.1 s.
- **Rails** slam in over 3 frames (ease-out) from their edge; the text over-scales to 105 % for two frames and shakes ±8 px, then settles to ±1.2 px. A rail only counts as read once it is fully in.
- **Vertical text** (CJK) moves full stops and commas to the top-right of their cell. Latin text on a rail stacks one or two words per row, flush to the rail's centre line.
- **Captions.** The spoken language only; rail lines and the italic caption line hold ≥ max(1.8 s, speech + 0.6 s). Flash cards are exempt because they repeat words already held elsewhere.

## 6. Motion

- **Frame rate and grid.** 30 fps; 150 BPM, so a beat is 12 frames and every cut lands on a beat, a half-beat (6 frames) or a quarter (3 frames). The timeline is written in frames.
- **Shot lengths.** Cards 6 frames; flash runs 3–4 frames per card for up to 1.5 s; chapter cards 18 frames; held shots 30–90 frames.
- **Pushes.** Held shots push in 2.5–12 % across their length (ease-out); a sequence of stair cuts steps the zoom up by about 0.2 per cut, one step per beat.
- **The snap.** A head turns from its held angle in 0.12 s (ease-in), with three smeared copies of the head at 28 % between the start and end angles, then overshoots and settles with a decaying oscillation (≈ 4 Hz, damping 9) and a 12 px camera shake.
- **Arrivals** are hard: bands drop in 0.15–0.18 s, bars wipe in 5 frames, nothing fades.
- **What never moves:** the vanishing point, the rails once landed, and type on a held card after its second frame (apart from a tiny shake).

## 7. Camera

| Move | What it expresses | What it can serve |
|---|---|---|
| Slow push on a held image (2.5–12 %) | dread, attention | the character, the architecture, an object in hand |
| Step-zoom per beat (+0.2 per cut up a stair) | approach, counting | countdowns, "one more step" |
| Tunnel rush | falling into the next scene | cold opens, between chapters |
| Lateral pan along a window wall, panes going dark | searching, absence | lists, "who is missing" |
| Split screen with a figure one place nearer each beat | threat closing in | chases, deadlines |
| Shake (±8–14 px, 2–3 frames) | impact | every card hit, the snap |

**Allowed transitions:** the hard cut on the grid, the flash card, the red slit (a 6 px red line opening from the centre over 0.3–0.4 s on black, sometimes crossed by a vertical), the 1–6 frame red/black inversion, the tunnel. **Forbidden:** dissolves, fades to black, wipes with soft edges, zooms between shots, any transition longer than half a beat except the slit.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Score | 150 BPM in a minor key: a harpsichord sixteenth-note ostinato (i–VI–iv–V, one chord per bar), plucked bass on the beat, a wood-block clock; quiet episodes keep only tremolo strings and bowed vibraphone; a glockenspiel lullaby as a second character's theme; the climax adds timpani rising each beat, staccato brass on counts and an accelerating snare roll | ducked under the voice |
| Card hits | a metallic transient, a bell ring (three high partials) and a falling 52 Hz sub; each hit in a run is pitched up (×1.12, ×1.26 … ×2.1) | dry plus reverb |
| Chapter cards | a hit plus a 48 Hz thump | |
| Rails | a 95 Hz thump with a click | |
| Foley | a whoosh for the tunnel, a reversed swell into a cut, material foley for each prop, footsteps growing louder each beat for an approach, a metal clack for the snap, heartbeats, a clock tick | |
| Ambience | a low hum (55 and 82 Hz) under the whole film; rain where it rains | |
| Silence | about 1 s of nothing but the hum before the snap; then a gong, a low brass chord and the bass drum | |

Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **The three-card hook.** Three single-word cards on half-beats, ground and figure swapping each time, pitch rising, into a boom on the fourth. Fits content like: a warning; a title; a slogan in three words.
2. **Rails in dialogue.** One speaker's black rail slams from the left; the answer's red rail slams from the right while the picture keeps running between. Fits content like: interviews turned into drama; a question and its answer; two sides of an argument.
3. **The count.** Number cards alternate with a stair push that steps closer each beat, cuts shrinking from 9 to 3 frames, an inversion and a tunnel in the middle. Fits content like: countdowns; launch dates; the final stage of anything.
4. **The snap.** After a held back view and a silence, the head turns in 0.12 s with smears; colour floods in; a rail answers. Fits content like: the reveal; a twist; the product shown at last.
5. **Panes going dark.** A wall of windows pans sideways, panes switching off one by one; then a 3×3 grid of one image, all nine moving together. Fits content like: absence; multiplying doubts; crowds and conformity.
6. **The red slit.** Black, a 6 px red line opening across the frame, crossed by a vertical. Fits content like: chapter breaks; time skips; the end.
7. **Inversion flicker.** Two frames of red/black swap on an impact. Fits content like: shock; a lie; a memory.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D at 1920×1080 (or 1080×1920), one timeline table in frames: `[start, end, shot function, parameters]`; each shot draws itself from local time and frame index.
- Inversion as a post pass on the frame (greyscale, contrast 5, invert, multiply red), triggered by a separate list of frame ranges.
- Character images need an image model the user brings: generate one character image first, then use it as the reference for the rest; ask for a flat green background; key, despill, fix reds, then split head and body along a polygon with a neck pivot. Without a model, draw silhouettes in code.
- Jitter comes from a hash of the frame number, never from `Math.random()`.
- Fonts are subsets of the words actually used, loaded before the first frame.
- One sound event per cut, hit, rail and step, each hit carrying its pitch step.

## 11. Pitfalls

- **Photosensitivity.** Full-frame red and inversion flicker are the riskiest kind of flash. Keep large luminance or saturated-red changes to at most three per second except in one short run, and add a flashing warning to the description.
- **Unreadable meaning.** A word seen for 6 frames registers but cannot be read; anything the viewer must understand also appears on a rail or caption line for the full hold.
- **Off-grid cuts.** A cut a frame away from the beat feels sloppy in a style this strict; write the timeline in frames.
- **Too many images.** More than about ten generated images, or images in different drawing styles, breaks the look; chain them from one reference.
- **Fourth colour.** Generated images bring oranges and pinks; correct them, or tint the figure to a silhouette.
- **All speed.** Without held shots the flashes stop meaning anything.

## 12. Variation space

The agent decides per video: the hook words, the number of episodes, which colour leads each chapter, which architecture (stairs, corridor, window wall, lockers), the characters (or silhouettes), the tempo (130–160 BPM).

- **Three structures:** episodes with one rising threat (each chapter closer to the reveal); a manifesto of numbered rules, a card and a rail per rule; a two-voice argument where the rails alternate and the last answer comes from the first speaker's side.
- **Three openings:** the tunnel burst into three word cards; a held architectural push with a rail already speaking; one giant word card held for a full beat in silence, then the run.
- **Three endings:** the snap and its answer; a title slate pushing slowly while bells ring out; a red slit closing to a point, then the clock tick alone.
