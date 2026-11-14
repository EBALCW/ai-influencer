# Microscope Story

> Real, licence-clean microscopy of a real specimen, seen as it is, and one continuous change of scale that carries the viewer from the glass slide in the hand to a single cell. Focus breathes when the magnification changes, a focal plane sweeps when the camera lands, and every scale bar, field of view and reading comes from the image's own metadata. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Charles and Ray Eames' *Powers of Ten* (one continuous change of scale with a readout riding along); premium microscope launch films (dark bench, glass catching light, restrained marks, clean instrument sound); digital-pathology viewers' instruments (scale bar, field of view, magnification). Copy none of their layouts, interfaces, typefaces or music; never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The specimen bleeds to every edge. Aim every dive at the safe box's centre (x 486, y 760), not the frame's. Use the camera's roll to turn the tissue axis upright, so a truck runs down the frame and the two circles stack one above the other. Instruments top left at x 72, y 280; the credit right-aligned to x 900 at the same height. A reading panel sits above or below its mark inside the safe box (x 72–900, y 269–1248). The frosted subtitle strip is centred on x 540, at most 720 px wide, baseline y ≈ 1200.
- **The first 3 seconds.** Frame 1 is already inside the dive: stained tissue filling the frame, the scale bar jumping from 1 mm to 500 µm. By 0.5 s a turret click and a breath of focus. By 3 s the camera lands, the focal plane sweeps, and one structure is ringed with the question.
- **Length and pace.** 20–45 s: a dive of 6–10 s through three or four real level changes, one or two readings held ≥ 2.5 s each, a silence before the verdict, then the climb back or a held last reading. Holds creep 2–5 %; nothing freezes.
- **Captions.** The frosted strip is the caption layer: one line per cue, 40–44 px, in the spoken language.
- **Sound.** `latch` for the turret detent at each magnification change, `shimmer` for the focal sweep, `typing-tick` as the scan front counts pixels, `clean-ding` as a reading lands, `sub-impact` on the verdict after the silence, `zoom-swish` into the climb. Hard-mallet vibraphone, marimba, bowed vibraphone, water glasses, a pulse bass and a quiet lab bed from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** As in sections 4 and 6: instruments in one corner, the credit in the opposite one, readings beside their marks, subtitles bottom centre. Panels inside the 5 % margins; the strip and the credit above the bottom 12 % (the player's controls).
- **Length and structure.** 2–8 min at 24 fps. A chapter is one level of scale (slide, tissue, cells, a nucleus) or one region measured, each ending on a reading. Its title is written on the glass in the serif as the camera lands on the new level. Re-hook every 30–60 s with the medium's own events: a magnification change with its click and breath, a counting scan, a truck to a second sample, a climb that reveals what the cell belongs to.
- **The first 10 seconds.** The verdict first: two circles framed together with the accent reading between them. By 5 s the question (why is one so much bluer?); by 10 s the promise: from the slide in your hand to one nucleus, measured. Any channel sting after that.
- **Captions.** The frosted strip burned in, plus an `.srt`.
- **Thumbnail.** A landed frame in the stain's true colour with one accent ring and its reading: the number and at most two words.

### Good for

Biology and medicine explainers, materials science, product-science claims backed by real scans, lab and instrument launches, "how small is it" scale videos.

## 1. Essence, and what it is not

- **The specimen is a photograph**: a real micrograph or whole-slide scan of the actual sample, CC0, public domain or CC BY. Nothing on the specimen is drawn, retouched or generated. A whole-slide image (WSI) is the ideal source: one sample, one registered pyramid from millimetres to microns, with the pixel size in its metadata.
- **Scale is the camera**: one log-space dive (and, when the story wants it, the climb back) through nested plates of the same sample. The scale bar shortens and jumps in a 1-2-5 sequence, the field-of-view readout rolls, the magnification steps.
- **Focus has a grammar**: a rack-in from soft at the start, a short breath (blur + a hint of field change) each time the magnification changes, a focal-plane sweep across the frame when the camera lands.
- **Readings are measured**: every number is computed from the file (pixel size × pixels) and the screen says how it was measured. Describe what was measured; never diagnose. Keep a facts file in the project folder (claim, source URL, quoted wording, or the measurement method) and deliver it with the video.
- **One reading per screen**, in the single accent colour.

Not Satellite Briefing (no grey grade; the stain keeps its colour), not Sci-fi HUD (no glowing wireframes or crosshairs), not Data Storytelling (no chart paper), not a keynote (no slides or header bars).

## 2. Materials & rendering

- **Plates**: the WSI pyramid levels as plates in one world frame (level-0 pixels), the coarse levels whole and alpha-feathered at the scan edge, the fine levels as crops around where the camera lands. Each frame draws the finest plate that is downsampled no more than ~1.45×, and blends the next level in between 2.2× and 1.45×: no seams and no visible upsampling, because every level is the same sample, already registered.
- **The naked-eye plate**: the scanner's own photo of the whole slide (many WSI files carry one), registered through the scan's area-of-interest metadata and checked against the tissue's centroid. Cut the glass out of the scanner tray, remove the line-sensor streaks, and fill any manufacturer's printed logo with the surrounding frosted glass. Below ~30 mm of field the photo would be upsampled: let the cover glass become clean glass (its dust leaves the focal plane).
- **One grade for every plate**: glass normalised to a warm white, a little density and chroma in the stain, nothing else. No false colour, no film emulation.
- **The bench**: graphite under a slow pool of light; a soft shadow under the slide.
- **Focus**: screen-space Gaussian blur on a frame rendered with a margin (so edges never go dark); the focal sweep is a tilted sharp front crossing a softened frame. A light illumination vignette, nothing more.
- **Marks** in screen space but anchored to the specimen through one world → screen function: hairlines 1.5–2.5 px with a dark or light halo, circles drawn on as arcs with cardinal ticks, dimension lines with end ticks, leader lines with one elbow. Counted pixels are shown as a mask revealed behind a scan front, then kept as a faint trace.
- **Frosted panels** (dark translucent glass over a blurred copy of the frame) for readings, instruments, subtitles and the credit: white type reads on glass and stain alike, nothing switches colour mid-shot.

## 3. Colour logic

- Glass: warm paper white. Bench: graphite. The stain is evidence and keeps its true colour (e.g. trichrome red and blue, H&E pink and purple).
- One accent, cool and away from the stain's hues (mint against red and blue; amber against a green or purple stain), only for the measured reading and the counted pixels.
- Ink on glass is near-black; type on stain sits on a frosted panel in warm white.

Example: glass #F4F1EC, bench #0B0D0F → #2A3036, ink #181B1F, panel rgba(12,14,17,0.74), accent mint rgb(120,240,205) (on stain) / rgb(0,122,99) (on glass).

## 4. Type & subtitles

- **Roles**: a light condensed grotesk for readings and the scale bar (40–72 px, e.g. Barlow Condensed); a monospace for instruments and pixel counts (20 px, e.g. IBM Plex Mono); a sans in the video's language for labels (20–34 px, e.g. Noto Sans); a serif only for the title. OFL, self-hosted, subset to the characters used.
- **Instruments** live in one frosted panel in a corner: scale bar with its value, field of view, magnification with a small nosepiece glyph that turns a quarter on every change. The source credit in a small panel in the opposite corner.
- **Readings** sit in a frosted panel beside what they measure, joined by a leader: a small label above ("collagen share of tissue area"), the number large in the accent, the method or the raw counts below.
- **Subtitles**: a frosted strip at the bottom, one line in the spoken language, never wrapped. Measure each line with the real font and split long lines into two cues.
- Nothing below 20 px at 1080p. Hold labels ≥ letters ÷ 15 + 1.5 s; a reading that rolls is reported by its landing value.

## 5. Motion quality

- The camera is a similarity transform (zoom, roll, position) interpolated as a log spiral between keys (M^u about the fixed point of the two frames), so every push is a true dive towards one point and the roll is part of it. Ease the moves, creep 2–5 % during holds; never a frozen frame longer than a second.
- Magnification changes happen where the plates actually change, each with a breath of focus, a turret click and the new magnification said once, large.
- Marks arrive by being made: a dimension line grows from its centre, a circle is drawn as an arc, a scan front counts pixels while the reading rolls, the reading lands with a small spring.
- Never moves: the specimen under its marks, the instrument positions.

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| The dive (log zoom with roll) | going to look for yourself | an opening; from the slide to the cell |
| Locked frame, slow creep | evidence, a measurement | a reading; a comparison |
| Truck at one magnification | a second sample of the same thing | the counter-example; "meanwhile, nearby" |
| Pull back to frame two marks | comparison | the verdict |
| Focal-plane sweep | arriving; depth | a landing; a reveal inside one frame |
| The climb (reverse dive, scale bar jumping back) | consequence, scale | an ending; a return to the eye's scale |

At key moments the measured structure fills a third of the frame height or more; instruments in a corner, subtitles bottom centre, readings beside their marks. Transitions are scale changes, trucks and focus, never cuts or crossfades between samples.

## 7. Sound palette

- **Instrument foley**: the objective turret (a click, a detent, a small metal ring), a focus servo, pen on glass for each line drawn, a band-passed scan travelling left to right with counter ticks that speed up, a soft filtered sweep for the focal plane.
- **Music**: hard-mallet vibraphone in 8ths and 16ths, marimba ticks, bowed vibraphone and water glasses for pads and the motif, glockenspiel for each reading that lands, a pulse bass with 2nd/3rd harmonics, timpani and bass drum under the landings. Harmony stays open and light; the score is the user's to shape.
- **Beds**: a quiet lab room (fan, a little mains hum).
- **Silence** before the verdict and before the climb; the first sound after it is the reading or the turn.
- **Mix**: voice ~10 dB over music, music ducked under it; master −14 LUFS. Voice: a calm, exact narrator; numbers spelled out in the text sent to the voice, digits on screen.

## 8. Native moves

- **The dive.** From the slide in the hand to a cell in one camera, the turret clicking at each real change of level. *Fits content like:* a biopsy to its cells; a coated surface to its crystals; a hair or skin section to its layers.
- **Counting the colour.** Draw a circle, let a scan front cross it, light up every counted pixel and roll the share up to its landing value; show the raw counts underneath. *Fits content like:* collagen in tissue; porosity in a ceramic; coverage of a coating; pigment in a sample.
- **Two circles, one verdict.** Measure one place, truck to another at the same scale, then frame both and say what differs. *Fits content like:* treated against untreated; edge against centre; before against after.
- **The focal sweep and the ring.** Land, sweep the focal plane across the frame, ring one structure and give its size. *Fits content like:* a nucleus; a grain; a fibre's diameter.
- **The climb back.** Pull out to the eye's scale with the scale bar jumping backwards; a title card written on the glass.

## 9. Pitfalls of the medium

- **Licences**: most microscopy on the web is CC BY-NC or all rights reserved. Usable: CC0 whole-slide scans (e.g. the OpenSlide test data: check each file's licence line), public-domain government micrographs (NIH, CDC PHIL, NASA, USGS), CC BY collections (Cell Image Library, Wellcome Collection), with every file listed in the credits file. Not usable: CC BY-SA without agreement, NC images, journal figures, AI images.
- **Finding material for a new topic**: search by organ, stain or material plus "whole slide" in the OpenSlide test data, NCI Imaging Data Commons (TCGA/CPTAC slides, licence per collection), the Cell Image Library, Wellcome Collection, Wikimedia Commons (filter by licence) and NIH/CDC galleries; prefer a file whose metadata carries its pixel size. CC BY-SA, ODbL or "no known restrictions" are not CC0: name the terms to the user and ask before using them. For a product, a lab or a brand, ask the user for their own scans (SVS/NDPI/MRXS, SEM TIFFs with a scale) first. Never stand in a generated image for a real specimen.
- **Different samples never zoom into each other**: two micrographs of "the same thing" at two scales are two specimens. Use one pyramid; if you must join sources, cut on a focus breath and say so.
- **Pixel size**: read it from the file (XMP `ScanRes`, TIFF resolution, OME `PhysicalSizeX`); a slide-photo's resolution tag can be trusted only after checking against the scan.
- **Upsampling** shows as mush beyond ~1.6×: end the dive at the scan's real resolution.
- **Tile seams**: some scanners overlap tiles; check the joint info, frame out visible seams.
- **Labels and logos** on the slide: barcodes and IDs are part of the object; manufacturer logos are not — fill or crop them.
- **Claims**: a stain's colour means what the stain protocol says, nothing more; measured shares are of the drawn region and the stated threshold, never a clinical score.
- **Landings under the app's buttons**: in a reel, a dive aimed at the frame's centre puts small structures near the lower edge of the safe box; aim at the safe box's centre instead.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **Canvas drawn from `t`.** The camera is a similarity transform (zoom, roll, position) interpolated as a log spiral M^u about the fixed point of two keys. Each frame picks its plates by downsampling ratio and coverage (the finest at ≤ ~1.45×, the next blended in between 2.2× and 1.45×), draws them with a margin, then blurs in screen space for focus and the tilted focal sweep. Frosted panels are dark translucent glass over a blurred copy of the frame.
- **Objective events come from the camera path**: wherever the chosen plate level actually changes, generate the turret click, the focus breath and the large magnification label; never place them by hand. The same events are the cues in `cues.json`, with the scan's ticks, each line drawn, the focal sweep and every reading's landing.
- **Plates prepared before the render** in Python: `tifffile` and `imagecodecs` read TIFF-based slides (Ventana BIF, Aperio SVS, Hamamatsu NDPI, generic pyramidal TIFF; for BIF, mind its label page, XMP and area of interest); MRXS, SCN, VMS and others need `openslide-python` with the OpenSlide library (`brew install openslide`), or an adapter of your own. Install them into a private environment inside the project folder. Register and clean the slide photo, grade every plate, compute the counted-pixel mask and the scan's cumulative curve (so the reading rolls in step with the scan front), and the tissue axis for trucks and roll.
- **Measuring a nucleus**: find the membrane edge on 72 rays from the centre and fit a least-squares circle; the ring and its diameter come from that fit, and the facts file records the method.
- **Marks and text** through the same world → screen function; register every text and each rolling reading's landing value for the reading check. A reading lands on the word that says its number, from the voice's word timings.

A minimal example: a coated steel sample: one SEM pyramid, a dive to one crack, a circle counting coverage, a ring around one grain.

## 11. Variation space

The agent decides the specimen, the stain or modality, what is counted, the camera path, the accent, the ending.

- **Structures**: a single dive ending in one measurement; a comparison of two regions or two samples at one scale; a climb that starts on a cell and reveals the object.
- **Openings**: the slide on the bench under moving light; a cell already in focus, the climb revealing what it belongs to; a blurred field racking into focus.
- **Endings**: the title written on the glass; a last reading held in silence; the slide lifted out of frame.
