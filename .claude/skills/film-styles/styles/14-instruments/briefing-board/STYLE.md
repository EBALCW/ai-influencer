# Engineering Briefing Board

> One real whiteboard wall, filmed: window light on enamel, ghosts of erased marker, frame and tray. Cut-out photographs of real things land on it with weight; tags, magnets, a ruler and stamps are pinned to it; marker ink draws itself in three colours with fixed meanings. The camera rides the lines from fact to fact and only at the end pulls back to show the whole briefing. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): explainers filmed on a map wall; the long pull-back over a wall covered in work; drafting conventions (plan above elevation, dimension lines, hatching). Never copy them or name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Design the wall as a tall poster (for example 2400×4000 board px), because the last pull-back must fill a 9:16 frame. The board bleeds to every edge until that pull-back. Plan above elevation is already vertical: projection lines run down the frame, and comparisons become a staircase of dimension lines, one under the other. Each item's judgement frame (the item, the limit, the verdict) fits inside the safe box (x 72–900, y 269–1248). The frosted subtitle strip is centred on x 540, at most 720 px wide, baseline y ≈ 1200; key content stays above it. Before the reveal the camera shows at most about 60 % of the board's height and never both its top and bottom edges.
- **The first 3 seconds.** Frame 1: a red stamp already thudding onto a finished drawing, close and off-centre, the board still jolting. By 0.5 s the camera rides a leader line away from it. By 3 s a tag swings in with the question the stamp answered.
- **Length and pace.** 20–45 s, at most four options tested. Something lands, draws or swings every one or two beats; each judgement frame holds ≥ 2.5 s; the whole-wall pull-back takes 3–4 s and holds 1.5 s at the end.
- **Captions.** The frosted strip is the only caption layer: one line, about 44 px, with its blue marker tick.
- **Sound.** `thock` for each print landing, `ui-click` for every magnet, `tick` for nib taps and dimension arrowheads, `zoom-swish` for the whip with the line, `hook-impact` for the stamp, `sub-impact` for the pull-back's last beat. Felt-tip squeaks, eraser felt, the room bed and a small rhythmic ensemble (bass, light kit, wooden percussion, low brass) from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Sections 2, 4 and 6 as written; key content above the subtitle strip and the bottom 15 % (which also clears the player's controls); the strip stays inside its 1,500 px safe width.
- **Length and structure.** 2–8 min at 24 fps on ones. One wall per video, a region per chapter: a chapter tests one option or one constraint and ends on its judgement frame and stamp. Its title is a printed card pinned with a magnet at the region's corner, reached by riding a leader. Re-hook every 30–60 s with weight: a print landing, a stamp, an idea erased to a ghost, the subject passing through the answer. A partial pull-back may close a chapter, but the whole wall is seen only at the end.
- **The first 10 seconds.** The verdict first: the winning option circled in red with its stamp. The question ("why this one?") by 5 s; by 10 s the promise ("four options, one test each, and the ship decides"). Any channel sting after that.
- **Captions.** The frosted strip burned in, plus an `.srt`.
- **Thumbnail.** A close crop: a real photo print on the enamel, a blue dimension number beside it and the red stamp word, at most three words in all.

### Good for

Engineering and design choices, option comparisons, project briefings, "why was it built this way" YouTube videos, roadmaps and budgets.

## 1. Essence, and what it is not

1. **A physical board in a room**: enamel, window falloff, a sliding reflection, ghosts of earlier work, frame and tray.
2. **Real things on it**: cut-out photographs of the real objects, a few millimetres off the board, shadowed by one window, parallaxing. They are evidence: never a generated image presented as a real object.
3. **Ink that means something**: graphite for names and rules, blue for water and measurement, red only for the decision; rejected ideas erased to ghosts.
4. **One continuous wall**: no pages; the camera travels along lines, projections and leaders.
5. **The whole wall, once**: every shot is a crop of the final briefing, seen whole only in the last pull-back, as a poster.

Not **Whiteboard Explainer** (a hand drawing line art on a flat page): the board is a filmed object, subjects are photographs. Not **Data Storytelling**: comparisons are dimension lines in real units beside real objects. Not a keynote: no headers, centred bullets, page turns.

## 2. Materials & rendering

- **Board (z 0)**: procedural enamel, wiped ghost strokes, smudges, a window falloff, a sliding diagonal reflection; the frame shadows a warm grey wall.
- **Ink (multiply)**: flat colour at about 90 %, lighter core, round caps, a wet-tip glint on the stroke being drawn. Lettering: a marker font revealed glyph by glyph with seeded tilt and baseline jitter. Erasing leaves a blurred ghost (about 7 %).
- **Prints (z ≈ 6–14)**: photographs cut out at full resolution (a matting model, or a hand polygon / mask), clean edges, one shared grade (lower saturation, a touch warmer, lifted blacks). Thin structure (cables, wires, masts, railings) is measured in the photo and redrawn as clean lines in one colour. Shadow = blurred silhouette along one light vector, softer the higher the object. **No frame upsamples a photo**: ≥ 1 source px per screen px at its largest, measured; cap the zoom or find a bigger source.
- **Secondary layer** (only where the camera never goes before the end): the photos as pinned prints, a source card, sums on sticky notes, a small sketch. Texture and proof for the final wall, lighter than the main line.
- **Props (z ≈ 8–26)**: magnetic tags, magnets, a steel ruler, printed cards, a pitted stamp impression; the tray (z 70) nearest the lens.
- **Camera**: parallax by height, sub-frame motion blur (180° shutter), light grain. Only subtitles are screen-space.

## 3. Colour logic

- Ground: the enamel and its light falloff; the wall around is neutral warm grey.
- Ink: graphite = names, rules, facts; blue = water and measurement (dimensions, projection lines, measured numbers); red = the decision (a rejection, the key word of a verdict, the one mark to notice); grey for drafting only (extension lines, hatching).
- Red is rare: two or three red marks per frame at most, never on a red object. Full colour belongs to the photographs; props stay neutral; a red magnet is a verdict.

## 4. Type & subtitles

- **Marker lettering**: a single-weight marker face (e.g. LXGW Marker Gothic, OFL, which has Latin; subset to the characters used and re-run the subset when words change). Content 100–160 board px; a verdict 230–400.
- **Printed labels** (tags, cards, stamps): a sturdy sans; credit lines in a monospace. A tag holds one to three words.
- **Subtitles**: a frosted acrylic strip at the bottom centre with a blue marker tick, one language, the one spoken. **One line**: `nowrap`, measured in the page against a 1,500 px safe width; a long line becomes two cues. Key content stays above the strip (bottom 15 %).
- **Reading time**: subtitles ≥ max(1.8 s, speech + 0.6 s); board text stays fully in frame for letters ÷ 15 + 1.5 s from when it appears. In the final wall, text meant to be read is ≥ 20 px on screen.

## 5. Motion quality

- 24 fps on ones; nothing is stepped.
- Camera: overlapping eased moves, velocity ∝ u^a (1−u)^b (a, b ≈ 1.5–4), so speed and acceleration never jump; b > a gives inertia. A hand-held breath (≤ 3 px) underneath; shake only on an impact.
- Weight: prints are lowered from the camera side, land, bounce and settle as the shadow tightens; magnets clack on to pin them; tags swing; removed magnets pop toward the lens; struck things jolt and spring back. The camera may meet a landing close, briefly, on the object's most telling detail, then pulls out.
- Blurred in motion, sharp where words are read. Every 1–2 beats something lands, draws or swings; only silences and judgement holds go still.
- Ink draws at the speed of a hand; dimension lines land with an arrowhead tap.
- Never: dissolves, scale-pops on text, bouncy UI easing, text fading in by itself.

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| Ride a line (with the pen or a dimension) | measuring; "how far does it go?" | lengths compared; a route; a timeline |
| Tilt along projection lines | the same quantity in another view | plan → elevation; a total → its parts |
| Slow push-in, slight Dutch tilt | tension, an approaching problem | a collision; a deadline; an overrun |
| Pull back and sideways | stepping back to state a rule | a constraint; a turn in the argument |
| Whip with the line, overshoot, settle | a result that exceeds | a record; an outlier |
| Rise along a leader line | from evidence to verdict | a conclusion; a recommendation |
| Staircase framing (each new item with the previous result) | comparison in sequence | rankings; tests; options |
| Judgement frame: the whole item, the limit and the verdict, held ≥ 2.5 s | a test the viewer can check | pass / fail against a threshold; a budget against a cap |
| Long pull-back to the whole wall | scale; everything at once | the end of an argument; a summary |

Framing: off-centre, cropped, close. The first frame holds a readable subject; the first strong action hits within 0.5 s. Items tested against a limit each get a judgement frame (wider each time if they grow); the verdict lands after the camera settles. Before the reveal: ≤ about 60 % of the board's width, never both side edges, never the reveal's zone. Transitions are moves; no cuts, fades or zoom-to-fit.

## 7. Sound palette

- Room: an air-conditioning bed and traffic through the window, about 20 dB under the voice — audible, not a hiss; silences keep only this.
- Foley: felt-tip squeaks scaled to stroke length, nib taps, magnet clacks (a pitch per magnet in a row), suction pops, print landings (board thump, paper slap), a ruler's ring, eraser felt, a stamp's thud.
- The subject's own sound arrives early as a J-cut; the first sound after a silence is an impact or the subject's sound.
- Music: a small rhythmic ensemble, walking to brisk — bass, a light kit, wooden percussion, low brass stabs for verdicts (or mallets); no piano-and-strings pad. Landings, stamps and arrows sit on the beat. Voice calm, briefing-room confident, about 8–10 dB over the music; master −14 LUFS.

## 8. Native moves

- **The whole-wall reveal.** Design the wall as a poster first (hierarchy, reading path, filling the frame), then plan every shot as a crop of it; keep one zone (secondary layer, verdict, title card) for the reveal alone. *Fits:* a product roadmap; a household budget.
- **The subject passes through the answer.** The real thing moves through the chosen solution, its sound first. *Fits:* a parcel along the chosen route; a train over the new viaduct.
- **Ride the dimension line.** A quantity drawn as a real length to one scale; the camera rides the tip. *Fits:* battery ranges of four cars.
- **Projection lines.** Dashed lines carry an edge from one view to another so two drawings share a scale. *Fits:* a trail map above its elevation profile.
- **Magnets as countable things.** Units clack on in rhythm, pop off when a rule removes them. *Fits:* seats in a vote.
- **Erase to a ghost.** A rejected idea wiped but faintly visible. *Fits:* last year's plan under this year's.
- **The stamp.** A verdict lands with a thud and a jolt. *Fits:* passed / failed tests.
- **The physical answer.** A real prop laid down as the solution. *Fits:* one cable instead of five.
- **Leader to the verdict.** An arrow from the deciding number to the conclusion. *Fits:* the bottleneck in a process.

## 9. Pitfalls of the medium

- **Text glimpsed in passing** fails the reading time. Fix: words where the camera rests; frame each new item with the last result.
- **Only close-ups.** The viewer never sees the whole object against the limit. Fix: detail → judgement frame → hold → verdict → move on.
- **Photos that don't belong together.** Fix: one grade, one light vector, one viewpoint family.
- **Thin parts lost or stair-stepped** by the matte. Fix: key them against the clean background, redraw clean lines at the measured positions.
- **Upsampled photos** go soft in close-ups. Fix: full-resolution cuts, large sources, a per-frame check.
- **Lettering in photos** (signs, names, logos). Fix: paint out, cut, or choose another photo.
- **The wall seen too early** spends the ending; **a sparse or tiny final wall** wastes it. Fix: measure every frame's visible share; size the hierarchy for the poster; a quiet secondary layer, no empty middle.
- **A wide wall in a reel**: a 16:9 poster pulled back in a 9:16 frame leaves the ending tiny. Fix: design the reel's wall tall from the start.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **One board in board pixels, drawn from `t`**: a camera (x, y, zoom and its moves), and every element (print, tag, magnet, ruler, card, stamp, ink stroke, erasure) placed at a height z that sets its parallax and shadow softness. Describe the wall as data, one element per thing with its position, size and arrival time, and render it on canvas with seeded jitter; a minimal world: a 4000×2400 board, a tag "UNDERGROUND CAR PARK" swinging in at 0.2 s, a blue dimension line drawn over 0.6 s from 0.6 s, "120 m" written in blue beside it at 1.2 s, a FIRST CHOICE stamp at −8° landing at 4.2 s. Render stills of any moment to check composition before the full render.
- **Ink and lettering**: strokes as paths grown at hand speed with a lighter core, round caps and a wet-tip glint, composited with multiply; lettering revealed by a wipe, glyph by glyph; an erased stroke left as a blurred 7 % ghost.
- **Cut-outs prepared before the render**: a matting model (BiRefNet-general, MIT, about 970 MB, run with onnxruntime: https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx), installed into a private environment in the project folder; without it, cut by a hand polygon or a mask image. Thin structure is redrawn as lines at measured positions; fonts are subset with fonttools.
- **Three checks**: the camera's visible share of the board on every frame (and that every tested item gets a judgement frame), the resolution of every print (≥ 1 source px per screen px), and every subtitle against the 1,500 px width (720 px in a reel); register every board text so its reading time can be checked.
- **Timing and cues**: landings, stamps and arrowheads sit on the music's beat and on the word that names them, from the voice's word timings. One cue per landing, magnet, stamp and whip in `cues.json`.

### Sources and facts

- **Photos**: Wikimedia Commons (read each file page's licence and author), national libraries and archives (e.g. the Library of Congress: check each item's rights statement), agency media pages, Flickr Commons. Fine: CC0, public domain, CC BY (credit it). CC BY-SA, "no known restrictions" (≠ CC0) or other terms: name them to the user and ask first. For the user's own product, site or people, ask for their photos. No licensable photo of a real thing → draw it in marker as a sketch; never a generated image presented as the real object.
- **Facts**: keep a facts file in the project folder (each claim on screen or in the voice, its source URL, the quoted wording, or the measurement method) and deliver it with the video. List every photo in the credits file with source, author and licence.

## 11. Variation space

The agent decides per video: structure, which objects are photographed, plan vs elevation, the wall's reading path, opening, ending, camera path, pacing.

- **Three structures:** one measurement that keeps growing until it breaks a limit; a before/after where the erased first plan stays as a ghost under the second; a checklist stamped item by item as the camera moves down the wall.
- **Three openings:** a stamp on a finished drawing, then back to see why; one number written large, then the line that measures it; a photo dropped onto an empty corner.
- **Three endings:** the wall revealed with the answer circled; back to the opening mark, now corrected; the last tag flipped from a question to an answer, then the pull-back.
