# Stick-figure Explainer

> Clean, even-weight stick figures on warm off-white paper act out an idea about people (a chain, a crowd, a queue, a ring) while one red signal runs through them; bold sans headlines and small counters sit beside them like an editorial page, and the camera pulls back or dives in to change scale. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Otl Aicher's and the Isotype movement's pictograms (one figure stands for many; repeat it to count); editorial explainer graphics in newspapers (headline, one accent colour, a source line under every number); the "people as dots" simulations of interactive essays (a rule spreads through a crowd and you watch it happen); classic character animation principles (anticipation, follow-through, overlap). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Headline left-aligned at x 96, first baseline y 380, 72–76 px, at most three lines; its kicker (episode and topic in small caps) at y 300. The figures stand on their line around y 1080, filling y 640–1100: a row of five to seven figures 300–360 px tall, or two stacked rows, or a grid of crowd figures 120–160 px tall. Counters and labels sit inside x 72–900 above y 1248; below that only the paper and the bottom of a pulled-back crowd. Stack, don't shrink: a chain that would run wider than the frame bends into two rows or onto a ring.
- **The first 3 seconds.** Frame 1 already shows the headline's first line and the base line drawing across; the first figure pops in by 0.3 s with an overshoot; by 2 s the chain or crowd is complete and the first hand-clasp or red pulse has happened; the question (the red word in the headline) lands by 3 s.
- **Length and pace.** 20–45 s, three to four "worlds" (scales), a camera move between each. Every 4–6 s something in the crowd acts: a pulse, a hand-off, a count ticking, a figure turning red.
- **Captions.** Centred on x 540, at most 720 px wide, one or two lines of 38 px Jost at y 1150–1236, no box; a 48 px red rule 4 px thick sits above the line.
- **Sound.** The pack's `ui-pop` (each figure appearing), `ui-click` (each hand-clasp), `tick` (a counter step), `zoom-swish` (pull-backs and the dive), `clean-ding` (the moment the idea closes: a ring joining, a count passing a threshold). Pizzicato strings, mallets and harp come from a free sample library.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Captions and counters stay above y 950; the kicker and headline keep the 96 px left margin.
- **Length and structure.** 3–8 min in chapters of 40–90 s. **Each chapter is one world**: its own arrangement of figures (a chain, rows in time, a grid, rings, a globe) in its own coordinates, with its own headline that slides in as the chapter starts. Chapters join where two worlds share a point: the camera pushes into one figure of this world and that figure is the first figure of the next (a dive through its red head, or a pull-back that reveals it was one of many). A chapter's arc: set the figures up (5–10 s), run the rule through them once slowly (10–20 s), run it again faster or bigger with a counter (10–20 s), then the scale change that opens the next chapter.
- **Re-hooks every 30–60 s.** A pull-back that multiplies the crowd; a figure that fails (drops what it carries, stays grey while the red passes); a counter that passes a familiar number; a chart drawn in the same lines beside the crowd; a dive into one face.
- **The first 10 seconds.** Strongest image first: the full chain or crowd with the red signal already running. The question in the headline by 5 s; by 10 s the answer-in-waiting appears on the right in red (the common answer, stated as a claim) as the promise the video will test.
- **Captions.** Burned in as the left-ruled line (they belong to the page's typography); export the same lines as `.srt`.
- **Thumbnail.** A real frame of the signature arrangement: the row of figures with the one red figure lifting its arms, a headline of at most three words with one word in red.

### Good for

Social and network ideas, crowd behaviour and queues, simple statistics and probability, economics of many people (rushes, markets, voting), cause and effect in systems.

## 1. Essence, and what it is not

1. **One line weight, one body.** Every figure is the same skeleton drawn with one even stroke (8 px at full height) and round caps: hollow round head, curved spine, arms and legs as single soft curves. No faces, no hands, no feet.
2. **People as units.** Figures stand for counts. Repeated, they become rows, grids, rings and globes; the idea is the arrangement.
3. **One red signal.** Red is what changes, travels or matters: the figure who acts first, a pulse along joined arms, a counter's last value.
4. **Alive, not cartoony.** Every figure breathes on its own phase, anticipates before it moves and overshoots when it stops; nobody is copy-pasted.
5. **Editorial type.** Big bold sans headlines with negative tracking, small-caps kickers, right-aligned numeric columns and a source line. The page looks designed, not drawn.

Not **Sketchnote** (no handwriting, no marker, no dot grid; type is typeset). Not **Marker on Paper** (no felt-tip wobble, no worked maths; lines are clean vectors). Not **Whiteboard Explainer** (no hand, nothing is drawn stroke by stroke except base lines and links). Not a **cartoon** (no faces, no props beyond simple pictograms like a letter or a coin).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Kicker | x 124, baseline y 118 | episode and topic, 22 px Jost 500, small caps, tracking 3 px, grey |
| Headline | x 116, baselines y 214 and 308 | 84 px Jost 600, tracking −2 px, one or two lines; one word in red |
| Claim | right-aligned to x 1800, baseline y 308 | the answer to test, 84 px red |
| Figures | y 380–900, centred or left of centre | row figures 360 px tall on a base line at y ≈ 820; crowds 120–180 px |
| Base line | 60–160 px beyond the end figures | 7 px, pale tint, nodes between figures |
| Counter column | x 1312–1800, rows 74 px apart from y 318 | 20 px column heads, 44 px values right-aligned, last value 52 px red |
| Source line | under the counter, 18 px | grey, says what is illustrative and where numbers come from |
| Caption | x 124 rule, text from x 146, baseline y ≈ 900 | 36 px, no box |

When a counter or chart is on screen, the figures move left of centre (about 160 px) so the numbers own the right third. Leave at least one figure height of clear paper above the crowd for the headline.

## 3. Materials and rendering

- **Paper**: flat warm off-white `#F3F0EA` with a very fine luminance grain (±3 levels, seeded, fixed to the screen); no vignette, no fibres, no texture on top.
- **The figure** is a skeleton in figure-height units: thigh and shin 0.215, hip height 0.42, spine 0.285, upper arm 0.18, forearm 0.155, head radius 0.112, stance 0.09. Legs use two-bone IK to their feet; elbows always bend down. Each limb is one quadratic curve whose control point sits 80 % of the way to the joint, so limbs are soft hoses, never polylines. The spine curves with a bend parameter; the head sits on the neck and only rotates.
- **Line width** is 8 px for a 380 px figure (7.5 px for the head ring), scaled by √(height ÷ 380) clamped to 0.6–1.05, never below 3 px. In a fractal pull-back, scale it proportionally so big and small figures look equally thick.
- **Holding hands**: two neighbours' arms join into one continuous curve whose lowest point hangs 0.17 × height below the shoulders; on the clasp it bounces once (4.5 % of height, decaying in about 0.5 s).
- **Fills**: heads are filled with paper (hollow); a red figure has a solid red head and red limbs.
- **Pictograms** (a letter, a coin, a house) use the same stroke and the same two colours, at about 0.25 × figure height.
- **Base lines and guides**: 7 px pale tint for base lines and empty bars; 3 px for guides, ticks and dashed group boxes (pale red when they group the affected).

## 4. Colour logic

- **Two inks and a signal.** Near-black for figures and headlines, grey for labels and kickers, pale tint for structure, red for the signal. Nothing else.
- **Red moves.** It appears where the change starts and travels: along joined arms, along the base line, through a crowd. A trail of pale red can show its path; full red marks where it is now.
- **Red text** only for the word the headline is about, the claim being tested and the counter's final value.
- **Structure is quiet.** Base lines, empty bars and group boxes are tint or pale red, never ink.

| Role | Hex |
|---|---|
| Paper | `#F3F0EA` |
| Ink (figures, headlines) | `#24242C` |
| Mute (kickers, labels, captions' second voice) | `#9C978C` |
| Tint (base lines, empty bars, inactive nodes) | `#E2DDD2` |
| Signal | `#EB4A2A` |
| Signal, pale (trails, group boxes) | `#F4C3B4` |

## 5. Type and captions

- **Face**: Jost (OFL), weights 500 and 600. For a script Jost lacks, the matching Noto Sans face (OFL).
- **Roles**: headline 84 px 600, tracking −2 px; claim 84 px red; kicker 22 px 500, tracking 3 px, grey; column heads 20 px 600, tracking 3 px; values 44 px 600, right-aligned, tracking −0.5 px; labels at the ends of a chain 22–24 px small caps, grey; source line 18 px 500.
- **How type arrives**: it slides up 16 px over 0.45 s (cubic ease-out) while fading in over 0.38 s; it leaves by fading over 0.3 s. It never types on, bounces or scales.
- **Numbers** come in as their word is spoken, one row at a time; the last value of a count is bigger and red.
- **Captions**: no box; a 4 px red bar 70 px tall at x 124, the line at x 146 in 36 px Jost 500 ink, fading in and out over 0.12 s. Start each 0.25 s before the line is spoken and hold at least max(1.8 s, speech + 0.6 s). Captions never cover a figure; move the crowd up instead.

## 6. Motion

- **60 fps** for YouTube (the springs and the clean paper show every frame), 30 fps for a reel. No stepping, no boil.
- **Springs drive every joint**: each pose parameter chases a target with its own damped spring, simulated at 1,200 Hz. Hips ω 20 ζ 0.8; lean ω 13 ζ 0.6; upper arms ω 13 ζ 0.58; forearms ω 9.5 ζ 0.46 (slower, so they trail); head ω 9 ζ 0.42 (loosest); feet ω 30 ζ 0.85. Target poses contain the acting; springs add the overlap.
- **Anticipation**: before a jump, a 0.28 s crouch with arms pulled in; before reacting to a wave, a small dip 0.2 s ahead.
- **Appearing**: figures pop in with a damped-spring step (ω 17, ζ 0.45) that overshoots once; rows appear 0.045 s apart.
- **Breathing**: every figure sways and breathes on its own phase (index × 1.93), a few thousandths of its height. Nothing ever stands perfectly still.
- **Propagation**: a change spreads from its source to both sides at a fixed step (0.1–0.2 s per figure), the pulse on the base line arriving at each node exactly as that figure reacts; afterwards the whole row turns its heads toward the source.
- **Never moves**: the headline once placed, the paper, the base line.

## 7. Camera

The camera is `(x, y, zoom)` over each world, with zoom interpolated in log space and cubic in-out easing.

| Move | What it expresses | What it can serve |
|---|---|---|
| Hold (zoom 1) | the rule shown plainly | the first run of any idea |
| Pull-back revealing copies (2 s, to zoom 0.35–0.4) | "this happens everywhere" | one case becoming the experiment, the sample, the population |
| Fractal pull-back, ×2.5 per step (0.6–1.2 s each, faster each time) | exponential growth | branching, compounding, how quickly numbers pass a limit |
| Push into one figure while others fade to paper (1.2 s) | focus on "you" | moving from the crowd to the individual |
| Dive through a red head (0.6 s, zoom to ×75, cubic in) | entering the next idea | a chapter turn: the red fills the frame and the next world begins |
| Slow push under a hold (+3 % over 3 s) | weight | conclusions, end cards |

Worlds share coordinates where two shots meet, so a move never needs a cut. Forbidden: dissolves, wipes, rotation, shake, handheld drift.

## 8. Sound palette

| Layer | What |
|---|---|
| Score | about 120 BPM (2 s bars) in a major key: pizzicato bass and marimba for set-ups, a walking pizzicato line when things travel, strings swelling under pull-backs with a harp sweep per new ring, glockenspiel for counts, vibraphone for values, a full chord when a threshold is passed. |
| Foley | soft pops for figures appearing, a quick air swish as a hand reaches, a dry click as hands clasp, glock ticks as the pulse reaches each node, a soft shimmer of filtered noise while red runs, a low thump when something is dropped, whooshes for camera moves. Each sound panned to its figure. |
| Silence | a short gap of score before the dive, broken by a soft low hit on the red frame. |
| Mix | voice about 10 dB over the bed; the music bus dips 300 Hz–4 kHz and ducks under each line. Master −14 LUFS, true peak −1 dB. |

## 9. Native moves

1. **The wave.** One figure crouches, jumps with arms up and lands with a hand on its head; the reaction spreads to both sides while a red pulse runs along the base line, then every head turns toward the source. Fits content like: one change in a system; a rumour; a price move.
2. **The joined chain.** Figures pop in one by one and clasp hands; each clasp turns two arms into one curve; red then runs along the whole chain. Fits content like: supply chains; a relay of messages; a referral that spreads friend to friend.
3. **The hand-off that fails.** An object passes from hand to hand along a chain and one figure drops it; it falls with a thump and that figure stays grey while red passes the others. Fits content like: where a process breaks; lost information; a weak link.
4. **Rings that outgrow the frame.** "You" in the centre, a ring of figures around, then a ring 2.5× bigger, again and again, the camera pulling back each time while a counter column climbs. Fits content like: exponential growth; reach of a network; compounding.
5. **Time as rows.** The same row drawn three times stacked (0 s, 2 s, 4 s) with a pale red trail showing how a stop travels backwards. Fits content like: a queue at a gate; stop-and-go waves; delays in a pipeline.
6. **Crowd and chart.** A grid of figures with dashed group boxes beside a bar chart drawn in the same 7 px tint lines and a dotted threshold; the bar crossing the threshold turns red. Fits content like: a rush on a shop; tipping points; capacity limits.
7. **The closing shape.** A chain bends from a straight line onto a circle and grows round it until the last hands meet; the circle fills as the shape of the whole. Fits content like: everyone connected; a cycle completing; a global total.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D, one canvas, the frame drawn from `t`: paper, then each world under its camera transform, then headline, counters and caption in screen space.
- One figure rig shared by everyone: pose parameters (hip offset, lean, bend, head, arm angles, foot positions) → joints → curves. Keep the three drawings in mind (even hose, tapered stroke, one-line body) but use one per video.
- Springs are simulated once per group at 1,200 Hz from the target-pose functions and recorded at 240 Hz; rendering interpolates the record, so seeking stays deterministic.
- People are entities `{x, y, rot, size, appear, pose(t), colour(t)}`; links are `{a, b, clasp, release, sag, overRuns}` and draw before people, so joined arms read as one line.
- A `worldAt(t)` table picks the world and its camera; worlds are built so the last frame of one shares a point with the first of the next.
- Export one event per pop, reach, clasp, node, count, pulse and camera move for the foley and `cues.json`, and each headline and counter with its box for the reading check.

## 11. Pitfalls

- **Clones.** Figures with the same phase look pasted; give every one its own breathing and sway.
- **Popping limbs.** Never switch poses in an `if`; always let a spring carry the change.
- **Too thin when small.** Crowd figures under about 120 px need the 3 px minimum or they shimmer; pulled-back crowds may need the line scaled up.
- **Red everywhere.** If more than about a third of the frame is red the signal has nothing to travel through.
- **Illustrative numbers passed as data.** Simulated crowds are illustrations; the source line says so.
- **Captions on the figures.** Move the crowd, never print over legs.
- **The app's buttons.** In a reel, nothing that must be read below y 1248 or right of x 900; on YouTube nothing in the bottom 12 %.

## 12. Variation space

The agent decides per video: the arrangement for each world, the signal colour (one saturated hue only), the figure drawing (even hose, tapered stroke or one-line body), how many worlds, the counters and the voice.

- **Three structures:** a claim tested (state it, run it, check it, refine it); a scale ladder (one figure → a row → a crowd → the planet); a failure analysis (the chain works, then breaks, then is fixed).
- **Three openings:** the full chain on frame 1 with red already running; a single figure that waves and the crowd pops in around it; the counter showing a surprising number, with the figures arriving to explain it.
- **Three endings:** the closing shape (ring or globe) with a slow push; a pull-back to everyone, one red figure still lifting its hand; back to the first row, now red end to end.
