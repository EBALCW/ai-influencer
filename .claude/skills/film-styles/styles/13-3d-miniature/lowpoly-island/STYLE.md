# Low-poly Isometric Island

> A tiny faceted world seen through an orthographic isometric lens: everything is a geometric block, and everything that appears arrives with a bounce and a note. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): town-building toy games (building is the performance; every piece lands with a springy bounce and a sound; pieces sprout small details by themselves); pastel isometric puzzle games (isometric geometry, soft pastel palettes, gradient skies, calm pacing, lots of empty space). Never copy their grids, buildings, characters, UI or typography, and never name them on screen.

## Formats

### Reel (1080×1920)

- **Layout.** Sky gradient and sea bleed to every edge. The horizonless sky band fills the top of the tall frame, so the world sits low-centre, around y 600–1150, inside the safe box (x 72–900, y 269–1248). The frustum's width (height × 9/16) is what must hold the world. Subtitles are centred on x 540, at most 720 px wide, baseline near y 1190, the tile icon to their left; titles rise from a water line inside the safe box. Stack, don't shrink: choose tall worlds (a hill town, a mesa, a lighthouse, a tower of floors) and a higher elevation (35–50°) so more ground fits vertically; run a list of tiles up the screen and crane along it instead of trucking sideways; two worlds side by side become one above the other.
- **The first 3 seconds.** Frame 1 is mid-construction, a busy half-built world with a tile already breaking the water surface. By 0.5 s it settles with a splash and its note, and two more pieces drop on eighths; by 3 s growth has doubled in density and a melody is forming: the viewer stays to hear it finish.
- **Length and pace.** 20–40 s at 30 fps on ones. One piece per smallest slot, density accelerating; wide and close intercut on beats every 2–4 s; one drop to a drone before the big downbeat.
- **Captions.** No box: warm white Quicksand 600 at about 48 px with a soft dark-blue shadow, in the spoken language; the tile icon's top follows the time of day.
- **Sound.** `ui-pop` as trees and lamps pop, `thock` as floors and roofs land, `clean-ding` for the world's one-note motif, `sparkle` as lights come on in the dark, `shimmer` under a time-of-day sweep. The event-driven mallet score is synthesised from the growth events or taken from a free sample library, with water, splash and bird beds from the same library.

### YouTube (1920×1080)

- **Layout.** The body as written. Keep subtitles above the bottom 12 % (the player's controls) and titles inside the 5 % margins; a text card still leaves a gap where the world shows.
- **Length and structure.** 2–6 min at 24 fps. A chapter is one stage of growth, or one time of day or season; its title card is the chapter's name rising letter by letter from under the water line, overshooting and settling. Re-hook every 30–60 s with a time-of-day change, a scale zoom, a turntable, lights in the dark, or a sweep that replays the world's melody.
- **The first 10 seconds.** The finished world first, at dusk with its lights on; by 5 s the question, as it sinks back to a single tile (how did it grow from this?); by 10 s the promise, the first tile rising with its note. Any channel sting after that.
- **Captions.** Burned in as part of the look, plus an `.srt`.
- **Thumbnail.** The finished world in the isometric 3/4 wide at night, warm windows against blue-violet; at most three words in wide-tracked caps.

### Good for

Game trailers and world building, calm and ambient content, growth stories (a startup's year, a town), seasons and time-of-day explainers, process explainers, relaxing build videos on YouTube.

## 1. Essence, and what it is not

A miniature world built from **flat-shaded low-poly geometry** (hexagonal tile columns, box buildings with prism roofs, cone and icosahedron trees) floating in a faceted sea or void, watched by an **orthographic camera** at an isometric angle. No perspective and no horizon: distance dissolves into a **screen-space sky gradient**, so the world looks like a model suspended in colour. **Light, not texture, tells time**: every facet changes colour as the sun moves; in the dark only emissive blocks keep their colour.

Not a voxel game (no cubes-of-cubes, no pixel texture), not **Tilt-Shift Miniature** (no perspective, no photo detail), not a smooth-shaded 3D cartoon (no rounded normals, no subsurface).

## 2. Materials & rendering

- **Geometry** (world unit = one hex tile's circumradius): pointy-top hexagonal columns (`CylinderGeometry(r, r, h, 6)`), axial → world `x = √3(q + r/2)`, `z = 1.5 r`. Terrain height encodes material (sand low, grass, hills, rock highest). A thin separate top cap sits over a darker side colour; **sink the side column's top below the cap** or it z-fights. Leave a small gap between tiles so AO draws the seams.
- **Props** are primitive assemblies: boxes, prisms, low-segment cylinders and cones, icosahedra at detail 0, pinched boxes. Emissive parts (windows, lamps) get their own material per object so they can light individually.
- **Materials**: `MeshStandardMaterial({ flatShading: true, roughness ≈ .9 })`, **no textures**. Jitter each tile's lightness a few percent so the ground isn't a spreadsheet.
- **Water** (if any): a dense non-indexed plane displaced by summed sines in the shader, flat-shaded so each triangle glints on its own (not too low a roughness or facets flash white); a coarse plane below for zoom-outs; a **shallow map** redrawn per frame where land exists, mixing deep → shallow colour with a faint foam rim; a thin transparent ring at each tile's water line for surf.
- **Sky without a horizon**: in post, linearise the orthographic depth and blend distant pixels into a vertical screen gradient; set haze start/end as fractions of frustum height × cot(elevation) so the horizon band stays in the top third at any zoom. Stars (hash grid, twinkle) only where haze is thick.
- **Post**: MSAA + depth → **GTAO** (mandatory: it draws the seams between tiles and under roofs) → sky/haze composite → a very light tilt-shift at the frame edges → bloom (stronger at night) → pastel grade → Neutral tone mapping. Supersample 2×.
- **Light beams** (searchlight, projector, torch): a camera-facing ribbon with a Gaussian profile, bright at the root and fading with distance, plus a wider faint halo copy; light the surface under it in its own shader.

## 3. Colour logic

- **Pastel, low contrast, a handful of hues**: one ground family (sand/grass/earth or its equivalent), one neutral rock, and a small set of wall and roof colours repeated across buildings.
- **Time of day is a keyframed set of colours** (zenith, horizon, deep, shallow, sun colour, intensity, elevation, azimuth), interpolated. Day is airy and cool; dusk warms the horizon; night desaturates everything toward blue-violet.
- **At night, warm emissives are the only bright things** (windows, lamps, a beam). Keep the sun sideways to the camera in key shots (low sun behind the target turns faceted water into glare); water receives no shadows.
- No outlines, no black; shadows and AO are the only darks.

Examples of world palettes: sand, grass and coral roofs under a pale-blue day; snow tiles, pine greens and red cabins under a lilac sky; terracotta mesas, sage scrub and turquoise pools under an apricot dusk.

## 4. Type & subtitles

- Geometric OFL sans faces: a rounded one for subtitles (e.g. Quicksand 600), a geometric caps face with wide tracking for titles (e.g. Josefin Sans).
- **Subtitles**: no box; warm white with a soft dark-blue drop shadow, centred low; a small flat-shaded tile icon beside them whose top colour follows the time of day. One line in the spoken language, at most about eight words. Hold ≥ max(1.8 s, speech + 0.6 s), never overlapping the next line or a title.
- **Titles behave like tiles**: letters rise one by one from under a water line, overshoot and settle.
- A text card over the world leaves a gap where the world stays visible.

## 5. Motion quality

- On ones (24 fps, 30 in a reel), smooth. The charm is in the **arrival curves**, not stepping.
- **Rise from below**: a short cubic ease up, then a damped-sine overshoot; a splash ring and spray the moment it breaks the surface. The event time is when it settles.
- **Drop and stack** (floors, roofs, rings): a fast ease-in fall, a damped bounce, and volume-preserving squash-and-stretch on landing.
- **Pop** (trees, lamps, details): scale `1 − e^(−k s)·cos(ω s)`, about 25 % overshoot.
- **Life**: mills turn, smoke puffs, birds circle, boats bob with the same wave function as the water (evaluated on the CPU).
- **Schedule growth on the music grid**: at most one piece per smallest slot, so every event keeps its own note; accelerate by density (halves → quarters → eighths), not by tempo.
- Never moves: the projection (no perspective, no fov change).

## 6. Camera grammar

`THREE.OrthographicCamera`. **Frustum height is the zoom** (a few units for a close-up, the whole world at a dozen or more, hundreds for a scale reveal); place the camera ≥ 3 × frustum height away or the bottom of the frame looks under the sea. A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Turntable (azimuth sweep) | the thing seen from every side | building; inspecting; a product assembled |
| Pure orthographic zoom (frustum change) | scale without perspective | a detail in context; smallness; a world among worlds |
| Elevation change | low (≈20–25°) widens the sky band; high (≈50°) reads as a map | night and stars; a sweep across the whole world; a plan |
| Locked 3/4 wide | the world lives on its own | lights coming on; time-lapse; waiting |
| Tight close-up on one arrival | the bounce and the splash | a key piece; a milestone; a gag |
| Side angle trailing a mover | travel across the frame, never at the lens | a delivery; a departure; a route |
| Lateral truck along a row of tiles | a list, a sequence | steps of a process; a timeline |
| Time-lapse sun sweep, camera still | light is the time machine | a day; a season; history |

Intercut wide and close on beats: wide shows the shape growing, close sells the bounce. Transitions: hard cuts on the beat, a time-of-day change, a zoom through the sky; no dissolves, no perspective whip-pans.

## 7. Sound palette

- **Music can be event-driven**: growth events carry a note, and the score synthesizes each one at its exact time, so the picture writes the tune. Pitched percussion suits the facets: marimba, kalimba, woodblock, bells, vibraphone, celesta, steel drum; underneath, a soft pad, a gentle ostinato, light shaker or soft kick. Pentatonic or modal material keeps any order of notes consonant. **No piano, no strings.**
- **A single note can be a motif**: one sound owned by the world (a bell, a chime, a horn) that returns changed.
- **Foley follows material**, all synthesizable: bubble sweep + splash with droplet ticks for rising tiles (bigger = lower); wooden knock plus a quieter bounce knock for floors; ceramic clack for roofs; hollow plank knock; heavy stone thunk; glass tink; a low whump with electric hum for anything switching on.
- **Beds**: low-passed brown-noise water with swells, birds as downward-gliding FM chirps, creaking wood, crickets or wind at night.
- **Silence**: drop to a low drone and a bed; a moment of digital zero on the music bus before a big downbeat. Options: thin the ostinato to one voice instead of stopping it; let the world's own events carry the rhythm for a passage.
- **Voice**: one clear, gentle narrator, few short lines; avoid words that collide with the video's subject (a video about baking: "flour" heard as "flower").
- **Mix**: voice compressed and well above the music, music ducked under it, master −14 LUFS; **grain 0** (flat colour shimmers with grain).

## 8. Native moves

A menu: use the ones your story needs.

- **Building is composing**: every piece that lands plays a note; a later sweep can replay them in spatial order as a finished melody. *Fits content like:* a skyline whose floors are notes; a team assembling a product; a garden whose flowers form a chord.
- **Procedural growth**: tiles rise, floors stack, trees pop. *Fits content like:* a startup's first year; a coral reef recovering; a neighbourhood being planned.
- **Scale by pure zoom**: one object fills the frame, then the world becomes a speck (or the reverse). *Fits content like:* one user among millions; a village on a continent; a data centre inside a network.
- **Turntable**: a continuous rotation around the thing being made. *Fits content like:* a machine being assembled; a museum object; a house renovation.
- **Light as clock**: shadows sweep and facets re-colour. *Fits content like:* a day of a shop; a year of a farm; a shift at a hospital.
- **Emissive blocks in the dark**: lights coming on one by one, a beam sweeping like a clock hand. *Fits content like:* a network going live; a town at nightfall; volunteers joining a cause.

## 9. Pitfalls of the medium

- `perspectiveDepthToViewZ` in shared post code is wrong for an orthographic camera → `orthographicDepthToViewZ`.
- GTAO renders sprites and transparent objects as solid quads → hide them during the AO pass; set `visible = false` at zero opacity.
- Side column and top cap sharing one plane → z-fighting → sink the column.
- A double-sided additive cone reads as two white lines → a camera-facing Gaussian ribbon + halo.
- Camera too close for its frustum → the frame bottom shows below the sea → distance ≥ 3 × frustum height.
- Two pieces landing in one grid slot muddy the melody → one piece per slot.
- `half` is a reserved word in GLSL.
- A world framed for 16:9 in a reel leaves a strip of island in a sea of sky → set the frustum from the world's width and choose taller worlds; keep subtitles and titles inside the reel's safe box and above YouTube's bottom 12 %.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js with an orthographic camera, the whole frame drawn from `t`; three.js can be vendored next to the page and imported through an import map, as the pack's 3d-character style does. Hex tiles from axial coordinates, flat-shaded standard materials, no textures, lightness jitter seeded by tile index, one emissive material per lit object so each can switch on alone.
- Growth is a schedule, not a simulation: a list of events (time on the music's smallest slot, piece, kind of arrival, note), at most one per slot. Each piece's pose is a pure function of the time since its event: rise (cubic ease up, damped-sine overshoot, event time = settle), drop (ease-in fall, damped bounce, volume-preserving squash), pop (`1 − e^(−k s)·cos(ω s)`).
- The same event list writes the score (each note synthesised at its exact time), the foley and `cues.json`; after the score is rendered, compare its onsets and pitches with the events and fix any that drifted. Subtitles follow the voice's word timings; growth scenes are timed to the grid, lines placed in their gaps.
- Water: a dense non-indexed plane with summed sines in the vertex shader, a coarse plane below for zoom-outs, a shallow map redrawn each frame from land positions, surf rings; boats and floating props evaluate the same wave function on the CPU. Time of day: keyframed colour sets (zenith, horizon, deep, shallow, sun colour, intensity, elevation, azimuth) interpolated at `t`.
- Post chain: MSAA + depth → GTAO (sprites and transparents hidden) → sky and haze from orthographic depth (haze set from frustum height × cot(elevation)), hash-grid stars → light edge tilt-shift → bloom → pastel grade → Neutral tone mapping, at 2×, no grain. Beams are camera-facing Gaussian ribbons with a halo, the surface under them lit in its own shader. Per shot, the camera keys frustum height, azimuth and elevation, at a distance ≥ 3 × frustum height.

## 11. Variation space

You decide the world (island, town, orchard, factory floor, planet), what grows or changes, the palette within the colour logic, the opening, the ending, the camera path and the pacing. Vary them per video:

- Structures: **erosion** (a finished world loses pieces one by one, each removal a falling note, until only the essential piece remains); **two worlds** side by side trading pieces across a gap until they join; **a year in four seasons** on one fixed world, the palette keyframes carrying the story.
- Openings: **mid-construction** (a busy half-built world, many pieces already dropping); **from above** (a top-down map that tilts down into isometric); **the full world first**, then a push into one tile where the story lives.
- Endings: **a close-up on one final piece** landing, no pull-back; **the world packed away** (pieces fly up and stack into a box); **daylight** (dawn floods the world and the music resolves on the first sunlit facet).
