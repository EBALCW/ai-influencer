# Broadcast News Package

> A television newsroom's on-air package, built entirely in code: a sting that becomes the channel bug, a rundown of today's stories that opens and closes the bulletin, a lower-third strap that never leaves the bottom of the frame, and full-frame graphics (split-flap price boards, a line breaking a threshold, explainer maps, documents flying out of a city, quote cards, spec cards with proportion bars, stamps) that carry the facts. The style is the **package system plus its cutting rules**, not a drawing style. A 9:16 reel, or a 16:9 video for YouTube, in a clean frame: no burned-in subtitles, no news crawl.
> References (grammar only): evening network news headline menus, financial-channel market graphics, European news channels' explainer maps, tech-desk spec cards. Never copy a broadcaster's logo, set, fonts, colours, music or idents, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Backgrounds, plates and maps bleed to every edge; the package stacks inside the safe box.

| Zone | Position | Content |
|---|---|---|
| Content | x 72–900, y 380–1040 | the full-frame graphic, stacked: rundown date block above its rows, split-flap old value above new, spec-card groups one above the other |
| Channel bug | right edge x 900, y 280–350 | the plate, scaled |
| Corner tag | x 72, y 280, 300×56 | as in 16:9 |
| Category tab | x 72, y 1060, 44 high | one word |
| Source line | right-aligned at x 900, y 1086 | mono 13 px, ≤ 30 characters |
| Strap | x 72, y 1108, 756×120 + 72 px ink end block | headline 44 px + one detail line 24 px |

- **The first 3 seconds.** Cold open on the biggest graphic: frame 1 is the split-flap board mid-flip (or the threshold line one step from the break) with the strap already up; by 0.5 s the tiles land and the ×2 callout stamps in; by 3 s the strap flips to the line that says why it matters, and the plate flies in as the bug. No full sting first.
- **Length and pace.** 30–45 s at 120 BPM: the hook graphic, a 2 s rundown of three rows, three items of 8–10 s with one fact per screen and a package action every 0.5–1 s, then the rundown ticked.
- **Captions.** No burned-in subtitles: the strap and the graphics carry the meaning with the sound off; upload the `.srt` where the platform accepts one.
- **Sound.** The pack's `hook-impact` on the cold open and on the threshold break after its beat of silence, `zoom-swish` on every band wipe, `ratchet` under the split-flap tiles, `thock` for a stamp, `clean-ding` as each rundown row lands and each tick lands at the close. The news theme comes from CC0 samples or the user's own theme.

### YouTube (1920×1080)

- **Layout.** Section 2 as written: the strap group already ends at y 938, clear of the bottom 12 % where the player's controls appear, and the content (x 96–1824) and bug sit inside the 5 % margins.
- **Length and structure.** 3–8 min at 30 fps. The rundown is the chapter list: each item is a chapter, opened by the band wipe and the strap tab flipping to its category (no item cards). Re-hook every 30–60 s with a new full-frame graphic, a map long take, a stamp or a threshold crossing; the rundown returns ticked at the end.
- **The first 10 seconds.** The biggest graphic first, the question ("why did it fall 20 %?") by 5 s, the promise (the rundown: "four stories this week") by 10 s; the sting and its fly-to-bug follow.
- **Captions.** A clean frame: no burned-in subtitles; ship the `.srt`.
- **Thumbnail.** The split-flap board with old and new value and the ×2 callout, up to three words on the strap's tab.

### Good for

News round-ups, weekly bulletins, market updates, launch and earnings recaps, internal company news, election and sports results.

## 1. Essence, and what it is not

1. **One package system, used consistently.** Every graphic is built from the same few parts: a brand plate (parallelogram), a tab in the accent colour, a paper strap, ink cards with an accent top edge, mono datelines, stamps. Viewers read the system before they read the words.
2. **The bulletin's order.** Sting → rundown ("today we have four stories") → item → item → … → back to the rundown, ticked off → sign-off. Each item opens with its category on the strap's tab and its date on the first graphic.
3. **One fact per screen.** A full-frame graphic states one thing: the price, the break, the two stocks, the place, the two letters, the quote, the verdict.
4. **The strap holds the headline.** One lower-third strap is on screen from the first story to the recap and changes its words with a vertical flip; the picture above it is free for the graphic.
5. **Clean panel.** No crawl, no burned-in subtitles; subtitles ship as a separate `.srt`. The frame is the graphic, the strap, the bug and a source line.

Not **Caption News** (that is captions-first social video: huge slammed captions are the lead, no rundown, no strap; here type is small and orderly and the graphics lead). Not **Data Storytelling** (one chart per beat, never a dashboard; the chart is an insert in a bulletin). Not a keynote: no centred title-and-bullets, no page turns. Not a studio show: no virtual set, no anchor, no fly-throughs — the package is flat graphics over ink.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Content | x 96–1824, y 56–770 | the full-frame graphic; when a strap is up, nothing important below y 770 |
| Lower-third strap | tab x 96 y 786, 48 high; strap x 96 y 834, 1250×104, + 120 px ink end block | category tab (accent, ink text, one word), headline 50 px + one detail line 27 px |
| Source line | right-aligned at x 1824, y 880 / 908 | `SOURCE: …` mono 13 px + the date on the second line, 75 % opacity; ≤ 36 characters or it slides under the strap's end block |
| Channel bug | top right, plate centre (1739, 86), 0.327 of the sting plate | the plate plus the channel's short name |
| Corner tag | top left x 96 y 56, 330×64 | `ILLUSTRATION · GENERATED` on generated plates, `SCHEMATIC` on schematic charts; flips in and out 0.2 s |

The strap group sits 70 px higher than a broadcast lower third so it clears the bottom 12 % of a YouTube frame. Content layers sit lower than a subtitled layout would put them (a 60–110 px downward shift) so the strap does not leave an empty band above it. When you remove subtitles and the crawl, re-lay the page; never leave the space they used.

## 3. Package parts (specs)

| Part | Spec | Rules |
|---|---|---|
| Sting | 0–1.5 s | two accent slashes (0.04, 0.10 s) → the plate slams in with an overshoot, an impact ring and shake (0.16–0.42) → letters drop in one by one → wordmark and dateline open from the centre → a glint → the plate flies to the top right and **becomes the bug** while a vertical band wipes into the first shot. A hit within 0.4 s |
| Brand plate | parallelogram 520×180, accent gradient, ink and gold bars at the left, name in condensed 800 | the same object is the sting, the bug, the desk front and the end card |
| Rundown | left: date block (big numerals, month, week); right: three rows, 1024×140, number block in accent | rows flip in vertically on the beat (back ease) with a glint; at the close the same object returns and each row is ticked |
| Lower-third strap | see §2 | enters with the first story, flips (new words up from below, old up and out, 0.32 s; the tab flashes white when the category changes), leaves with a slide when the recap starts. A **profile** version (tab `PROFILE`) names a speaker |
| Split-flap board | tiles 220×130, top and bottom halves clipped separately | old value and new value on the same board, so the change reads in one look; ×2 / +x % called out to the right |
| Threshold chart | line from the peak, the threshold as a dashed gold line | the line head advances one trading day per step; the last step crosses the threshold in accent with a shake and a ring; the readout panel slides in after; axes show only what the data supports |
| Bars | grow from a zero line downward for losses, values roll | a reference line at the shared threshold plus a badge |
| Explainer map | the same projection, one long take | members light in order of distance from the city; the city label, the institution label with leader, a stamp; the camera pushes, then pans to make room |
| Documents | 380×490 paper, ink header | fly out of the city dot on an arc (0.5 s, scale 0.08 → 1, rotation settles); check boxes tick on the voice's key words |
| Quote card | ink background with the package's light streaks, a large accent quotation mark lands first, lines push up one by one (0.18 s apart), then a one-line gist in the video's language when the quote was said in another, a gold rule, name, occasion and date | the official wording, in the language it was said; never paraphrase inside quotation marks; an underline sweeps the key word as the voice says it |
| Spec card | eyebrow (source · date), the product name pushed up from a mask, a category stamp, proportion bars on one scale (the whole vs the part, values rolling), a percentage badge, a context chip; a second group on the right for the hardware or the place, filling cell by cell, joined by a bracket to its total | one scale for every bar, so the proportion is true; every number from the source page |
| Stamps | accent fill or ink with a double accent frame, −6° to −10° | land from 1.9× in 0.16 s with an expanding ellipse; one per story at most |
| Transitions | vertical band wipe (accent 84 px + ink 5 px + gold 14 px edge, 0.3 s) between stories and programme parts; hard cut + timpani inside a story; slanted wipe into the end card | nothing else: no dissolves, no 3D flips, no page turns, no fly-throughs. **The package layer travels with its picture**: under a wipe each side draws its own strap words, tab, source line and corner tag (old state on the old side, new state on the new side), so the band brushes the headline over; on a hard cut they change on the same frame. Strap words never flip or overlap. The incoming picture's entry animation starts under the band, so its first revealed frame already has content |

## 4. Colour

| Role | Value | Use |
|---|---|---|
| ink | `#121417` | backgrounds, panels, strap end block |
| ink2 / ink3 | `#1B1E23` / `#22262C` | cards, land on maps |
| accent (yellow) | `#F2CF1D` (light `#F8DE4A`, dark `#D8B30C`) | plate, tabs, band wipe, bars, stamps, the line that breaks |
| gold | `#D4B064` | thresholds, datelines, source lines, light fins, badges |
| paper | `#F4F1E8` | strap, documents, the chart line |
| breaking | `#FE6B3D` | only for BREAKING and LIVE. A weekly round-up has neither, so it never appears |

Structure to keep when you change the brand: one accent + one gold-like secondary + paper + ink, and a reserved alarm colour. Ink text on the accent; on paper, secondary lines in a dark olive (`#6E5A1E`) because gold is too weak there.

## 5. Type

- Barlow Condensed 800 (headlines, strap, numbers, names, the plate), 700 (labels), 600 (secondary lines, quotes), 600 italic (the end-card title).
- Mono: IBM Plex Mono 500 for datelines, sources, axis labels, all caps with 1–4 px tracking.
- All OFL from Google Fonts, subset to the characters used (subset again after any text change). No handwriting faces in this style.
- Every label is one line; never wrap.

## 6. Picture layer and grade

- When there is no footage, the picture layer is data graphics drawn in code plus, at most, a few **illustrative plates** (generated or stock), each tagged `ILLUSTRATION` for as long as it is on screen. They set a mood (a server room behind a model launch, a wafer behind chip stocks); they never stand in for the event, the place or the people.
- One grade for every plate: greyscale → auto black/white points (0.5 / 99.6 percentile) → γ 1.05 → 35 % S-curve → black 8, white 232 → duotone `#0E1013` → `#ECE7D8`, plus a left-dark ink gradient for type, a 50–55 % vignette and 7 % overlay grain cycling through six tiles. Graphics and the package are never grained.
- Real footage, if you have it, takes the same grade path; modern footage ≤ 1.5× scale, archive ≤ 2.5× after deblocking; crop out station logos.

## 7. Editing grammar

- **120 BPM grid**, beat 0 at the end of the sting (1.5 s). Every cut and wipe on a beat or half-beat.
- **Shot lengths**: sting 1.5 s; rundown 4–5 s; story shots 3–7 s; a map long take (6–12 s) as the bulletin's breath; a comparison stays until every item has been fully on screen ≥ 2.5 s.
- **A package action every 0.5–1 s** inside a shot (flip, count, stamp, tick, strap change, map light, line step). No frame flat for more than 1 s; a strong action within 0.5 s of every cut.
- **Date every story**: a weekly bulletin's items happen on different days; the date sits in the rundown row, the eyebrow line, the readout or the document.
- **The order inside an item**: what (the name or the number) → how big (the line, the bars, the price board) → who it hits or who said it (bars, documents, a quote) → the verdict stamp.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Anchor voice | one narrator in the video's language, one sentence per graphic, starting 0.1 s after the cut; HP 90 Hz, 3:1 compression. The user's own recording replaces a synthetic voice whenever they have one | music ducked ≈ −7 dB and its 1.2–5 kHz band thinned under speech |
| News theme | 120 BPM, minor key: spiccato violins in root–fifth–octave eighths, pizzicato bass on the beat, horn pads, a low-passed 16th-note saw pulse, kick on 1 and 3, snare on 2 and 4 | full under the rundown and the first story |
| Section moods | markets: violins down an octave, tremolo, four-on-the-floor kick (heartbeat); policy: pizzicato and horns only | |
| Signature hits | sting tutti; glockenspiel notes as the rundown rows land; timpani on hard cuts and story changes; one beat of silence before the biggest break, then the heaviest hit of the video; a held drone after the verdict stamp; a major-key lift for the last story; tutti on the end card | |
| Foley | whoosh on wipes, flap clicks on split-flaps, stamp thump + clack, trading-room ticks under market charts, map clicks per lit country, a sonar ping on a city, paper and typewriter ticks on documents, click + glockenspiel on ticks | |
| Room | server-room hum under a tech plate, soft air under maps | very low |

Master −14 LUFS, true peak −1.2 dB. Samples: VSCO 2 CE and VCSL (CC0); foley synthesised or from a free sample library.

## 9. Native moves

1. **Sting becomes the bug** — the brand plate slams in, then flies to the corner and stays there for the whole bulletin; opening and programme are one object.
2. **Strap tab = category** — the strap's tab changes category (MODELS, MARKETS, POLICY …) with a white flash when a new story starts; no separate item cards between stories.
3. **Rundown, then ticked off** — the same list opens and closes the bulletin; at the end each row gets its tick.
4. **Spec card** — a launch reduced to its proportions: the whole and the part on one scale, then what it runs on, joined by a bracket to the total.
5. **Strap that never leaves** — one strap group from the first story to the recap; words flip, the strap itself never exits mid-programme.
6. **Split-flap before/after** — old and new value on one board, each tile flipping from the old to the new.
7. **Breaking the threshold** — a line advances one period per step towards a dashed threshold; the music stops for one beat before the last step and the crossing gets the heaviest hit.
8. **Date in the eyebrow** — every graphic's eyebrow line carries source and date in mono caps, so a weekly round-up never blurs which day each item happened.
9. **City sends the letters** — on a map long take, documents fly out of the sending city to their addressees; one world→screen function keeps labels and documents attached through push and pan.
10. **Quote card + verdict stamp** — the official's own words in type, with name, occasion and date; an underline on the key word as the voice says it; one stamp.

## 10. Material

1. **Facts first.** Every on-screen number and every sentence of the voice comes from an official source (the company's own page, the exchange's data, the institution's press release or speech), recorded in a facts file with claim, URL, quoted wording and any arithmetic. When a fact exists only in a news report, attribute it on screen and in the voice ("… reports") and keep to the plain claim; never put a single report's allegations about a real company or person on screen.
2. **Data.** Draw charts from real series only; when you have just a few reported numbers, draw a *schematic* line, tag it `SCHEMATIC`, and label only what you know. Exchange closes: the exchange itself, the central bank's statistics portal, or a market-data file whose source you log.
3. **Pictures: ask in this order.**
   a. **The user's own images** — photos, b-roll stills, their logo and colours (the package is rebuilt around their brand). Use these first.
   b. **Generated illustrative plates**, if the user wants them. Before generating, tell the user how many images and what each shows (one line per plate). If an image tool is available to you, make them and save JPEGs into the project's assets; otherwise give the user the prompts and the target file names, and they drop the images in. Prompts ask for no text, letters, logos, flags or people.
   c. **No generated images**: public-domain, CC0 or CC BY photographs (licences below), or abstract backgrounds drawn in code (gradients, grids, light fins — the package already carries the frame).
   Whatever the source: every word on screen is typeset in code, never baked into an image; a generated plate is only ever an illustration behind a graphic, tagged `ILLUSTRATION` for as long as it is visible, and never stands in for the event, a place in the news, or a person. No generated anchor.
4. **Photo and footage licences** (judge each file on its own page, not the search result):
   - **Wikimedia Commons**: CC0, public domain or CC BY (credit author, title, licence on the end card and in the credits). Not used: CC BY-SA, "no known restrictions", unclear licences, YouTube re-uploads, colourised or "restored" versions.
   - **U.S. federal agencies** (NASA, NOAA, NARA, USGS…): public domain; check the page does not credit a contractor or third party.
   - **Internet Archive**: only items whose page states public domain, CC0 or CC BY; U.S. works published before 1931 are public domain.
   - **Library of Congress / national archives**: read each rights statement; "no known restrictions" is not enough.
   - **Institutions' audiovisual services** (for example the European Commission's): read their reuse terms per item; many require attribution and forbid implying endorsement.
   - **Maps**: Natural Earth (public domain), via `world-atlas` TopoJSON; maps follow [directing](../../../references/directing.md#maps).
5. **Before downloading, tell the user** what you will fetch, from where and under which licence; log each file's licence, author, page and the seconds used, and keep the raw downloads under ~1.5 GB.
6. **Logos**: never use a company's logo for a company in the news; set its name in type.
7. **People**: public figures in the news can be named on a profile strap; no close-up or slow motion of private individuals.
8. **Voice and music**: ask whether the user has a recorded anchor, a preferred voice or a theme of their own before synthesising one.

## 11. Pitfalls

- **Package left behind.** If the strap, source line or tags are drawn once on top of everything, a wipe changes the picture under yesterday's headline and the strap catches up 0.3–0.5 s later. Draw them per picture, inside the wipe's clip.
- **Leftover layout.** Removing subtitles or a crawl without moving the content down leaves a dead band above the strap.
- **Masked type peeking in.** A push-in title clipped by a mask shows its top edge before it moves if the travel distance doesn't clear the mask; start it fully below and don't draw at progress 0.
- **Words stronger than the source.** "Request for information" is not "investigation" or "penalty"; write "no fine, no case opened" or "for the first time" only if a source says so — and check the institution's own pages, which can contradict a report ("first requests" may have gone out months earlier).
- **Thresholds depend on the reference.** "Bear market" = −20 % from *which* high? Name the reference on the axis; from a different peak the claim can be false.
- **Attribute what only a report says.** When the official source does not name the companies, the graphic carries "reported by …" and so does the voice.
- **A schematic posing as data.** Rolling counters on a close price flash values that never existed; set the close with a mask push instead. Don't label axes the data doesn't support.
- **Source lines under the strap.** Right-aligned mono 13 px: ≤ 36 characters.
- **Stamps over key words.** A stamp hit can mask the voice ("fines"); take the brass off the stamp and low-pass its clack.
- **Gold on paper** has too little contrast: use ink or dark olive.
- **Generated plates** carry stray corner marks: crop them in preparation.
- **Short preview text.** Rundown rows are previews of the stories and are too short to read in the opening; that is fine, because they return in the recap and as straps.
- **Names in synthetic speech.** Spell brand names, model numbers and abbreviations the way they should sound in the text sent to the voice (a respelling, a number written as a word, an abbreviation without dots) while the strap and subtitles keep the real spelling; when speech-to-text mishears an unusual name, compare it with the expected transcript instead of rewriting the line.
- **The app's buttons**: in a reel, the strap, tab or source line below y 1248 or right of x 900 hides under the app's text and buttons; on YouTube, the bottom 12 % is under the player controls.

## 12. Variation space

Decide per video: the channel's name, plate and accent colour; how many items (one lead with a long package, three or four equal items, a five-item round-up); which full-frame graphics each item needs; where the long take goes; the anchor's voice.

- **Three structures:** rundown → items → rundown ticked (round-up); one lead package with a correspondent two-box and a short "also today" grid; a countdown of items (election-night, sports results).
- **Three openings:** sting → rundown (YouTube, after a cold-open hook); cold open on the biggest graphic, then the sting; sting straight into the first story with the rundown as a recap only.
- **Three endings:** rundown ticked → end card; a "coming up next week" teaser card; the last stamp freezing into the end card.

## 13. Build

Follow [building](../../../references/building.md). For this style:

- The package is flat graphics, so DOM and SVG with one paused GSAP timeline fit it: the plate, tabs, strap, cards and stamps as elements; each split-flap tile as a top half and a bottom half clipped separately, flipped with `scaleY`; maps in SVG with d3-geo and `world-atlas` TopoJSON, one world→screen function shared by labels and flying documents through every push and pan.
- Build the package layer inside each shot, not once on top: every shot carries its own strap words, tab, source line and corner tag, and a wipe clips old shot and new shot along the band, so the headline is brushed over with the picture.
- Time everything on the 120 BPM grid from the end of the sting; voice lines start 0.1 s after their cuts, and underlines and check-box ticks land on the word timings.
- Plates are graded in preparation (Python or ffmpeg: the duotone chain from section 6) and saved at display size; the six grain tiles are chosen per frame from a hash of the frame number.
- One cue in `cues.json` per wipe, flap tile, stamp, rundown row, tick, map light and ping; the theme, with its section moods and the beat of silence before the biggest break, is mixed with them.
