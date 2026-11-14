# Circuit Board

> The subject is drawn as a printed circuit board seen from straight above: the world is copper under green solder mask, routes are traces, places are pads, words are white silkscreen, and what flows (power, water, signals, goods) is light running along the copper. The camera rides that light and jumps between the scale of a map and the scale of a single component. A 9:16 reel, or a 16:9 video for YouTube, both at 30 fps.
> References (grammar only): real PCB design files and assembly drawings (layers, clearances, designators, detail callouts); macro photography of boards (shallow depth of field, gold sheen, soft key light); schematic and single-line diagrams (one symbol stands for one function). Draw your own boards: never copy a real board layout, a logo or a part marking.

## Formats

### Reel (1080×1920)

- **Layout.** The board bleeds to every edge, straight down, nothing in perspective. Route the main bus top to bottom, so a ride runs up the tall frame with the head low in the safe box (x 72–900, y 269–1248), around y 1000, and the route ahead visible above it. The depth-of-field bands fall over the app's own text at top and bottom; labels plot inside the safe box (title caps ≥ 72 px), picture text above y 1100. The subtitle plate is centred on x 540, at most 720 px wide, baseline near y 1190. Stack, don't shrink: raced routes become parallel vertical buses; a detail callout sits above or below its subject; a map board rides its route rather than showing it whole.
- **The first 3 seconds.** Frame 1 is a locked macro on a gold pad and its via, amber dashes already rocking along the trace into it. By 0.5 s the pad flashes and the camera starts to ride the pulse; by 3 s it rises while following until both ends of the route are in frame and the first value plots in silkscreen.
- **Length and pace.** 25–45 s at 30 fps. Three to five stations, one picture action per spoken line: rides of 2–4 s, crash zooms of 0.3–0.5 s, a locked macro hold for each verdict that lasts its reading time; the rhythm drops out before the verdict.
- **Captions.** A dark translucent plate, one line in the spoken language, an open-licence sans at about 44 px; the board itself prints only key words and numbers in routed silkscreen.
- **Sound.** `latch` on each arrival (the relay's double click), `tick` for the 16th ticks under a ride, `zoom-swish` on whips along a trace, `hook-impact` on a crash zoom, `metallic-riser` into a plunge through a via, `clean-ding` on the verdict pad. The hum-tuned drone, the tremolo and steady tones and the low-passed outside sounds are synthesised or come from a free sample library.

### YouTube (1920×1080)

- **Layout.** The body as written. Keep labels out of the depth-of-field bands and out of the bottom 12 % (the player's controls), lift the subtitle plate's baseline above y 950, and keep title blocks inside the 5 % margins.
- **Length and structure.** 2–6 min at 30 fps. A chapter is one station or one scale (map → building → device → component); its title card is a silk label plotting itself in the dark before the copper lights under it, or the board's title block printing the chapter's name. Re-hook every 30–60 s with a plunge through a via, a pull-out across nested boards, a matched step-down or a timestamp race.
- **The first 10 seconds.** The answer first, a number plotting in silkscreen on a dark board with one pad lit; by 5 s the question as the camera pulls out to the route the number belongs to; by 10 s the promise, the pulse starting at the first pad (we ride it all the way). Any channel sting after that.
- **Captions.** The plate burned in, plus an `.srt`.
- **Thumbnail.** A crash-zoom frame on a lit gold pad, amber streaming in along its trace, one silkscreen value as the words.

### Good for

Energy and grid explainers, supply chains, latency and networking, how a device works, logistics routes, systems explainers on YouTube.

## 1. Essence, and what it is not

- A top-down board in every frame: copper pour with clearances cut around everything, traces with 0/45/90° runs and mitred corners, gold pads and vias, white monoline silkscreen. Nothing is drawn in perspective.
- Information moves as light on copper. The way the light moves *is* the explanation: a pulse, a stream, a rocking dash, a pad that flashes.
- Two scales on one board: whole regions (a map, a supply chain, a city) are drawn in the same language as single components, and the camera passes between them without changing medium.
- Only real things are drawn. Every trace, pad and label stands for something in the subject; empty copper is filled with what boards really have (stitching vias, via fences, solder-mask mottling), never with decorative routing.
- Not **Engineering Briefing Board** (a whiteboard on which real photos are pinned and written over in marker): here there are no photos and no handwriting; the subject itself becomes copper, pads and silkscreen, and information travels as light along the traces. Not **Blueprint** (no white-on-blue linework, no paper), not **Sci-fi Hologram HUD** (no glass, no floating panels, no glowing UI chrome), not a 3D circuit "city" (no buildings rising, no perspective).

## 2. Materials & rendering

Layers bottom-up, all in board space under one world → screen camera:
1. **Laminate (FR-4):** dark green, a glass-weave basket texture in two crossfaded octaves so its on-screen size stays bounded at every zoom. Bottom-layer copper may show through faintly.
2. **Copper pour:** fills the board; everything is a **clearance** punched out of it (channels, lakes, sea, keep-outs around parts and traces). Rendered twice: a lighter rim pass with the plain clearance, then the fill pass with the clearance grown by ~1.6 px, so every copper edge gets a bevelled rim. A soft mottling texture sits only on the pour (solder mask is never perfectly flat).
3. **Traces:** rim colour stroke + narrower fill stroke, round caps; a channel of bare laminate runs on both sides (the clearance). Parallel traces keep the pour out of the gap between them when they are a pair.
4. **Exposed metal:** ENIG-gold pads (rect, round, square pin-1) with a sheen band on the top third and a dark drill hole; vias are gold rings with dark bores; bare copper (salmon with a vertical gradient and brushed streaks) only for one heavy, special part. Fiducials and mounting holes at board corners.
5. **Silkscreen:** off-white monoline strokes with a pinhole texture punched out, slightly blurred (0.35 px). Outlines, designators, polarity marks, component symbols, labels.
6. **Light:** an additive layer (glow) with two blurs (≈24 px and ≈5 px) under a sharp copy. Current, water, lit pads all live here.
7. **Screen space (once per frame):** a soft warm key light drifting from the upper left, shallow depth of field (a blurred copy faded in at the top and bottom bands, stronger in macro shots, weak or off where text must be read), out-of-focus motes of light drifting with parallax in front of the board, a vignette, film grain over the finished frame. A window's light (a soft parallelogram with a mullion shadow) may fall on the board when the whole board is on a desk.

Level of detail: textures crossfade between octaves; small features (vias, designators, rims) fade out before they go sub-pixel, so zooms never shimmer. Nested boards (a module inside a board) are separate boards composited into their footprint, so a continuous zoom can cross six or more orders of magnitude without precision loss.

## 3. Colour logic

- Ground: green solder mask in three values (dark laminate, mid pour, light rim/trace). The video is green; never recolour the mask per scene.
- Metal: gold for pads and vias, one bare-copper accent at most.
- Ink: one off-white for all silkscreen.
- Light carries meaning and is the only saturated colour: **amber** for energy/current (with a near-white core), **silver-cyan** for a second kind of flow (water, data, goods) when the story has two. A third flow gets a third light colour only if it must be told apart; red is reserved for a fault and appears at most once.
- Dark (bare laminate, sea, holes) for what is absent.

Example: laminate #05190F, pour #1C6A44, rim #4AA977, gold #D9B25B, silk #F2EEE1, current (255,190,84), water (170,214,226).

## 4. Type & subtitles

- All type is silkscreen in one **monoline stroke font routed like traces** (0/45/90° strokes, chamfered corners, round caps), drawn in code. Any non-Latin script follows the same rules: every character hand-routed on the 0/45/90° grid with the same stroke width as the Latin beside it, proofed at large size before use.
- Text is world-anchored and **plotted stroke by stroke**; it stays on the board and is still there when the camera pulls back.
- Roles: labels (a name in capitals, with an optional smaller line under it at the same stroke width), board-native text (designators, voltages, timestamps, km, values), micro texture (tags, notes, REV/sheet lines) which may fade below reading size.
- Reading: a label must be fully in frame and stay there for its reading time (≥ 1.5 s plus about 0.3 s per word). Never let text sit in the depth-of-field bands; never cut text at the frame edge in a held shot. Title caps ≥ 60 px at 1080p.
- Moving camera: a label's reading clock starts when it is first fully in frame and stops the first time it leaves, so a label that slides out during a ride or whip fails even if it comes back. Before plotting a label, check where the camera path takes it for its whole reading time: place it where the path keeps it in frame, print it once the camera settles, or let it be micro texture (under ~9 px tall it needs no reading time).
- Glyph coverage: the routed font draws only the characters it has, and a missing character prints as a placeholder with no error. A practical base set is capitals, digits, common signs and the few lowercase letters units need (`a b d e k l m o p s u z` covers ms, km, kV). Check every label string against the font before building, write labels in capitals (or add the lowercase you need), and route what you lack (§10).
- With a voice, every line gets a subtitle in the bottom safe area: a dark translucent plate, one line in the spoken language (an open-licence sans, e.g. Noto Sans, subset to the characters used; never a system font), 34 px at 1080p, at most about ten words. The board then prints only the voice's key words and numbers, never whole sentences. Keep picture text above the subtitle band.

## 5. Motion quality

- 30 fps, everything on ones. The frame depends on `t` only; motion blur from measured screen motion (180° shutter, sub-frames from 1 to ~20), never across a cut.
- Kinds of current, told apart only by how the light moves:
  - **AC / alternating:** short dashes rocking back and forth along the trace (a slowed mains frequency) over a faint energised line.
  - **DC / one-way:** a continuous lit stream behind a travelling head, with slow streaks inside and an afterglow that dims slowly behind the head.
  - **Step-down:** the trace gets thinner and the dashes smaller.
  - **Water / second flow:** several parallel streamlines of moving dashes at different speeds, faster in the middle, with short glints.
- Pads flash on arrival (a quick bright bloom, then a steady glow). Components "conduct": the symbol's internal edges glow while current passes.
- Silkscreen appears only by plotting; copper and pads never pop in. What never moves: the board itself (only the camera moves).

## 6. Camera grammar

Straight-down camera always (rotation about the view axis allowed, small). Moves:

| Move | What it expresses | Can serve |
|---|---|---|
| Ride the pulse (camera locked to a moving head, head on a third) | following one thing through a system | a delivery route; a signal path; a single order through a process |
| Rise while following (zoom out during the ride until both ends are in frame) | the whole length becomes visible | a distance; a supply chain end to end; a timeline |
| Crash zoom onto a pad | arrival, impact | a deadline met; a package delivered; a test result |
| Locked macro hold | reading, comparing, verdict | two numbers side by side; a spec; a rule |
| Whip along a trace | jump to the next station | the next stage; skipping ahead |
| Matched cut on a centred symbol (same symbol, same screen size, the world around it changes scale) | the same step repeated at every level | step-downs; repeated approvals; hand-offs |
| Plunge through a hole / via, reverse out of another hole | entering a smaller world | into a device; into a building; into a file |
| Continuous pull-out across nested boards | everything was one board | the big picture after the detail; the system behind one object |

Framing rules: the lit subject sits on a third or dead centre for symbols; at least two layers of detail around it (background copper/vias/routes, foreground motes or depth-of-field blur); the board edge appears only when the whole board is the subject. Transitions: motion-into-motion and matched cuts; no fades, no wipes, no page turns.

## 7. Sound palette

All synthesised: sine/saw tones, pulse waves, FM bells and glockenspiel, relay clicks (two-click transients), soft kicks and 16th ticks, filtered noise. Tune the drone to the mains hum (50 Hz ≈ G1; 60 Hz ≈ B♭1) so the hum belongs to the key. Rule the ear can follow: an **amplitude-gated tremolo tone = alternating**, a **steady tone = direct**; a component that converts one into the other is heard as the tremolo smoothing into the long tone. Arrivals are relay clicks or a filtered noise burst; a step-down is a relay one step lower each time; plotting silkscreen is a faint scratch of grains. Outside sounds (water, cicadas, traffic) only behind a low-pass, as if heard through a wall. Silence: drop the rhythm before a verdict, keep only long tones. With a voice, the voice leads: duck the bed so it sits 15–18 dB under the speech, effects a few dB. Mix around −16 LUFS before mastering, true peak under −3 dBTP, lean low end (high-pass ≈ 55 Hz); master −14 LUFS.

### Voice-over and subtitles

When the video explains something, a voice tells it and the board shows it at the same moment: each spoken line has one picture action (a pad lights, a stream changes shape, a tag prints). Every line gets a subtitle in the bottom safe area, one line in the spoken language on a dark translucent plate, appearing and leaving with the voice; the board itself prints only the key words and numbers the voice says (a name, a value, a verdict), never whole sentences. Keep the voice on top: the bed sits 15–18 dB under it and rises in the gaps. Pick one calm, clear narrator for the whole video; numbers and units are spoken in full.

## 8. Native moves

- **Flow becomes current.** A second flow (silver) enters a row of pads; each pad lights on a beat and amber leaves on its other side. *Fits content like:* raw material entering a factory and leaving as product; requests hitting servers and leaving as responses; donations becoming grants.
- **Pulse-path explainer.** Every stage of a process is a component on one trace; the way the light changes (rocking, streaming, thinning) tells what each stage does. *Fits content like:* a payment's clearing path; a parcel's sorting hubs; a message across a network.
- **The map is a board.** Geography re-routed octilinear as copper and channels; rivers, lakes and coasts are clearances with via fences; cities are test points; corridors are buses of parallel traces. *Fits content like:* a pipeline across countries; a migration route; the cables under an ocean. Maps follow [directing](../../../references/directing.md#maps).
- **Detail callout.** An assembly-drawing circle that shows another place of the same board (or another board) at a chosen scale next to the thing it is compared with. *Fits content like:* the same mechanism at two sizes; a lab prototype beside the plant; yesterday's version beside today's.
- **Nested boards.** A module footprint on a board is a complete board of its own; plunge into it, or pull out through every level in one move. *Fits content like:* a country → city → building → device; an organisation → team → person; a chip → core → transistor.
- **Matched step-down.** The same symbol held centred while the board around it changes scale on each cut. *Fits content like:* voltage levels; approval tiers; zoom levels of a map.
- **Timestamp tags.** Silk frames printing times at two stations, the second tag repeating the first digit-for-digit above its own. *Fits content like:* latency; a race between two routes; before and after.

## 9. Pitfalls of the medium

- **Flat pour.** A board that is all mid-green reads as an empty slide. Fill with real board texture: stitching vias that stay visible at map scale, fences along every clearance, mottling, micro silk, other unlit routes that exist in the subject.
- **Decorative routing.** Traces that mean nothing make viewers ask what they are. Draw only real routes; texture comes from vias and mask, not invented traces.
- **Lines crossing on one layer.** Two traces can't cross on the same copper: use a via to the bottom layer, or route around. A trace may cross a bare channel (a river, a street).
- **Overexposed light.** Wide traces with additive bloom turn into white bars. Cap glow widths and flash radii in pixels, keep the amber body and a thin core.
- **Text in the blur or under the frame edge.** Depth of field and the vignette eat the top and bottom bands: keep labels out of them, or turn the blur down in reading shots.
- **Too-fast holes.** A plunge into a hole under 0.6 s reads only as "darkness". Hold on the hole first, then plunge; come out of another hole the opposite way.
- **Precision.** Zooming a single coordinate system over many orders of magnitude breaks the canvas transform. Nest boards (each with moderate units) and convert cameras between levels in double precision.
- **Glyphs in a stroke font.** Automatic skeletons of fonts lose dots and merge strokes; route each character by hand. A glyph that only works at small size (a part missing, two strokes merged) reads as another character on a title (O and 0, S and 5, I and 1): proof it large (§10).
- **The board edge by accident.** A renderer that switches to drawing the desk and clips to the board when the view nears the outline will suddenly show black desk in a close shot near the edge. Keep the view well inside the outline (the frame's half-diagonal plus 4 % of the board width), or make the board larger than the shot needs; show the edge only when the whole board is the subject.
- **The app's buttons.** In a reel, a label or plate below y 1248 or right of x 900 sits under the app's text and buttons; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **Canvas 2D, drawn from `t` only**, the layer stack of §2 in board space under one camera: world centre, pixels per unit and a small rotation, plus a helper that builds the camera putting a chosen world point at a chosen screen point (the head on a third). Each board has a typical feature size in world units; it sets where textures change octave and where small features fade. Motion blur averages sub-frames of the same frame function, kept within one shot. Keep every colour in one palette.
- **A board is data.** Its outline and inset; traces as polylines with a width, an optional bottom layer and a measured length on every trace that carries light; pads (round, square or rect, optional hole); labels (text, position, cap height, stroke width, alignment); silk outlines and circles; designators; extra keep-outs; vias, holes and fiducials; test-pad grids; clearances cut **out of the copper** (rivers, lakes, sea, streets, slots: use them only for real gaps); and generators that place via fences and stitching. Routing helpers give octilinear paths through waypoints (diagonal first or straight first), offsets, and sampling, sub-paths and trimming by length. Footprint builders (chip, capacitor, transformer, bridge with its conduction paths, reactor, capacitor bank, ground, tag, box) return pads, silk, keep-outs and anchors.
- **A scene is what the board reads each frame**: each label's plot progress (0–1); AC dash sets (trace, span, alpha, wavelength, amplitude, phase; optionally travelling forward and dying away); DC streams (trace, head, start, alpha, decay, floor, speed, min and max width in px, head glow), both in the current colour; free glows (any polyline, width, alpha, any light colour, with bloom); flashes (point, radius, colour, max px); lit test pads; and an overlay pass after the board, without bloom, for callout circles. A second flow needs no new machinery: each frame cut its measured trace into a head, a fading tail and moving dashes, push them as glows in the second light colour, and flash at the head. A darkening of the whole frame goes between the board stack and the screen-space pass.
- **Nested boards**: each module footprint is its own board with moderate units, composited into the footprint; convert cameras between levels in double precision, and report labels from every level drawn.
- **Lettering**: each glyph is a list of strokes in a 12 × 12 box (y down), each stroke a flat list of points with runs at 0/45/90° only; right-angle corners are chamfered and strokes plot in the order listed, so list them in writing order. A dot is a stroke about one unit long; a hook is a final short 45° run; one stroke width for every glyph. Before building, list every character in labels, designators and silk text that the glyph table lacks: the list must be empty. To add glyphs, make a proof page (each character on its 12 × 12 grid with an open-licence font faintly underneath at a cap of a few hundred px, a second row without it, and once at its size in the video), route by hand, reuse shared parts so they match across the video, and fix until it reads without the reference; if a word still won't read, choose another word.
- **Timing and cues**: lock the voice; each line's one picture action starts on the word that names it, from the voice's word timings. Report every label's on-screen box each frame for the reading check. One cue per visible event in `cues.json`: arrivals, pad flashes, crash zooms, plunges, step-downs, the plotting scratch.

## 11. Variation space

The agent decides the structure, the stations, the scales visited, the camera path, the pacing and which flows get which light. Range:
- Structures: a single packet's round trip and the time it took; three routes raced side by side on parallel buses; one board revealed component by component like an exploded view, ending on the whole.
- Openings: a via drilled through in macro, light rising out of it; a whole board on a desk, the camera diving to one pad; a single silk label plotting itself in the dark, then the copper lighting under it.
- Endings: the last pad lights and the board's power LED stays on; a pull-out to many identical boards in a rack; the title block of the board printing the answer.
