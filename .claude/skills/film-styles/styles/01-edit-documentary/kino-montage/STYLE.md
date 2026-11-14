# Constructivist Montage

> Real archive footage, photographs and documents, printed as one ink-and-paper poster with a single red, and cut on a machine beat. Diagonal bands carry the type; windows cut along the axis hold the film; people are scissored out of photographs and stacked into structures; numbers count, documents are marked in red, and two images collide to make a third idea. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Soviet montage cinema of the 1920s (city symphonies with split screens, counting and machine rhythm; "intellectual" montage where A + B yields a concept), constructivist posters and photomontage (red / black / paper, steep diagonals, photo cut-outs with geometric blocks, type as structure). Never copy their shots, layouts, slogans or lettering, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The −18° axis crosses the narrow width, so bands carry 2–4 words and stack down the frame; windows and cut-outs bleed to every edge. Must-read type stays inside x 72–900, y 269–1248; numbers top out near 300 px. Vertical titles and the photomontage tower are native to the tall frame. Split strips become three stacked strips of one panel each; the 3 × 3 grid stays square in the middle third; the result stacks the numbers above the slanted window. The subtitle bar sits bottom-left at x 72, baseline y ≈ 1200, at most 720 px wide.
- **The first 3 seconds.** Frame 1 is the title package mid-slam: a red band already on the diagonal, footage running in the window cut to its edge, the first digit of the key number stamped; the rest stamp one per eighth with shakes by 0.5 s; by 3 s the question lands: a document heading circled in red beside a huge red "?".
- **Length and pace.** 30–45 s at 120 BPM (a bar is 2 s): footage shots 0.5–2 s, one acceleration that halves down to 0.125 s, one half-bar of silence before the heaviest hit, the tower as the signature near the end.
- **Captions.** One line in the spoken language on the ink bar with its red tick; intertitle-only (no voice) is valid, with the type blocks carrying the words.
- **Sound.** The pack's `thock` + `latch` for every slam and stamp, `zoom-swish` for red wipes and irises, `ratchet` under a counter, `hook-impact` for the heaviest hit after the silence. The machine ostinato and xylophone counts (sampled CC0 instruments) and original recordings come from elsewhere, or the user's music.

### YouTube (1920×1080)

- **Layout.** Sections 2–6 as written. The subtitle strip sits at y 860–948 and key type above y 850, clear of the bottom 12 % where the player's controls appear; bands and windows may bleed, but tags and type stay inside the 5 % margins.
- **Length and structure.** 3–6 min at 24 fps. A calendar machine carries it well: one counter runs the whole video and stops at each milestone, and each stop is a chapter whose title card is a date on a girder. Inside a chapter, a document asks and the footage answers. Re-hook every 30–60 s with an acceleration, a newly marked document, a collision or a new floor of the tower; alternate grounds so every chapter cut lands.
- **The first 10 seconds.** The key number stamped on a red band over footage first, the question (the circled heading) by 5 s, the promise ("the brochure names three men; the film shows thousands") by 10 s; a channel sting after that.
- **Captions.** The subtitle bar is part of the print: burned in, plus an `.srt`.
- **Thumbnail.** The photomontage tower: cut-out workers on stacked floors, a red band and the huge end number, with up to three words in Oswald.

### Good for

Industry and company histories, milestones and anniversaries, infrastructure openings, collective-effort stories, "how many people did it take" explainers, archive-led brand films.

## 1. Essence, and what it is not

1. **Evidence, recut.** Every picture is real material (archive film, photographs, documents) about the actual subject. The video's argument comes from how they are cut and set, not from illustration.
2. **One printed sheet.** All material is converted to the same two-tone print (warm ink → paper); red is the only colour and is laid on top as a printed element.
3. **The beat is the editor.** Cuts, slams, wipes and counts sit on a 120 BPM grid (or the score's tempo); sections accelerate by halving shot length.
4. **Type is structure.** Words and numbers are beams: on a −18° band, as solid blocks, stacked vertically. Never floating captions.
5. **The collective over the individual.** Crowds, hands, machines and many small figures; a single face is never the protagonist.

Not **Data Storytelling** or a keynote: no centred headline with bullets, no slide transitions, no header bars; data appears as marked documents, counters and measured bars inside the composition. Not **Swiss Motion Graphics**: asymmetric, diagonal, no grid of white space, no thin rules as decoration. Not **Art Deco** or **60s Spy Titles**: no gold, no fine lines, no jazz. Not a museum slideshow: archive material is never shown "as is" in a neutral frame; it is cut, windowed, stacked and counted.

## 2. Materials & rendering

- **Four kinds of element only**: **bands** (red or ink, along the axis), **windows** (rectangles or parallelograms holding film or photographs), **cut-outs** (people scissored from photographs with a paper-white border), **type blocks**. Plus one paper-fibre texture over everything.
- **The print grade** (one function for film, photos and documents): luminance → percentile stretch (film: one pair of percentiles per clip, so it never pumps; 0.7 / 99.5; photos 0.8 / 99.4) → S-curve `x + s·(x−0.5)·(1−|2x−1|)·2`, s = 0.32 (documents 0.18, they keep their paper) → map to ink→paper: `rgb = INK + (PAPER − INK)·g`. Archive film keeps a ±2.5 % per-frame flicker inside its window (from a hash of the frame number), photographs and documents do not.
- **Cut-outs**: an open person-segmentation model run locally (ONNX) → threshold 0.5 → median filter → largest component → 7 px paper border dilated outside the mask. The border is the medium's own look and hides the model's edge errors. Group photos rarely segment cleanly: use them whole in windows.
- **Documents**: scans at full resolution, never retyped. They are marked: a red highlighter bar in `multiply` over the exact sentence, a hand-drawn red ellipse round a heading, a red circle on a map. Drawings on a document (a chart, a map) may be lifted off the page and reused, keyed from their paper (`alpha = (205 − luminance) / 90`).
- **Resolution ceiling**: archive film ≤ 2.5× its source pixels on screen, modern footage ≤ 1.5×, photos ≥ 1 source px per screen px where possible. Prepare clips with `hqdn3d → lanczos → light unsharp` before grading; add grain once, over the finished frame. A 720-line film transfer can fill a 1,700 px window, not a full 1080p frame: frame it (a window, a split strip, an iris) instead of stretching it.
- **Paper fibre**: a fixed seeded noise canvas multiplied over the frame at α 0.5; light film grain over the finished frame.

## 3. Colour logic

| Role | Value | Use |
|---|---|---|
| Red | `#D52B1E` | bands, wedges, blocks, the key number, marker bars, circles and leaders, the one winner in a comparison |
| Ink | `#141210` | type, beams under each floor, window borders, dark grounds |
| Paper | `#EDE4D0` | ground, reversed type, cut-out borders |

- Everything photographic is ink-on-paper; nothing else has colour. Red is never laid on red: a red block on a red ground becomes ink.
- Alternate grounds to make cuts land: paper scene → ink scene → paper. In an acceleration the background itself alternates red / ink per cut.

## 4. Type & subtitles

| Use | Face | Size (1080p) |
|---|---|---|
| Display, slogans | Oswald 700, capitals | 110–210 px; stacked vertically 170 px per letter |
| Numbers | Oswald 600–700 | 230–440 px |
| Secondary lines | Oswald 500, capitals | 30–62 px, letter-spacing 2–10 px |
| Source and footage tags | Space Mono Bold | 17–18 px on an ink or red tab, padding 6 |
| Subtitles | Oswald 500, 40 px | bottom left, ink bar at 90 %, a 10 px red tick |

- **Display and secondary**: a display block, then one secondary line in Oswald directly under it (or on the neighbouring band). Each one line, measured.
- **Placement**: along the −18° axis on a band, or as an ink / red block; never centred on the frame, never a header. Numbers can be bigger than the words that explain them.
- **Tags**: every archive window carries its footage tag (`FILM · <TITLE> · <PLACE> <YEAR>`, `PHOTO · <AUTHOR> <YEAR>`), every fact a source tag (`SOURCE · <PUBLISHER> <YEAR>`). If the footage is not of the subject itself, the tag says what it really is.
- **Subtitles** stay bottom-left in an 860–948 px strip, in the spoken language, one line; key type keeps above y 850 while narration runs. Subtitles hold ≥ max(1.8 s, speech + 0.6 s). On-screen text holds letters ÷ 15 + 1.5 s, fully in frame; a comparison holds every item ≥ 2.5 s before its verdict.

## 5. Edit grammar

- **Grid**: one tempo for picture and score (120 BPM: beat 0.5 s, bar 2 s). Every cut, slam, wipe and count lands on a beat, half-beat or sixteenth. These times go into one event list that the sound cues and the score read too.
- **Shot length**: 0.5–2 s for footage; one idea per shot. A section may accelerate by halving: 0.5 → 0.25 → 0.125 s (never shorter than 3 frames). Holds are reserved for reading: a text block, a freeze, a comparison.
- **Cut rule**: adjacent shots conflict in at least one of direction (left slam / right slam), value (paper / ink ground), or geometry (diagonal band / upright window). Never two paper documents in a row.
- **Nothing static for more than a second**: inside a hold something moves (film in its window, a counter, a slow push, a frame-within-the-frame). Planned exceptions only: the comparison hold, one silence beat, the end card.
- **Transitions inside the medium** (pick per cut, don't fade):
  - *red wipe*: a 260 px red band at 72° (perpendicular to the axis) sweeps the frame in 0.25 s, the next scene revealed behind it; it lands on the downbeat;
  - *iris*: a red marker circle drawn on a map or photo becomes an aperture and opens onto footage;
  - *slam*: the next element arrives from outside along the axis in 0.08–0.2 s, ease-out, hard stop, frame shake (amplitude 3–18 px, `exp(−14·Δt)`);
  - *flash cut*: one frame of 50–80 % paper over a window at a cut or freeze;
  - *hard cut on the beat* between grounds of opposite value;
  - *jump-in*: inside a freeze, a cut to a 1.2× crop of the same frame, the annotation scaling with it.
- **Two silences**: one where the orchestra stops and only an original recording remains, and one true half-bar of nothing (ink frame, one red dot) before the heaviest hit.

## 6. Scene formats

| Format | How it looks | How it is built |
|---|---|---|
| **Title package** | a red band slams along the axis; a window cut to the band's edge runs footage; digits stamp one per eighth, the unit in red | window clipped to the band's top edge on the bar; digits measured and slammed one by one; the group is measured as one block for reading time |
| **Lower third** | a red bar from the left edge with the place, an ink tab with the date | 92 px bar at y ≈ 760–850, slams in 0.14 s, slides off with the next transition |
| **Map + iris** | a document map pushes in, a red circle is drawn round the place, the circle opens onto the site | the map's scale / focus / angle are functions of time, and the circle is re-projected from the map point every frame; aperture = an `arc` clip whose radius grows to the frame |
| **Vertical title** | capitals stacked top to bottom beside a tall window, the secondary line rotated 90° | per-letter slams 1/16 apart |
| **Date on a girder** | the date in paper on a red band crossing the footage | text placed on the band's centre line (point + normal offset), rotated by the axis |
| **Grid** | 3 × 3 windows light one per sixteenth in a spiral, the centre counts 1…9 and lights last in red | cells back-ease in, each a different clip at 1.4–1.8× speed, ping-pong |
| **Split strips** | the frame rotated to the axis, three strips of two panels each; one panel changes per beat; strips drift in opposite directions | panels ≤ 1,160 px wide so the film stays ≤ 2.5×; red seam on the middle strip |
| **Freeze + annotation** | flash, freeze, push; a red ellipse drawn on the object, a leader to a red block with the number; a jump-in; the film keeps running in a small red-framed inset | the circle is computed from the zoom focus so it follows the jump; inset = same clip, live |
| **Document close-up** | a tilted page slams in, a red marker bar crosses the exact sentence, a red block repeats the number huge | marker in `multiply` over the scan's own line coordinates; a tall slot beside it runs footage fast to show speed |
| **Process staircase** | three windows rising along a diagonal, red triangles between them, a counter climbing to the claim | each window 0.75 s apart; the counter is graphic, only its end value is a fact |
| **The question** | a document heading on an ink ground, circled in red; a huge red "?" | heading cropped tight so only the words that matter show |
| **Acceleration + count** | full-frame windows tilted ±4–6°, ground alternating red / ink, a four-digit counter jumping per cut | cut list with shrinking durations; the original sound plays alone |
| **Multiple exposure** | top-down footage, a second clip in `screen` at 45 %, cut-outs in `multiply`, the answer in a block | exposure window ≤ 1,700 px on a red ground |
| **Chart from the document** | the page turns 90°, its drawings lift off and stand on one ground line to scale, red dimension lines, numbers, names; held; then the verdict block | outlines keyed from the scan, scaled so tip-to-ground = value × px per unit; the winner tinted red (`source-in`) |
| **Photomontage tower** (signature) | floors of footage strips slam in from alternate sides every sixteenth, an ink beam under each, a cut-out worker lands on every other; the camera climbs; a crown and a figure on top | a list of floors; the camera's `y` follows the eased count of built floors; the floor counter runs to the dated anchor, **rests there while its caption is up**, then runs on to the end value |
| **Silence beat** | ink frame, one red rivet | half a bar; the score and foley are gated to zero |
| **Result composition** | huge numbers left, a tall slanted window with the finished subject (camera tilts up it), a tilted photo, a red wedge | numbers slam, the last line restamps the key number on red |

## 7. Sound palette

- **Score**: an original machine ostinato (eighths, minor, e.g. D–D–F–D–A–D–E–F) in spiccato cellos + staccato bassoon, staccato tuba / trombone on the beat, snare sixteenth taps, xylophone for counts (one rising note per lit cell or built floor), horn / trumpet stabs and a short brass motif, timpani rolls into section changes, gran cassa + gong on the heaviest hit. Sampled CC0 instruments (VSCO 2 CE, VCSL). No piano-and-strings bed.
- **Original sound alternates with music**: in one section the orchestra stops and a real recording (a rivet gun, a machine, a crowd) carries the cut alone, each burst trimmed to its shot. Bring it in a beat early (J-cut).
- **Foley for every printed action**: slam = low thump + steel clank; stamp = thump + clack; wipe and iris = whoosh; marker = filtered noise scrub; paper = band-passed rustle; floors and cells = pitched clanks.
- **Layers**: ambience (a real site / street recording, about 20 dB under the voice, out for the silence), foley ducked 35 % under speech, music ducked 70 % under speech (≈ 10 dB under the voice), narration compressed and levelled by RMS. Master to −14 LUFS with the peaks limited to −1.8 dBFS before the final encode, and a 25 ms fade at sample 0 (an AAC encode overshoots on a hit at the first sample).
- **Narration** (when the video has one): one voice, short declarative lines, newsreel cadence, never more than one sentence over a format; numbers spelled out in the text sent to the voice, digits in subtitles.

## 8. Native moves

1. **The document is marked, not quoted**: the actual sentence on the scan gets a red bar; the number then becomes a red block.
2. **The document becomes the chart**: drawings printed on a page are lifted off, turned and stood on a ground line to scale.
3. **A + B → idea**: two kinds of image alternate faster and faster (the machine / the hands; a heading / the people it leaves out) until a card or a number states what the collision meant.
4. **Count the many**: a counter driven by the cuts, a grid that fills cell by cell, a tower floor by floor.
5. **People build the structure**: cut-out figures stacked into the thing they made (photomontage).
6. **Silence, then the heaviest hit** into the result.

## 9. Footage

1. **Ask first.** Before searching, ask the user for their own material: film, video, photographs, scans of documents (reports, brochures, letters, minutes), data. What they give leads; archives fill gaps.
2. **Where to look, and how to judge the licence** (log the licence, author and source page of every file you fetch):
   - **Internet Archive**: read each item's `licenseurl` and description. Public Domain Mark / CC0 / CC BY are usable; *no licence field* is not. For a pre-1978 US film, check the title and end cards for a copyright notice: published 1930 or earlier = public domain in the US by date; published without notice before 1978 = public domain; with a notice, check renewal. Corroborate date and producer elsewhere (a library catalogue, an archive exhibit). Avoid YouTube mirrors, re-uploads with no provenance, colourised or "restored" versions.
   - **Wikimedia Commons**: read the file page's licence and its source institution. Public domain, CC0, CC BY (credit in full) are usable; CC BY-SA is not used.
   - **US National Archives (NARA)**, **Library of Congress**, **NASA**, other US federal agencies: federal works are public domain; check each item's rights statement. "No known restrictions" (LOC, Flickr Commons) is **not** clear enough: name it to the user or find the same image elsewhere with a clear statement.
   - **Museums with open access** (Met, Rijksmuseum, Smithsonian): CC0 where the object page says so; check that the item is still marked open access.
   - **University and city libraries** (e.g. Columbia's digitised ephemera on the Internet Archive): use their rights statement; "copyright status undetermined" is not usable.
3. **Tell the user before downloading**: what (title, years), from where (URL), under which licence and why. Keep the raw downloads under about 1.5 GB; download serially (Commons rate-limits).
4. Record every asset with the seconds used (source seconds → video seconds), list it in the credits, and keep the trail for anything judged "no notice".
5. Footage that is not of the subject itself (another city, another year) may stand in only with a tag that says exactly what it is.

## 10. Facts

Every number, date and claim on screen or in the voice comes from an official or primary source (a contemporary report, an official brochure, a government record), kept in a facts file with the URL and the quoted wording. Counters are graphics: only their end values and dated anchors are facts. Where two primary sources disagree (a film's intertitle vs. the official brochure), use one and record the conflict.

## 11. Build

Follow [building](../../../references/building.md). For this style:

- One canvas drawn as a stateless function of `t`: each scene draws a full frame; a wipe draws the old scene, clips, draws the new one, then the band on top. A few helpers carry the whole look: slam (ease-out arrival along the axis + hard stop), flash, per-frame flicker from a hash of the frame number, shake (`exp(−14·Δt)`), slanted parallelogram windows, a focus-point cover fit, and clip playback forward / reverse / ping-pong / at speed.
- Type is drawn as rotated boxes placed from the band's centre line (point + normal), and each box is measured so every line fits and holds its reading time.
- Preparation (Python with PIL and numpy, plus ffmpeg): the print grade with one percentile set per clip, clips as 24 fps JPEG sequences at window size, stills, document pages with outline keying, the cut-outs with their paper border, and OFL fonts subset to the letters used.
- The 120 BPM grid is the clock: every cut, slam, wipe and count is computed from bar, beat and sixteenth; narration lines are placed on the grid and their word timings set the subtitles. At 30 fps a sixteenth is 3.75 frames: round each event to the nearest frame and keep the mix on the same rounded times.
- One cue in `cues.json` per slam, stamp, wipe, marker scrub, paper move, cell and floor; the score, the original recordings and the ambience are mixed with them. Check the rhythm before delivery: no window flat for more than a second, every hit on its onset; then transcribe the final mix.

## 12. Pitfalls of the medium

- **Upscaled archive film** turns to mush on a 1080p full frame: window it; split strips into panels; keep zooms inside the 2.5× ceiling.
- **Per-frame grading pumps**: one percentile pair per clip.
- **Type on a band running off frame**: place it from the band's centre line (point + normal), not by eye.
- **Red on red**: a red answer block on a red exposure ground disappears; switch it to ink.
- **A face as hero**: ordinary identifiable workers appear in groups, at work, in quick cuts; no slow motion or close-up protagonist.
- **Counters read as facts**: label only the end value and dated anchors; a caption beside a counter must match the number shown at every frame (stop the count on the caption's value while it is up).
- **A number without a unit**: every counter carries its unit in the same layout as elsewhere (HOURS / FLOORS / MEN).
- **Ink type over a window**: a line that runs past a photo's edge disappears into dark film; give it a paper tab or keep it clear of the window.
- **The verdict covering what was compared**: place it where no item is, after the hold.
- **Too many documents**: one marked sentence per document shot; a page with three highlights is a slide.
- **Short labels in an acceleration** fail reading time by design: keep text out of the 1/8-beat cuts; put the result in a held block after.
- **A hit at sample 0** overshoots in the AAC encode: fade the first 25 ms.
- **The app's buttons**: in a reel, a band's words, a number or the subtitle below y 1248 or right of x 900 hides under the app's text and buttons; on YouTube, the bottom 12 % is under the player controls.

## 13. Variation space

The agent decides per video: structure, which archive and documents, which formats (not all of them in one video), the axis angle (−15° to −30°), the red's exact hue, tempo (100–140 BPM), whether there is narration (intertitles only is valid), the signature build (a tower, a bridge span, a crowd forming a word, a map filling in).

- **Three structures:** a calendar machine (one counter runs the whole video and stops at milestones); a document that asks and footage that answers (the turn at the middle); one object's journey through a process, then the scale of the whole.
- Subjects that fit: construction and engineering histories, industrial anniversaries, mass events, labour and collective effort, infrastructure openings, any "many people, one machine rhythm" story with archive film and documents behind it.
