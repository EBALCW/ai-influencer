# Caption News

> Social-video news that reads with the sound off. Real footage, photos and the source document are the ground; huge captions are the lead actor, slammed in a chunk at a time with one keyword on a yellow block. Hard cuts on a music grid, numbers that roll, a source tag that slides in whenever a figure appears, and the original document highlighted on screen before its number is believed. Built for the feed: a 9:16 reel, or a 16:9 explainer for YouTube.
> References (grammar only): the captions-first social news of the mid-2010s, and explainers that set big type over footage. Never copy their logos, fonts, colour ratios, idents or shots, and never name them in the reel.

## Formats

### Reel (1080×1920)

- **Layout.** Footage bleeds to all four edges. Everything that must be read sits inside the safe box (x 72–900, y 269–1248); below and right of it are the app's own text and buttons.

| Zone | Position | Content |
|---|---|---|
| Footage | full bleed | a horizontal source fills a band at least 1080×1240 (scale ≤ 1.5×) with a blurred, darkened copy of itself behind; never a small letterboxed frame in the middle |
| Caption card | centred on x 540, max 720 px wide; last line's baseline y ≈ 1200 | one or two lines, 84–96 px; chunks stack, the keyword block stays on one line |
| Channel bug | x 72, y 280, 46 px high | as in 16:9 |
| Source tag | under the bug, y 336, 36 px | as in 16:9 |
| Footage credit | right-aligned to x 900, y 280 | as in 16:9 |
| Lower third | x 72, y 900, 80 px high | as in 16:9 |

  Splits stack top and bottom, grids stack as rows, charts sit in the upper two thirds and prefer horizontal bars.
- **The first 3 seconds.** Frame 1 already shows the biggest number in its yellow block, rolling to its value by 0.45 s; the unit and the subject word land by 1 s; the "but" that makes people stay is said by 3 s. No title sting first.
- **Length and pace.** 20–45 s. One fact per shot, a cut every 1.5–3 s, one held breath after the turn.
- **Captions.** The caption card is the only caption layer.
- **Sound.** The pack's `hook-impact` on the frame-1 number, `typing-tick` under rolling counters, `ui-pop` for source tags and labels, `camera-shutter` on a freeze, `sub-impact` on the turn, `zoom-swish` into each card. The 120 BPM score comes from a free library.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Keep captions and numbers above the bottom 12 % of the frame, where the player's controls appear.
- **Length and structure.** 2–6 min. One question per chapter, each chapter its own small inverted pyramid (number → "really?" → the document → why), separated by a title sting that names the next question. Chapter titles in the description match the stings.
- **The first 10 seconds.** The biggest number on frame 1, the document that complicates it by 5 s, and the promise of the video ("by the end you'll know who's right") by 10 s. The channel sting comes after that, never before.
- **Captions.** The caption card stays burned in; export the same lines as `.srt` for the platform's own captions.
- **Thumbnail.** The frame-1 number in its yellow block over the footage, plus one word.

### Good for

AI and tech news, a stat that surprises, "the report actually says…" pieces, weekly round-ups, sound-off ads.

## 1. Essence, and what it is not

1. **Sound-off first.** Every beat must be understood from the picture and the captions alone; the voice adds pace, not information.
2. **The caption is the shot.** One line, set huge, slammed in two or three chunks, one keyword in a yellow block. The footage is chosen to sit under the line.
3. **Evidence on screen.** Each number arrives with its source: a source tag slides in; key figures are first seen highlighted in the original document; per-shot footage credits sit in the corner like a news "Video:" tag.
4. **A hook on frame 1.** The reel's largest number is already on screen in the first frame and rolls to its value.
5. **One turn.** The bad-news hook is answered by a fact that changes its meaning; the rest of the reel explains that turn, one new fact per shot.

Not **Data Storytelling** (charts are short inserts between footage, never the whole reel, never a dashboard). Not a **Broadcast News Package** (no anchor, no lower-third ticker, no studio, no scrolling crawl). Not a keynote: no headers, no centred title-and-bullets, no page turns.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Footage | full bleed | video, photo, document or data card; never a vertical frame pillar-boxed in the middle |
| Caption card | left aligned at x 120; baseline y ≈ 960 | one line, never wrapped |
| Channel bug | top left, x 96 y 52, 46 px high | yellow block with a fictional channel name and the topic in small caps |
| Source tag | under the bug, y 108, 36 px | white "Source" + a dark label (`USDA NASS · 2026-08-03`, `… · p. 13`); only on data and document shots, slides in 0.2 s |
| Footage credit | top right, 19 px on a 50 % dark chip | `Video: author · CC BY 3.0`; every CC BY shot carries it |
| Lower third | x 120, y 742, 96 px high | yellow bar + label + one line; for a place, date or speaker, never for the main sentence |

Under the caption: a bottom gradient (0 → 84 % from y 560) plus a soft dark radial from the bottom-left corner; a top gradient (55 % → 0 over 200 px) under the bug and the credit. Data cards use a lighter gradient that starts at y 820. Graphics and charts sit right of centre and bleed to the frame edge; their title and source sit top left, never centred.

## 3. Editing grammar

- **Cuts on a 120 BPM half-beat grid** (every cut at a multiple of 0.5 s). Footage shots 1.5–3 s; data cards and documents 3–4.5 s; a shot that holds a comparison stays until every item has been fully on screen ≥ 2.5 s.
- **Captions cross cuts.** A caption can run over two shots (picture changes, words don't); captions change at most every ~2.5 s even when shots change every 1.5 s. Reading time, not shot length, sets the caption clock.
- **The order of a fact**: footage (feeling) → the number on a card → the document line that says it → the consequence. Never a number without its source tag in the same shot.
- **Transitions are few and fixed**: hard cut (default); a 1–2-frame white flash on the turn and on the freeze; a card sliding in from the right with speed streaks (0.18 s); a split screen opening from its divider (stacked top and bottom in a reel); grid panels rising staggered (0.1 s apart); a punch-in (0.3 s ease-out to ~1.25×) on the culprit; a **mask transition** where a photo grows out of a map shape. No dissolves, no page turns, no 3D flips.
- **Pace**: a strong action within 0.5 s of every shot; no frame flat for more than 1 s (rolling counters, line drawing, highlighter sweeps, slow pushes keep it alive); one held breath (2–3 s) after the turn; two real silences.

## 4. Caption card (the subtitle *is* the graphic)

- **The line**: Inter Tight 900, 88 px in 16:9 and 84–96 px in a reel (verdict lines up to 112 px), ivory `#F7F5EF`, 20 px dark soft shadow. Split into 2–3 chunks; each chunk slams 0.12 s after the previous: scale 1.3 → 1 in 0.13 s (back ease, overshoot 1.6), opacity full in 0.04 s. One line in 16:9; at most two stacked lines in a reel.
- **Keyword**: one word inside a chunk; a honey-yellow block `#FFC21A` wipes left → right in 0.12 s behind it, and the word turns ink `#0E0E0C`. One keyword per caption, at most.
- **Short enough to read**: if a line would wrap in 16:9, or need three lines in a reel, split the sentence into two captions. A caption is on screen ≥ 1.8 s and ideally ≥ the spoken line + 0.6 s. Numbers as digits.
- The captions come from the same word timings as the voice (edit-video's `voice.py`), so every chunk slams on its word.
- A text-only beat (caption with no voice) is native to the style: use it for the breath after the turn.

## 5. Graphics

- **Ledger card** (the data-card ground): `#151512` sheet, faint ruled lines every 54 px (4.5 % white), a thin red double margin near the left edge — the "account book" that ties every chart together. It slides in from the right over 0.18 s; inside, a slow push (×1.025–1.03 over the shot).
- **Colour meaning**: honey `#FFC21A` = the point / gains / the highlight; red `#FF4A3D` = losses, the spike, the bad number; ivory = everything else; grey `#8D8B83` = labels and units; `#5E5C55` = the bars that don't matter.
- **Numbers**: Inter Tight 800 with fixed-width digit cells (`font-variant-numeric: tabular-nums`, or one cell per digit), so a rolling counter never jitters. Counters roll with ease-out and turn their colour when they arrive. Units set smaller after the number.
- **Charts**: titled top left (Inter Tight 900, 64 px, at most four words so it can be read in the shot) with one grey line under it; lines draw segment by segment (ease-in-out); the key point gets a bigger dot, an expanding ring (0.7 s) and a block label; bars grow from the left one after another (the first one slower and longer if it is the point).
- **Map**: shapes from Natural Earth, projected, sequential fill in five steps of one hue, regions without data in dark grey with a "no data" swatch; the subject outlined in yellow with a leader and a label; the map pushes in on it. Maps follow [directing](../../../references/directing.md#maps).
- **Documents**: the PDF page rendered at 220 dpi as white paper on a dark desk (±1–2° tilt, soft shadow, vignette), pushed in slowly; highlighter rectangles placed from `pdftotext -bbox` coordinates, `multiply` blend, swept left → right in 0.3–0.5 s; the number read from it is re-set as a big yellow block over the page. The printed text is picture; what must be read is re-set in type.
- **Split screen**: two halves (stacked top and bottom in a reel) with a 4 px yellow divider that drops first; the "bad" half desaturated, darkened and tinted red, the "good" half in full grade; a label block and a counter in each; a shared stamp centred on the divider.
- **Grid**: three panels (632 px wide, 12 px gaps; rows in a reel) rising staggered; each one lights up (yellow border, label turns yellow) on the word that names it; numbered 1–2–3.
- **Freeze frame**: the shot stops on a frame, a 0.14 s white flash, punch 1.0 → 1.12, saturation drops to 45 %, yellow corner brackets close in on the subject, a timecode chip with a pause mark appears top right.
- **Title sting** (optional, never first): a yellow ruled page (the ledger again, in yellow) wipes across the left 45 % (the top half in a reel) over live footage; the title slams, a dateline chip follows; the page wipes off and the title becomes the channel bug.

## 6. Grade and image quality

- One grade for every piece of footage: `contrast(1.07) saturate(0.92) brightness(0.98)` + a 6 % warm soft-light layer; documents 4 %. Light grain over the whole frame.
- **Scale limits**: modern footage ≤ 1.5× (prepare frames at their final size with ffmpeg: crop, lanczos, `unsharp=5:5:0.45`); photos ≤ 1:1 of their source; archive material ≤ 2.5× after deblocking. Pushes stay inside those limits — a 720p source already at 1.5× gets no push.
- Remove station logos by cropping (never cover them with a caption), blur legible private details (phone numbers, names, number plates) with `delogo`, skip shots with burned-in text.
- Captions, numbers and charts are always vector, never scaled footage.

## 7. Sound palette

| Layer | What | Level |
|---|---|---|
| Voice | one brisk narrator; numbers spelled out in the text you send to the voice | compressed, ≈ 8 dB over the music |
| Music | 120 BPM pulse: kit (kick on the beat, hats on off-beats), eighth-note bass, a sixteenth-note marimba ostinato, off-beat chords, glockenspiel accents, brass stabs on the big numbers, timpani and cymbal for turns | ducked ~45 % under the voice |
| Structure | the hook hit on frame 1; a hard stop into silence before the turn (only natural sound and the question); the turn lands on a major-key hit; half-time for the threat; a snare build into the spike; a second short silence before the verdict; a major chord with bells on the verdict | |
| Foley | every graphic action has a sound: chunk slam (click + thump), counter rattle (a tick every 45 ms), whoosh into each card, highlighter squeak, camera shutter on the freeze, stamp thump on a big number, pops for labels, ticks as map regions fill, a riser into the map push | |
| Natural sound | the subject's own location sound, J-cut 0.3 s before the freeze, bed under the ending | not ducked below audibility |

Master −14 LUFS, true peak −1 dB.

## 8. Native moves

1. **First-frame hook** — kicker line, then a giant number in a yellow block rolling to its value in 0.45 s, then the unit and the subject word.
2. **Chunk slam with one yellow keyword.**
3. **Proportion by darkness** — a yellow line sweeps across the footage to the percentage; what it passed goes grey and dark; the figure appears on the dark side. Works for any "X % of …".
4. **The document says it** — headline or sentence highlighted from PDF bbox coordinates, then the number popped as a yellow block over the paper.
5. **Freeze and question** — the image stops on the viewer's question, music cut to silence.
6. **Ledger split** — two counters racing side by side (one above the other in a reel), the difference stamped after both settle.
7. **Lit grid** — three ways / three causes, each panel lighting on its word.
8. **Punch and circle** — 0.3 s punch-in on the culprit, a circle drawn round it, a leader to its name.
9. **Map to ground** — the map pushes into a region, then a photo of that place grows out of the region's outline.

## 9. Material

1. **Ask the user first** whether they have their own footage, photos, documents or data (and the rights to them). Their material comes first; the sources below are the fallback.
2. **Where to look** (judge every file on its own page, not the search result):
   - **Wikimedia Commons** (video and photos): read the licence on each file page. Fine: CC0, public domain, CC BY (credit author, title and licence on screen and in the credits). Not used: CC BY-SA, "no known restrictions", unclear licences, YouTube re-uploads, colourised or "restored" versions.
   - **U.S. federal agencies** (USDA, USGS, NASA, NOAA, NARA): works of federal employees are public domain; check that the page does not credit a contractor or a third party. NASA: https://images.nasa.gov. NARA: https://catalog.archives.gov.
   - **Internet Archive**: only items whose own page states public domain or a CC0/CC BY licence; U.S. works published before 1931 are public domain.
   - **Library of Congress**: read each item's rights statement; "no known restrictions" is not enough.
   - **Official documents and data** (reports, statistics, filings) from the publisher's own site: the source of every fact; keep a facts file (claim, URL, quoted wording, derived sums with their arithmetic).
   - **Map geometry**: Natural Earth (public domain).
3. **Before downloading, tell the user** what you will fetch, from where and under which licence, and keep within a size budget. Log each file's licence, author, page and the seconds used. Wikimedia rate-limits bursts (HTTP 429): one request at a time with pauses.
4. **People on screen**: no close-up or slow motion of an identifiable private person; public figures and people in the news event are fine. Never use generated images as footage.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- A DOM composition with one paused GSAP timeline: footage as `<video>` or image-sequence layers, captions and cards as HTML over them. Each shot is a function that adds its tweens at its start time; a `SHOTS` table of start times and shot names drives the cuts.
- Prepare every video shot at its display size first (crop to the band, lanczos, `unsharp`, `delogo`), so nothing scales up at render time.
- Captions come from the voice's word timings: each chunk's slam is keyed to its first word.
- Charts and maps in SVG (d3-shape and d3-geo work well); the document page as a 220 dpi PNG with the highlight rectangles drawn over it.
- One cue per visible event in `cues.json` (slam, tick, pop, shutter, swish) for edit-video's `sfx-sync.mjs`; music and natural sound are mixed with them.

## 11. Pitfalls

- **Text that can't be read in its shot.** Chart titles at most four words; ornamental stamps (datelines) must recur readably elsewhere; check every frame where text changes at phone size.
- **Wrapped captions in 16:9, three-line captions in a reel** read as a slide. Split the sentence instead.
- **The voice running to the cut**: lines that end on the cut feel rushed; speed the voice slightly or shorten the line. Very fast synthetic voices start to mangle names.
- **Homophones in the transcript**: "requeen the weak" was heard as "week"; "varroa mite" as "might". Rewrite the line ("give old ones a new queen", "varroa mites") so the word timings come back right.
- **Words stronger than the source**: the report says "stressor", not "killer"; quarterly losses summed are not "annual net loss". Write what the source says.
- **Footage from elsewhere**: illustrative footage never carries a place label it doesn't have; dates on photos are stated in the credit.
- **Blank first frames on transitions**: start split/grid/sting animations 0.1–0.15 s before the cut so frame 1 already has picture.
- **Station logos**: crop them out; never park a caption over a logo.
- **The app's buttons**: in a reel, a caption or number below y 1248 or right of x 900 is hidden under the app's text and buttons; on YouTube, the bottom 12 % is under the player controls.

## 12. Variation space

The agent decides per video: topic, the turn, which formats are spent where, footage, the channel's fictional name and colour (keep one accent colour), the title.

- **Three structures:** the inverted pyramid with a mid-reel turn (bad number → "really?" → the document says otherwise → why); a list of three that turns on the third; a countdown of numbers that ends on the one that matters.
- **Three openings:** the biggest number on the first frame; the document headline highlighted in the first second; a freeze on the event with a question.
- **Three endings:** a two-part verdict caption on footage with music returning after a silence; back to the hook's number, now re-read; the last data card's key point becoming the closing caption.
