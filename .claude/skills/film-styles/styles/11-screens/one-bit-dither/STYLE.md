# 1-bit Dither

> Real 3D scenes rendered in only two inks, warm black and old-paper cream, every grey made of ordered dither dots that stick to the surfaces they shade, with one-pixel outlines where depth or angle breaks. The frame is drawn at half resolution and doubled with hard pixels, like an early desktop screen or a fax. Even transitions stay 1-bit: dot dissolves, block swaps, line-by-line scans. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): 1-bit desktop computers of the 1980s and their dithered pictures (take the two-ink discipline and ordered patterns); recent 1-bit 3D games (take surface-anchored dither and outline extraction); wire-photo and fax machines (take the picture arriving one line at a time); newspaper halftone (take the 45° dot screen of printed photos). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The internal frame is 540×960, doubled to 1080×1920; every edge is a hard 2 px step.

| Zone | Position | Content |
|---|---|---|
| Scene | full bleed | the 3D set, framed vertically: a horizon in the upper third or a subject filling the middle |
| Diegetic text | on objects inside x 72–900, y 269–1248 | cards, labels, stamps, a headline |
| Caption strip | centred on x 540, ≤ 720 px wide, bottom edge y 1230 | paper text on an ink bar |
| Machine or print | middle third | the thing being scanned, printed or received |

- **The first 3 seconds.** Frame 1 is already a moving 3D shot (a slow rack focus or glide) in two inks; by 0.5 s a sound-synced tick and a visible change (a light, a line printing, a dot dissolve); by 3 s the first coarse-to-fine resolve or a scan reveals the subject.
- **Length and pace.** 30–50 s at about 126 BPM; shots of 4–7 s, with one run of quick cuts (one per two beats) as the machine starts.
- **Captions.** One caption layer, drawn into the 1-bit frame. Wordless videos tell the story with text on objects instead.
- **Sound.** `tick` on every sync pulse (every two beats), `typing-tick` for each printed line, `latch` on a plug or switch, `ratchet` as a machine spins up, `thock` on a stamp with its one-frame inversion, `metallic-riser` into a resolve. Clarinet, bass, strings, upright piano, glockenspiel, bowed vibraphone and a light kit from the [VS Chamber Orchestra Community Edition](https://github.com/sgossner/VSCO-2-CE) and the [Versilian Community Sample Library](https://github.com/sgossner/VCSL) (CC0).

### YouTube (1920×1080)

- **Layout.** Section 2 as written; captions end above y 950 and inside the 5 % margins.
- **Length and structure.** 3–8 min as a chain of media: each chapter hands the subject to the next carrier (a sensor, a signal, a printout, a page, a screen), and each handover is a 1-bit transition. Re-hook every 30–60 s with a resolve, a scan, a stamp or a quick-cut run on the beat.
- **The first 10 seconds.** The strongest image first: the subject already rendered in two inks, mid-move; the question by 5 s on a card or in a caption ("what is this machine actually doing?"); the promise by 10 s, as the first scan line starts to print.
- **Captions.** Burned in as 1-bit type, plus `.srt`.
- **Thumbnail.** One dithered frame with a strong silhouette against a dark field, a knocked-out stamp of at most three words.

### Good for

History told through a chain of media, printing, scanning and signals, night scenes and space, retro tech, archive stories, data that arrives slowly.

## 1. Essence, and what it is not

1. **Two inks, no exceptions.** Every pixel of every frame is ink or paper, including transitions and text.
2. **Dither belongs to surfaces.** The 8×8 ordered pattern is computed in each object's own coordinates, so it moves and turns with the object and never crawls across it when the camera moves.
3. **Low resolution, hard pixels.** Rendered at half size and doubled with nearest-neighbour; nothing is anti-aliased.
4. **Outlines from geometry.** One-pixel lines where depth jumps or normals turn: ink on lit surfaces, paper on dark ones.
5. **Prints have their own screens.** Photographs on paper use error diffusion, newspaper pictures a 45° halftone; text on paper stays crisp at any distance.

Not **ASCII / CRT Terminal** (no characters as pixels, no phosphor glow, no scanlines). Not **Halftone Dossier** (that is flat paper documents; here a whole lit 3D world is dithered). Not **16-bit Pixel RPG** (no sprites, palettes or tiles; full 3D in two inks). Not **Risograph Print** (no second colour, no misregistration).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Internal frame | 960×540, shown at 2× | every picture |
| Scene | full frame | the set, often a dark field with a lit subject |
| Diegetic text | on cards, crates, boards, pages | must be legible when the shot holds: at least 18 internal px tall |
| Caption strip | centred, bottom edge at y 940 | one line, up to 1200 px wide |
| Stamps | on the object they judge | ink squares with words knocked out in paper |

Compose for two values: a lit subject against dark, or a dark subject against a lit ground. Mid-grey areas become pure pattern; keep them for texture (ground, walls), not for the subject.

## 3. Materials and rendering

- **Scenes are real 3D** (three.js): grey standard materials (values only, roughness 0.9), shadow-casting lights, and flat emissive materials for skies, glows and lamps.
- **Pass 1, shading**: render the lit scene to a 960×540 half-float target, 4× multisampled.
- **Pass 2, G-buffer**: each pixel stores its normal (octahedral), its Bayer threshold and its depth. The threshold uses the object-space position on the dominant axis (times the object's scale), with the Bayer octave chosen from the screen footprint so a cell stays 1–2 pixels at any distance and grazing angle; octaves blend smoothly. Large grazing planes (floors, seas) can switch to a screen-locked threshold to avoid ring patterns.
- **Pass 3, 1-bit**: luminance is exposed (0.9–1.15), gamma-corrected (1/2.2), remapped with `smoothstep(lo, hi)` (lo 0.05–0.12, hi 0.75–0.9), then compared with the threshold: below is ink. Edges where depth jumps by more than 3–6 % of distance, or normals turn by more than 60°, become lines: ink if the surface is brighter than 0.25–0.3, otherwise paper. Lines stop beyond a far distance per shot.
- **Depth of field** is gathered before thresholding (40 samples on a golden-angle spiral, circle of confusion up to 9–11 px, foreground spilling over background), so a rack focus becomes a soft field of dots.
- **Prints**: photographs on paper are rendered from the scene, then Atkinson-dithered (error ÷ 8 to six neighbours, a quarter of it discarded, which keeps highlights clean). Newspaper pictures use a 45° halftone with dot radius `√(1 − tone) × 0.62` of the cell; cells under 3 px fall back to the surface dither. Text textures are thresholded around 0.5 when magnified and pass their tone when minified.
- **Present**: the 1-bit image is drawn at full size with nearest-neighbour scaling, mapping 0 to paper and 1 to ink.

## 4. Colour logic

- Two colours, fixed for the whole video: a warm, slightly blue black for ink and a warm grey-cream for paper. No third colour, no grey blend, ever.
- Light reads as paper, shadow as ink. Night scenes are mostly ink with paper lines; paper documents mostly paper with ink type.
- Inversion is an event: a whole frame swaps ink and paper for exactly one frame on a stamp or a hit.
- Emphasis comes from density and edges, not colour: a solid ink box or a knocked-out word is the loudest thing on screen.

Example palette: ink `#16161A`, paper `#E9E6D6`.

## 5. Type and captions

Faces are open: Special Elite (Apache 2.0) for typed logs and labels, Architects Daughter (SIL OFL) for handwriting, Newsreader (OFL) for newspaper body and captions, Anton (OFL) for headlines and stamps.

| Role | Face | Size (internal / output) | Rules |
|---|---|---|---|
| Caption | Newsreader 600 | 18–22 / 36–44 px | paper on a solid ink strip, thresholded, no anti-aliasing |
| Typed logs, labels | Special Elite | as printed on the object | drawn on a paper texture in the scene |
| Handwriting | Architects Daughter | as written | on cards and notes |
| Headlines, stamps | Anton | as printed | stamps: ink square, 16 px paper inner frame, words knocked out |
| Body text far away | none | — | drawn as a bar per word: at a distance it reads as grey columns, never as half-legible words |

- Captions hold ≥ max(1.8 s, spoken line + 0.6 s). One language, the spoken one. A caption strip appears and leaves by an ordered dissolve over 4–6 frames, never a fade.
- Text that must be read is held still long enough and sized so its strokes are at least 2 internal pixels wide.

## 6. Motion

- **Frame rate.** 30 fps for both formats, continuous camera; because the dither is anchored, motion stays clean without stepping.
- **Easing.** Smoothstep and cubic in-out for camera paths; exponential (log-distance) pulls for long zoom-outs, with Hermite starts so they never jump.
- **Weight.** Machines move mechanically (drums spin up, carriages advance one line at a time); cameras glide or orbit slowly.
- **Progressive resolve.** A picture can arrive coarse to fine in whole octaves (cells of 32, 16, 8, 4, 2, 1 px over about 0.8 s), every cell splitting into four, like a slow scan.
- **Printing.** A print reveals one row per sixteenth note, the stylus a short ink bar on the current row.
- **What never moves**: the dither pattern relative to its surface, and the pixel grid itself (no sub-pixel scrolling of text).

## 7. Camera

| Move | What it expresses | What it can serve |
|---|---|---|
| Rack focus from near grass or an object to the subject | finding the subject | an opening |
| Glide into an orbit | discovery, scale | arriving at a place or an object |
| Macro locked to a moving surface | process, precision | a line printing, a needle, a reel |
| Push through printed dots into the picture | the picture becomes the world | from a print to the place it shows |
| One-take pull out (log distance, overhead tilting to 40°) | consequence | from a page to a street to the horizon |
| Static hold | evidence | a board, a comparison |
| Quick cuts, one every two beats | a process starting | a machine powering up |

Transitions, all in two inks: hard cut on the beat; a match cut on a shape (a ring to a ring); an ordered dissolve (each pixel switches when its Bayer value passes the mix); a block dissolve (32 px cells swap at random, about 0.2 s); a fax scan (the next picture replaces the old one top to bottom behind a two-row inverted scan head, about 0.33 s); a one-frame inversion. Forbidden: grey crossfades, blur without dither, colour, anti-aliased text.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Voice (optional) | one dry narrator; a wordless video is native here | about 8 dB over the music |
| Music | 126 BPM; the machine is the clock: scan hiss as hats, the line sync as a snare every two beats; clarinet, pizzicato and bowed bass, strings, upright piano, glockenspiel, bowed vibraphone; a long major chord that rings into the end | under the voice |
| Foley | sync ticks, the signal itself (tones and chirps), a squeal on tuning, a plug and a switch, a drum spinning up, one tick per printed row, paper rustle, stamp thumps, a far dog bark for night exteriors | close and dry |
| Silence | space or the climactic picture can be silent except the far signal, a bowed note and glockenspiel | |

Pack ids as in Formats. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Resolve.** The subject arrives in 32 px cells and sharpens octave by octave to single pixels in 0.8 s. Fits content like: a first image; data arriving; a memory coming back.
2. **Fax scan.** The next picture replaces the current one line by line behind an inverted scan head. Fits content like: transmission; a before/after; a document arriving.
3. **Print on the beat.** The camera locks to a printing line, one row per sixteenth, until the picture is whole. Fits content like: printing, plotting, a slow download.
4. **Block swap.** Whole 32 px cells flip from one shot to the next at random in a fifth of a second. Fits content like: a jump between places; corruption; a hard change.
5. **Stamp and invert.** A black stamp with knocked-out words lands, and the whole frame inverts for one frame. Fits content like: a verdict; a correction; a rejection.
6. **Dots to world.** From the halftone dots of a printed picture, one take pulls back to the page, the street and the horizon. Fits content like: news reaching people; a photo and its place; scale.
7. **Rack focus in dots.** Near detail dissolves into a soft field of dither as the subject sharpens behind it. Fits content like: an opening; attention shifting; a reveal.
8. **Match cut on a shape.** A ring, a dish or a dial cuts to a similar shape in the next set. Fits content like: chain-of-media stories; cause and effect; time jumps.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- WebGL through three.js (vendored, import map), `data-no-timeline`, drawn from `t`. Each set is a scene with a camera and an `update(t)` that poses it and returns its pipeline settings (exposure, lo, hi, edge threshold, line luminance, focus, aperture, cell).
- A shot table picks the set for each time; a dissolve table names pairs of sets mixed by mode (ordered, block, scan). The inversion is a list of single frames.
- The 1-bit pipeline is one class: shading target, G-buffer target with an override material per layer (outlined, flat, screen-locked), and a full-screen pass that thresholds, draws lines and gathers depth of field; a present pass mixes two 1-bit targets and maps to the two inks.
- Paper textures (logs, cards, stamps, newspapers) are canvases with text, used through the sharpening print material; photographs on paper are rendered from the sets at load and Atkinson-dithered once.
- One timing file (BPM, sync interval, shot starts, print rows) feeds both the picture and the score; every sync, cut, row, stamp and shot change is a sound event in `cues.json`.

## 11. Pitfalls

- **Grey sneaking in.** A crossfade, an anti-aliased font or a scaled texture adds grey; check frames for any value that is not one of the two inks.
- **Shower-door dither.** A screen-space pattern while the camera moves makes the world swim; anchor the threshold to surfaces.
- **Moiré** on large grazing planes; use the screen-locked threshold there, or blend octaves.
- **Mid-grey subjects.** A subject at 50 % luminance turns into pure pattern and loses its shape; light it bright or dark.
- **Unreadable small text.** Strokes under 2 internal pixels break up; enlarge or hold closer.
- **Too many lines.** Edge thresholds that are too low outline every bump; raise them per shot and cut lines beyond a far distance.
- **Video codecs.** Single-pixel patterns smear in low-bitrate encodes; export at high quality and check the encoded file.

## 12. Variation space

The agent decides per video: the chain of media, the sets, exposure and line settings per shot, where the resolve and the scan fall, whether there is a voice.

- **Three structures:** a chain of carriers, each passing the subject to the next; one machine at work from power-on to finished output; a comparison of two versions of the same picture, settled by a stamp.
- **Three openings:** a rack focus through something near onto the subject; quick cuts of a machine starting on the beat; a black frame resolving from 32 px cells.
- **Three endings:** a one-take pull from printed dots to the horizon; the last line printing and the camera holding on the whole page; an end card typed in two inks, the music's long chord ringing out.
