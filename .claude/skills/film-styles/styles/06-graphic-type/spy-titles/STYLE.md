# 60s Spy Title Sequence

> A cut-paper, four-ink opening title sequence for a film that never existed: silhouettes move through sets built out of the credits themselves, every brass stab is a cut, and a title is assembled from the pieces. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Saul Bass's titles for *North by Northwest*, *Anatomy of a Murder* and *Vertigo* (flat opaque inks, abstraction down to silhouettes, type as structure); the 2002 homage by Kuntzel + Deygas for *Catch Me If You Can* (a cut-paper chase through graphic sets, lateral tracking). Not a gun-barrel opening, not a tiptoeing cartoon panther, not a copy of any real title's logo, lettering, characters or shots.

## Formats

### Reel (1080×1920)

- **Layout.** Keep the ~30° diagonals and the big flat grounds; turn the sets upright. A credit line becomes a tower of type (two or three stacked words as pillars, floors, a lift shaft) that is fully readable inside x 72–900, y 269–1248 at least once. Lateral tracking becomes a fall or a climb down a column of type; a diagonal split stacks into slanted rows. The subtitle strip is centred on x 540, at most 720 px wide, its bottom edge above y 1240, still slid in from the left and slightly tilted.
- **The first 3 seconds.** Frame 1 is the object of the chase on its black backing on a hot ground, a silhouette hand already reaching in. By 0.5 s the first brass stab cuts to the hero running on the diagonal, accent streaming; by 3 s a graphic match cut (key → keyhole → pupil) lands, and the hero runs into the first set built from a credit.
- **Length and pace.** 20–45 s: a location every 3–6 s, every stab a cut, the cut interval shrinking as the chase accelerates, one stop-time freeze (two beats of silence), the assembled title held ≥ 2 s at the end.
- **Captions.** On the paper strip, in the language spoken; credits stay in the set, never in the strip.
- **Sound.** `hook-impact` on the first stab cut, `zoom-swish` as a credit slides in on its grid line, `thock` for each letter landing with a paper slap, `latch` for keys and locks, `sub-impact` under the title chord. The big-band score (brass stabs, surf guitar, walking bass, bongos, vibraphone), paper and tape foley come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 2 as written; the subtitle strip sits above y 950 (the player's controls cover the bottom 12 %), and every credit line reads in full inside the 5 % margins.
- **Length and structure.** 2–5 min suits it best, as a case in locations: each chapter is one location whose credit line is its title and its set (40–90 s): a short chase, then the taped briefing explains, with a stop-time freeze on the key fact. Re-hook every 30–60 s with a stab into a new location, a run of match cuts, a diagonal split into a grid. The last chapter assembles the title from the pieces. 24 fps, puppets on twos.
- **The first 10 seconds.** The hero against the giant circle, holding the object, first; the question on the tape voice by 5 s ("who took the key?"); the promise by 10 s. A channel sting comes after that.
- **Captions.** The strip burned in, plus an `.srt`.
- **Thumbnail.** The silhouette against the giant circle in the hot colour, the object on its black backing, up to three words in the cut title glyphs.

### Good for

Title sequences and event openers, trailers and launch reveals, conference programmes, award nominees, heist-style product stories, mystery explainers.

## 1. Essence, and what it is not

- **Flat, opaque inks on paper**: four colours, no gradients.
- **Hand-cut edges** on every shape; pieces layered with cut gaps and small paper shadows.
- **Abstraction down to silhouettes**: figures in profile, all acting in outline and timing.
- **Typography is the picture's structure**: credits are architecture, props, vehicles.
- **Music cuts the picture**: brass stabs are edit points.
- A title sequence is a story in itself: one goal, a few locations, one reveal.

Not flat vector motion graphics (the edges are cut, the paper is physical), not a halftone print style (no dots), not a Swiss grid (diagonals, jaunty type, playful), not a spy parody with gadgets and gun barrels.

## 2. Materials & rendering

- **Scissor-cut edges**: every polygon resampled every ~9–10 px and displaced along its normal by low-frequency noise (amp ~1.2–2.2 px, larger for bigger shapes) plus a rare 1–2 px notch. **Cut the edge once in the piece's local space and cache it**, so a moving cutout keeps the same edge, exactly like real cutout animation (screen-space edges crawl).
- **Paper layering**: separate pieces are separated by a ~2.4 px cut gap in the ground colour and cast a small paper shadow (offset a few px, blur ~5, alpha ~0.3). Whole figures get the gap as an outline, so a black figure reads in front of a black letter.
- **Paper texture**: one full-frame texture multiplied on top (mottling + faint fibres), a sparse "ink void" speckle on dark ink, faint squeegee streaks; light film grain over the whole frame.
- **Silhouette figures**: tall stylised adults (~7 heads), identity by hat, coat cut, shoes and **one colour accent** that doubles as a motion indicator (a tie or scarf streaming back when running). Pieces **merge into one outline** inside the figure, with only thin slits at shoulder, elbow, hip and knee. Hands are sharp wedges; no faces except an eye slit in close-ups.
- **The object of the chase** sits on a black backing (an ink keyline) so it reads on any ground; it is the brightest thing in frame.
- **Type**: a condensed OFL display face (e.g. League Gothic) for credits, glyph outlines extracted (opentype.js) and **re-cut** per letter (edge noise, ±0.8° rotation, ±1.5 px baseline jitter). A title in custom geometric cut glyphs (straight cuts + arcs, uneven weights, staggered baselines), never a real title's lettering.

## 3. Colour logic

- **Four inks**: ink black, paper cream, one hot colour, one warm secondary. Darker "shadow paper" variants of those inks only for depth.
- **One dominant ground colour per scene**, changing with the location; figures and type in the other inks.
- The hot colour is reserved for one accent on the hero and for danger; the secondary marks the object of the chase.
- Background props go in a darker version of the ground, never in black, or they read as letters.
- Examples: black `#1b1714` / cream `#efe4c9` / red `#d23a22` / mustard `#e2a52a`; ink `#161a22` / bone `#ece6d6` / teal `#1f8a8a` / orange `#f07a28`; black / pale pink `#f3d6cc` / cobalt `#2a46b8` / yellow `#f0d23a`.

## 4. Type & subtitles

- **Credits live in the set**, never in the subtitle band: one line per location (a stacked tower of words in a reel), fully readable at some moment. Credits are fictional roles only, never real people's names.
- **Subtitles** in one language, the one spoken, on a narrow paper strip (scissor-cut ends, slightly tilted) bottom-left in 16:9 and bottom-centre in a reel, a small glyph from the sequence as bullet, a geometric OFL sans (e.g. League Spartan 600, ~44 px; ~52 px in a reel). Light strip on dark scenes, dark strip on light scenes; slides in from the left in ~0.18 s. Hold ≥ max(1.8 s, speech + 0.6 s).
- Hold each credit long enough to read alongside a subtitle.

## 5. Motion quality

- **Puppets on twos** (12 fps): poses and positions of figures, hands, letters landing, vehicles. **Camera, credit slides and grid growth on ones** (24 fps): a stepped camera judders.
- Run cycles of ~8 drawings, one step per beat, a strong lean, the accent flying back. Walks one step per beat, coats swinging.
- Credits slide in along grid lines and **stop dead on the beat** (short ease-out); letters land with a paper slap.
- **Stop-time**: at a stab the whole picture freezes (background scroll included) for a couple of beats in total silence, then resumes.
- Shattering: a scene sliced into strips parallel to a cut line that slide off alternately along the diagonal.

## 6. Camera grammar

A vocabulary, not a route. Graphic, flat, decisive. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Wide on a full credit line, then truck in | reading, then action | any location built from type |
| Lateral tracking, one screen direction | pursuit; momentum | a chase; a race; a delivery |
| Hard cut on a brass stab | punch; a new location | montage; a reveal; a gag |
| Graphic match cut (same shape, same position) | rhyme; acceleration | wheel → coin → pupil → moon |
| Locked single shape on a flat ground | mystery; an icon | a cold open; a clue; a logo |
| Silhouette against a giant circle | the hero moment | a catch; a triumph; a stand-off |
| Diagonal split into a grid | fragmentation; many at once | a split screen; a conspiracy; a team |
| Vertical pan down a column of type | descent; a list | a building; a roster; a countdown |
| Push into a letter until it fills frame | a letter becomes a place | a door; a tunnel; a window |

Framing: strong diagonals (~30°), big flat grounds, figures small against type. Match cuts keep circle centres and sizes identical across the cut. No dissolves. In a reel, the vertical pan down a column of type does the work lateral tracking does in 16:9.

## 7. Sound palette

- **1960s spy big band**: stacked staccato trumpets and trombones in octaves with crash (the stab), surf guitar low-string twang through a spring reverb, walking upright bass, brushes or sticks, bongos and shakers, vibraphone, flute, organ stabs, harpsichord. Minor keys, chromatic lines, dotted rhythms. Original motifs only: avoid the famous chromatic crawl of the most famous spy theme and its minor-major-ninth ending chord.
- **Stabs = edit points**: place staccato brass ~8 ms early so the sample's peak hits the frame.
- **Techniques (options)**: a cut interval that shrinks as a chase accelerates; stop-time silence; a big chord for the title followed by a short button; a solo instrument alone for a quiet scene.
- **Foley follows the material**: paper (cut "shh", slides, card slaps for letters landing, blind flips, a tear), metal (keys, chains, locks, clicks), tape (click, hiss). Environments only hinted: a jet pass panned, train wheels in tempo, roulette ticks slowing, wind, a phone ring, footsteps on stairs.
- **Silence**: true zero, reverb tails included; a single tape click or hiss may remain.
- **Mix**: music ducks ~7 dB under voice; a peaky mix needs a few dB into a limiter before loudness normalisation to reach −14 LUFS.
- **Voice**: one cool briefing voice through a tape chain (band-pass ~220–5200 Hz, soft saturation, slow wow, hiss rising under the voice); a few very short lines.

## 8. Native moves

A menu: use the ones your story needs.

- **Type is the set.** Each location is one line of credits and that line is its architecture (letters as pillars, words as carriages, a letter as a lock). *Fits content like:* a conference programme as a city; a menu as a restaurant; team names as a stadium.
- **Credits are rhythm.** Credits land on beats; stabs are cuts. *Fits content like:* a product's features; a festival line-up; an award's nominees.
- **Graphic match cuts.** Shape rhymes, the interval shrinking as tension rises. *Fits content like:* a coin → a planet → a clock; a gear → a wheel → a sun.
- **The diagonal grid.** A diagonal cut multiplies into a grid, and the pieces later fly back along it to assemble something. *Fits content like:* a puzzle solved; a team forming; a logo assembled.
- **Silhouette puppets.** Profile cut-outs whose acting is outline and timing. *Fits content like:* a heist; a courier on a deadline; a detective.
- **Stop-time gag.** Freeze on a stab, silence, resume. *Fits content like:* a near miss; a double take; a price reveal.
- **The object of the chase is the title.** What everyone pursues becomes the last thing assembled. *Fits content like:* a product launch; a book's name; a birthday name.

## 9. Pitfalls of the medium

- Every internal piece outlined with a gap looks like a mannequin diagram → merge pieces in an offscreen layer, cut only joint slits (`destination-out`), outline the whole figure.
- A `clear()` that resets the transform silently kills the camera.
- A figure fully hidden behind a letter reads as "nobody there" → let hat, nose and accent stick out. A stiff streamer reads as a tongue → multi-segment ribbon with a travelling sine.
- A credit only ever seen partially is uncomfortable → always open wide on the full line.
- Black background props read as letters → darker ground colour.
- An object in the same ink as its ground vanishes → black backing.
- Circular props dropped into a word cover neighbouring letters → lay the word out around a gap.
- Match cuts fail if circle centres move across the cut.
- Flat inks + grain make huge files at low CRF → a higher CRF looks the same.
- A 16:9 credit line shrunk to fit a phone becomes unreadable → stack it into a tower of words, and keep every word of it inside the safe box when it is read.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D, drawn as a pure function of `t`, with two clocks: puppets, hands, letters landing and vehicles step at 12 fps; camera, credit slides and grid growth run on every frame.
- A paper layer: four inks, scissor edges cut once per piece in local space and cached (resample every ~9–10 px, low-frequency normal noise, rare notches), cut gaps in the ground colour, the paper shadow, one multiplied paper texture. Figures are drawn merged in an offscreen layer, joint slits cut with `destination-out`, then outlined as a whole; never let a `clear()` reset the camera transform.
- Type: credit glyph outlines from an OFL condensed face via opentype.js, re-cut per letter (edge noise, ±0.8°, ±1.5 px baseline); the title in custom geometric cut glyphs, plus a diagonal split that slices a scene into strips and later flies pieces back along it.
- Silhouette rigs with poses and ~8-drawing run and walk cycles (one step per beat), the accent as a multi-segment ribbon with a travelling sine. Keep a model-sheet mode and a single-style-frame mode for checking the look before the full render.
- One tempo grid is the single source of timing: stabs are cuts, credits stop dead on beats, voice lines sit between stabs on their word timings. Cues in `cues.json`: each stab-cut, each credit slide, each letter landing, keys and locks, the stop-time silence and the title chord; place brass ~8 ms early so its peak hits the frame.

## 11. Variation space

You decide what is pursued, by whom, the locations (as credits), the inks, the opening and the ending. Push past the obvious chase for a stolen object:

- Structures: **no chase: a countdown** (ten credits, ten locations, a bomb-clock number built from type in each); **a heist in reverse** (the object is returned, location by location, to where it belongs); **two agents, one frame** (split diagonally, each side a different ground colour, until they meet).
- Openings: **a full-frame title** that shatters into the sequence (the reveal moved to the start); **a telephone rings** in a single cut-out room; **the hero already falling** through a column of type.
- Endings: **the title never assembles**, one piece missing, the hero walking off with it; **a slow pull-out** showing every location was one giant credit page; **a stop-time freeze** on the final stab, held.
