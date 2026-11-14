# Visual Investigation

> A cold investigation desk: footage, photographs, documents, sound and maps from one real event, laid out on one shared clock so they check each other. The clock lives inside the picture — timestamps on the evidence, a playhead on a data chart, a stopwatch over the decisive seconds; frozen frames are circled and magnified; quotes are highlighted on the page they come from; a plan shows where cameras stood and where they looked; what is known and what is not are kept apart; at the end every piece of evidence is pulled into one map. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): newspaper visual-investigation videos, forensic-architecture reconstructions, broadcast verification units. Never copy them, quote their names or use their branding.

## Formats

### Reel (1080×1920)

- **Layout.** Boards become columns. Evidence panels run the full width (x 24–1056, keeping the source's aspect: a 4:3 frame is 1032 × 774) and may bleed above and below the safe box; the readout, the heading and every circle label sit inside x 72–900, y 269–1248. The three-column sync grid becomes three rows (report / photo / video) under one stopwatch at y ≈ 290; the loupe opens under the frozen frame, not beside it; map → plan fills the width with the map as a corner inset; known / unresolved becomes two stacked lists; the evidence map turns into a tall poster, plan on top, sources in a column, links running down to the schematic. The subtitle is centred on x 540, max 720 px, baseline y ≈ 1210.
- **The first 3 seconds.** The rewind cold open: frame 1 is the decisive frozen frame with the red circle already being drawn; by 0.5 s two more sources cut in with white flashes and a sync line sweeps through all three; by 3 s the rewind runs (footage backwards, scan lines) under the question ("three sources, one second: where did it start?").
- **Length and pace.** 30–45 s: three or four layouts, one finding each, cuts on the 0.5 s grid, something changing every second, one verdict held ≥ 2.5 s.
- **Captions.** One line in the spoken language, centred, 10 px black shadow; original sound is subtitled too, marked like `[1937 newsreel]`.
- **Sound.** The pack's `camera-shutter` as each photo cuts in, `typing-tick` under a typeset telegram, `tick` for the stopwatch (one per event second), `ui-click` for each ✓ badge, `sub-impact` for the one deep thump at the moment of impact, then near-silence. The low-string bed, pizzicato ostinato, Morse, teletype, paper and rewind sweep come from a free sample library.

### YouTube (1920×1080)

- **Layout.** Section 6 as written: content y 60–880, the subtitle at baseline y ≈ 944, above the bottom 12 % where the player's controls appear. Panels may run to the 60 px margins, but headings, tags and labels stay inside the 5 % margins (x 96–1824).
- **Length and structure.** 4–8 min at 30 fps. A chapter is one question at one time scale (hours → minutes → seconds → days), ending on its sync point; its title card is the readout changing form plus a one-line heading inside the layout. Re-hook every 30–60 s with a new source cutting in, a freeze-circle-magnify, a hard sync point or a strike-through.
- **The first 10 seconds.** The decisive frozen frame first, the question by 5 s, the promise ("five sources, one clock: by the end you'll see where it started") by 10 s; a channel sting after that.
- **Captions.** Burned in, plus an `.srt` from the same cues.
- **Thumbnail.** The freeze-circle-magnify frame: one grey evidence frame, the red circle and its ×2 loupe, at most three words.

### Good for

Reconstructions, fact-checks, incident reports, "what really happened" explainers, disputed calls in sport, product-failure post-mortems.

## 1. Essence, and what it is not

1. **Sources meet at one moment.** The payoff of every section is two or more independent sources (a frame, a photo, a testimony, a report line, a sound) pointing at the same place or the same second. Cut points are sync points.
2. **One clock, read in the picture.** Time is carried by large readouts that belong to the layout: the timestamp on each telegram card, a playhead with its clock on the data chart, a `T+xx.x` stopwatch over the decisive seconds, a frozen "32 s". The scale changes with the story (hours → minutes → seconds → days) at section cuts. A permanent timeline band under every shot is **optional and usually wrong**: it eats the bottom of the frame, adds a layer of small labels and goes empty once the story leaves the clock.
3. **One finding per layout.** Each section says one thing; a heading is part of the layout, never a page header.
4. **Uncertainty is drawn, not apologised for.** `≈`, *inferred*, *schematic*, dashed boxes. Known and unknown are separate columns. A source that does not cover a stretch simply is not on screen yet (it lights up late in its column); never an empty "no footage" box, which reads as a broken render.
5. **Restraint.** Real disasters and real people: no slow motion of the catastrophe, no music that tells you to feel; fire only inside evidence frames; casualties as counted dots and numbers.

Not **Satellite Briefing** (no orbital imagery, no zoom from space). Not **Archive Light Table** (no paper on glass, loupes or hands: documents are flat evidence frames). Not **Halftone Dossier** (no print texture, stamps or collage). Not a newsreel package (no channel bug, ticker or anchor voice). Not a keynote: no centred title slides, no page turns.

## 2. Materials & rendering

- **Three kinds of source at least**: moving image (newsreel, CCTV, phone video, launch camera), documents (testimony, memo, telegram/teletype, report page), photographs. Add sound (original commentary, radio, recordings), data (weather, telemetry, counts) and maps whenever they exist.
- **Documents**: a scanned page is shown as a strip or a page, never re-drawn; only the decisive line is highlighted (red, `multiply`, α ≈ 0.6, wiped left to right). Text that exists only as a transcription (a report, radiograms) is re-typeset by code and labelled as a transcription.
- **Archival picture pipeline** (pre-1950 film, max ≈ 2.5×): deinterlace (`bwdif=0`) → crop borders → deblock (`hqdn3d=2:2:3:3`) → lanczos upscale → light unsharp (`5:5:0.5`) → greyscale; one grain for everything. Modern footage: ≤ 1.5×. Never colourised or "restored" copies.
- **One grade** (canvas `ctx.filter`): footage and photos `grayscale(1) contrast(1.22) brightness(0.94)`; paper `grayscale(1) contrast(1.05) brightness(0.86)` (white pages pressed to light grey); maps greyscale, inverted, `brightness(.62)` so they read as dark line drawings.
- **One grain**: six 256² Gaussian tiles rotated per frame, `overlay`, α 0.22 on footage/photos, 0.10 on paper. Grain only on sources, never on type or lines, and none added over the finished frame.
- **Drawn evidence** (plan, side schematic, charts, dot matrix) is thin line work on the panel colour, marked *schematic* when it is not measured.
- Remove channel bugs, watermarks and the source's own title cards; never generate an image to stand in for a historical one.

## 3. Colour logic

| Use | Value |
|---|---|
| Ground | `#0B0C0E` |
| Panels | `#141619` |
| Hairlines, frames | `#2E3238` |
| Text | `#ECEAE4` |
| Secondary text | `#8B9097` |
| Ticks, *uncertain* | `#4A4F57` |
| **The one accent: here / now / match** | `#FF4A2E` |
| Paper cards (typeset telegrams) | `#E4E0D4` with ink `#1D1D1B` |

Sources are greyscale; red is the only colour and it only ever points: circles, the chart playhead, sync lines, highlights, ✓ badges (a drawn tick in a red box, no words), the zone everything converges on, the *unresolved* column, a strike-through on a wrong claim.

## 4. Type & subtitles

- Headings and findings: IBM Plex Sans 700 (30–124 px). Tags, timecodes and ticks: IBM Plex Mono 400/600. Quotes: Source Serif 4 Italic for the original wording; when the original is in another language, a translation underneath in Source Serif 4 Roman in the secondary colour (only when the subtitles don't already say it). All OFL, subset to the words on screen.
- **Few words per frame.** Each frame keeps only what this beat needs: the main readout or heading, the quoted original (the highlighted line), and one short source tag per piece of evidence. No eyebrow labels, no second-language twin under every label, no archive numbers, dates or "estimate / schematic / not to scale" footnotes unless the beat is about them, nothing the subtitle is saying at the same moment.
- **Source tag**: a 6×12 chip + `type · source` in mono, about three words at most (`Photo · Pasquarella`, `FBI teletype · 1937-05-08`), sitting just above its frame. Full credits go on the end card, not on the panels.
- **Lower third**: a red bar + place name (36 px bold) + one mono line (place code).
- **Subtitles**: at the bottom of the frame (baseline y ≈ 944): IBM Plex Sans 600, 34 px, centred, 10 px black shadow; **one line**, in the spoken language, measured in the page against 1,500 px; a long sentence becomes two cues. Original sound gets subtitles too, marked `[1937 newsreel]`.
- **Reading time**: every key text stays still and whole for letters ÷ 15 + 1.5 s; verdict and comparison frames hold ≥ 2.5 s with every item fully in frame. Counters (timecode readouts, the stopwatch) and tick labels are exempt.

## 5. Motion quality

- 30 fps. Elements **cut in** (≤ 0.1 s opacity) with a 3–4-frame white flash, as if pulled from the evidence locker; nothing flies, bounces or scale-pops.
- Only things that are *drawn* are progressive: circles drawn clockwise in 0.5 s (ease-out cubic), leaders and links 0.4–0.8 s, plans stroke by stroke, highlights wiped, typewriter text for telegrams.
- Inside a frame: a slow push (≤ 1.9× on a map, ≤ 1.06× on a photo) is allowed; the "camera" itself never moves. Layouts change on cuts.
- The event clock (chart playhead, stopwatch) eases between keyframes and moves at constant speed inside a timed run (each tick = one real second).
- Scale changes (minutes → seconds → days) happen on section cuts, carried by the readout changing form (clock → `T+` stopwatch → date), not by a zooming band.
- Something changes at least every second; holds are for verdicts only.

## 6. Shot & layout grammar

- 1920×1080, 60 px margins; content y 60–880, subtitles below it (baseline y ≈ 944). Layouts use the full height; no strip is reserved for a timeline. When a section has no subtitle, centre its content vertically.
- Panels are hard-edged rectangles with 1 px frames; footage panels keep the source's aspect.
- Typical layouts: **map → plan** (left) with a reference photo and a footage panel (right); **one big statement + one quote + one wide schematic**; **five-source board** (three evidence frames on top, sound and report below, schematic right, red links converging); **three-column sync grid** (report / photo / video under one stopwatch, each column lighting up when its source begins); **document strip + two-column verdict**; **claim card + fact-check card + dot matrix**; **evidence map** (plan, broken-axis mini timeline, schematic, thumbnails with links).
- Avoid centred layouts, page headers and slide-like page turns. Transitions are hard cuts on a 0.5 s grid, white flashes and the rewind; no dissolves.

## 7. Sound palette

1. **Bed**: low D held by contrabass and cellos; a filtered room tone about 30 dB under the voice.
2. **Clockwork**: a pendulum tick every 0.5 s in the minute-scale sections, louder in the waiting minutes; in a timed run one tick per **event** second (accent every 5) — the audible stopwatch.
3. **Harmony**: a quiet pizzicato ostinato in eighths (Dm – B♭ – Gm – A) under the slow sections; tremolo minor-second clusters for tension; slow sustained chords for the verdict columns; a resolving D minor add9 with vibraphone for the evidence map.
4. **Foley**: paper for documents, a shutter for photos, Morse "dits" and keystrokes for telegrams, teletype chatter, a rewind sweep, pencil scratches for plans, one deep thump for the moment of impact — then near-silence.
5. **Original sound** (archival commentary, radio, recorded sound): band-passed 180 Hz–5.5 kHz with sparse crackle, shown as a waveform with a red play-line and word-by-word lighting; music ducks −12 dB under it. Original sound and score alternate; never both loud.
6. **Voice**: one calm, flat narrator; music ducks about −9 dB under it; master −14 LUFS, true peak ≤ −1.2 dB.

## 8. Native moves (and how to code them)

- **Freeze, circle, magnify.** Freeze a frame with a white flash; draw a 2.5 px red circle clockwise; at 60 % a leader and a bold label appear; a ×2 loupe opens beside it, cropped from the same source pixels (never beyond 1 source px per screen px). *Fits:* a licence plate in CCTV; a crack in a weld.
- **Hard sync point.** Pick one instant every source can recognise (impact, flash, a public clock, a gunshot peak) and align each source to it. A source that starts late just appears late; if the gap matters, say it in the voice or a subtitle. *Fits:* which phone started filming first; when the launch camera lost the vehicle.
- **Three-column sync grid.** Document / photo / video side by side under one big stopwatch; each column cuts in (white flash) at the moment its source begins, so the grid fills left to right as the clock runs; freeze on the sync point with a red dashed line across the pictures. *Fits:* two dashcams and a police log.
- **Readouts change scale.** The time readout changes form at each section cut — card timestamps and a chart playhead (minutes), a `T+` stopwatch (seconds), dates (days) — as the story narrows or widens. *Optional:* a bottom timeline band with tracks per source kind, only for a video that stays on one clock throughout; keep it free of labels and drop it when the clock stops. *Fits:* a market crash from the week to the minute.
- **Rewind cold open.** Start on the decisive frozen frame, slam the other sources into a grid, sweep a sync line, then rewind (footage playing backwards, scan lines) to the start. *Fits:* any reconstruction.
- **Telegrams on the clock.** Typeset radiograms / messages land at their timestamps with Morse and keystrokes; red dashed leaders tie each card to a pin at its time on the data chart's axis. *Fits:* chat logs, ATC calls, emails.
- **Data chart with a playhead.** A chart (wind, speed, temperature) across the lower part of the frame with a time axis, event bands (storm, outage) labelled with one word, the message pins, and a red playhead carrying the clock. *Fits:* power-grid load before a blackout.
- **Map → plan.** A real survey map pushes in to the site, then cuts to a measured plan with the subject's position, a bearing, a distance ring, a camera point and an inferred view cone; the map stays as a locator inset. *Fits:* where each witness stood.
- **Evidence → model links.** Every circle in every source sends a red dashed link to the same zone of one schematic; ✓ badges land 0.12 s apart with small mallet notes. *Fits:* which room a fire started in.
- **Then vs. record.** Play a period claim as original sound, then a fact-check card; strike through the wrong words in the claim. *Fits:* a press release against the filed numbers.
- **Known / unresolved.** Two columns, ticked vs. dashed boxes, every item held whole for ≥ 2.5 s, one source tag for the board. *Fits:* any inquiry's conclusion.
- **Dots for people.** One dot per person; the dead become red open rings one by one; a single large number. *Fits:* passengers, workers, victims of any event.
- **Evidence map.** Plan, broken-axis mini timeline, schematic and thumbnails of every source, all links converging; the poster frame. *Fits:* the end of any investigation.

## 9. Pitfalls

- **Inference passed off as fact.** Camera positions, photo times and offsets need `≈ / inferred / unlocated` on screen and in the facts file.
- **Early reports as facts.** The first-night memo and the period newsreel often disagree with the final report; use them as images or as claims to check, never as the source of a number.
- **Faking a multi-camera event.** With one licensable film, do not borrow clips of unclear origin; cross-check film + photos + documents + sound instead. The structure still holds.
- **Seams in "continuous" shots.** An exposure jump or splice breaks timing; time durations from the official record and state the alignment error.
- **Time zones and clocks.** Old reports may use standard time while the place ran on daylight time; pick one and state it once on screen (`18:25:00 EST` on the first readout).
- **Too much at once.** One layout, one finding; at most five sources on a board, and the subtitle never repeats the heading word for word.
- **Too many words on screen.** Keep only what this beat needs (main readout or heading, the highlighted original, one short tag per source). Eyebrows, twins of every label, archive numbers, footnotes and translations the subtitle already gives turn the frame into noise.
- **Empty placeholder boxes for missing material.** A grey "no footage" or "waiting for photo" panel looks like a render error. Fill the slot with real material, change the layout, or let the source appear when it starts.
- **A strip reserved at the bottom** (timeline band, caption rail) leaves an empty band when it has nothing to show. Content runs to y ≈ 880; nothing lives in the subtitle line.
- **Catastrophe as spectacle.** No slow motion of fire or impact, no full-screen flames, no sound effects on deaths.
- **The app's buttons**: in a reel, a label, readout or subtitle below y 1248 or right of x 900 hides under the app's text and buttons; on YouTube, the bottom 12 % is under the player controls.

## 10. Footage

1. **Ask the user first.** Before searching: does the user have their own footage, photos, documents, recordings or data (dashcam files, a report PDF, a spreadsheet of readings)? Their own material always comes first.
2. **Where to look, and how to judge the licence.** Log the licence, author and page of every file you fetch and use.
   - **Internet Archive**: the item's `licenseurl` and collection. The NARA-donated Universal Newsreels (1929–1967) are public domain; other newsreel companies (Hearst, Pathé, Movietone, Paramount) are not, even when uploaders tag them PD. "stock footage" and YouTube-ripped items: skip.
   - **Wikimedia Commons**: read the file page — author, source, licence template. U.S. federal work (Navy, NASA, NARA, NOAA, USGS) = public domain. PD claims resting on "not renewed" agency photos (AP, INS, Wide World): treat as uncertain and skip. Download big files through the API thumbnail URL (3840 px) to avoid 429s.
   - **NASA** (images.nasa.gov): public domain except marked third-party items and logos.
   - **Library of Congress / national archives**: read each item's rights statement; "no known restrictions" is **not** a licence — skip it.
   - **USGS The National Map**: historical topographic maps as PDF (public domain); render the area you need with `pdftoppm -r 300 -x … -y … -W … -H …`. Maps follow [directing](../../../references/directing.md#maps).
   - **Government reports and FBI files**: U.S. federal works are public domain; quote them, typeset transcriptions, show scans only as evidence frames.
   - Allowed: public domain, CC0, CC BY (credited in full on the end card). Not allowed: CC BY-SA, "no known restrictions", unclear origin, colourised or restored copies.
3. **Tell the user before downloading**: what (title, length or pages), from where (page URL) and under which licence; keep the raw downloads under about 1.5 GB.

## 11. Facts

Keep a facts file (claim on screen or in the voice → source URL → quoted wording), list every inference separately, and check the final script and subtitles against it before the last render.

## 12. Build

Follow [building](../../../references/building.md). For this style:

- One canvas drawn as a pure function of `t`, from one table of sections, voice starts, original-sound clips and subtitle cues that the mix and the `.srt` read too; the voice's word timings place every cut, circle and subtitle.
- A small kit of drawing parts reused everywhere: a plate (grade + grain + white flash), a ring (circle + leader + label), a cover fit that fills a panel without stretching and returns the source → screen mapping so circles and loupes land on the right source pixels, a ✓ badge, a waveform with a play-line, a playhead whose keyframes the mix shares for its ticks, the plan, a 16-cell side schematic, a push.
- Preparation: ffmpeg for the archival chain, `pdftoppm` and PIL for pages and maps, precomputed waveform peaks for original sound, OFL fonts subset to the words on screen.
- Grain tiles are chosen per frame from a hash of the frame number, so seeking is deterministic; nothing else is random.
- Measure every subtitle cue in the page against its width (1,500 px in 16:9, 720 px in a reel) so none wraps; after the render, transcribe the finished mix line by line against the script.
- One cue in `cues.json` per photo cut-in, typed telegram, stopwatch tick, badge and the impact thump; the bed, ostinato, original sound and their ducking are mixed with them.

## 13. Variation space

The agent decides per video: the event, the sources, the sync point, which time scales the clock passes through, the layouts, the opening and the ending.

- **Three structures:** a cold open on the decisive frame, then rewind and rebuild; one question ("where did it start?") answered source by source; a strict clock (T−10 min → T+1 h) with findings dropping in where they happen.
- **Three sync points:** an impact or flash frame; a sound peak heard in several recordings; a public clock or broadcast time signal.
- **Three endings:** the evidence map; the known/unresolved board left on screen; back to the opening frame, now fully annotated.
- **Other subjects:** a traffic collision (dashcams, CCTV, police report), a protest (phone videos, photos, statements), a disputed call in sport (camera angles, rulebook), a launch failure (tracking cameras, telemetry, accident report).
