# Line-Art Cutaway

> A real 3D object, built in code to its true dimensions, drawn as engineering line art on graph paper: grey tone, three line weights, hatched cut faces, and one orange part that carries the explanation. The object is cut, exploded and dived into while labels trace themselves onto the sheet. A 9:16 reel, or a 16:9 how-it-works video for YouTube.
> References (grammar only): drafting standards (45° section hatching, dimension lines, the corner title block); service-manual exploded views (parts lifted along their assembly axis on dashed guides); Stephen Biesty's cross-sections (one object opened to show the order of its insides); patent drawings (line weight as the only shading). Never copy their drawings, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The sheet bleeds to all edges; the grid keeps its 40 px pitch. The object is centred on x 540 and fills the middle band; it may run off the sides, but every label it needs sits inside x 72–900, y 269–1248. The camera rises so the explode axis reads vertically: layers stack up the screen instead of spreading sideways.

| Zone | Position | Content |
|---|---|---|
| Headline | x 72, first baseline y 360, 72 px, at most two lines | the question or the answer; one orange word |
| Object | centred x 540, main body y 520–1180 | may bleed left, right and below |
| Callouts | inside x 96–880, name 34 px, spec 24 px | at most two at once; leaders may run to parts outside the box |
| Inset (magnifier) | circle centred x 540, y 470, radius ≤ 190 | replaces the headline while it is open |
| Caption strip | centred on x 540, ≤ 720 px wide, last baseline y ≈ 1210 | one or two lines of 44 px |

- **The first 3 seconds.** Frame 1 is the closed object already traced, the dashed section plane a third of the way across with hatched cut faces behind it. By 0.5 s the plane has visibly moved; by 2 s the question wipes in with its orange word; by 3 s the first layer lifts.
- **Length and pace.** 25–45 s. One explode and one dive per reel, a new callout every 1.5–2.5 s, one held beat (1.5 s, no new marks) after the answer.
- **Captions.** The caption strip is the only caption layer; callouts are labels, not captions.
- **Sound.** `typing-tick` under every text wipe; `tick` on each callout's anchor dot; `latch` as each exploded layer seats; `ratchet` under a dimension line drawing out; `zoom-swish` into the dive; `clean-ding` when the orange part lights up. Score (vibraphone, glockenspiel, harp, pizzicato bass) from a free CC0 library such as VSCO 2 CE or VCSL.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Must-read text stays inside x 96–1824 and above y 950; the caption strip moves up to sit on y 836–930, and the object stays above y 820 while a caption is on.
- **Length and structure.** 3–8 min, one chapter per subsystem (40–90 s each). Every chapter opens with a new way into the object: a section plane on a different axis, an explode of another group, or a dive through a gap to a new scale. That opening is the re-hook, so one lands every 30–60 s by construction. Each chapter ends with its group reassembling and one summary callout in orange. Chapter cards are drafting title blocks drawn cell by cell top left (heavy outer frame, then inner rules, then text); the description's chapter titles match them.
- **The first 10 seconds.** The object already exploded at three-quarter angle, the orange part lit and pulsing; the question wipes in by 5 s ("where does X actually happen?"); the promise by 10 s ("by the end you'll be able to point to it"). Any title block comes after.
- **Captions.** The caption strip is part of the sheet: burn it in, and export the same lines as `.srt`.
- **Thumbnail.** The exploded view, large and right of centre, orange part lit, the grid visible, at most three words in 150 px Plex Sans 600 on the left with one word orange.

### Good for

Hardware teardowns, how a device works, product engineering explainers, repair and design-flaw stories, science and engineering teaching.

## 1. Essence, and what it is not

1. **A true object, drawn as a drawing.** A 3D model at real millimetre dimensions, but the screen never shows a render: only paper-white tone and traced ink.
2. **Line weight is the only shading.** Silhouette heaviest, edges between overlapping layers lighter, creases and small details thinnest and grey. Tone across a surface varies by at most 18 %.
3. **One orange part.** Everything is grey except the part the video is about and the signal, flow or energy it carries.
4. **The drafting kit as motion graphics.** Section planes, hatching, dashed guides, dimension lines, magnifier circles and a title block, each drawn on, never faded in.
5. **The sheet never moves.** The camera orbits, pushes and dives; the graph paper stays put like a sheet on a desk.

Not **Blueprint** (white line drawn stroke by stroke on blue paper; here a 3D model is traced live on off-white graph paper and cut open by the camera). Not **Color-Coded Mechanism** (there, several systems each wear a flat colour and the mechanism runs; here the object is still, opened, and only one part is coloured). Not **Instruction Manual Art** (no people telling a story in steps, no numbered page panels, no isometric figures). Not **Assembly-Line Diagram** (no flat factory cartoon, no workers, no process conveyor). Not a product render (no materials, reflections, depth of field or studio light).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Sheet | full bleed | paper `#f6f5f0`, 1 px grid every 40 px at 4 % ink, 11 px registration crosses every 200 px at 15 % ink |
| Object | right of centre, roughly x 580–1600, y 80–900 | placed by a camera view offset of −300 to −440 px so the left third stays clear |
| Headline | x 110, baselines y 300–404 | Plex Sans 600, 54–64 px, two lines, one orange word; a smaller second line under it at 38 px in graphite |
| Hero number (optional) | x 112, baseline y 520 | Plex Mono 500, 150 px, tracking −4, a 2 px rule 340 px long under it |
| Callouts | beside their part, 60–230 px away | anchor dot, leader with one knee, name 21–26 px Plex Sans 600, spec 15–18 px Plex Mono |
| Inset | circle centred x 330, y 360, radius ≤ 150 | a second camera on the detail, linked to it by a dashed line |
| Small print | right-aligned to x 1824, baseline y 60 | 12 px Plex Mono, tracking 1.6, faint: scale, units, "illustrative" |
| Caption strip | x 96, y 836–930 | see section 5 |

Headline and inset share the left third, never at once. Callouts sit on the side facing open paper; leaders never cross each other or a silhouette.

## 3. Materials and rendering

- **The model.** Extrusions, rounded boxes and lathed profiles at real millimetre sizes, each assembly a layer group that can lift along one axis. Every layer has real thickness (≥ 0.3 mm) and real gaps; the tracer needs depth differences to find edges.
- **Tone.** One flat shader: base grey × (0.82 + 0.18 × Lambert), light high, left and front. Base greys from near-white (`#fbfbf9`, `#f6f6f3`) for covers, light metal (`#ededea`), mid (`#9a9a97`) to dark (`#3e3e3d`) for dense parts. No specular, shadows or ambient occlusion.
- **Ink.** A full-screen pass over normal and linear-depth buffers finds three kinds of edge: silhouette (where coverage changes, ≈ 2 px, ink grey 8 %), occlusion (a jump in depth between layers, ≈ 1.5 px, 11 %), crease (a sharp change in surface normal, ≈ 1 px, 25 %, drawn at 78 % strength). A secondary figure, such as a hand, is traced lighter and thinner still so it never competes with the object.
- **Section faces.** Where a clipping plane cuts the model, the back faces show as 45° hatching with a 10 px period. The hatch is screen-anchored, as on a drawing sheet: it does not rotate with the object. A lighter hatch marks non-metal breaks.
- **Guides.** Dashed assembly lines (dash 1.6, gap 1.2 world mm, `#8f8e8a`) run along the explode axis and grow as the layers lift; they are world-anchored and turn with the object.
- **Labels and insets** live on a 2D layer above the traced model, anchored each frame to projected 3D points.
- **Clean edges.** 2× supersampling and 8 sub-pixel jitter passes per frame, averaged; their tiny time offsets span 0.12 of a frame, for anti-aliasing only, never motion blur.

## 4. Colour logic

- The sheet is warm off-white; all drawing is in neutral greys from ink to faint.
- **Orange is the story.** Only the subject part, its leaders and labels, the path energy or fluid takes, and radiation arcs. If the answer moves to another part, the first drains back to grey before the second lights.
- **Lit paths flow** as a front with a bright head (orange mixed 60 % toward `#ffb88c`), never switching on all at once.
- Never coloured: the sheet, the grid, hatching, guides, dimension lines, any secondary figure, body text.

| Role | Hex |
|---|---|
| Paper | `#f6f5f0` |
| Ink (lines, headline) | `#141414` |
| Graphite (secondary text) | `#5a5955` |
| Faint (small print, guides) | `#8a8984` / `#8f8e8a` |
| Hatch ground / hatch line | `#e0e0dc` / `#8f8f8b` |
| Accent | `#ff4d1a` |

## 5. Type and captions

- **IBM Plex Sans** (OFL) for headlines and callout names, weight 600, caps with 0.5–1.4 px tracking. **IBM Plex Mono** (OFL) for specs, measurements, small print and the hero number. Nothing else.
- Roles at 1920: headline 54–64 px; second headline line 38 px; callout name 21–26 px; spec 15–18 px; dimension text 18 px on a paper patch; small print 12–13 px with 1.6–2.4 px tracking.
- **Text is written, not faded.** Every line wipes in left to right (a clip edge with ease-out, 0.3–0.5 s) and leaves the same way. Callouts: the leader grows in 0.35 s, the anchor dot pops (back ease), the name wipes from 0.18 s, the spec from 0.3 s.
- **Caption strip.** One line, Plex Sans 500, 36 px at 1920 (44 px in a reel), ink on an 88 % paper panel with a 3 px ink rule on its left edge, fading in and out over 0.12 s. Captions are in the spoken language only. Hold each ≥ max(1.8 s, the spoken line + 0.6 s); split a sentence rather than wrap it.
- Numbers in mono with their unit; a measurement that is approximate says so in the small print.

## 6. Motion

- 24 fps for YouTube, 30 fps for a reel; motion is smooth, never stepped, and lines never boil or wobble.
- **Easing.** Ease-in-out for anything mechanical (layers, the section plane, the camera), ease-out for things drawn on (leaders, rules, text wipes), a back ease (overshoot ≈ 2.2) only for small pops (badges, anchor dots).
- **Explode.** Layers lift one after another, 0.17 s apart, each over 1.05 s; each reaches rest at 78 % of its time, then settles with a 2.5 % overshoot. Reassembly runs in reverse order, 0.12 s apart, 0.75 s each, with a seat sound per layer.
- **Section plane.** A dashed rectangle labelled SECTION sweeps across the object in about 1.4 s; behind it the model is clipped away.
- **Flows.** Orange runs along its path, brisk at the start and soft on arrival; three arcs (radius 26 → 116 px, ±45°) pulse out from an active part and fade as they grow; a ping ring expands 6 → 40 px in 0.7 s.
- **Weight.** Large assemblies take ≥ 0.9 s; small parts and labels 0.3–0.5 s.
- **Never moves:** the sheet, the grid, the small print, a title block once drawn.

## 7. Camera

A long lens (field of view 15–22°), so the object reads almost like an axonometric drawing. The camera is an orbit (azimuth, elevation, distance) around a target, with distance interpolated in log space so pushes feel even.

| Move | What it expresses | What it can serve |
|---|---|---|
| Slow orbit (8–15° over 8 s) | "look at it properly" | the opening, a held explanation |
| Push to a part (distance −40 %) | attention | a callout, the answer |
| Tip to plan view (elevation 85–88°) | "here is the layout" | positions, segments, measurements |
| Dive through a gap (distance ÷ 500 in 4–5 s) | going inside | a change of scale, a chapter turn |
| Pull back to the opening angle | the whole again | reassembly, the ending, a loop |
| Magnifier inset | detail without losing context | a tiny part while the whole stays on screen |

Transitions: one continuous camera by default. The only cut is **through the material**: the dive ends with the frame filling with hatching, then a round iris opens from the point you entered (radius growing to 2300 px with ease-in over 0.75 s, a 2 px ink ring on its edge) into the next view. Never dissolves, whip pans, spins, shake, depth of field or motion blur.

## 8. Sound palette

- **Score.** 96 bpm (a bar is 2.5 s), a minor key that turns to its relative major on the answer. Vibraphone (soft mallets for the opening, bowed for beds), glockenspiel for reveals and falling three-note phrases, harp sweeps for a part lighting up, pizzicato or upright bass. A bed of very fine plotter-like ticks, densest during explodes, gone in the silences.
- **Two near-silences.** After the problem is shown (2–3 s, one low bowed note), and before the final demonstration. The first sound after each is a key one.
- **Foley from the drafting kit.** Rising band-passed noise for the section plane; very light ticks for every text wipe; a soft lift and a seat click per layer; a ping where something starts; a zip panned with a flow; a hiss brightening through a dive; a paper swipe and low thud for the iris; fine ratchet ticks as a dimension line draws out; an upward glide and bright ding when the accent lights, a downward glide when it drains; one beep per step of a level indicator.
- **Mix.** Narration about 10 dB above music and foley; the music carves 300 Hz–4 kHz by about 5 dB and ducks another 4 dB under speech. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Section sweep.** A dashed plane crosses the closed object; cut faces appear hatched behind it. Build: a clipping plane driven by `t`, back faces as screen-space hatch, the plane's outline on the 2D layer. Fits content like: what is inside a sealed product; why a shell is thicker in one place; the layers of a material.
2. **Staggered explode with guides.** Layers lift along one axis with dashed guides growing beside them, then settle. Build: per-layer offset = settle(progress of layer k from start + k·0.17 s over 1.05 s) × gap. Fits content like: what a device is made of; assembly order; which part carries the load.
3. **The path lights up.** Orange runs from source to destination along a part, head first. Build: a 0–1 parameter per vertex along the path; the shader colours vertices below the current value. Fits content like: where a signal, current or fluid goes; heat flow; the route a force takes.
4. **Dive through the material.** The camera pushes into a gap until hatching fills the frame, then an iris opens into a view at a new scale. Fits content like: from the object to one component; from outside into a chamber; a YouTube chapter change.
5. **Magnifier.** A small ring on the main view, a dashed line to a large circle where a second camera shows the detail. Fits content like: a seal, a contact, a slot; a part too small to read; a tolerance.
6. **True-scale dimension.** A dimension line grows from its middle to its arrowheads, ticks every 5 mm, the value in mono on a paper patch, at the model's real size. Fits content like: why a part has this length; comparing two sizes; "it's only this big".
7. **Light trace.** At the end an orange glint runs once round the subject part's edge. Fits content like: a closing summary; a loop to the first frame; your app's hardware in its best light.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js on three stacked canvases: paper and grid (screen-space), the traced model, and a 2D overlay for labels, insets and captions. `data-no-timeline`; every frame is a pure function of `t`.
- One shader with two modes, tone and normal + linear depth, rendered into float targets at 2× size; an edge pass with silhouette, occlusion and crease weights as uniforms; downsample; accumulate 8 jittered passes from a fixed offset table (4 for long YouTube renders).
- One beat table of start and end times keyed to narration words drives layer offsets, clipping, the path parameter, camera keyframes and the events exported to `cues.json`.
- Camera keyframes `[t, azimuth, elevation, ln(distance), target xyz, view offset]`, eased in and out; the view offset keeps the object right of centre without moving the sheet.
- Labels re-project their 3D anchors every frame; a text wipe is a clip rectangle whose right edge follows ease-out progress.

## 11. Pitfalls

- **Flickering lines.** Coplanar faces, zero-thickness parts and tiny gaps make the tracer flash. Give everything thickness, offset coincident surfaces, keep the jitter passes.
- **Line noise at phone size.** Fine bevels, dense curve segments and tiny parts become grey fuzz. Simplify small parts, hide those under ~6 px, judge every shot at final size.
- **Two accents.** A second colour, or orange as decoration, kills the read.
- **A wide lens.** Above about 30° the object distorts and looks like a game render.
- **A sheet that moves.** If the grid pans or scales with the camera, it stops being paper.
- **Label clutter.** More than three callouts at once, crossing leaders, labels over the object.
- **False precision.** Dimensions on screen are true, or the small print says the layout is illustrative.
- **Render cost.** Sixteen draws per frame (two modes × eight passes); render YouTube videos chapter by chapter.
- **Drifting labels.** Callouts move with the camera; check each across its whole life against the reel's safe box and YouTube's bottom 12 %.

## 12. Variation space

The agent decides per video: the object and its true dimensions, which part is orange, which tools appear (section, explode, dive, magnifier, dimension), the main camera angle, the music's key, the headline wording.

- **Three structures:** a symptom → open it → the part that explains it → close it and show it working; one continuous dive from the outside to the smallest part and back out; two designs side by side on one sheet, exploded together, with the difference in orange.
- **Three openings:** the section plane already crossing the closed object; the object hanging mid-explode with one part lit; a hero number traced in mono beside the closed object, its rule drawing under it.
- **Three endings:** reassembly in reverse with a light trace round the part; the title block drawn cell by cell in the corner; a pull back to the exact opening angle so the video loops.
