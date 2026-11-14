# Color-Coded Mechanism

> A working machine, modelled in code with true gear ratios, shown as a soft cel-shaded illustration on warm paper: each subsystem wears one flat colour, every part is ringed in a darker shade of its own hue, and the colours spread through the mechanism in the order energy flows. The machine really runs, slows, stops and runs away on cue. A 9:16 reel, or a 16:9 how-it-works video for YouTube.
> References (grammar only): colour-coded textbook diagrams (one hue per system, a legend that reads in flow order); museum cutaway models (a wedge removed to show the inside while the rest stays whole); technical illustration with coloured outlines rather than black ones; high-speed slow motion in engineering films (one event slowed until it can be seen). Never copy their drawings, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Paper bleeds to every edge. The machine fills the middle, framed tighter than in 16:9 and allowed to run off the sides; the exploded stack reads vertically. Everything that must be read sits inside x 72–900, y 269–1248.

| Zone | Position | Content |
|---|---|---|
| Figure line | x 72, baseline y 300 | 18 px mono caps, tracking 0.16 em |
| Headline or hero number | x 72, first baseline y 380 | 72 px headline (two lines) or 150 px number |
| Machine | centred x 540, main body y 470–1150 | bleeds left and right |
| Part labels | inside x 96–880, y 420–1120 | name 38 px, line 24 px; at most two on screen |
| Legend (when used) | x 72, stacked rows from y 1000 | swatch, name, one line each; replaces labels |
| Caption | centred on x 540, ≤ 720 px wide, last baseline y ≈ 1210 | 44 px, one or two lines |

- **The first 3 seconds.** Frame 1: the closed machine already running at real speed, close and slightly from above, its fastest part visibly moving. By 0.5 s the camera is pulling out. By 2 s a wedge is cut out of the casing; by 3 s the first colour spreads from the power source and the question is on screen.
- **Length and pace.** 30–45 s: closed → cut → three dyes → one runaway or slow-motion event → whole. One label leads at a time; a held beat of near-silence right before the slowed event.
- **Captions.** One caption layer, bottom of the safe box; labels and the legend are graphics, not captions.
- **Sound.** `tick` on every beat of the mechanism (it is the film's clock); `ui-pop` as each label's dot appears; `ratchet` under winding or a part being turned by hand; `metallic-riser` under a runaway; `latch` when the last part drops in and everything stops; `sub-impact` under the one slowed beat. Score instruments (harp, vibraphone, marimba, pizzicato strings) from a free CC0 library such as VCSL or VSCO 2 CE.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Captions and labels stay above y 950 and inside x 96–1824.
- **Length and structure.** 3–8 min. One chapter per subsystem, in the order energy flows through the machine (source → transmission → control → output), 40–90 s each, then a closing chapter where the whole machine runs. Each chapter opens with a figure line ("FIG. 2 · …") and its system dyeing; the legend at the left gains one row per chapter, so the viewer always sees where they are. Re-hook every 30–60 s with a change the machine itself makes: a part removed and the rest running away, a slow-down to 1/10 or 1/40, a wedge cut into a new part, a switch from side view to plan view for a ratio.
- **The first 10 seconds.** The machine running, cut open, all systems already coloured and the legend on screen. The question by 5 s ("why doesn't it just spin out?"); the promise by 10 s ("by the end you'll know what each colour does"). Then reset to grey for chapter 1.
- **Captions.** Burned in as part of the page (one quiet line, bottom left) and exported as `.srt`.
- **Thumbnail.** The cut-open machine in all its system colours, three-quarter view from above, plus a hero number or at most three words in 150 px Inter, left third.

### Good for

How machines work, mechanical and electromechanical products, engines and drivetrains, physics teaching, engineering explainers.

## 1. Essence, and what it is not

1. **Colour means system.** Three to four flat hues, one per subsystem, plus a neutral for the frame. Colour is never decoration and never per-part.
2. **Outlines in the part's own colour.** Edges are a darker shade of the surface they bound, not black; the result reads as a coloured illustration, not a CAD render.
3. **The machine is true.** Parts are modelled from real profiles (involute gear teeth, real tooth counts) and move by real ratios from one time signal; slow motion slows the whole machine together.
4. **Colour arrives in flow order.** A system takes its hue by a dye front spreading from where energy enters it, so the order of colouring is the explanation.
5. **One red part.** A separate accent marks the single part the story turns on, briefly, and the one control the viewer is asked to watch.

Not **Line-Art Cutaway** (that is monochrome line art with one accent and a still object; here colour is the system and the machine runs). Not **Instruction Manual Art** (no assembly steps or figures). Not **Assembly-Line Diagram** (no flat factory metaphor, no workers). Not a product render (no reflections, no hard shadows, no realistic materials).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Paper | full bleed | `#F3F0EA`, flat; a soft blurred contact shadow under the base only |
| Figure line | x 112, baseline y 118 | Plex Mono 500, 13 px caps, tracking 0.16 em, `#8C867D` |
| Headline | x 112, top y 150 | Inter 650, 62–64 px, line height 1.04, tracking −0.028 em; a 21–22 px grey line under it |
| Machine | right of centre, x 500–1720, y 140–880 | placed by a camera view offset of −150 to −330 px |
| Part labels | 60–200 px from their part, x 140–1780, y 150–820 | leader, dot, name 30 px, line 18 px |
| Legend | x 112, rows from y 670, 80 px apart | 13 px swatch, mono number, 20 px name, 15 px line; a thin arrow between rows |
| Readout panel (optional) | right column x 1404–1804 | rows 400 px wide on 1 px rules, key 18 px, value 30 px mono |
| Caption | x 112, baseline y ≈ 920 | see section 5 |

Left third for words, right two-thirds for the machine. When the camera crosses to the other side, the words cross with it (readout panels go right when the machine sits left).

## 3. Materials and rendering

- **Geometry.** Every part is a 2D profile extruded to its thickness: involute wheels and pinions from module and tooth count, spoke windows cut and rounded, bridges as convex hulls around their bearings, springs as spiral strips. Units are millimetres.
- **Soft cel.** Two tones per colour: the lit tone, and a shade at 80 % with a slight blue lean (×0.80, 0.80, 0.86); the terminator is a short smoothstep, and a faint highlight (+4 %) appears only where light hits straight on. Light from high, left and front, fixed to the world.
- **Outlines.** A post pass over view normals and depth draws edges on the near side of each depth step and on sharp creases; the line colour is the surface colour × 0.52 mixed 28 % toward ink. Contact shadows and guide lines are kept out of the outline pass.
- **Dye front.** Each part group has an origin (where energy enters it) and a radius that grows with ease-out over 0.45–0.7 s; inside the radius the part shows its system colour, with a pale wet rim just behind the front.
- **Wedge cutaway.** Two clipping planes through an axis remove a wedge (118–150°). Cut faces are capped with 45° hatching in the part's own colour (lines at colour × 0.55 on the colour lightened 18 %), computed in world units so the hatch never swims as the camera moves.
- **Shadow.** One soft contact shadow under the base plate (blur ≈ 1.6 mm, warm brown at 20 %); nothing else casts shadows.
- **Screen-space** layers: figure line, headline, legend, readouts, caption. **World-anchored**: labels' anchor points (re-projected every frame), dashed assembly axes, hatching, the shadow.

## 4. Colour logic

- **One hue per system**, mid-saturated and light enough that the darker outline still reads; the neutral frame takes a warm grey.
- **The order of the hues follows the energy**: the source first (warm), the transmission next (cool green), the controller last (blue-violet).
- **Red is a pointer**, not a system: one part at the turn of the story, for a few seconds, then it returns to its system colour; or one control (a slider, a lever) the viewer watches.
- **Before dyeing, everything is neutral.** A chapter about one system shows the others neutral or faded.
- Never coloured: paper, text (ink and greys only, except a label naming the red part), leaders, hatching outside the cut parts.

| Role | Hex |
|---|---|
| Paper | `#F3F0EA` |
| Frame, plates (neutral) | `#DDD8CF` |
| Source / power | `#E6B94F` |
| Transmission | `#79B09F` |
| Control / regulation | `#8A97D4` |
| Pointer accent | `#E8472A` |
| Ink | `#25282D` |
| Greys (text) | `#5E5A54`, `#7A756D`, `#8C867D` |

## 5. Type and captions

- **Inter** (OFL) for headlines, labels and captions; **IBM Plex Mono** (OFL) Medium for figure lines, numbers, units and speed tags.
- **Three levels only.** Primary: one per shot, either the headline or the label of the part being explained (name 30 px Inter 600 ink, an 18 px grey line). Secondary: what was explained before; its name shrinks to 22 px and turns mid grey, its line greys and leaves after about 1.5 s. Tertiary: the figure line and mono tags (19 px). Nothing else.
- **Labels grow out of the part**: the leader draws in 0.3 s (ease-out, 1.25 px, round caps), an 18 px ringed dot pops with a small overshoot at its end, the text slides 12 px and fades in over 0.35 s. A part leaving the frame takes its label with it.
- **Hero number**: Inter 640, 132–150 px, tracking −0.04 em, its unit or "×" at 96 px in grey, a 22 px line under it saying what it counts, then the arithmetic in 15 px mono (the tooth counts behind the ratio).
- **Captions**: one line, Inter 500, 34 px at 1920 (44 px in a reel), ink, no box, fading in 0.15 s; spoken language only. Hold each ≥ max(1.8 s, the spoken line + 0.6 s). Labels never enter the caption band.

## 6. Motion

- 24 fps for YouTube, 30 fps for a reel; smooth, never stepped.
- **One clock.** A speed curve (1 = real time) is keyed and smoothstepped; machine time is its integral, and every part's angle is that time × its ratio. Slow motion, stops and restarts are moves of this curve, so all parts stay meshed. Typical values: 1 (closed), 0.25 (inside, so beats can be counted), 0.025 for one climactic event, 0 for a stop.
- **Explode by system.** Each system lifts to its own height (power lowest, frame stays), the top bridges first, then the controller, transmission and source (starts 0, 0.18, 0.32, 0.42 s; each 1.1 s smoothstep). They land in reverse with ease-in over 0.95 s; the last landing locks the machine.
- **Runaway.** With the controller lifted, the free train spins up along its own curve and stops dead on the lock frame. No easing on that stop: the abruptness is the point.
- **Headlines** rise 14 px and fade in over 0.55 s; when demoted they shrink 15 %.
- **Never moves:** the paper, the light, the figure line once set, the legend's order.

## 7. Camera

A 20° lens, an orbit (elevation, azimuth, distance, target, view offset) on Hermite-spline keys, so moves are continuous through keyframes.

| Move | What it expresses | What it can serve |
|---|---|---|
| Close on the closed machine, pull out (25 → 120 units in 1.4 s) | "this little thing…" | the hook |
| Crane down into the opening (elevation 48° → 22°) | going inside | the cut, chapter starts |
| Skim along the chain (elevation 11–12°, following each mesh) | following the force | transmission, flow order |
| Plan view (elevation 60–65°) | layout, counting | ratios, positions |
| Side view of the stack (elevation 20–22°, slow orbit) | parts on layers | the explode |
| Tight orbit round one part (distance 21–30) | the decisive detail | slow motion, the red part |
| Pull out to the whole (to ≈ 230) | everything together | the ending |

Transitions: long continuous moves, joined by a **hard cut** to a plan view (for a number) and a **match cut** on a matching shape or motion (the lock frame into a close-up of the same part). No dissolves, whip pans, dutch angles, shake or depth of field.

## 8. Sound palette

- **The mechanism is the rhythm section.** One short metallic tick per beat of the controller, panned to where it sits on screen, its rate following the speed curve; softer and duller while the machine is closed; one big tick for the slowed climax.
- **Score** on a grid matched to the machine (here 150 bpm, so real beats fall on eighth notes and quarter-speed beats on half notes): harp in quarter notes over the hook, a vibraphone note on each hard cut, marimba and glockenspiel for each dye, tremolo strings swelling under a runaway and cut dead at the lock, pizzicato cello and contrabass for the bass, a last add9 chord that rings out.
- **Foley.** A metallic swish with a small tink for cuts and lifts; a buzz at the tooth-passing rate plus air for a free-running train, following its speed; a clack when the last part drops in; soft taps as labels land.
- **Silence.** Everything but one low sustain falls away for 2 s before the slowed event; a breath after the lock.
- **Mix.** Narration about 10 dB above music; music ducked under speech and cleared from 300 Hz–4 kHz. Tick transients are sharp: limit them ~5 dB with look-ahead so the master reaches −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Dye in flow order.** Each system takes its colour from the point where energy enters, the front spreading part by part as the camera follows. Fits content like: power through a drivetrain; signal through a circuit; water through a plant.
2. **Wedge cutaway.** A slice of the casing vanishes in 0.6–0.9 s; the cut faces show hatching in the part's colour. Fits content like: inside a closed mechanism; a spring or coil in its housing; a pump chamber.
3. **Explode by system.** Layers lift, one system per height, with dashed axes showing where each sits, then land in reverse. Fits content like: what belongs to which job; why a part sits where it does; the minimum parts that make it work.
4. **Remove the brake.** Lift the controlling part and let the rest run away, then drop it back and stop everything on one frame. Fits content like: what a regulator, valve or governor prevents; failure modes; why a small part matters.
5. **The slowed beat.** The clock slows to 1/40 around one event, the camera tight on it, near-silence, then one big sound. Fits content like: the instant of a click, catch or spark; the decisive step of a cycle; a tolerance.
6. **Ratio from above.** Hard cut to plan view, a hero number, the arithmetic under it, a mono speed tag on each wheel ("1 turn / 40 s"). Fits content like: gear ratios; speed and torque trade-offs; how small inputs become big outputs.
7. **Drag the input.** A slider in red at the bottom left is dragged; the machine and a panel of live readouts (and a small chart with a moving dot) respond. Fits content like: what changes with more load, wind or voltage; a sweet spot; "it stays constant even when…".

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js with a hand-written cel shader (system colour, dye origin and radius, cut planes as uniforms) and a two-pass outline: colour with 4× MSAA, then normals + depth, composited in one full-screen pass. Render at 2× pixel ratio.
- Geometry from profile functions (involute gear, spoke windows with Chaikin rounding, hulls, spirals) extruded in millimetres; one `physics` module holds tooth counts and computes every ratio, speed and readout, so on-screen numbers and motion share one source.
- One timeline module (shots, narration starts, speed keys, cue times, dye list, layer heights, lift order) read by the page, the sound events and the subtitles.
- Labels, headlines, the legend and captions as HTML over the canvas, plus one SVG for leaders; each label re-projects its anchor every frame and is clamped out of the caption band.
- The tick events are found by stepping the integrated machine time in 1 ms steps and writing one cue per beat crossing, with its pan and rate, into `cues.json`.

## 11. Pitfalls

- **Colours that don't mean anything.** A fourth hue for a "nice" part, or two systems in similar hues, destroys the code. Test the palette as a legend first.
- **Black outlines.** They flatten the hues and make it look like CAD.
- **Fake motion.** Gears turning at arbitrary speeds, or slow motion that slows only one part, is noticed. Drive everything from one clock and the real ratios.
- **Dyeing out of order.** If colour appears anywhere other than where energy enters, the explanation reverses.
- **Too many labels.** More than one primary per shot, or secondary labels that never leave.
- **Thin teeth at phone size.** Fine teeth and spokes alias into noise; use larger modules, fewer spokes, and render at 2×.
- **Low camera crossing the words.** When the camera skims low, parts sweep through the headline zone; plan the view offset per key.
- **Ticks too loud.** Sharp transients eat loudness headroom; limit them before mastering.

## 12. Variation space

The agent decides per video: the machine and its true numbers, the systems and their order, which part goes red, which of runaway, slow beat and drag-the-input to spend, the score's grid (matched to the machine's beat), the camera's main side.

- **Three structures:** closed → cut → dye in flow order → break it → fix it → whole; one chapter per system with a growing legend and a finale where all run; a "what if" ladder (more load, less oil, a missing part), each step changing the readouts.
- **Three openings:** the closed machine ticking at real speed, close; the hero number over the plan view with every wheel turning; the machine already running away, unexplained.
- **Three endings:** pull out to the whole machine with the legend complete; the slowed beat returning to real speed and the last tick on the cut; a drafting title block ruled line by line at bottom left over the running machine.
