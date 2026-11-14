# Woodcut Print

> A relief print that carves itself: every frame is a black wood block, and light only exists where a knife has cut it away. One colour at most, and only for the thing that burns. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Frans Masereel *Passionate Journey* (1919) and Lynd Ward *Gods' Man* (1929), wordless woodcut novels told as a sequence of self-contained plates; Käthe Kollwitz's woodcuts, where emotion lives in the direction of the gouge; Gustave Doré's engraving, where line spacing and direction build light and volume. Never copy their plates, figures, borders or titles.

## Formats

### Reel (1080×1920)

- **Layout.** The frame is the paper sheet: laid paper bleeds to every edge and never moves. The plate is tall, not shrunk (about x 48–1032, y 110–1080, ragged block edge), so a figure can fill a third of the frame height. The caption sits in the margin under it, centred on x 540, at most 720 px wide, baselines between y 1130 and 1235; the foot margin below it, under the app's buttons, stays empty paper. The pull-back becomes a crane up the block; two blocks printed in turn stack top and bottom; a panorama is cut as two plates in sequence, never one shrunk strip.
- **The first 3 seconds.** Frame 1 is a plate already roughed out: U-gouge sweeps show the subject against uncut black. By 0.5 s the knife tip is moving and V-cuts grow along the form, bright areas first; by 3 s the one colour plate glows out of the cuts, or a mirrored word is about to read true, while the margin asks the question.
- **Length and pace.** 20–40 s as four to seven plates: a carve reveal 1.5–3 s, a locked plate 3–5 s, a series of impressions every 0.6–1 s on the beat; one peel, at the turn; one near-silence before the loudest moment.
- **Captions.** Letterpress in the margin under the plate, in the language spoken, never on the image.
- **Sound.** `hook-impact` on the first strike, `thock` on each new impression, `tick` for stab cuts (snow, sparks), `ratchet` under the baren and the press, `sub-impact` for the first sound after the silence, `zoom-swish` on a snap zoom. Knife into wood, brayer tack, the wet peel and the score (low strings, log drum, tam-tam, struck metal) come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 2 as written; set the bottom margin so the caption's baseline stays above y 950 (the player's controls cover the bottom 12 %), and keep the plate inside the 5 % margins.
- **Length and structure.** 3–8 min told as a wordless novel: each chapter a run of three to six plates (40–90 s), opened by its title carved into a black panel, mirrored, then pulled true with the peel. Re-hook every 30–60 s with a different native move: the colour plate spreading, a snap zoom on the detail that breaks, the block recut deeper. 24 fps, characters on twos.
- **The first 10 seconds.** The peak plate first, its colour glowing out of the cuts; the knife on black wood with the question in the margin by 5 s; the promise ("seven plates, one winter") by 10 s. A channel sting comes after that.
- **Captions.** Burned in as letterpress in the margin, plus an `.srt`.
- **Thumbnail.** The plate where the colour is widest, the subject large, with up to three words carved in IM Fell English SC, reading true.

### Good for

Folk tales, craft and maker brands, book trailers, labour and history stories, poems read aloud, origin stories.

## 1. Essence, and what it is not

Each shot is **one printed plate**: black ink on laid paper, framed by a paper margin. It follows three rules of real relief printing:

1. **Black is the wood, white is what the knife removed.** Light is *carved*: a bright area is many wide cuts, a dark area untouched wood.
2. **Pictures appear by being carved.** Nothing fades in: cuts grow stroke by stroke along the form, coarse gouges first, fine lines after.
3. **The block is a mirror.** Letters read backwards until the paper is pulled; that reversal is the style's own transition.

Not copperplate engraving (no swelling burin lines on white, no crosshatch built up from white ground), not linocut poster art (no flat colour areas), not a black-and-white photo run through a threshold filter (the cuts must follow the form).

## 2. Materials & rendering

- **Print frame**: the printed image area sits inside a paper margin; the wider bottom margin holds captions. The image edge is the block edge: ragged ink, never a clean rectangle.
- **Knife classes** (widths in 1080p pixels at 1× camera):

| Tool | Width | Use |
|---|---|---|
| Knife `k` | 1.2–2 | contours, the white outline that separates a black figure from a black ground |
| V-gouge `v` | 2–8 | hatching, hair, beard, fine light |
| U-gouge `u` | 10–22 | rays, sky sweeps, the first rough-out |
| Stab `stab` | r 3–8 | snow, sparks, flecks of loam, wood chips |

- **Hatching (Doré grammar in wood)**: line **direction follows form** (a round object is wrapped in arcs, slopes follow the fall line, fire and light radiate, cloth follows its folds). **Width follows tone**: bright = wide cuts almost merging into white, mid-tone = thin cuts, dark = no cuts. Far = dense and fine, near = sparse and coarse. Every line is a separate cut (30–160 px, blunt entry, tapered exit, chipped edge), never a continuous machine line.
- **Figures**: black silhouette + white knife halo + grazing-light hatching on the lit edge only (light z ≈ 0.2, so flat areas stay black). **Skin carved white, features left black** (the wordless-novel rule).
- **Close-ups (hands, objects)**: sculpt a small height field (capsules, blobs, planks, creases), light it and run it through a woodcut filter (§10), so cuts follow the isophotes like an engraver's.
- **Printing**: the mask (white = cut) goes through a WebGL2 compositor: knife burr on edges, ±6 % ink unevenness, wood-grain streaks, specks where ink didn't take, a mottled colour plate with a small fixed misregistration. Block mode: glossy inked wood with grain sheen, pale wood in the grooves.

## 3. Colour logic

- Two values carry everything: near-black ink and warm laid-paper white. The raw wood colour appears only in shots that show the block itself.
- **At most one colour plate**, printed only where white has been carved, so it glows out of the cuts and never sits on the black. A colour plate over ink is nearly invisible, so plan it on carved white.
- The colour is reserved for the one thing that matters (a flame, molten metal, a heart, a signal lamp). It can spread at a peak and shrink to a single highlight afterwards; it is never decoration.
- Examples of a plate: a burnt copper-orange for heat; a cold Prussian blue for water or night; a deep oxblood for a wound or a seal. Choose it from the topic.

## 4. Type & subtitles

- **Captions are letterpress in the paper margin**, below the plate, like a plate caption in a woodcut novel. They never cover the image. A letterpress old-style face (IM Fell English, OFL) around 40–44 px in 16:9 and 46–52 px in a reel, in ink, pushed through the same print shader. The ink comes up in 0.1 s with no slide and fades over 0.15 s. Hold ≥ max(1.8 s, speech + 0.6 s). One or two lines; a longer sentence becomes two captions.
- **Titles are carved, not typed**: cut into the block (IM Fell English SC), mirrored if the block is shown before the print is pulled.
- Any closing text is a fresh print: letterpress in the margin or carved out of a black panel.

## 5. Motion quality

- **Characters on twos (12 fps)**; camera, particles, fire and light on ones (24 fps). Hatching lives in each body part's local space, so cuts move with the limb and don't boil; only fire and liquids re-cut every 2 frames, as deliberate boil.
- **Anticipation / action / follow-through** on every key action: a few frames back → a 2-frame strike → settle + a short shake.
- **Carve reveal**: each stroke has its own start time and speed (0.08–0.35 s). Reveal keys: `light` (bright areas first, coarse to fine), `radial` (from a point: rays, a pour), `down`, or any function.
- **Hard cut = a new impression**: two frames of misregistration (a few pixels, then back).
- **Paper transition** (the one transition grammar): brayer rolls ink (a wet highlight sweeps) → paper lays down → baren spirals, the image soaks through → the sheet peels on a cylinder toward camera, heavy then fast, its back showing the mirrored show-through.
- What never moves: the paper margin.

## 6. Camera grammar

The camera moves over the paper; the margin stays fixed. The knife tip, or the brightest cut, is the focus.

| Move | What it expresses | Can serve |
|---|---|---|
| Track with the knife tip | Making; the line is the story | a first mark; a route drawn on a map; a signature |
| Continuous pull-back as cuts spread | A line becomes a world; scale | a city from one street; a family tree; a reach of sound or news |
| Locked plate | A page of a wordless novel; reading time | a decision; a portrait; the aftermath |
| Slow macro push on a sculpted close-up | Patience, touch, labour | hands at work; a tool; a letter being read |
| Snap zoom and hold | Shock; the detail that breaks | a crack; a wrong number; a face turning |
| Frame in a frame (door, window, arch) | Distance, exclusion, waiting | a crowd outside; a sickroom; a border |
| Hard cuts on the beat, each a new impression | Accumulation, a series of prints | offerings; days passing; a list of names |
| Crane up from a detail to the whole | Consequence | a flood reaching a village; a light reaching faces |
| Rack between two plates via the peel | One state printed over another | before/after; a promise kept; generations |

Opening and ending come from the topic. Framing: black masses on carved white or white on uncut black, never grey on grey; text only in the margin. Transitions: hard cut (new impression) or the peel; never a dissolve.

## 7. Sound palette

- **Instruments**: low strings (contrabass, cellos; spiccato, pizzicato), wood and skin (log drum, woodblock, frame drum), gran cassa, timpani, one tam-tam, synthesised struck metal (modal: 3–5 inharmonic partials + hammer transient); a bowed saw or hurdy-gurdy drone for a folk colour.
- **Options**: withhold the timbre of the story's object until it appears; a metric modulation instead of a tempo jump; a modal shift inside a long decay; one drone under a locked plate.
- **Foley follows the material**, all synthesisable: knife into wood (transient + band-passed fibre tearing tied to knife speed), chips, brayer tack, paper air, baren rasp, the wet peel; metals by size (large = low, small = high and pure); resonant objects as modal models plus echoes for distance.
- **Silence is a tool**: near-silence with one faint ambience, or true digital silence before the loudest moment; the first sound after it is chosen.
- **J/L cuts** carry sound across plates and peels.
- **Mix**: music ducks ~8 dB under voice and a little under key foley; **foley ducks too** under voice. Pan hard transients off centre. Master −14 LUFS.
- **Voice**: one low, plain narrator with few lines, like captions spoken; the plates tell the rest.

## 8. Native moves

A menu: use the ones your story needs.

- **Light is carved.** A burst of radial cuts from a point. *Fits content like:* a power grid switched on; a scientific insight; a lighthouse restored.
- **Carving = time.** Patient work on screen, cut by cut. *Fits content like:* a year of training; a building rising; a craft apprenticeship.
- **Mirrored block → true print.** A backwards word reads true when the sheet is pulled. *Fits content like:* a vote result; a name cleared; a misunderstanding put right.
- **Stab cuts as texture.** White dots can freeze mid-air or be inked back in until the black is clean. *Fits content like:* stars going out over a city; rain stopping; a disease receding on a map.
- **The one colour plate spreads and withdraws.** *Fits content like:* a blood donation; a sunrise over a harvest; a single lit window in a blackout.
- **Filter a sculpt or a frame** into form-following cuts. *Fits content like:* a portrait of a real person drawn from a photo; a machine part; an archive image re-cut.
- **Wordless-novel sequencing.** Self-contained plates, few or no lines; a gap can be silent. *Fits content like:* a migration; a strike; a life in seven plates.

## 9. Pitfalls of the medium

- **White marks on white areas are invisible** → stab cuts need dark masses behind them.
- **Hatching every surface looks like fur or rain** → grazing light; 3–6 cuts on the lit edge only.
- **Black faces with white cuts don't read small** → skin white, features black, a black keep-line around white parts.
- **Hand-drawn close-up props look like mittens and blobs** → a lit height field through the woodcut filter.
- **Short hatch segments with a tonal wobble turn into zig-zag chevrons** → long cuts (14–50 × spacing), one broad highlight band, a thin rim light, a stronger halo.
- **Steam or smoke on top of the subject reads as flames** → draw it behind, so only wisps escape.
- **Lazily cached strokes shared between shots** make frames depend on the render worker → every cache builds itself on first use.
- **Fine hatching + ink noise + grain inflate the file** → a higher CRF with `-tune grain`; check a 1:1 crop. The filter gives NaN in flat areas → clamp before `sqrt`.
- **Captions under the app's buttons**: in a reel the margin caption ends above y 1248; on YouTube above the bottom 12 %. Move the plate up, never the caption onto the image.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas, drawn as a pure function of `t`. Every shot carves into two layers: a **mask** (black = uncut wood, white = cut) and an optional **colour plate**. A WebGL2 compositor prints them: knife burr on cut edges, ±6 % ink unevenness, wood-grain streaks, specks where ink didn't take, the colour plate mottled and offset by a small fixed misregistration; a block mode shows glossy inked wood with grain sheen and pale wood in the grooves. The page and its margin are drawn in the same pass and never move.
- A small carving library that cuts **any path or shape**: a carved solid (white halo plus form-following hatching), a path as hand-cut strokes, streamline hatching of a region, stab flecks, carved rays. Each stroke is a record (path, tool width, start time, speed 0.08–0.35 s); the reveal is which strokes have started by `t`, ordered by a key (`light`, `radial`, `down` or any function).
- A **woodcut filter** for close-ups and photos: sculpt a height field from capsules, blobs, planks and creases (or take an image's luminance), light it at a grazing angle and lay cuts along its isophotes, width from tone. Clamp before `sqrt`.
- Two clocks: characters step at 12 fps, camera, particles, fire and light run on every frame; fire and liquids re-cut every other step. Stroke lists and height fields are built on first use inside the shot that needs them, keyed by shot, never shared.
- The peel is a sheet bent round a cylinder that travels toward camera (ease-in, then fast); its back is the plate mirrored and faded as show-through, and the next plate is already printed under it.
- A carve reveal starts on the word that names its subject; the peel lands on the turn. Cues in `cues.json`: the first strike, every new impression, stab-cut bursts, the baren and the press, the peel, the colour plate's arrival.

## 11. Variation space

You decide the story, characters (or none), plates, opening, ending, camera path, pacing and what the one colour is for. Push past the first idea a woodcut suggests:

- Structures: **a book of hours** (seven locked plates, one per hour, no moves inside a plate); **the same block recut** (carved deeper each scene, the image changing as wood goes); **two blocks printed in turn** (two places alternate impressions until one sheet carries both).
- Openings: **the finished print on a wall** (then back into the block to see it cut); **white paper** (an inked block pressed onto it: the first image arrives whole); **wood grain** that becomes water or a field as the first cuts follow it.
- Endings: **the block cleaned** (ink washed off, pale carved wood remains); **a stack of prints** (rising over many sheets of one plate); **an uncarved corner** (holding on black wood the knife never reached).
