# Assembly-Line Diagram

> A process drawn as a working factory in cross-section: numbered rooms on floors, conveyors, pipes, hoppers and gauges, tiny workers in caps, all in flat mid-century print colours with thick ink outlines, slightly misregistered plates and paper grain. The camera follows one piece of cargo through every station, then pulls out to show the whole plant at once. A 9:16 reel, or a 16:9 explainer for YouTube.
> References (grammar only): Fritz Kahn's "body as industrial palace" posters (a process as rooms of machinery and workers); Nigel Holmes's explanation graphics (flat colour, right-angle leaders, offset drop shadows, numbers you read in a second); mid-century factory cutaway illustration and two-colour print (plates out of register, warm stock). Never copy their drawings, characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The plant is a tall building: floors stack down the screen and the camera travels down through them. Rooms bleed to the sides; plaques, numbers and the caption card sit inside x 72–900, y 269–1248.

| Zone | Position | Content |
|---|---|---|
| Station plaque | x 96, top y 300 | number circle + plaque, name 44 px |
| Room interior | full width, y 420–1100 | the station's machine, the cargo, two or three workers |
| Callouts | inside x 96–880 | right-angle leaders, 44 px labels |
| Pipes and chutes | run vertically through the frame | lead the eye to the next floor |
| Caption card | centred on x 540, ≤ 720 px wide, bottom edge y ≈ 1240 | the work-order card, 38 px |

- **The first 3 seconds.** Frame 1: the cargo already riding a conveyor through a busy room, workers moving, the station number visible. By 0.5 s a hopper drops something on it or a sign swings down; by 3 s the camera is pushing into a door (the way into the system) and the question is on the caption card.
- **Length and pace.** 30–50 s, four to six stations, each 4–8 s; one plunge, one match cut, one stop, one pull-out.
- **Captions.** The work-order card is the only caption layer.
- **Sound.** `thock` when a plaque or sign lands; `ratchet` under conveyors and chains starting; `zoom-swish` on plunges and whips; `ui-pop` as each number circle or tag appears; `metallic-riser` under the big pull-out; `clean-ding` as the light streak reaches each station. The march itself (clarinet, woodblock, bass drum, brass, glockenspiel, timpani) from a free CC0 library such as VSCO 2 CE or VCSL.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. The work-order card stays above y 950 and inside the 5 % margins.
- **Length and structure.** 3–8 min. One chapter per station or floor (40–90 s), in the order the cargo travels. Each chapter opens with its numbered plaque landing (a sign that flips down and bounces) and closes when the cargo leaves the room. Re-hook every 30–60 s with a move the factory makes: a plunge down a chute to the next floor, a match cut on the cargo, the whole line stopping dead at a STOP sign, an alarm, a clock fast-forward, a porthole view out to the world the plant serves. The final chapter is the pull-out and the light streak through every station.
- **The first 10 seconds.** The whole plant first (a 3 s pull-out frame, everything running), then a push to station 1. The question by 5 s ("what actually happens in there?"); the promise by 10 s ("by the end you'll have walked every station").
- **Captions.** The work-order card is burned in (it is part of the plant's paperwork); export the same lines as `.srt`.
- **Thumbnail.** The cross-section with the cargo in one room, a numbered plaque, at most three words in Big Shoulders Display 900 on a sign.

### Good for

How a process works, biology and medicine, supply chains and logistics, data pipelines and software systems, manufacturing.

## 1. Essence, and what it is not

1. **The process is a building.** Every step is a room with a number and a name; rooms connect by conveyors, pipes and chutes; the cargo moves through them in order.
2. **Workers make it human.** Tiny figures (cap, coat, two-segment arms) operate levers, push carts, wave flags and doze; they show what each station does without a word.
3. **Print, not screen.** Thick ink outlines, flat fills, flat offset drop shadows, colour plates a pixel out of register, warm paper grain.
4. **One continuous world.** The whole plant exists at once; the camera tracks, pushes through doors, plunges between floors and finally pulls out to show everything.
5. **Colour is cargo type.** Each kind of thing that travels (three at most) has its own colour, its own pipe and its own legend tag.

Not **Instruction Manual Art** (that is isometric, wordless and faceless; this is a front-on cross-section, labelled, full of characters). Not **Color-Coded Mechanism** (a true 3D machine; this is a flat metaphor). Not **Line-Art Cutaway** (monochrome engineering drawing). Not a modern flat corporate explainer (no gradients, no rounded blob people, no white void: dense, warm and printed).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Paper / ground | full bleed | the dark body of the plant (indigo `#24345A`) between rooms; paper `#F2ECE0` outside it |
| Rooms | 600–1900 px wide at 1:1 | 3 px ink frame in a station colour, 14 px border, light wall `#FBF7EE`, a 22 px floor strip |
| Station plaque | room's top-left corner, overlapping the frame | yellow number circle (radius 22) + cream plaque with flat shadow; name 34 px caps |
| Floors between rooms | 60–80 px slabs | blush slab, dark lower edge, rivets every 44 px |
| Conveyors | along each floor | 22 px dark belt, rollers every 32 px |
| Pipes | between rooms and floors | ink edge, colour, highlight strip; chevrons every few hundred px show direction |
| Legend tags | hanging from a pipe or line | 34 px colour swatch + name (30 px) |
| Callouts | from the part to open wall | solid 6 px dot, vertical then horizontal leader, label 40 px |
| Work-order card | x 56–(width), y 830–946, bottom left (bottom right when the action is left) | see section 5 |

A shot shows one room at 1:1 with the edges of its neighbours; plaques for the next stations peek in at the frame edges as promises. Keep the cargo in the middle third.

## 3. Materials and rendering

- **Flat vector, rebuilt every frame.** Each frame is one SVG: rooms, machines, workers, text, all from drawing functions. Shapes are a fill pass and an ink pass (round joins and caps).
- **Line weight follows the camera like print.** Ink width × factor KS: when the camera pulls out, lines thin by zoom^0.6; when it pushes in they thicken only slightly (zoom^0.75 compensation), so the plant always reads as one printed sheet. Belts, rods and pipes keep geometric widths.
- **Misregistration.** Each colour plate is shifted as a whole by a fixed sub-2 px offset (red ≈ +1.6, +0.8; yellow ≈ −1.2, +1.3; teal ≈ +1.0, −1.2; blush ≈ −0.8, −0.6). Ink, paper and walls stay put, so colour peeks out from under the lines.
- **Flat drop shadows.** The same shape offset down-right in one light colour: 18/14 px for big objects, 6/5 for plaques and tags, a 28 % ground-coloured shadow for the caption card.
- **Paper grain.** A full-frame canvas of fine noise (up to 13 % darker) with faint horizontal fibres at 5 %, laid over everything with `multiply` at 55 %. Screen-anchored, like the grain of the print.
- **Level of detail.** Below zoom 0.2, small text and workers are skipped so the pulled-out plant stays clean.
- **Workers.** About 64 px tall at 1:1 (scaled 1.25–1.3): legs as 6 px ink strokes, a trapezoid coat (cream or teal, a button line on cream), a skin-tone head, an optional cap (red, yellow, teal or ink), arms as 8.5 px ink strokes with the coat colour inside and a small round hand. Each one has a loop: an arm swinging at 1.6–4 rad/s, a walk at 12, a lever pull on the beat.

## 4. Colour logic

- **The plant's body is dark** (indigo by default), rooms are light, so every station reads as a lit window.
- **Room frames rotate through the station colours** (yellow, teal, red, blush) so neighbours never match.
- **Cargo types own colours**: one per stream, its pipe, its conveyor items, its legend swatch and its funnel. Never more than three streams.
- **Yellow also means "number"**: every station number circle is yellow.
- **Red means stop and alarm** besides its stream role: a STOP sign, an alarm light, a clock's warning hand.
- **Three schemes share the drawing code**: night shift (indigo body), daytime chart (white ground, light flesh body, cobalt instead of teal, no large dark areas), and warm (wine-red body). Pick one per video.

| Role (night shift) | Hex |
|---|---|
| Paper | `#F2ECE0` |
| Ink | `#1D2030` |
| Plant body | `#24345A` (lighter `#2F4270`, darker `#1C2A4A`) |
| Walls | `#FBF7EE` / `#EFE7D7` |
| Blush (floors, soft tissue, pipes) | `#EE9F87` |
| Red | `#E04A2F` |
| Yellow | `#F3B23A` |
| Teal | `#2E8D87` |
| Cream (plaques, coats) | `#FFFBF3` |
| Flat shadow | `#DCCFB8` |

## 5. Type and captions

- **Big Shoulders Display** (OFL) 700–900 for plaques, signs, numbers and callouts: condensed caps, letter-spacing about 1.2 px per letter. **Archivo** (OFL) 600/800 for captions and small print.
- Sizes at 1:1: station plaque 34 px; big sign title up to 120 px (900); callouts 40 px; legend tags 30 px; number circles 28 px in a 44 px circle. All printed in the world and scaled by the camera, except the caption card.
- **The work-order card.** A cream card (radius 4) with a 2.8 px ink frame and a 28 % ground-coloured flat shadow; on its left a 72 px stub in yellow carrying the current station number in a cream circle (or a clock face when it is about time), separated by a dashed perforation line; one line of Archivo 600, 34 px at 1920 (38 px in a reel). It slides up 34 px in 0.2 s (ease-out) and drops 40 px out in 0.14 s. Spoken language only. Hold each ≥ max(1.8 s, the spoken line + 0.6 s).
- Words on signs are short (one or two words: INTAKE, PRESS, COLD STORE); the narration explains.

## 6. Motion

- 24 fps for YouTube, 30 fps for a reel; motion is smooth, and every machine runs on a loop tied to `t`.
- **Easing kit.** Back ease (overshoot 1.8) for things that pop; a damped spring (k 7, damping 0.35) for signs and hanging plaques that swing and settle; sine pulses (0 → 1 → 0) for lever pulls and bites; keyframe tracks that ease in and out and hold on each key.
- **Signs land.** A title sign flips down on its chains, bounces twice and settles; a sub-sign follows half a beat later.
- **Cargo moves at belt speed**: steady (around 800 px/s at 1:1), easing to a stop under each hopper exactly when its drop lands; rollers turn by distance travelled.
- **Time stretch.** To hold a title without cutting, story time slows smoothly to about 2 % and back (a raised-cosine dip), so the factory keeps idling while the viewer reads.
- **Clock fast-forward.** A wall clock's hands spin, workers doze, a light dims; only the clock moves fast.
- **Never moves:** the paper grain, the plate offsets, the caption card's position within a shot.

## 7. Camera

A 2D camera (centre x, y and zoom z), zoom interpolated in log space.

| Move | What it expresses | What it can serve |
|---|---|---|
| Track with the cargo (z ≈ 1.0–1.06) | following one thing | each station's work |
| Push through a door or opening (to z ≈ 9) | entering the system | the start, a new organ or subsystem |
| Plunge down a chute or pipe | going to the next floor | a stage change |
| Whip pan sideways | jumping to a parallel line | a comparison, an alarm elsewhere |
| Hold on the floor (z ≈ 0.5) | the station as a whole | sorting, many lines at once |
| Colour follow up a pipe | one stream's journey | where a product goes |
| Porthole view | the world outside the plant | why the process matters |
| Big pull-out (to z ≈ 0.12) | the whole plant | the ending, the summary |

Transitions: **through a shape** (the door becomes the frame), **match cut** on the cargo (the same object drops into the next station), **plunge and whip** with directional blur (a Gaussian blur along the motion, up to 26 px, scaled by the camera's on-screen speed) plus ink speed lines, a **circular mask** opening from a porthole. The only dissolve is the final one, from the pulled-out plant to a simple diagram of the whole. No 3D turns, no shake.

## 8. Sound palette

- **The line is an ostinato.** A 120 bpm factory march: bass and ostinato on every beat, a staccato clarinet tune on top, woodblock and bass drum on machine hits. Each section changes key and density: a tidy major march for the ordinary line, a minor churn for heavy processing, half density for storage, a full-speed march after an alarm.
- **Voices by stream**: when lines split, each line brings in its own instrument.
- **Stops are total**: when a STOP sign goes up the whole band stops dead and picks up when the line restarts.
- **Fast-forward**: only the clock and a rising xylophone.
- **Climax**: three timpani hits with brass as the engines ignite; brass chords build through the pull-out; one glockenspiel note per station as the light streak passes (rising); a final tutti when the end plaque lands.
- **Foley (procedural)**: belt noise at the roller rate, chain rattle, sign bounces, pneumatic hiss, door hiss, crunching hits, bells and alarms, wind on the pull-out.
- **Mix**: narration compressed and set about 10 dB over the music, music ducked and cleared from 300 Hz–4 kHz. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Through the door.** The camera pushes into an opening until it becomes the frame, and the next interior is behind it. Fits content like: entering an organ, a server, a warehouse; the start of a pipeline; "let's go inside".
2. **Plunge between floors.** A fast drop down a chute with directional blur and speed lines, slabs sweeping past. Fits content like: the next stage; going deeper; gravity-fed steps.
3. **Match cut on the cargo.** The same lump leaves one room and drops into the next station's hopper. Fits content like: continuity across stages; a handover between teams; transformation.
4. **Sort into lines.** One stream splits onto three conveyors, each a colour with its legend tag and its own instrument. Fits content like: separation and classification; routing; ingredients into components.
5. **STOP.** A worker raises a sign; every machine and the music stop dead; the line restarts on a lever. Fits content like: a checkpoint or gate; a bottleneck; quality control.
6. **Clock fast-forward.** The wall clock spins, workers doze, stock piles up. Fits content like: storage and waiting; hours passing in seconds; slow processes.
7. **Porthole.** A round window opens to the outside world the plant serves. Fits content like: the purpose of the process; the customer; the moment of use.
8. **The light streak.** In the full pull-out, a light runs along the whole line, each station lighting and its number popping as it passes. Fits content like: the summary; total time or distance; an end card for your app's workflow.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- A DOM page that rebuilds one SVG string per frame (no GSAP needed), `data-no-timeline`; drawing functions for every element (`room`, `plaque`, `tag`, `callout`, `worker`, `belt`, `pipe`, `gear`, `gauge`, `lamp`, `slab`) write into one buffer; the world is one coordinate system.
- A global line factor set from the camera zoom each frame; a plate table maps each fill colour to its plate and offset, applied as a `translate` on fills only.
- The paper grain as a canvas over the SVG with `mix-blend-mode: multiply` at 55 %.
- A cue file (`cues.json`) holds every action time (drops, signs, cuts, stops, the light streak) and a story-time warp for stretched holds; the sound mix reads the same file.
- Directional motion blur only while the camera moves fast: a `feGaussianBlur` with separate x and y deviation from the camera's speed.
- Fonts subset to the characters used and kept local as woff2.

## 11. Pitfalls

- **Clutter at phone size.** A full plant at 1:1 has hundreds of parts; frame one room and let the rest be shapes. Skip small text and workers when pulled out.
- **Too many streams.** More than three cargo colours and the legend stops working.
- **Signs nobody can read.** Plaques at 34 px are fine at 1:1, gone at 0.4; never ask the viewer to read a sign while the camera is pulled out.
- **Static workers.** A worker standing still reads as a sticker; give each a loop.
- **Heavy misregistration.** Offsets above 2 px look like a rendering bug; keep them small and fixed.
- **A metaphor that lies.** The factory must keep the real order and the real number of stages; label what is simplified.
- **Dark frames.** Too much body colour on screen makes a reel heavy; keep a lit room in every shot.
- **Blur everywhere.** Directional blur belongs to plunges and whips only; static frames stay crisp.

## 12. Variation space

The agent decides per video: the process and its stations, the cargo and its streams, the colour scheme, what each station's machine is (press, filter, kiln, cold store), the workers' gags, whether the line runs forwards (building) or backwards (taking apart).

- **Three structures:** one cargo followed from entry to exit, ending on the pull-out; the plant explained floor by floor, each a chapter with its own sign; a race between two lines (normal versus faulty), cut together, with the STOP on the faulty one.
- **Three openings:** the cargo already on a busy conveyor; the title sign dropping and bouncing over a running line; the whole plant pulled out, then a push through the first door.
- **Three endings:** the light streak through every station and the end plaque landing; the porthole showing the result out in the world; the cargo leaving the last door, transformed, as the march resolves.
