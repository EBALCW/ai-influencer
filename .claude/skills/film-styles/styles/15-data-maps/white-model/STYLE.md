# Projection on White Model

> A pure white massing model of a real place stands on a plinth in a dark room, and a projector paints data onto it as light: one layer at a time, falling on the surfaces that face it, spilling a little past the plate. The model never changes; only the light on it does. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): projection-mapped planning models in city galleries (the dark room, the soft throw, colour only on white surfaces); macro model photography (shallow focus at rooftop height); editorial data graphics (one figure, one label, one source per layer). Copy none of their layouts, typefaces, colours or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The model and its dark room fill the frame; the plinth's edge may cross it, never a letterbox. Turn the camera's heading so the model's long axis (a river, a main street, the edge of the plan) runs up the frame, and favour steeper views than in 16:9 so the plate reads as a tall shape. The readout sits at the top of the safe box (x 72–900, y 280–520), left-aligned, at most 720 px wide; the identity label right-aligned to x 900 under it. Pins rise from roofs on their hairlines to tags inside the safe box. Subtitles are centred on x 540, at most 720 px wide, baseline y ≈ 1200 on the soft dark gradient. Low angles against black (the rising level, a single tower) are native to the tall frame.
- **The first 3 seconds.** Frame 1: a macro glide at rooftop height over white roofs, already moving, house lights on. By 0.5 s the relay has cut the house lights and the lamp strikes with its flicker. By 3 s **the hole** is lit: only the set that answers the question glows, and its dark gap asks why.
- **Length and pace.** 20–45 s: lights out, two or three layers of 6–10 s each, one silence with the projector dark before the turn, lights up to end. The camera never stops; it slows as each layer lands.
- **Captions.** One line in the spoken language, 40–44 px, no box; the readout carries the figure, never the sentence.
- **Sound.** `latch` for the house-light relay, `hook-impact` for the lamp strike, `clean-ding` for each building picked out, `metallic-riser` under a rising level, `sub-impact` on the heavy fact after the silence. Projector fan, room tone, mallets, glass, bowed vibraphone, timpani, gong and low brass from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** As in sections 4 and 6: readout in the left third, identity label top left, subtitles bottom centre. Keep subtitles and the readout's legend bar above the bottom 12 % (the player's controls) and the identity label inside the 5 % margins.
- **Length and structure.** 2–8 min at 24 fps, one model per video. A chapter is one layer answering one question. Its title card is the room's own grammar: the projector goes dark, the readout's index and layer name ("02 · Heights") appear in the next layer's colour, the lamp re-strikes. Re-hook every 30–60 s with a new gesture of light (a wash, buildings popping on, a rising level, the sun clock) or a pick-out with a pin; lights up resets between topics.
- **The first 10 seconds.** The most striking layer first, low and close: the hole lit in its accent. By 5 s the question it raises; by 10 s the promise (each layer of light will add one answer). The lights-out opening and any channel sting come after.
- **Captions.** Subtitles burned in, plus an `.srt`.
- **Thumbnail.** A low angle on the white model in the dark with one layer projected and its figure: the number and at most two words.

### Good for

Urban planning and city history, development and real-estate pitches, flood, sun and shadow studies, exhibition and gallery videos.

## 1. Essence, and what it is not

- **The model is real geometry of a real place**: building footprints and heights from open data (§2), extruded at a stated scale (1:1000, 1:2000…). Nothing on the model is invented or "representative", and no generated image ever stands in for the place.
- **The model is white; data is light.** Colour is never painted into the material: it is projected, so it brightens surfaces that face the projector, fades on walls turned away, stops at the edge of the throw and reaches a little onto the plinth.
- **Layers arrive one at a time**, each with its own gesture of light (a wash, a pop-on, a rising level, a moving sun), and each answers the question the last one raised.
- **A physical room**: house lights, a projector that strikes and switches, a plinth, darkness around it. Lights out is where the data starts; lights up is where it ends.
- **Every number on screen is computed from the same buildings** that are on the table.

Not Isometric Infographic (no diorama or icons), not Low-poly Island (no invented terrain), not Sci-fi Hologram HUD (no wireframes; light lands on matter), not Satellite Briefing (no imagery), not a laser-scan or point-cloud video (no scan lines; light is projected, not measured).

## 2. Materials & rendering

- **Model**: matte white (≈ #F3F3F1, roughness ≈ 0.9), crisp edges; water a darker satin inlay in the base plate; bridges low white slabs; a thin base plate on a dark satin plinth.
- **Light model**: house light = one soft key + a neutral studio environment + AO on close shots. Projection = a term added to the lit surface in the shader: `colour × (0.42 + 0.58 · max(N·toProjector, 0)) × throw mask`, scaled by albedo, reduced on water. Never a texture on the mesh.
- **Building data is the material.** First look for the place's own open 3D or footprint-with-height data: 3DBAG (Netherlands, CC BY 4.0), PLATEAU (Japan, CC BY 4.0-compatible), city open-data portals (footprints with heights or floors, zoning, plans). Fine: CC0, public domain, CC BY (credited in the credits file and on screen). OpenStreetMap and Overture (ODbL), CC BY-SA and "no known restrictions" are not CC0: name the terms to the user and ask first. For their own site, ask the user for their data (plan, city model, survey heights).
- **Layers depend on what exists.** Construction years per building are a Dutch luxury (BAG); elsewhere they are often missing. Substitute what the data does hold and the medium can still project: heights or floor counts, footprint area, zoning or plan status, a boundary, sun and shadow (always computable). Never invent a year layer.
- **A layer is state, not a picture**: per-building attributes (year, height, rank, flags) live in vertex data; the shader decides each frame what colour the projector gives them.
- **The sun is a real directional light** with shadow maps, computed from the place's latitude and a real date and time (NOAA/Meeus solar position). The projector can trace what the sun does (a shadow footprint) but never fakes a shadow.
- **Post**: physical depth of field (stronger on close shots), bloom only above the projection highlights, vignette, light grain in ffmpeg. GTAO only on close shots: on wide grazing views it bands.
- **Screen space only for the 2D layer**: readouts, pins, measured lines and subtitles go through the camera's world → screen function so they stay pinned to the model.
- **Keep a facts file in the project folder** (claim, source URL, quoted wording, or the measurement method) and deliver it with the video; every number on screen is computed by a script from the same data as the model.

## 3. Colour logic

- Neutral ground: white model, dark room (near black), dark plinth. Projector black level is a cool near-black on the plate.
- **One hue family per layer**, chosen for the data: a single categorical accent for "the old/the exception" (e.g. warm amber), a sequential ramp for continuous data (blue → cyan → white for time, violet → magenta → peach for height).
- **A colour may return** only with the same meaning (the "before" colour reused later marks the same set of buildings).
- The sun is warm, its shade is a projected deep blue; data colours are put away when the sun arrives.
- Never colour the model in the house light; never use more than two layer palettes on screen at once.

## 4. Type & subtitles

- **Roles**: a light grotesk for the figure (Inter Tight 200, 120–140 px), a sans for labels in the video's language (Inter 300/500, 20–36 px), a monospace for instruments, years and coordinates (IBM Plex Mono, 18–22 px). OFL, self-hosted, subset to the characters used.
- **Readout in the left third**, one per layer: index + layer name, one figure, one label, one source line, a legend bar.
- **Pins**: a hairline from a roof or a ground point up to a tag on a dark plate (title 26 px + one sub line 20 px).
- **Identity label** top-left, quiet: place, scale, data sources.
- **Subtitles** centred at the bottom on a soft dark gradient, no box, measured with the real fonts; one line in the spoken language, split into two cues rather than wrap.
- Nothing below 18 px at 1080p. Hold subtitles ≥ max(1.8 s, speech + 0.6 s); labels ≥ letters ÷ 15 + 1.5 s.

## 5. Motion quality

- The camera moves continuously and slowly; it changes speed with the layers, never stops dead.
- **Light is the actor.** Each layer arrives by a soft-edged gesture of light: a wash spreading from the projector axis, buildings switching on one by one with a short flash, a level climbing every facade, the sun's clock running. No hard line sweeping the table.
- House lights cut fast (a relay, 0.25 s) and return slowly (1 s); the projector strikes with a brief flicker.
- Counters roll while the light moves and land when it lands; measured lines grow from A to B with ticks.
- What never moves: the model, the plinth, the pins' anchors on the model.

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| Macro glide at rooftop height, shallow focus | the model is a real object | an opening; a detail that matters |
| Crane up and back | the whole pattern only seen from above | revealing a hole, a cluster, an edge |
| Slow orbit with a rise | the city as a whole, layers accumulating | growth over time; comparisons across the model |
| Boom down to a low angle against black | height, skyline | tall buildings, heights, a single tower |
| Side-on track along a line | a measured distance on the model | a shadow, a corridor, a route, a view line |
| Pull back as the house lights return | the data stops; the object remains | an ending; a reset between topics |

At key moments the subject fills a third of the frame height; readouts left third, subtitles bottom centre, pins never over the readout. Transitions are light changes on one take (lights out, a layer replacing another, the projector going dark), not cuts, fades or wipes.

## 7. Sound palette

- **The room**: room tone, the projector fan (hum + filtered air) rising when the lamp strikes, relays for the house lights, a lamp strike (zap + thump), the air of a light wash (sliding band-passed noise).
- **Light as sound**: mallets and glass for things switching on, bowed vibraphone for held light, a rising mallet line and air riser for a climbing level, one glass note per highlighted building.
- **Weight**: timpani, gran cassa, gong, low brass for a heavy fact; warm low brass for a turn.
- **Floor**: contrabass and cellos only as a floor under the chords; no generic piano and strings melody.
- **Silence**: the projector goes dark and everything stops but a thin fan hum before the turn; a short suck-out before the heaviest hit. The first sound after the silence is the turn.
- **Mix**: voice about 10 dB over the music; the two designed impacts are the loudest moments; master −14 LUFS, true peak ≤ −1.2 dB. Voice: calm, short declarative lines, numbers spoken plainly.

## 8. Native moves

- **Lights out, lamp on.** House light, a relay, darkness, the lamp strikes, the first layer arrives. *Fits content like:* a site before and after; a district before a plan is shown; any "now look closer".
- **The hole.** Light only the set that answers a question (built before a date, owned by one party, inside a zone) and let the absence draw the shape. *Fits content like:* a war-damaged centre; a flood plain with no housing; land a company owns; a protected zone.
- **Layers by time.** Buildings switch on in the decade they were built, each layer faster than the last, a year counter rolling. *Fits content like:* a new town's growth; a campus master plan by phase; a port's expansion; a developer's portfolio by year.
- **The rising level.** A soft level of light climbs every facade at once; low buildings finish first, the tallest last, the reading rides up with it. *Fits content like:* building heights; sea-level or flood depth; floor counts; a height limit being tested.
- **The sun clock.** A real sun at a real date sweeps the shadows; the projector then traces one shadow and measures it. *Fits content like:* a new tower's shadow on a park; winter light in a courtyard; solar panels' best roofs; a street's daylight hours.
- **The pick-out.** One building or set lights alone while the rest stay dark, with a pin. *Fits content like:* a listed building; the plot for sale; the hospital in an evacuation plan.
- **Lights up.** The data stops, the white model comes back. An ending or a reset.

## 9. Pitfalls of the medium

- **Wall normals** wound the wrong way show inside faces (walls look hollow): derive the outward normal from ring orientation. **Shared walls** between parts z-fight: skip the overlap below the lower neighbour.
- **Warm HDRIs turn the white model beige**: use a neutral studio environment.
- **GTAO on wide grazing views** produces wedge-shaped dark bands; keep it on close shots only.
- **A low sun lights facades, not roofs**: shoot from the sunlit side or side-on. **Narrow shadows vanish** among all the others: trace the one that matters (fill + edge) and measure it.
- **Hairline scan lines read as laser scanning**: give every projection front a wide soft edge or switch buildings individually.
- **Floating labels**: anchor pins on the tallest part of a building, not on its footprint centroid.
- **Numbers from mixed sources** (official height vs measured roof): say which on screen ("roof", "measured").
- **Boundaries and zones** projected on the model follow [directing](../../../references/directing.md#maps).
- **The app's buttons**: in a reel, a pin tag or readout below y 1248 or right of x 900 is hidden; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **three.js drawn from `t`.** One studio: renderer, post (depth of field, bloom above the projection highlights, vignette), the room, the plate, the plinth, a house light and a sun with shadow maps. The projection is injected into a standard material's shader (a projected-light term and a roof glow added to the lit surface), never baked into a texture; a handful of uniforms (layer colours, thresholds, a centre and radius, a height level, a height band, the sun's clock) drive every layer, so a new layer is a new uniform state, not new geometry.
- **The city mesh** is extruded from footprint rings with outward normals derived from ring orientation, shared walls between parts removed below the lower neighbour, water as a plate-sized mask.
- **Data prepared before the render.** For 3DBAG, read `b3_h_70p` (roof height), `b3_h_maaiveld` (ground level) and `oorspronkelijkbouwjaar` (construction year) and convert from Dutch RD coordinates; any other source gets its own adapter writing the same model data: the model's size in model metres; per building `[year or 0, height in m]`; per roof part `[building index, height in model metres, outer ring and holes as [x, z] lists]`; decks (bridges) as rings; x east, z south, 1 unit = 1 model metre; plus the water mask and a stats file holding every number shown on screen. Downloads are plain `curl` from the portal; reprojection may need pyproj or shapely in a private environment inside the project folder. Solar position (any place and date) and the heightfield shadow are source-independent.
- **A 2D overlay** through the camera's projection: readout, pins, the measured range line, the subtitle strip and title card, every text registered for the reading check.
- **Timing and cues**: each layer's gesture starts on the word that names it and its counter lands with the voice. One cue per relay, lamp strike, layer, pick-out and landed figure in `cues.json`.

A minimal example: set the projection's centre on a station and grow its radius to light everything within walking distance; or hold a flood height with the height band at 1 and leave it still.

## 11. Variation space

Decide per video: place and scale, which layers in what order, their colours, the opening, the camera path, the ending, the pace.

- **Structures**: a question answered layer by layer; a plan versus today (the plan's buildings switching on in a second colour); one building's story told by its neighbours.
- **Openings**: a macro glide over white roofs; darkness and a single pick-out; the plinth from across the room as the house lights fall.
- **Endings**: lights up on the white model; one last layer left on alone; the camera rising until the model is an object on a table in a dark room.
