# Blob Simulation

> A crowd of soft, flocked blob creatures runs a real simulation on a paper lab board: they hop, eat, tire, vanish and multiply by the rules, generations sweep past in waves, and the survivors walk into a histogram printed on the board. Every number on screen is an output of the run. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): agent-based simulation videos on YouTube (one rule set, many runs, a chart that builds); stop-motion felt and clay animation (soft fibre surfaces, squash, tiny expressions); science-museum tabletop exhibits (a board, a grid, printed labels). Never copy their characters, board designs, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Shoot the board steeper (closer to overhead) so the crowd fills the frame height; type stacks above the crowd, the board bleeds to every edge.

| Zone | Position | Content |
|---|---|---|
| Board and crowd | full bleed | the action inside x 72–900, y 560–1150 |
| Kicker and big number | x 72, y 300–540 | 22 px kicker, 180–220 px count in Fredoka |
| Travelling tag | beside a blob's head, kept inside x 72–860 | speed at 56 px, a 150 px energy bar |
| Caption plate | centred on x 540, ≤ 720 px wide, bottom edge y 1240 | 42 px, one line, two at most |
| Charts | rows, not columns | a histogram becomes horizontal rows that blobs walk into |

- **The first 3 seconds.** Frame 1 is a low close-up of one blob waking (eyes half open) with food popping up around it; by 0.5 s it hops; by 1.5 s the camera starts rising and the crowd appears; by 3 s the question ("who makes it through the day?") is captioned and the rule is one line on the board.
- **Length and pace.** 30–45 s: the rules (≤ 5 s), one day up close, the verdict, generations in fast-forward, the result. One slow-motion moment.
- **Captions.** The plate of section 5, at 42 px.
- **Sound.** `ui-pop` for every food item that appears, `thock` for each blob that is gone, `clean-ding` for each birth, `tick` on each generation's wave, `zoom-swish` on the rises and the crane, `sparkle` when the last blob lands in the histogram. Felt footsteps, kalimba, marimba and pizzicato from a free sample library.

### YouTube (1920×1080)

- **Layout.** Section 2 as written; the caption plate's bottom edge no lower than y 930; the clean floor on the left third carries the numbers.
- **Length and structure.** 4–8 min as a series of experiments, one per chapter (40–90 s): state the rules on the board; run one day up close; judge it; fast-forward the generations; read the result; then change one rule and run again. Each new chapter is a re-hook ("what if food is scarce?", "what if they share?"), and its result is compared on the same printed chart as the last.
- **Re-hooks every 30–60 s**: a parameter changes, a slow-motion moment on one individual, a hard cut into a close-up inside the crowd, a chart that turns.
- **The first 10 seconds.** The most surprising image first (the crowd mid-run with one blob slumping grey, or the final chart with its surprising shape); the question by 5 s; the promise ("by the end you'll see what many generations of this rule do") by 10 s.
- **Captions.** Burned in on the paper plate; export the same lines as `.srt`.
- **Thumbnail.** A low close-up of one blob of one colour in front of a crowd of the other, its tag showing the key number, up to three words in Fredoka.

### Good for

Evolution and natural selection, game theory and agent-based models, epidemics, queues and markets, traffic and crowds, "what happens if everyone does X".

## 1. Essence, and what it is not

1. **The simulation is real.** Positions, meals, survival and births come from a seeded run of stated rules; the picture interpolates the recorded run.
2. **Soft, toy-like individuals.** Flocked blobs with ink faces, expressions that change through blinks, squash on every hop.
3. **Colour is a variable.** A five-stop ramp shows the trait being selected (or five teams); one mint accent marks food and the number to watch.
4. **A lab board, not a world.** Matte paper, a printed grid, labels and charts printed on the board; nothing floats.
5. **From one to many.** Start with one individual, end with the population as a chart made of the individuals themselves.

Not **3D Map Explainer** (real places and flows). Not a flat data-visualisation explainer (here the dots are characters who act). Not a character film: no individual has a story beyond what the rules give it, and no blob is named on screen.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Board | the right two thirds, its left edge in frame | crowd, food, rings, printed charts |
| Clean floor | the left third, under a board-coloured gradient (92 % → 0 across 700 px) | kicker, big number, rules, live chart |
| Kicker | x 120, y 118 | Inter 600, 15–17 px, tracked 2 px, 55 % ink |
| Big number | x 112, baseline y 250–300 | Fredoka 600, 150–168 px, with a 30 px Inter unit beside it and a mint underline that grows under it |
| Rules list | x 120, from y 388, 52 px apart | food dots + Inter 27 px |
| Live chart | x 190–630, y 460–790 | mean value per generation: dots dropping in, a 2.5 px ink line at 40 % |
| Travelling tag | beside a blob's head, a little right and up | Fredoka 46 px value, 15 px label, 150×9 px energy bar |
| Result block | right-aligned to x 1800, from y 118 | kicker, 26 px label, "before → after" at 120–140 px |
| Caption plate | x 96, bottom edge y 930 | see section 5 |

The camera is placed so that nothing stands between it and the subject, and is shifted (a 190 px offset) when a big number needs the left third.

## 3. Materials and rendering

- **Blobs**: a lathe profile like a domed rice cake (wide base, round belly, about 0.9 units tall) with a small pulled tuft, two little feet, ink eyes and mouth in glossy clear-coated ink, white glints, cheeks of the body colour pushed 30 % toward pink.
- **Flock**: a rough physical material (roughness 0.9) with a very fine fibre normal map, full sheen tinted by each blob's own colour, and a fuzz term that brightens and pales the silhouette (`pow(1 − n·v, 2.6)`). This edge glow is the style's signature; the rim light exists to feed it. Matte clay or soft vinyl are the alternatives if a video needs them.
- **Crowds** are instanced, one instanced mesh per part, hundreds at once; each blob gets a clean radial contact shadow (multiply-blended) instead of screen-space occlusion.
- **Board**: a thick rounded slab of matte paper with a printed grid drawn in the shader (minor every unit at 45 %, major every five at 80 %), fading with distance, a thin edge line and a faint paper grain. A floor of the background colour below it; a light haze.
- **Printed graphics** (charts, the colour ramp, the end card) are canvas textures lying flat on the board, pre-stretched against the camera's foreshortening so they read correctly.
- **Light**: a warm key from front-left above with soft 4096 px shadows, a cool rim from behind, a sky-blue/warm-bounce hemisphere fill, a dim room environment for reflections; neutral tone mapping at exposure 0.94; no bloom.
- **Lens**: depth of field set per shot (strong in close-ups, almost none overhead), a 12 % vignette, a touch of extra saturation (1.04), 2× supersampling.

## 4. Colour logic

- **The ramp is the variable.** Five hues from cool to warm with lightness rising (interpolated in OKLab) map the trait under selection, slow to fast, small to large; or name five teams. The legend is printed on the board.
- **Mint is the resource and the answer**: food, energy bars, birth rings, the underline under the key number, the "now" marker. It is never a team colour.
- **Spent is warm grey**: a blob out of energy fades toward it; gone blobs leave grey rings.
- **Ink** for faces, type, axes and printed lines; **paper** for the ground; never pure black or white surfaces.
- **Printed bars** use their team colour mixed 78 % toward paper, so the blobs standing on them stay the strongest colour.

| Role | Hex |
|---|---|
| Ramp 1–5 | `#4A6FE3` `#8B67D6` `#E0607E` `#F2604A` `#F6BE45` |
| Accent (resource) | `#4FBF8F` |
| Ink | `#262A3B` |
| Board / minor grid / major grid / edge | `#ECE6DA` / `#E0D7C7` / `#D3C6B1` / `#C4BFB6` |
| Haze / open haze / floor | `#E9E2D5` / `#EFE8DC` / `#E2D9C9` |
| Spent / fluff / cheek / bar paper | `#B9B2A6` / `#FFF7EA` / `#FF9A8F` / `#F4EEE3` |
| Key / rim / sky / bounce light | `#FFF4E6` / `#F3F6FF` / `#EEF2FF` / `#D9CCB8` |

## 5. Type and captions

- **Fredoka** (OFL) 600 for numbers and titles: rounded, friendly, the blobs' voice (big counts 150–168 px, titles 56–76 px, tags 46 px, chart counts 28 px). **Inter** (OFL) 500 and 600 for kickers, labels, rules and captions.
- **Type appears softly**: fade in 0.4 s while rising 14 px with an ease-out; fade out 0.3 s. Labels never pop.
- **Numbers are outputs.** Every count, mean and share is read from the run; if the run changes, the numbers change. Show two decimals for means, whole numbers for counts.
- **Captions**: a board-coloured rounded plate (radius 18, 86 % opacity) with one line of Inter 500 at 36 px in 16:9 (42 px in a reel) in ink; fade 0.18 s in and out. One language only.
- **Hold** every caption at least max(1.8 s, the spoken line + 0.6 s); a caption may stay up to 0.5 s longer if the next one isn't due.

## 6. Motion

- **24 fps**, continuous; the score sits on a 120 BPM grid and generations land on beats.
- **Simulation time is a dial.** Film time maps to simulation time through a monotone cubic curve: real time for the run, down to about 0.1× for the key moment, then faster and faster.
- **Hopping**: height `|sin(π·phase)|^1.5 × 0.17`, squash `1 + 0.08·cos(2π·phase)`, a forward lean that grows with speed; fast runners kick up small cream fluff balls behind them.
- **Idle**: a breath of ±2.2 % at 0.85 Hz, offset per blob.
- **Events**: eating squashes 10 % and swells 5 %; running out of energy slumps 6 % and fades toward grey; being gone squashes up 16 %, shrinks to nothing and leaves a puff; birth pops a child out beside its parent with a back-out ease (0.38 s), surprised then happy.
- **Expressions change through a blink**, never in one frame.
- **Food** pops up with a back-out ease (0.28 s) and is pulled toward the eater as it vanishes.
- **Rings** on the board grow from 0.55 to 1.45 body widths with an ease-out over 0.6 s: grey for losses, mint for births.
- **Generations** pass as a mint band sweeping diagonally across the board, old blobs sinking, new ones popping up; about 0.45 s each at first, 0.25 s later.
- **Crowds never overlap**: a short relaxation pass pushes touching blobs apart every frame.

## 7. Camera

| Move | Expresses | Serves |
|---|---|---|
| Low close-up (distance ≈ 3.4 body heights, field of view 30°, strong depth of field) | one individual matters | openings, slow motion |
| Rise to overhead (distance 20–22, 34°) | the rules, the whole board | setting up |
| Low side tracking shot | following a run | the race, the moment it fails |
| Focus pull from one blob to another | comparison | fast versus slow, winner versus loser |
| Crane up to a wide, shifted to free the left third | judgment | the verdict, the big number |
| Overhead orbit that slowly tilts | time passing | generations in fast-forward |
| Tilt down onto the printed chart | the conclusion | the histogram, the result |

Set-ups are joined by spherical interpolation of direction and logarithmic distance, so rises feel even. Allowed transitions: these camera moves, and a **hard cut on a beat** (into the first run, into a close-up inside the crowd). Forbidden: dissolves, wipes, flashes, cutting away from the board.

## 8. Sound palette

- **Foley**: soft felt footsteps (a low-passed thump with a short 150–220 Hz tone), a falling "plip" for every food item that appears, a two-note chew whose pitch follows the eater's speed, a small sigh when one tires, a soft poof when one is gone, a breath of wind on each camera rise, a soft stamp on the end card.
- **Score**: 120 BPM in a bright major key. Hang drum and kalimba for the opening (one kalimba note per nearby food item, climbing a pentatonic scale); a marimba arpeggio under the rules; a woodblock and low pizzicato as the run starts; for slow motion the groove stops and only a low cello and bowed vibraphone remain; the groove returns as time speeds up.
- **Data you can hear**: a glockenspiel note per birth pitched by the child's trait, a low woodblock per loss, one kalimba note per generation pitched by its mean (so a trend is audible), a xylophone note per blob landing in the histogram pitched by its value (at most one every 40 ms), a big chord when the last one lands.
- **Mix**: a synthesized shaker on sixteenths in groove sections; the music cut about 5 dB at 300 Hz–4 kHz and ducked under the voice, which sits about 10 dB above the bed. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **One becomes many.** A low close-up of one blob, then a rise that reveals hundreds like it. Fits content like: a population; a market; "imagine everyone did this".
2. **Running dry.** In slow motion the blob that led early slumps and greys while a plodder keeps going. Build: slow the simulation clock around the recorded moment; fade colour toward spent grey. Fits content like: trade-offs; burnout; costs that come later.
3. **The verdict rings.** Grey rings where blobs vanished, mint rings where children appeared, and the head count changes under a mint underline. Fits content like: survival rules; elimination rounds; births and deaths.
4. **Generation waves.** A mint band sweeps the board each morning; the crowd's colour drifts across the ramp. Fits content like: evolution; repeated games; compounding.
5. **The audible trend.** One pitched note per generation as the chart's dot drops in; the melody falls or rises with the mean. Fits content like: drift; inflation; a slow decline.
6. **Walking into the chart.** Every blob walks into its slot on a histogram printed on the board, next to a dashed outline of where things began. Build: assign slots by bin, five per row; time arrivals so the counts appear when a bar is full. Fits content like: distributions; before and after; who ended up where.
7. **The lonely one.** A hard cut into the crowd on one blob of the old colour surrounded by the new; they all turn to look at it. Fits content like: a rare trait; a minority strategy; the last of its kind.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- A deterministic simulation in plain JS (seeded generator, fixed time step 0.05) that also runs in Node: run it first, record every step of the featured day and every generation's population, and print the numbers for the facts file; the picture only interpolates the record.
- three.js scene: instanced blobs (lathe body, tuft, feet, ink parts placed on the surface by height and angle), `MeshPhysicalMaterial` with sheen and a patched fuzz term via `onBeforeCompile`, a rounded-box board whose grid is drawn in its fragment shader with `fwidth`.
- Expressions as small sets of ink parts per face (neutral, happy, eating, sleepy, surprised, keen, sad, determined), swapped at the middle of a blink.
- Post: the depth-of-field pass with aperture per set-up, a light grade, no bloom; neutral tone mapping.
- Cameras as set-ups `{look, direction, distance, field of view, shift, aperture}` blended by slerp and log-distance; the azimuth of each close-up chosen by testing which angle has no blob in the way.
- The 2D overlay for kickers, numbers, tags and captions; everything that belongs to the experiment (charts, legends, end card) printed on the board as decals. Every food item, meal, loss, birth, generation and landing goes to the events list that drives the sound.

## 11. Pitfalls

- **Faked results.** Placing blobs by hand to get a nicer chart breaks the style's promise; change the rules or the seed, then report what the run gives.
- **Rules nobody can read.** More than three rules or a formula the viewer must decode; show the rules as pictures (food dots, arrows) and one short line each.
- **Mush.** Too many blobs of similar colour at a distance read as noise; keep the ramp's lightness rising so it reads even in greyscale, and use close-ups.
- **Floating signs.** Labels standing in the air look like a game HUD; print them on the board or keep them on the clean floor.
- **One-frame expression swaps and popping births.** Always through a blink, always with an ease.
- **Overlap.** Blobs inside each other at landing or in crowds; relax positions every frame.
- **Over-claiming.** A toy model is not the world; say what it shows and what it leaves out.

## 12. Variation space

The agent decides per video: the rules and their parameters, the trait the ramp shows (or five teams), the population size, the food, the board's size, which individual to follow, the second experiment.

- **Three structures:** one run, then twenty generations, then the histogram; a rule change per chapter on the same board, results compared on one chart; a tournament of five teams with strategies, eliminated round by round.
- **Three openings:** one blob waking in a low close-up while food pops up; the crowd frozen mid-run as one blob slumps; the final histogram first, then the question of how it got that shape.
- **Three endings:** blobs walking into the histogram, the before-and-after mean set large; the camera rising off a board now entirely one colour; the same opening close-up, now on a blob of the new colour.
