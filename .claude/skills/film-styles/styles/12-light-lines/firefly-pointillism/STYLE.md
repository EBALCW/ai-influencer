# Firefly Pointillism

> A night drawn only with points of light. One fixed swarm of fireflies, never added to and never taken away, becomes a meadow, a child, an animal, a storm, a constellation and finally the words of the title; every change of scene is the same lights flying somewhere new. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): neo-impressionist pointillism (form built from separate dots that the eye fuses); point-light motion studies, where a few dozen moving dots read as a walking body (motion carries the figure); synchronous firefly displays (the blink rhythm, and a wave of light answering a single flash); drone light shows (one fleet of lights re-forming shape after shape); long-exposure and bokeh photography of fireflies (depth told by blur size). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The black sky and the glowing ground bleed to all four edges; nothing is boxed.

| Zone | Position | Content |
|---|---|---|
| Sky | y 0–1100, full width | swarms, bokeh, stars, the large formed shape (animal, object, word); the formed shape's centre sits at y 500–800 |
| Ground line | y ≈ 1120–1180, full bleed | the glowing grass crest; below it the dim meadow fades to black at the bottom edge |
| Protagonist | x 300–780, standing on the ground line | the small point figure, at least 260 px tall at key moments |
| Particle title | centred on x 540, y 300–620, ≤ 760 px wide | a word or short title written by the swarm, two stacked lines at most |
| Captions | centred on x 540, ≤ 720 px wide, last baseline y ≈ 1220 | one or two lines over the dark meadow |

  The big shape stacks above the protagonist instead of beside it; lateral tracks become slow vertical drifts.
- **The first 3 seconds.** Frame 1 already has a stream of points sweeping in from the bottom-left corner. By 1.6 s it has settled into a scene (ground line, bokeh, one figure); by 3 s a single point blinks and the whole field answers in one synchronised flash.
- **Length and pace.** 20–45 s. One transformation every 4–7 s, so each shape is read before it dissolves; one held breath of near-black (a single point alive) before the turn.
- **Captions.** Plain type over the dark meadow, never written in particles; a word the swarm writes is repeated in the caption if it must be read.
- **Sound.** `shimmer` under every gather (swarm into shape), `sparkle` for the answering blinks, `clean-ding` for the single "question" blink, `zoom-swish` on gusts and streams of light, `sub-impact` under the scale reveal (the shape re-formed huge). Harp, glockenspiel, hand chimes and soft strings come from a free CC0 sample library (VS Chamber Orchestra Community Edition, VCSL); crickets, wind and rain are synthesised.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Captions and particle titles stay above y 950 (the player's controls) and inside x 96–1824.
- **Length and structure.** 2–6 min. Chapters of 40–90 s, each a new configuration of the same swarm (a new landscape, a new creature, new weather) reached by one transformation, never a cut. Each chapter opens with its title written by the swarm in the upper left, held 2 s, then blown into the chapter's scene. Re-hook every 30–60 s with a change of scale (a figure re-formed at 1.5–2.5×), a change of weather (a gust, rain), or a call-and-answer flash.
- **The first 10 seconds.** The strongest formed shape (the creature or object the video is about) glowing on frame 1, the protagonist small below it; the question by 5 s as one blink that nobody answers; the promise by 10 s as the first answering flash.
- **Captions.** Burned in as part of the look (section 5), and exported as `.srt`.
- **Thumbnail.** The formed shape large on the right, the small protagonist on the ground line to its left, at most three words written in particle type in the upper left (the same sampling as the title, so the letters are made of points).

### Good for

Picture-book stories; many becoming one (community, crowds, collective action); night and nature lyric; bioluminescence and wildlife; tributes and memorials; "every dot is a person" data stories.

## 1. Essence, and what it is not

1. **Only points.** No lines, fills or solid shapes: figures, ground, weather and type are clouds of separate glowing dots, read by silhouette and motion.
2. **Conservation.** One fixed pool (about 19,000 points) seeded once; points travel from role to role and nothing pops in or out.
3. **Light adds.** Points sum as light and are tone-mapped, so crowds bloom toward white instead of clipping; a lone point on black stays a jewel.
4. **Depth by blur.** Near points are crisp, far ones soft discs of bokeh; no fog or haze.
5. **Blinking is speech.** A blink is a question, a synchronised flash an answer; rhythm of light drives the scenes.

Not **Neon Tubes** (continuous bent tubes and their wall glow; here nothing is continuous). Not **Flow-field Wind Lines** (lines traced along a vector field; here a point's path is never drawn, only its half-frame streak). Not a particle logo reveal or screensaver: the points have characters and a story, they blink with intent, and they never form a hard-edged logo.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Sky | y 0–800 | bokeh drift, moon and stars, storm clouds, swarms in flight; the title or chapter word sits upper left from x 232, centre y ≈ 260 |
| Large formed shape | right half, x 1100–1700, y 80–560 (or standing on the ground at full height) | the creature, object or constellation the story turns on |
| Ground line | y ≈ 800–880 (a gentle curve or hill crest), full bleed | grass blades of points, brighter at their tips; a soft dim meadow below |
| Protagonist | left of centre, x 600–1100, feet on the ground line | the small figure, 180–220 px tall in a wide shot, about 2× that in a medium |
| Captions | centred on x 960, baseline y ≈ 930 | one line over the dark below the grass, never over the formed shape |

The small figure looks up and right, the large one down and left; keep the band between them empty so the light passed across it reads against black.

## 3. Materials and rendering

- **The pool.** Five groups with per-point random constants (phase, rate, size, offset, stagger): protagonist (≈ 2,400), second character (≈ 3,600), ground (≈ 5,000), loose fireflies (≈ 6,000), bokeh (≈ 1,800), plus one guiding firefly, the brightest point in the film. Each act is a state function giving every point a position, focus level, brightness, colour and depth.
- **Figures.** A skeleton of tapered capsules (limbs, neck) and polygons (dress, body, head). About 60 % of a figure's points are bound by perimeter (outline), 40 % by area (fill), as normalised positions on their part, so they ride along when the pose changes. Outline: brightness ≈ 0.52, focus level 0.15–0.9, shimmering ±22 %; fill: ≈ 0.19, level 0.5–1.5.
- **Focus levels.** Five blur levels, σ 1, 2.1, 4.8, 10.5 and 23 px. A fractional level splits a point between neighbouring levels, plus a 16 % halo two levels softer, so even crisp points glow. Bokeh and close foreground fireflies sit at levels 2.8–4.
- **Tone.** Light sums linearly, × an exposure of 11, mapped with `1 − exp(−x)` and gamma 1/2.2; nothing clips flat.
- **Motion streaks.** Each point is a streak from a quarter frame back to a quarter frame ahead (a 180° shutter): fast swarms smear, still points stay round.
- **Anchoring.** Points, ground and sky are world-anchored and move with the camera, scaled by depth for parallax. Grain, dither and captions are screen-space.
- **Grain.** 0.45 % gaussian grain weighted toward the darks (×1.0 in black, ×0.35 in highlights), plus ±0.65/255 dither, without which the near-black bands.

## 4. Colour logic

- **The ground is near-black, slightly green at the bottom and blue at the top**, with a faint lift in the centre; it is never pure `#000000` and never lighter than about 4 % grey.
- **One hue per character, and it stays theirs.** The protagonist is warm amber; the second character is lime-green. When the protagonist's light passes to the other, the colour travelling is the story.
- **Nature is cooler and dimmer.** Grass is a mid green with brighter crests; bokeh is a mix of green and a teal minority (about one in three), always dimmer than any character.
- **White is earned.** Only flashes, crowded overlaps and the moon get near white. The title is a pale warm gold, a step cooler than the protagonist.
- **Never coloured:** the sky (no blue gradients, no aurora), the captions (warm ivory only), and the darkness between figures.

Example palette (from the code's linear values):

| Role | Hex |
|---|---|
| Sky top / ground bottom | `#05070A` / `#070907` |
| Protagonist outline / fill | `#FFBD57` / `#FF9E47` |
| Second character outline / fill | `#C7FF75` / `#99EB5C` |
| Loose fireflies | `#DBFF66` |
| Grass base → crest | `#529E33` → `#9EE04D` |
| Bokeh green / teal | `#80CC57` / `#4D9E94` |
| Moon / stars | `#FFEDBD` / `#CCE0FF` |
| Particle title | `#FFE694` |
| Caption | `#F0E8CC` |

## 5. Type and captions

- **Face.** LXGW WenKai (SIL OFL), a soft, slightly handwritten face whose rounded strokes still read when sampled into dots. For a Latin-only video, Klee One (OFL) has the same pen. Ship the woff2 next to the page.
- **Particle titles.** The title is drawn into an offscreen mask and filled with points by jittered-grid sampling: about 3,400 points for one line of six glyphs at 138 px, 800 points for a 40 px tracked subtitle in capitals (+15 px letter spacing). The title flares to 1.7× brightness as it forms and decays over 0.3 s; afterwards each point breathes ±14 % and drifts ±0.25 px so the words are alive.
- **Captions.** The same face, 40–44 px in 16:9, 56–60 px in a reel, warm ivory `#F0E8CC`, centred, no box, no outline. A soft warm glow (7 px blur at 7 % opacity) lets them sit in the world as if lit by the fireflies. Fade in and out over 0.18 s, never slam. One language, the spoken one.
- **Hold.** Each caption stays ≥ max(1.8 s, speech + 0.6 s); in practice speech + 0.6–0.9 s, because the eye is busy with moving light.
- **Words the swarm writes** are short (one to four words) and held at least 2 s fully formed before the points leave.

## 6. Motion

- **Frame rate.** Continuous, never stepped: 60 fps native for YouTube when the render budget allows, 30 fps for reels. Streaks are half a frame interval at either rate.
- **Idle life.** A loose firefly wanders on two sines (±34 and ±14 px across, ±22 px up and down, 0.4–1.4 rad/s) and blinks at its own rate, 0.35–0.95 Hz, as a narrow gaussian pulse (≈ 10 % of its period) over a 7 % floor. A low duty cycle reads as fireflies; uniform twinkle reads as static.
- **Transformations.** Each point leaves its old role at start = 0.08 + 0.62·s + 0.12·d seconds (s, d random per point) and arrives 0.62 s later, eased with a quintic smootherstep (6u⁵ − 15u⁴ + 10u³). Optional forces shaped by sin(πu) bend the path: a **swirl** round a centre, a **scatter**, a **wind** offset, a **lift**; brightness flares up to 1.5× mid-flight.
- **Streams.** A swarm in transit follows one cubic Bézier, each point offset sideways by a gaussian amount widening from 40 to 160 px, plus a 25 px wobble: a river, not a line.
- **Flashes.** A 0.08 s rise, then exponential decay, τ 0.22–0.45 s. A synchronised answer is a 0.11 s gaussian pulse on every point of a group at once.
- **Figures.** Poses blend between keyframes with the same easing; legs use two-bone IK on a gait phase so feet plant. A big creature lowers its head over 1–1.5 s; a child reaches up in 0.3–0.4 s.
- **Never moves:** the sky gradient, the captions, the grain's anchoring. Nothing is perfectly still either: a held title breathes.

## 7. Camera

| Move | What it expresses | Can serve |
|---|---|---|
| Slow push, 1.0 → 1.055 over 10–12 s | attention narrowing | the first meeting, a held question |
| Lateral track, 430 px in 2.3 s, ease in-out, then drift back | travel, leaving home | journeys, chapter changes |
| Push-in to 1.2 over 4–5 s | danger closing in | storms, conflict, a deadline |
| Pull back to 0.86 over 1.7 s | scale reveal | the figure re-formed huge, a crowd revealed |
| Tremor, 2–2.5 px on three incommensurate sines | wind and fear | only while the weather is violent |
| Depth parallax (background ×0.62, foreground ×1.38 of every move) | space between the dots | always on |

Allowed transitions, all made of the swarm: a gather (points stream into the next shape), a gust (everything blown sideways reassembles as the next scene), a scatter into embers and darkness with one light left, and a leap where a figure rises and thins into a constellation. Forbidden: hard cuts between unrelated scenes (they break conservation), dissolves (two clouds overlapping read as mush), wipes, flips and any transition with a hard edge.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Score | harp (glissandi for streams of light, chords for each new scene), glockenspiel (a rising two-note "question"), hand chimes (a falling three-note "answer"), glass and vibraphone on touches, pizzicato for footfalls, flute for travel, timpani on scale reveals, a string pad; one key throughout | room reverb about 24 % wet |
| Foley | a filtered breath of air (white noise, low-passed at 2.5–4 kHz) for every stream, gust and leap; footfalls placed from the gait phase, not by hand | about −6 dB under the score |
| Ambience | crickets synthesised as 18 ms tone pulses at 4.3–5.2 kHz, three to five per chirp, 32 ms apart, five voices panned apart; wind as band-passed noise (180–1,400 Hz) with slow gusting; rain as hiss above 2.5 kHz plus random drops, brought in 0.35 s before it is seen | ducked 55 % under the voice |
| Silence | crickets stop when danger arrives; a suspended-cymbal roll and falling glockenspiel run into true silence when the light is destroyed; the crickets return one by one after the answer | |
| Voice | one gentle narrator, sparse, picture-book pace | about 11 dB over the bed while speaking; the bed carved by ~7 dB between 300 Hz and 4 kHz under speech |

Master at −14 LUFS, true peak −1 dB. The last chord rings out; only the final 0.6 s fades.

## 9. Native moves

1. **Many into one.** A stream swirls into a rigged figure, outline first, fill a beat later, flaring in flight: blend stream state to figure state with a swirl centred on the chest. Fits content like: a team forming; a movement behind one idea; a product assembled from small parts.
2. **Question and answer.** One point blinks twice (a rising two-note phrase); silence; the whole field flashes back in sync under a harp sweep: a gaussian sync pulse added to every point. Fits content like: one voice and the crowd that joins; a signal and its response; a first customer and those who follow.
3. **Point-light walk.** A creature of dots walks; its gait phase drives the feet and the pizzicato. Fits content like: an animal or migration story; a journey of many steps; your mascot setting out.
4. **Blown to embers.** A gust tears the figure apart; points become rain, die to embers, and only the guiding light is left. Fits content like: a loss; a crash; the low point before a comeback.
5. **Last light asks the dark.** The surviving point rises and blinks into nothing; after a held silence, lights answer on the horizon one by one, then all at once. Fits content like: reaching out for help; a lonely start; a call to action.
6. **Scale reveal.** The same points re-form the figure 1.5–2.5× larger as the camera pulls back to 0.86. Fits content like: growth over time; a small idea becoming big; the true size of a problem.
7. **Constellation.** A figure leaps and thins into a few bright stars at its joints, with one steady star for the eye that flashes when answered. Fits content like: remembrance; a legacy; a goal set high.
8. **Written in light.** The swarm writes the title or a key word, flares, holds, and drifts upward. Fits content like: the title; a name; a final promise.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- A canvas page (`data-no-timeline`) drawn as a pure function of `t` on the seek event. Seed the whole pool once (counts, per-point constants); every act is a function `state(t)` returning position, focus level, brightness, colour and depth arrays; a table of act start times picks two states and blends them with the staggered transformation of section 6.
- WebGL2 with half-float (`RGBA16F`) render targets: splat the points additively as streaks (sub-steps every 1.1 px, at most 40) into five buffers at full, full, ½, ¼ and ⅛ resolution; blur each with its σ (1, 2.1, 4.8, 10.5, 23 px) and gain (1, 1.55, 2.7, 5.2, 10); upsample and sum; tone-map `1 − exp(−11·x)` and gamma in the last pass. Canvas 2D with `lighter` clips at 1 and turns figures into white blobs.
- Rigs as tapered capsules and polygons with points bound by normalised part coordinates; poses as keyframed dictionaries blended with smootherstep; two-bone IK for legs. Draw the silhouettes from the side.
- Particle type: render each title to an offscreen canvas, read its alpha, and sample it with a jittered grid whose spacing is √(area ÷ count); the same sampler fills any picture mask.
- Grain and dither last, from pre-made noise tiles offset by a hash of the frame index; skip any streak longer than 260 px (points wrapping round the frame).
- `cues.json` from the same event table: each gather, blink, answer, flash and gust writes its cue at its start time; footfalls from the gait phase.

## 11. Pitfalls

- **Banding** in the near-black sky: dither is mandatory; encode at a high bitrate (CRF ≤ 16), since small bright points on black are the hardest thing for H.264.
- **Points lost in the re-encode.** Keep crisp points at σ ≥ 1 px with a halo; single-pixel stars vanish on a phone.
- **White blobs.** Fill as bright as outline erases the edge; keep fill at about a third of outline brightness.
- **Unreadable silhouettes.** Front views, crossed limbs and props against the body disappear; use side views, separated limbs, a clear head.
- **Popping.** A shape whose points did not travel from somewhere, or a scene change by cut, breaks the illusion.
- **Static twinkle.** One blink rate for all, or a high duty cycle, looks like TV noise.
- **Everything moving at once.** Swarm, camera and figures: one leads at a time.
- **Too dark for a phone in daylight.** Keep the glowing ground line and one bright figure in every frame; black for more than about 2 s needs one living point.

## 12. Variation space

The agent decides per video: what the swarm becomes and in what order, the protagonist and its hue (one warm, one cool), the weather or threat, the landscape (meadow, sea, city roofs, a single tree), what the last light does, and the words the swarm writes.

- **Three structures:** call and answer (a signal, a small reply, a huge reply); gather, scatter, regather larger; a journey through three or four landscapes made of the same points.
- **Three openings:** a stream of light sweeping in on frame 1 and settling by 1.6 s; a single blink on near-black answered by the whole field by 2 s; the swarm already falling into the key word, legible by 1 s.
- **Three endings:** the title written in light, then drifting up into the stars; one last light held alone, then out, with the chord left ringing; the figure leaping into the sky to become a constellation while the protagonist watches from the ground.
