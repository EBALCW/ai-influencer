# Satellite Briefing

> Real satellite imagery of a real place, graded down to an analyst's grey, with thin white measurement lines drawn on the ground: a lock-on reticle, outlines, a range line, one reading. One continuous zoom built from stacked imagery plates carries the viewer from orbit to the ground and back, and time can run inside one locked frame. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): open-source investigation films that annotate satellite pictures (thin lines on imagery, one claim per screen, measuring as the plot); the Eameses' *Powers of Ten* (one continuous change of scale with a readout); NASA Earth Observatory's *World of Change* (one place, time running). Copy none of their layouts, typefaces, icons or music; never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Imagery bleeds to all four edges. Turn the camera's heading so the thing measured runs up the frame (a shoreline, a river, a range line): the tall frame then holds the whole distance at a larger scale than 16:9 could. The subject fills a third of the frame height between y 400 and 1000. The reading sits inside the safe box (x 72–900, y 269–1248) above or below what it measures, label above, source note below. Altitude readout top left at x 72, y 280; scale bar and imagery credit right-aligned to x 900 at the same height. The transcript strip is 720 px wide, centred on x 540 (x 180–900), text left-aligned inside it, its baseline at y ≈ 1200. Below y 1248 the ground is picture only.
- **The first 3 seconds.** Frame 1 is already mid-dive: the altitude readout falling, the reticle locked on the place, the printed claim map with its serif name under the camera. By 0.5 s a scan front starts tearing the map away. By 3 s the photograph underneath contradicts the name, and the question is asked.
- **Length and pace.** 20–45 s: one dive (4–6 s), one locked time-lapse of four to eight dated scans, one range line or outline that lands on a reading held ≥ 2.5 s, one climb to end. The camera never stops; one silence before the turn.
- **Captions.** The transcript strip is the caption layer: one line per cue, in the spoken language, 40–44 px in a reel.
- **Sound.** `metallic-riser` under the dive, `ui-click` as the reticle snaps, `tick` for the scan grid and rolling counters, `ratchet` as a range line grows, `sub-impact` when the reading lands, `shimmer` where true colour returns. FM pings, timpani, gran cassa, a reversed tam-tam, pulse bass and orbit hum from a free sample library.

### YouTube (1920×1080)

- **Layout.** As in sections 2, 4 and 6: reading in the right third, transcript strip bottom left, instruments in the corners. Keep the strip's baseline above y 950 (the player's controls) and the credit and scale bar inside the 5 % margins.
- **Length and structure.** 2–8 min at 24 fps. A chapter is one place or one claim tested, ending on one reading; the climb back to orbit and a whip pan carry the viewer to the next, and the reticle opens out into the chapter's title card. Re-hook every 30–60 s with a change of scale or time: a dive, a time-ring sequence, a range line, colour returning.
- **The first 10 seconds.** The map's name over the ground that contradicts it, first; the question ("where did it go?") by 5 s; the promise ("fifty years of satellite passes will measure what's left") by 10 s. Any channel sting after that.
- **Captions.** The transcript strip burned in, plus an `.srt`.
- **Thumbnail.** A grey nadir frame with one patch of true colour and the amber reading beside it: the number and at most two words.

### Good for

Climate and geography explainers, "the map is wrong" stories, open-source investigations, before-and-after of dams, coasts and cities, site briefings.

## 1. Essence, and what it is not

- **The ground is a photograph**: real, licence-clean, georeferenced satellite or aerial imagery of the actual place. Nothing on the ground is drawn, stylised or generated.
- **Two layers, two truths**: the imagery is what the satellite saw; the hairlines are what the analyst measured. Marks are thin, white, sparse, and sit on real coordinates.
- **The grade moves with the story**: orbit in true colour, the analysis layer in grey, colour back only where the story turns.
- **Scale is the camera**: one zoom from orbit to the ground built from nested plates, with an altitude readout and a scale bar from the same camera.
- **One finding per screen**, in the single accent colour.

Not Data Storytelling (a chart on paper), not Sci-fi Hologram HUD (no glowing wireframes or invented chrome), not Blueprint, not Isometric Infographic (real nadir or oblique views, no diorama), not a keynote (no slides, header bars or chapter numbers).

## 2. Materials & rendering

- **Plates**: georeferenced rasters with a lon/lat box, sampled in a shader where the camera ray hits the ground, nested by resolution (world → region → detail) with feathered edges so finer plates dissolve in as the camera descends.
- **Globe**: ray–sphere from a perspective camera, a thin atmosphere rim, limb shading at orbit only; compute |C|² − R² in double precision (float32 fails below a few tens of km).
- **Time**: dated plates share one grid. A soft scan front (a satellite pass, never a hairline) swaps them: north → south forward, south → north for a rewind. Growth can run outward from the old edge, ordered by a distance map.
- **The analyst's grade** (one uniform from colour to grey): luminance with local contrast and clarity, a shoulder so salt, snow and cloud stay below white, toned blue-black → cool silver up to ~65 % grey, a fifth of the chroma. White belongs to the marks.
- **Marks**: a 2D overlay through the same world → screen function: hairlines 1.2–2.6 px with a dark halo, dashes for history and claims, brackets, ticks, leader lines. Lines draw on; outlines print behind the scan.
- **Screen space only for instruments** (altitude, scale bar, imagery credit) and the transcript strip. Everything else is anchored to the ground.
- **The claim layer** is a printed map drawn in the shader from a distance field of the old outline: paper grain a few pixels wide at any zoom, halftone ink, coast and waterlines, graticule, the serif name.
- **Post**: light grain in ffmpeg, a vignette, directional blur only on whip pans.

## 3. Colour logic

- Neutral ground: grey, roughly 3–65 % in value. White means *measured*.
- One accent (warm, e.g. amber) for the single reading on screen, never decoration.
- A second hue may mark the **claim** the imagery tests (a map, a plan, a promise): flat, cartographic, never used for anything measured.
- True colour is evidence: at orbit, and again only where the story turns (the field that greened, the water that returned).
- No false-colour ramps over the imagery.

Example: ground #070B0E → #A1A7A9, marks #F2F5F6, reading #FFBE55, map blue rgb(46, 112, 206).

## 4. Type & subtitles

- **Roles**: a light condensed grotesk for the reading (96–130 px, e.g. Barlow Condensed); a monospace for instruments and dates (20–34 px, e.g. IBM Plex Mono); a sans for labels in the video's language (24–42 px); a serif only for the claim layer and the title. OFL, self-hosted, subset to the characters used.
- **Labels attach to the ground** with a leader line. The reading sits in the right third beside what it measures, label above, source note below ("Landsat, measured").
- **Subtitles are a transcript strip** at the bottom left: a 2 px white rule, a dark plate fading right, left-aligned, each line on one line (measure with the real font, `nowrap`; split a long sentence into two cues). One language, the one spoken.
- Nothing below 20 px at 1080p, the imagery credit included.
- Hold subtitles ≥ max(1.8 s, speech + 0.6 s); a rolling counter reports its landing value to the reading check; labels stay ≥ letters ÷ 15 + 1.5 s.

## 5. Motion quality

- The camera never stops: distance interpolates in log space, segments ease, holds keep a 2–5 % creep or a slow rotation. No frozen frame longer than a second.
- Marks arrive by being made: a line grows, an outline prints behind the scan, a counter rolls and lands with a small pop, a reticle snaps with overshoot.
- Time changes are scans, never dissolves; their spacing tells the speed, and the camera moves with them (accelerating as the steps shorten, braking on the last).
- Never moves: the ground under its annotations, the instrument positions.

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| Oblique orbit, limb in frame | scale, context, distance | an opening; a return; a title card |
| Dive (log zoom, tilt to nadir) | going to look for yourself | a reveal; checking a claim |
| Locked nadir frame, slow creep | evidence, comparison | time running in one place; a measurement |
| Push-in on a point | singling out | one town, one dam, one field |
| Track along a line | travelling a distance | measuring; a river, a road, a coast |
| Whip pan with blur | a new subject at the same altitude | the counter-example; "meanwhile" |
| Climb back to orbit | consequence, perspective | an ending; a summary |

At key moments the subject fills a third of the frame height; reading right, subtitles bottom left, instruments in the corners. Transitions: scan-line swaps, a map layer switched off, zooming through plates, whip pans, the reticle opening into a title card. No crossfades between unrelated places, no hard cuts inside a zoom.

## 7. Sound palette

- **Telemetry**: FM pings (a lock-on ping worth bringing back), dry ticks on the grid that divide to accelerate, noise scans (rising for a rewind, falling forward), servo whines, a ratchet for a range line.
- **Weight**: timpani, bass drum, gran cassa, bowed cymbal, a tam-tam reversed when time runs backwards. Measurements land on a pitched hit.
- **Synthesis**: a pulse bass with audible 2nd and 3rd harmonics, detuned-saw pads under a low-pass, risers for dives.
- **Beds**: orbit hum, radio hiss, data chatter; the place's own ambience (wind, water, a far horn), sparingly, often as J- or L-cuts.
- **One option for the shape**: keep the palette dry (electronics, skins, metal) and let one wet timbre (glass, water, bowed metal) mark the turn.
- **Silence**: music and foley stop, a thin bed stays, impacts may decay into it; the first sound after it is the turn. A short suck-out (0.2–0.45 s, music and foley down ~25 dB) before the heaviest impacts makes them land.
- **Mix**: voice ~10 dB over music; the two or three designed impacts are the loudest moments (out of the bus compressor, with mid-range body, e.g. a low-brass stab); 20–60 Hz about 15 dB under the full band (high-pass ~40 Hz, impact weight at 60–120 Hz); master −14 LUFS, true peak ≤ −1.2 dB. Voice: a calm analyst, short declarative lines.

## 8. Native moves

- **The map against the photograph.** The camera falls into the printed map of the claim; a scanner bar tears it away and the ground is underneath; the name outlives the page. *Fits content like:* a lake still on maps but gone; a cleared concession forest; a planned city never built.
- **Time rings in a locked frame.** Dated plates scan in one by one; each leaves its outline, the band lost between two rings flashes. *Fits content like:* a glacier's retreat; a city's sprawl; a fire scar season after season.
- **The range line.** Mark the destination, grow a ticked line from A to B, chase the tip while the reading counts up, land on the number, pull back to show the whole distance. *Fits content like:* how far a shore moved; a village to its well; a camp to the nearest town.
- **The dive and the climb.** One zoom from orbit to the ground, or back. *Fits content like:* locating anything; a scale reveal; an ending that returns one place to the planet.
- **Colour returns where the story turns.** Only the subject regains true colour inside the grey. *Fits content like:* an irrigated field; a refilled reservoir; a regrown forest.
- **The reticle becomes the frame**: the lock-on brackets open out to frame a title card or the last reading.

## 9. Pitfalls of the medium

- **Licences**: not usable: Google Earth/Maps, Bing, Esri World Imagery, Mapbox Satellite, Planet, Maxar, news photos, AI-generated imagery. EOX Sentinel-2 cloudless is CC BY 4.0 only for 2016 (2018 onward is NC). Raw Copernicus Sentinel data need "Contains modified Copernicus Sentinel data [year]"; check the user's rules. Public domain or free with credit: USGS Landsat (1972 on, worldwide), USGS NAIP (US, ~1 m), NASA Blue Marble, MODIS, VIIRS. Burn a readable credit into the picture and list every asset in the credits file.
- **Finding imagery for a new place**: search by bounding box and date in the Planetary Computer STAC (Landsat C2, Sentinel-2 L2A; no account) or USGS EarthExplorer; MODIS/VIIRS and Blue Marble from NASA GIBS; coastlines, lakes and rivers from Natural Earth (maps follow [directing](../../../references/directing.md#maps)). Log every request. OSM (ODbL), CC BY-SA and "no known restrictions" are not CC0: name the terms and ask the user first. Ask for the user's own surveys or GIS layers when the place is theirs. Never fill a gap with generated imagery presented as evidence.
- **Seams**: paths imaged on other days disagree. One date per path, each scene gain-matched on stable land, feathered overlaps, holes filled from the same year only.
- **Old sensors**: Landsat MSS (to 1992) has no blue or SWIR and drops scan lines: nearest-neighbour resampling, near-zero rows as nodata filled from same-year scenes, scan-angle streaks cleaned on land only. Inspect every year at full contrast.
- **Plumes and haze** cross water as bright diagonal bands: swap the scene for another date of the same year rather than painting it out.
- **Edges**: resampling against nodata darkens scene rims (erode the mask); drop contour pieces along a plate border. Real straight edges (dikes, polders) can read as seams: frame them out or label them.
- **Grey mush at close range**: raise local contrast for that altitude only and dim outside the measured corridor.
- **Water and cloud**: MNDWI where shortwave infrared exists, only the basin you measure; clouds read as features in grey, so use the dry season.
- **Facts**: keep a facts file in the project folder (claim, source URL, quoted wording, or the measurement method with scene IDs and dates) and deliver it with the video. Measure on the date you show.
- **The app's buttons**: in a reel, a reading or credit below y 1248 or right of x 900 is hidden; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **One WebGL2 shader for the ground, drawn from `t`.** A perspective camera set by lat, lon, distance, tilt, heading and a screen offset, with `project()` and `unproject()` between world and screen; the shader holds the nested plates, the time scans, the growth map, the analyst grade, the printed-map layer and the whip blur. Compute |C|² − R² on the CPU in double precision and pass it in.
- **A 2D overlay through the same projection**: hairlines with halos, brackets, ticks, readouts and the measured single-line transcript strip, every text registered so the reading check sees its final value.
- **Imagery prepared before the render**, with Python's standard library, numpy, SciPy and Pillow (no GDAL needed; allow 3–4 GB for cached scenes; anything more, such as rasterio or pyproj, in a private environment inside the project folder): a STAC fetch with one date per path and same-year gap fill; normalisation and gain-matching, streak cleaning, water masks and areas; shoreline vectors and distances; the distance field for the printed map; the distance-ordered growth map.
- **Timing from the voice**: the dive starts on the line that names the place, each scan lands on its date, the reading lands on the word that says the number.
- **Cues** in `cues.json`: the reticle snap, each scan front, every range-line tick, the reading's landing, the colour return. The score uses sampled orchestral percussion and synth from a free library.
- **Post** in ffmpeg: light grain and the vignette over the finished frames.

## 11. Variation space

The agent decides the place or places, whether there is a claim layer, which dates, the structure, the camera path, the accent hue and where colour comes back.

- **Structures**: a locked time-lapse of one place ending in a push-in; a river followed from source to mouth with a reading at each stop; two places compared at one scale with whip pans.
- **Openings**: a ground-level detail that climbs to reveal its scale; a black frame a scan line paints in; an oblique orbit with a searching reticle.
- **Endings**: the climb back to orbit; a last measurement that lands and holds in silence; the claim layer redrawn to match the ground.
