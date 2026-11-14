# Exploded Teardown

> A real product, built from its own engineering files (CAD, PCB layout, bill of materials), lit like a studio packshot and taken apart in front of the camera: the layers lift on one axis, the camera travels between them, every part is named with the numbers its files contain, and it closes again into one object. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): hardware-launch exploded films (layer stagger, orbit timing), repair-guide teardowns (opening order, the macro on the part that matters), engineering drawing (leaders, dimension lines). Never copy their products, layouts, typefaces or music, or name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** An exploded stack is taller than it is wide, so the tall frame suits it: the layers separate upward on the frame's long axis. Keep the stack near x 500 (shift it with a view offset, not by moving the object) and the label column on the left, x 72–360, leaders reaching across; at a macro stop the label sits above or below the part. Everything that must be read stays inside x 72–900, y 269–1248, including dimension text drawn on the object; parts may run under the app's buttons, the part that matters never. The subtitle strip is centred on x 540, at most 720 px wide, bottom above y 1240. The orbit turns about the vertical axis; two revisions alternate rather than sit side by side.
- **The first 3 seconds.** Frame 1 is a grazing macro of a part performing its real motion (a key mid-stroke, a hinge, a latch). By 0.5 s the camera rises and the first layer lifts; by 3 s the stack hangs apart and a leader lands on the hidden part with its one number.
- **Length and pace.** 25–45 s: one orbit with one or two stops inside (about 3 s each), separations of 1.5–2 s staggered 0.15–0.2 s, closing about 1 s per layer, two near-silences, the last seconds held on the dimensions.
- **Captions.** The subtitle strip, in the language spoken; labels carry the specs.
- **Sound.** `zoom-swish` for layers lifting and camera dives, `tick` for each label, `thock` for a key or the enclosure landing, `latch` as the last layer seats, `shimmer` when the lights come on inside. Material foley (plastic clacks, board taps, machined-metal rings) and the mallet score (marimba, vibraphone, glass) come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Sections 2 and 6 as written: the product on one side, the label column on the free side. The subtitle strip moves up to sit just above y 950 (the player's controls cover the bottom 12 %); labels and dimension text stay inside the 5 % margins.
- **Length and structure.** 3–6 min as a guided teardown: each chapter is one layer or subsystem (40–90 s), titled by a card in the label grammar ("02 · MAIN BOARD", a mono spec line); the camera rises or dives to it, it lifts, the stop inside names its parts, one real motion, then on through the object. Re-hook every 30–60 s: a layer lifting, inside the gap, lights on inside, a dimension drawn, a signal followed through the layers. Close bottom-first with the dimensions drawn on it, held. 24 fps.
- **The first 10 seconds.** The product fully apart, every layer floating and lit, first; the question by 5 s; the promise ("every part, with its real numbers") by 10 s. A channel sting comes after that.
- **Captions.** The strip burned in, plus an `.srt`.
- **Thumbnail.** The exploded stack mid-air with one accent leader on the part that matters, up to three words.

### Good for

Hardware launches, product pages and spec explainers, open-hardware showcases, repairability stories, "what's inside" videos.

## 1. Essence, and what it is not

A frame reads as this style when:

- **the object is real and exact**: geometry, positions and counts come from the product's own files (STEP, KiCad, BOM, assembly guide). Nothing is eyeballed that a file can give;
- **it is shown apart**: layers float on one axis with even, readable gaps, each still oriented as it sits in the product;
- **it is photographed, not drawn**: physically based materials, a studio key light, a cool rim, an HDRI reflection, soft contact shadow on an invisible floor;
- **the numbers live on the object**: thin leader lines from a dot on the part, dimension lines with ticks drawn in the scene's own perspective, never a table beside it;
- **the camera never stops travelling**: one or a few continuous moves, orbit outside, macro inside.

It is not a glass product render (one object, material beauty, no disassembly), not a blueprint (line drawing on a grid, no light), not a keynote (slides, headline type, a stage), not an assembly manual (step numbers, arrows, hands).

## 2. Materials & rendering

- Real-time PBR (three.js `MeshPhysicalMaterial`) at 2× and downsampled, ambient occlusion, a depth of field with one aperture for wide and macro (blur follows 1/focus − 1/z, so it grows as the camera comes close), a high-threshold bloom for emitters only, a vignette.
- Each material keeps its character: plastics with soft sheen (roughness 0.55–0.7), boards with a thin clearcoat and traces as a raised, lighter relief under the mask, metallic pads, tight highlights on machined metal, matte rubber.
- **Boards are painted from their layout files**: copper pours, every trace, via, pad and drill, silkscreen, on both sides, at 14–20 px per millimetre, with roughness, metalness and bump maps from the same drawing. Components stand at their footprint positions with their package sizes.
- Light: a warm key from above front, a cool rectangular rim behind that follows the camera so edges separate from the ground, a soft top light, a low HDRI for reflections; a practical fill only where the camera goes inside.
- Background: a dark graphite seamless sweep (screen-space radial gradient), floor visible only as soft shadow.
- Effects anchored to the world (leaders, dimension lines, glows) are projected from 3D points every frame; only subtitles and title cards live in screen space.

**Where the geometry comes from.** For the user's own product, ask for its STEP / IGES / KiCad / other CAD exports, BOM and spec sheet before anything else. For a public product, look for open hardware (GitHub, GitLab, OSHWA certification list, Hackaday.io, Printables/Thingiverse sources with the original CAD) and component datasheets from the maker. CC0, public domain, CC BY and MIT are fine with credit; CERN-OHL (-P, -W, -S), CC BY-SA, GPL hardware and "no known restrictions" are not the same thing: name the terms to the user and ask before using them. Without files, build only from published dimensions (datasheet, spec page), say on screen or in the voice that it is a model, and show no number you could not source. Never stand in a generated image for the real part.

Keep a facts file in the project folder (claim, source URL, quoted wording, or the measurement method for anything measured from the CAD) and deliver it with the video.

## 3. Colour logic

- The product brings its own colours; the frame around it is neutral and dark, so the product is always the brightest, most saturated thing.
- Interface ink is one warm white at two strengths (names at full, specs at about 60 %), plus **one accent** reserved for measured things: dimension lines, label indices and one matching detail on the product itself.
- Values are ordered: ground darkest, product mid to light, labels lightest. Never put text on a busy, bright part without a dark backing.
- Example: ground #34363a → #0d0e10, ink #f1efe9, accent #ff6b3d.

## 4. Type & subtitles

- Names: a clean sans at medium weight (28–32 px, about 40 px in a reel; e.g. Inter 500). Specs and numbers: a monospaced face (15–22 px, about 26–30 px in a reel; JetBrains Mono) so digits line up and read as measurement. The same neutral grotesque for running text.
- Label structure is fixed: a two-digit index in the accent, the name, one spec line. Units always written (mm, MB, ×n for counts). A label carries at most one fact the voice does not say.
- Dimension text sits on a small dark plate, follows the line's angle and is never upside down.
- Subtitles: one language, the one spoken, in a centred strip low in the frame with a soft shadow and no box. Hold every cue ≥ max(1.8 s, speech + 0.6 s); every label stays fully in frame for characters ÷ 15 + 1.5 s.

## 5. Motion quality

- 24 fps on ones; everything is smooth and deterministic.
- **Separation**: smooth start, fast middle, long settle (ease-in-out cubed); layers leave top first, 0.15–0.2 s apart; repeated parts (keys, screws) fan out in a wave ordered by distance from a corner.
- **Closing**: bottom first, quicker (about 1 s per layer), the last layer lands with a real mechanical response (a key travels its stroke and returns; nothing bounces like rubber unless it is rubber).
- While held apart, layers may float a millimetre or two with offset phases; during macro shots they hold perfectly still.
- Labels draw in (anchor dot, leader growing, text sliding 10 px) and fade out before the parts move again.
- Never moves: the floor, the light rig's relation to the camera, the label column's x position.

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| Orbit while layers separate | the whole, its order of assembly | a reveal; a structure overview |
| Grazing macro dolly | touch, material, finish | an opening; a texture |
| Dive between layers | being inside | a hidden component; how it works |
| Slow push on one still part | the part that matters | a chip, a sensor, a seal |
| Rise through the stack | one subsystem to the next | a transition between stops |
| Fast pull back | return, synthesis | a closing; a before/after |
| High three-quarter drift | scale and precision | sizes, pitch, thickness |

- At key moments the subject fills at least a third of the frame height. Labels live in a column on the free side (shift the projection with a view offset rather than moving the object), subtitles low in the frame, just above the bottom 12 % that the player's controls cover.
- Transitions are camera moves through the object itself. No cuts to black, no slide transitions, no split screens.
- The camera path is keyed in the product's own coordinates and interpolated without overshoot (monotone cubic), so a held macro really holds.

## 7. Sound palette

- Instruments: tuned mallets (marimba, vibraphone, glockenspiel, glass), a round bass, a short synthetic kick and small dry percussion. Precise and dry outside the object; sustained and airy inside it.
- Foley is the material: hollow plastic clacks for keycaps or housings, a switch click with a low thock, dry taps for boards, inharmonic rings for small machined metal, a soft thud for the enclosure, airy swooshes for layers lifting and for camera dives, a fine pen hiss when a dimension line draws, a tiny tick per label.
- Every separation and every landing has its sound, panned to where the part is.
- Silence: at least two near-silences (room tone only) before the big separations or the turn back; the first sound after each is the most important hit around it.
- Mix: voice clearly on top (music about 10 dB under it while it speaks), music bus ducked, sub-bass kept lean (20–60 Hz well under the full band), master −14 LUFS.
- Voice: one calm, close narrator, unhurried, short sentences; numbers spoken as words, written as digits.

## 8. Native moves

- **The wave lift.** Repeated parts rise in a wave across the object. *Fits content like:* battery cells; solar tiles; the drawers of a modular shelf.
- **Inside the gap.** The camera enters the space between two lifted layers to see a hidden face. *Fits content like:* the back of a logic board; the inside of a drone arm; the underside of a sensor module.
- **The leader that lands on the part.** A macro label whose line ends on the component. *Fits content like:* a pressure sensor in a shoe; a gasket in a waterproof case; a motor driver.
- **Dimensions drawn on the thing.** After closing, the real outline gets dimension lines in perspective. *Fits content like:* the thickness of a laptop lid; the footprint of a router; the bore of a valve.
- **One real motion.** A part performs its true mechanical motion once (a press, a hinge, a latch). *Fits content like:* a camera shutter; a buckle; a folding hinge.
- **Lights on inside.** Emitters inside the product switch on while it is apart. *Fits content like:* status LEDs; a backlit display; an indicator ring.

## 9. Pitfalls of the medium

- **Invented numbers.** A size that no file gives. Fix: measure it from the CAD and say "measured" in the facts file, or leave it out.
- **Mixed-up revisions.** Plates, cases and boards from different versions of a project. Fix: check hole positions and stack heights across the files (they must coincide), and pin the commit.
- **Panelised boards.** Layout files may hold a panel with breakaway tabs. Fix: take the outline from a plate or case of the same revision, or flood-fill from an interior point.
- **Zero-length edges.** Duplicate outline points give zero normals → NaN → black squares after bloom. Fix: clean outlines, repair zero normals, scan frames for one-frame black tiles.
- **Overshooting camera splines.** Catmull-Rom over unevenly spaced keys flies past a macro stop. Fix: monotone interpolation per component.
- **Labels too short.** Macro stops last about three seconds. Fix: one fact per label, opened before the camera settles; check every label's time fully in frame against the reading rule.
- **Over-bright light sweeps.** Area lights blow plastics to white. Fix: sweeps at a fraction of the key, bloom threshold above the brightest diffuse surface.
- **Brand marks on parts.** Chip tops and connector shells carry trademarks. Fix: plain package tops; drop logo footprints unless the product is the user's own.
- **Crushed blacks.** Black plastics against a black ground disappear. Fix: lift them to a dark grey and let the rim light separate them.
- **No free side in a reel.** A 16:9 label column has nowhere to go on a phone. Fix: a narrow left column with the stack offset right, or labels above and below at macro stops, all inside the safe box.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **three.js, vendored and pinned, drawn from `t`**: physical materials, rendered at 2× and downsampled through a post chain of ambient occlusion, depth of field (one aperture; blur from |1/focus − 1/z|), a high-threshold bloom for emitters and a vignette. A studio HDRI (Poly Haven, CC0) for reflections; tell the user before downloading it.
- **Geometry from files**: parse the `.kicad_pcb` s-expressions in plain Python (outlines, tracks, zones, pads, silkscreen, footprints) into JSON; triangulate STEP files with `occt-import-js` (npm, LGPL-2.1), installed into a private `node_modules` in the project folder. Outlines with holes and circles become extrusions; parametric parts cover the rest (a keycap as a lofted shell with a spherical dish and a stem, switches, hex spacers, screws).
- **Boards painted from the layout data**: per side, colour, roughness/metalness and bump maps at 14–20 px/mm; package bodies placed at footprint positions, each returning an anchor point for its label.
- **An overlay projected every frame**: anchored labels, perspective dimension lines, subtitles and the title card, with a width check that no subtitle line overruns its strip. Layers move by explode and gap functions of `t`; the camera is keyed as orbit or eye/target in product coordinates and interpolated monotone per component. Minimal example: one plate outline extruded 1.5 mm as aluminium (metalness 1, roughness 0.35), orbited with three camera keys.
- **Timing and cues**: a layer lifts, a stop opens or a label lands on the word that names it; macro stops are long enough for their label. Cues in `cues.json`: every separation and landing (panned to its part), each label tick, dives, the lights coming on, the last layer seating.

## 11. Variation space

Decided per video: which product and revision, which layers to separate and in what order, how many stops inside and which parts deserve them, the camera route, whether to open from the whole or from a detail, the product's palette and the accent, the voice.

- **Three structures**: one orbit with two stops; a "how it works" path following a signal or flow through the layers; two revisions taken apart side by side, each held still before a difference is named.
- **Three openings**: a part performing its real motion in macro; the closed product turning in silence on the seamless; a single component floating alone before the rest of the product assembles around it.
- **Three endings**: closed with its dimensions drawn on it; closing into a top view that becomes a technical drawing; apart one last time, frozen, every part labelled like a printable sheet.
