# 1920s Newsreel

> A sound newsreel of the late 1920s, cut from real archive material: a searchlight-and-globe ident with a brass fanfare, a newspaper that spins into the lens, a fast and cheerful announcer on an optical soundtrack, place-and-date cards, maps, magazine pages and documents, wipes, flips and irises, and a hot band that can stop dead for the punchline. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): the American sound newsreels of 1927 into the 1930s — the ident ritual, the announcer's patter, one story per location, the stinger after the last story; the item title card of the British newsreels; Hollywood's **spinning newspaper** montage; **1920s hot dance bands** (Charleston rhythm, banjo, tuba). Never copy a real newsreel's name, logo, globe design, typeface or fanfare.

## Formats

### Reel (1080×1920)

- **Layout.** The gate becomes a full-width band with black above and below; the picture never leaves it, and type may sit in the black, where it needs no strip.

| Zone | Position | Content |
|---|---|---|
| Gate | 1080 × 788 (1.37:1), y 360–1148, radius 26 px | all picture, with the projection look; a 480-line transfer lands at ≈ 1.64× |
| Place card | x 72, y 282, in the black above the gate | "PLACE · DATE" over one short line |
| Subtitle | centred on x 540, max 720 px, baseline y ≈ 1218 | Oswald 500, 44 px, cream, black stroke |

  Splits stack as two 1080 × 430 panels inside y 290–1170 (the push-over runs vertically), quads as 2 × 2, a grid deal as three rows of two. Tall print gets a tilt down the column, never a taller gate.
- **The first 3 seconds.** Frame 1 is the spinning paper half-way through its spin; it slams with its jolt by 0.5 s, on the announcer's first exclamation; by 3 s the punch-in has found the one detail and the question is said. The ident never opens a reel: it signs off.
- **Length and pace.** 20–45 s at 190–220 BPM (a bar is 1.1–1.3 s): two or three stories, shorter towards the end; archive shots 1–2.5 s, print 2.5–4 s; the band stop before the button is the held breath.
- **Captions.** The subtitle line is the only caption layer, in the spoken language; print in shot is never re-typed.
- **Sound.** The pack's `zoom-swish` for the paper's spin, `hook-impact` on the first slam, `camera-shutter` per still in a grid deal, `tick` for telegraph clicks along a map arc, `latch` for the carbon arc and the iris. The band, projector bed, needle drop, page turns and pencil squeak come from a free sample library, a public-domain 78 or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. The subtitle line sits at baseline y 940, above the bottom 12 % where the player's controls appear; place cards already clear the 5 % margins.
- **Length and structure.** 3–8 min at 24 fps. A chapter is one story (one place, one kind of material), opened by an item title card and closed by a band stop. Re-hook every 30–60 s with a map push to a new place, a needle drop, a split duel or a grease-pencil freeze.
- **The first 10 seconds.** The spinning paper and its headline first, the announcer's question by 5 s, the promise ("by the end you'll see who was right") by 10 s; the ident ritual follows as the channel sting.
- **Captions.** The subtitle strip is part of the look: burned in, plus an `.srt`.
- **Thumbnail.** A grease-pencil freeze: the telling archive frame ringed and arrowed, with up to three words in silver Limelight.

### Good for

History stories, fads and eras, anniversaries, "on this day" reels, brand origin stories, retro launch ads.

## 1. Essence, and what it is not

An edit style: the look is in **how real material is arranged, cut, captioned and carried by sound**, not in a drawing technique.
- **Archive in a projected gate**: 1.37:1 picture, full height, rounded corners, black outside; everything inside it shares one silver grade, gate weave, flicker, scratches and dust.
- **News objects** do the explaining: newspapers, magazine pages, books, telegrams, maps, records. They are filmed (spun, slammed, panned, turned, underlined), never typeset as slides.
- **A voice talks over everything**: short exclamations, half joking, never a lecture.
- **Music is a band, and it edits**: cuts land on the band's beats; the band stops dead to let a line land; a period record can take over the soundtrack.

Not **1920s Silent Film**: that style is a drawn, inked comedy projected between velvet curtains, with intertitles instead of voices, a cinema pianist and no foley. Here nothing is drawn but the packaging; the footage and print are real; somebody always speaks; the soundtrack is brass, banjo and records; titles are news captions (place · date), not dialogue cards; there are no curtains and no theatre.
Not a documentary with a "vintage filter" either: no talking heads, no slow Ken Burns drifts, no modern lower-third bars.

## 2. Materials & rendering

- **Gate**: 1480 × 1080 inside 1920 × 1080 (1.37:1), corner radius 26 px, pure black outside. Nothing is ever drawn outside the gate.
- **Two layers**: the picture layer (footage, print, maps, cards) gets the film look; the type layer (place cards, labels, subtitles, the record inset) stays sharp and steady. Grease-pencil marks belong to the picture (they weave with it).
- **Base grade** for every source, before anything else: greyscale → percentile stretch (0.6 % → black, 99.6 % → white; print: 0.2–0.3 % / 99.0–99.7 % with the black lifted to 26–30, like newsprint) → mild S-curve `x + 0.18·(x−0.5)·(1−|2x−1|)` → output 14–238. **Moving footage uses one level set per clip** (sampled across all its frames), never per frame.
- **Projection look** (picture layer only): warm silver (`multiply #efe7d6`, `screen #17140f`), vignette 0.42 H → 0.95 H, flicker ±3.5 % per frame + 3 Hz drift, gate weave ±1.6 px / ±2.2 px (value noise), 0–3 vertical scratches that live for 9 frames, 0–4 one-frame dust specks. Grain is added once, over the finished frame, never in the picture layer as well.
- **Archive film upscaling**: at most ~2.5×. NTSC transfers (720 × 480) are treated as 4:3, cropped to 1.37 and scaled 2.31× to 1480 × 1080: `hqdn3d=4:3:6:5` → `lanczos` → `unsharp=5:5:0.55` → base grade. Frames are exported at 24 fps as JPEG sequences and played by `floor((t − t0) · 24)`, so renders are deterministic.
- **Print**: newspapers, magazines and books at their scan resolution; crop pages to the relevant fold so unrelated (and sometimes ugly) old stories never come into view.
- **Code-drawn packaging only**: the ident (sunburst, two searchlights, wire globe), item title cards, maps, the end card. Never generate "archive" pictures.

## 3. Colour logic

- **Monochrome warm silver** for the picture; values do the work (check every shot as a thumbnail).
- Type is cream on near-black (`#f3eee4` / `#d6cfc0` on `rgba(12,11,10,.8)`), framed by a 2 px cream rule; marks are a slightly warm white grease pencil; underlines on printed pages are dark soft lead.
- Packaging silver: Art Deco gradient lettering `#fff → #d9d4ca | #9e978a → #efebe2` with a hard "metal" break at the middle and a black outline (0.12 em).
- No colour accents, no sepia wash on top of the silver, no colourised archive.

## 4. Type & subtitles

| Use | Face (all OFL) | Spec |
|---|---|---|
| Ident, item cards, end title | Limelight | 104–118 px, silver gradient, black outline |
| Second line on cards, end title | Oswald 500 | 34–44 px, letter-spacing 10–16 px, `#ece7dc` |
| Place card, labels | Oswald 600 | 26–34 px, letter-spacing 4–6 px, upper case "PLACE · DATE" |
| Subtitles | Oswald 500, 42 px | one line at the bottom of the gate (baseline y 940), black stroke 8 px |

- **Place card** (the newsreel's segment title, instead of full-screen cards for every story): top left of the gate (gate x + 48, y 56), dark box with an inset 2 px cream frame, "PLACE · DATE" over one short line in Oswald 500; it is pulled out left to right in 0.22 s and fades 0.15 s before it leaves. Hold ≥ letters ÷ 15 + 1.5 s from the moment it is complete, so keep both lines short.
- **Item title card** (one per video at most, to turn to a new story): black, a double Art Deco frame drawn in 0.35 s with quarter-fan corners, a Limelight line over a spaced Oswald line, slow push; ≥ 2.5 s.
- **Labels inside split screens**: one per panel, top centre, same box style, enter one beat apart.
- **Subtitle strip**: the subtitles sit on a dark strip across the bottom of the gate (240 px, transparent at the top edge, ≈ 93–96 % `#0a0908` below), on every shot, fading in 0.25 s before the first cue of a run and held through gaps under 1 s, so it never blinks; print and pale footage would otherwise swallow the letters.
- **Subtitles**: one line in the spoken language, **never wrapped** (measure every cue's width in the page before rendering); a cue lasts max(1.8 s, spoken + 0.6 s) and ends 50 ms before the next. Print in shot is never re-typed as a caption: the announcer and subtitles carry its meaning, an underline points at it.

## 5. Editing grammar

- **The band is the clock**: pick a hot-dance tempo (190–220 BPM); every cut, landing, slam and label entrance sits on a beat, most cuts on bar lines; quick inserts on beat 3 or on the Charleston accent (beat 1 and the "and" of 2). When a period record plays, cut on the record's own beat (measure it), not on the grid.
- **One story = one place + one kind of material + one line of voice.** Stories get shorter towards the end (2–3 bars → 1 bar → beats), then one held button.
- **Shot lengths**: archive shots 1–2.5 s; print and documents 2.5–4 s (they must be read); comparisons ≥ 2.5 s fully in frame before the verdict; never a static frame longer than ~1 s without something moving (push, roll, pencil, flicker of a counter).
- **Transitions are the newsreel's own, each used once, as punctuation**: iris close/open, diagonal hard wipe with a bright 6 px edge, vertical-axis flip, venetian blinds (12 slats turning), clock wipe from 12 o'clock, spinning paper, page turn, panel push-over, freeze. No cross-dissolves between stories, no modern whip pans, no zoom blur.
- **L-cuts**: the announcer may run 0.3–0.5 s over a cut; a new music state may start one beat before its picture (J-cut).

## 6. Camera on stills and archive

| Move | What it does | Typical use |
|---|---|---|
| Spin-and-slam | the paper arrives as news | a headline; a telegram; a poster |
| Slow push then punch-in on a beat | from the whole page to the one detail | a headline → a photo in it |
| Pan across a wide print | a crowd, a parade, a skyline | panoramas, group photos |
| Tilt to reveal | the landmark behind the subject | a building, a monument |
| Map push | from the country to one city, into the next story | travel, spread, campaigns |
| Grid deal | many related stills land one per beat | step-by-step, collections, "all of them" |
| Flip-book | a series of stills played on the beat becomes motion | dance steps, assembly stages, before/after |
| Freeze + jolt | stop the archive on the telling frame | the punchline, the evidence |
| Split / quad | two or four places at once, side by side | comparisons, "everybody's doing it" |

Archive footage is not reframed with fake camera moves bigger than ~6 % (it already has its own camera); stills always get a move with a purpose.

## 7. Sound palette

- **Announcer**: one bright, energetic voice with a mid-Atlantic tinge, fast (well above a normal reading pace); 6–12 words per line, exclamations and rhetorical questions. Treatment as a 1930 optical track: high-pass 260 Hz, low-pass 3.7 kHz, +4 dB presence at 1.5–2.3 kHz (horn loudspeaker), tanh drive 2.0, compression 4:1, wow 0.22 % at 0.55 Hz + flutter 0.07 % at 6.3 Hz, two short wall reflections (31 ms, 67 ms). Transcribe the clean voice, and again the finished mix, to check every word survives the treatment.
- **Band** (original): tuba on 1 and 3, banjo four to the bar (accent 2 and 4), trombones on the Charleston figure (1 and the "and" of 2), snare backbeat, honky-tonk piano right hand, muted then open trumpet melody with clarinet a sixth below, woodblock pickups; a brass fanfare with timpani for the ident; a dead stop with one stab for the punchline; "da – DA!" to close.
- **Counter-music**: when the story has two sides, give the other side its own band (for example an old-time reel: fiddle, plucked dulcimer, upright piano, tuba) and let them trade bars, then half bars, in a split screen, panned left and right.
- **Archive record**: a public-domain 78 can take over the soundtrack as "the real thing": needle drop (click + surface noise), band-pass 110–6500 Hz, crackle and rotation rumble only while the needle is down, varispeed by ≤ 2 % to sit on the video's tempo; end it on its own final chord and lift the needle.
- **Foley** for every move: carbon-arc snap, rising whoosh with flutter for the spinning paper, thump + paper slap, telegraph clicks under a map line, camera shutter per still, paper flicks per flip-book page, slat flutter, page turn, grease-pencil squeak, soft-lead scratch.
- **Bed**: projector (24 Hz claw clatter, motor hum, optical hiss) from first to last frame.
- **Mix**: the band and record ducked ≈ 4–5 dB under the voice (voice ≈ 12 dB over the music), the band band-limited 95–7500 Hz with a low shelf and light saturation; two silences (a dead stop before a turn, only the projector before the button); master −14 LUFS.

## 8. Native moves

A menu; use the ones the story needs, each once.

- **The ident ritual.** Searchlights snap on with a flash in the first 0.2 s, the globe grows and turns, the name lands with overshoot, the iris closes on the globe. Built from a sunburst, two beams, a wire globe and the Deco title. *Fits:* the sign-off of any news-shaped video, or a one-second reprise after the hook; never the first frame.
- **The spinning paper.** Grows by `u^2.3`, rotation decays by `(1−u)^1.25` over 2.5 turns, three ghost copies 18 ms apart as motion blur, a vertical jolt (damped sine, 16 px) and a 3 % bounce on the slam, then push and punch in on the next beat. *Fits:* a headline, a decree, a press release.
- **The map spread.** A projected outline (Natural Earth, Albers; maps follow [directing](../../../references/directing.md#maps)), dotted arcs from the source city drawn on the beat with telegraph clicks, star pulses on arrival, place labels in screen space, an odometer of years in a corner; push into the city of the next story. *Fits:* a craze, a product launch, a migration, a campaign.
- **Grid deal → flip-book.** Stills land one per beat (shutter click each), then the camera dives into the first cell and the series plays on the beat as stop motion. *Fits:* a how-to, the stages of a process, a collection.
- **Document underline.** Slam a book or letter, turn the page, push to the paragraph, draw soft-lead underlines word-exact (positions from the scan's OCR boxes, e.g. archive.org hOCR). *Fits:* a quote, a rule, a contract clause.
- **Grease-pencil freeze.** Freeze the telling frame, jolt it, ring the detail with a hand-drawn loop, add an arrow. *Fits:* the evidence, the punchline, "look here".
- **Split-screen duel → push-over.** Two panels slide in, each labelled, each with its own music in its own channel trading bars; the winner pushes the loser out of frame. *Fits:* old vs new, rival products, two cities.
- **Needle drop.** The band cuts dead, a 78 spins in the corner, the period record plays under the archive and ends on its own chord at the freeze. *Fits:* any era that has public-domain recordings.
- **Band stop + button.** One stab, silence with only the projector, one short line from the announcer. *Fits:* the last word of any story.

## 9. Material: where it comes from

1. **Ask the user first** whether they have their own material: film or video, photographs, newspapers, letters, documents, data, a period recording. Their archive beats anything found online.
2. **If not, search sources whose licence is clear**, and log the licence, author and page of every file you use:
   - **U.S. National Archives** (films, often via Internet Archive "FedFlix" copies): federal works are public domain; donated collections need their own rights note (e.g. the Ford Motor Company Film Collection: all rights transferred to NARA in 1962, "copyright- and royalty-free" except contractor films). Universal Newsreel (1929–1967) is in NARA too.
   - **Internet Archive**: check every item's licence field and provenance; skip anything that is a YouTube mirror, a colourised or "restored/AI enhanced" version, or has no stated source.
   - **Wikimedia Commons**: read the licence template on the file page; use PD-US-expired, PD-US-no-notice, PD-USGov, CC0, CC BY. A Library of Congress "No known restrictions" (often with "Copyright-tag-still-required") is **not** enough, nor is DPLA "no known restrictions"; CC BY-SA is not used.
   - **Library of Congress** (loc.gov, tile.loc.gov; Chronicling America newspapers before 1931), **NASA**, other national archives.
   - **Print**: anything published in the US before 1931 (newspapers, magazines, books on archive.org / HathiTrust / Commons) is public domain in the US.
   - **Recordings**: US sound recordings published before 1926 are public domain in the US from 1 January 2026 (Music Modernization Act: 100 years after publication for pre-1947 recordings); UCSB Library / Internet Archive transfers (Edison, Victor) and the LOC National Jukebox give dates and matrix numbers. Check the composition's date too.
   - **Maps**: Natural Earth (public domain) for outlines drawn in code; follow [directing](../../../references/directing.md#maps).
3. **Before downloading, tell the user** what you will fetch, from where, under which licence, and how big it is; keep the raw downloads under ~1.5 GB.
4. Everything used goes into the credits (title, author, date, licence, page, which seconds). Real people: historical public figures and people in news events may appear; ordinary people's faces are never slowed down or made the close-up subject.
5. Every fact in the voice and on screen goes into a facts file with its source and the quoted wording; read the catalogue description of each film before using it (it may say what is really happening in the shot).

## 10. Pitfalls

- Catalogue descriptions matter: a picnic film can contain both old-time dances and the Charleston; use only the shots that match the claim.
- Archive transfers start and end with archive slates, "End of Recording" and white flashes; cut inside them. Remove watermarks and archive logos.
- Newspaper pages hold unrelated, sometimes offensive stories next to yours: crop to the fold you need.
- Per-frame auto-levels make footage pump; use one level set per clip.
- `destination-in` irises leave transparent corners that later turn grey under `screen` — paint black behind with `destination-over`.
- Captions that fade before they can be read fail; shorten the words, not the hold.
- A fast announcer outruns the subtitles: 6–12 words per line, and a line that won't fit on one subtitle line is split into two cues.
- Voice engines mispronounce names (Bessie → "Bestie"); rephrase until the transcript comes back right.
- Old sources are soft: never exceed ~2.5× upscale; prefer wider framings to crops.
- Grain is added once over the finished frame; don't add it in the picture layer as well.
- **The app's buttons**: in a reel, a subtitle or place card below y 1248 or right of x 900 hides under the app's text and buttons; on YouTube, the bottom 12 % is under the player controls.

## 11. Variation space

- **Era**: late silent newsreel (no voice, title cards only) ↔ early sound newsreel (this style) ↔ 1940s wartime newsreel (deeper voice, maps with arrows, march music).
- **Tone**: comic stinger ↔ straight reportage (no jokes, still fast) — not for disasters and deaths, where the jaunty grammar is wrong.
- **Material balance**: all-footage, or print-heavy when film is scarce (maps, pages, flip-books carry the motion).
- **Music**: Charleston band, march band, swing orchestra, or a period record carrying a whole section.
- **Packaging**: invent your own ident name and emblem; keep the grammar (searchlights, globe, fanfare, place cards), change the shapes.

## 12. Build

Follow [building](../../../references/building.md). For this style:

- Two layers: a canvas picture layer drawn as a pure function of `t` (footage frames, print, maps and packaging, then the projection look), and a DOM type layer over it (place cards, labels, subtitle strip) animated with one paused GSAP timeline that never gets the film look.
- The projection look steps on 24 fps even in a 30 fps reel: flicker, weave, scratches and dust come from `ts = Math.floor(t * 24) / 24` and a noise hashed from the frame number, so any seek gives the same picture; footage plays by `floor((t − t0) · 24)`.
- Prepare every clip before the render with ffmpeg at its display size (1480 × 1080, or 1080 × 788 in a reel): the NTSC chain and the base grade from section 2, one level set per clip, a 24 fps JPEG sequence. Crop print to the fold; keep its OCR boxes for underlines.
- Draw irises with `destination-in` and paint black behind with `destination-over`; ghosts of the spinning paper are three extra draws at `t − 0.018 s`, `t − 0.036 s`, `t − 0.054 s` with falling opacity.
- Cuts snap to the band's bars (beat = 60 / BPM); subtitles and place cards enter on the voice's word timings; while a period record plays, cut on its measured beats instead.
- One cue in `cues.json` for each slam, swish, still, telegraph click, iris and page; the band, the record, the projector bed and the optical-track treatment of the voice are mixed with them.
