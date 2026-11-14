# Time-lapse Symphony

> A city video cut like a piece of minimalist music: time-lapse turns traffic, crowds and clouds into rivers of light, the cuts get denser with the score's subdivisions, one thing is slowed almost to a stop, and the video ends on a hard cut to black on a downbeat. No narrator. The music carries it. A 9:16 reel, or a 16:9 video for YouTube.
> Grammar learned from the city-symphony films of the 1920s and the wordless time-lapse features of the 1980s, scored with repeating minimalist arpeggios. Nothing is taken from those films: no footage, no melody, no title lettering, no names in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Footage bleeds to every edge, without the matte. A wide 4K time-lapse becomes a 9:16 window drifting slowly across it (an HD source that can't fill it within 1.5× goes into the grid); top-down aerials and towers crop freely. Number cards and the quote are left-aligned at x 96, at most 720 px wide, within y 300–1200, over the dark part of the frame; the day ring sits at x 780–900, y 1120–1240. The grid stacks: two rows → 2 × 2 → 3 × 5 → 4 × 7; the counterpoint split puts the archive above, today below.
- **The first 3 seconds.** Frame 1 is a light river already flowing (a top-down night aerial at 5×, fully blended) on the opening hit; by 0.5 s the arpeggio has started and the falling push is moving; by 3 s the cut on the bar brings the single-camera clock racing from night to dawn, and the first number locks digit by digit: the size of the place.
- **Length and pace.** 20–45 s at 120 BPM (a bar is 2 s): arpeggio, acceleration and grid, one 3–4 s brake, a one-bar reverse flashback, the hard stop, a 3 s coda with the quote. Two number cards at most.
- **Captions.** No voice, so no subtitles: the on-screen text (numbers, the quote) is in the user's language, on the soft darkening, never on a box. CC BY credits go in the post's caption plus a 2 s fine-print card.
- **Sound.** Music only; pack sounds are folded into the score, never heard as effects: `sub-impact` doubles the organ hit on the return, `metallic-riser` sits inside a cymbal crescendo, `clean-ding` doubles the glockenspiel note as each digit locks. The organ, winds and strings come from a free CC0 sample library, or the user's music if it is additive and has a sudden held chord.

### YouTube (1920×1080)

- **Layout.** Section 2 as written, with the 1.85:1 matte. Number cards, the quote and the day ring stay above the bottom 12 % (y ≤ 950), where the player's controls appear, and inside the 5 % margins; the left margin of 168–196 px already clears them.
- **Length and structure.** 3–6 min at 30 fps, in movements (dawn, morning, noon, dusk, night), each with its own score arc and brake, each opened by the returning single-camera clock with one left-aligned Michroma word. Re-hook every 30–60 s with a new subdivision, a grid stage, a counterpoint split or a number card.
- **The first 10 seconds.** The strongest light river first, a number that sets the scale by 5 s, the promise of the clock (one place, dawn to dawn) by 10 s; a channel sting, if any, after that.
- **Captions.** Number cards and the quote are burned in; the `.srt` carries the on-screen text for muted or accessible playback.
- **Thumbnail.** A top-down night aerial turned to light, or the 4 × 4 grid at full density, with the place's name in Michroma.

### Good for

City and place films, music montages, openers and sizzles, a day at a festival or a factory, tourism and real-estate launches.

## 1. Essence, and what it is not

- **An edit style.** The picture is real footage of a place (time-lapse, hyperlapse, aerials, slow motion, archive film, photographs). The style lives in *how time is bent* and *where the cuts fall*, not in a drawn look.
- **The score is the script.** It is written first, with a clear arc: minimal repetition → acceleration → climax → a sudden stop → acceleration again → hard stop → a quiet coda. Every cut sits on a beat or a subdivision of it.
- **Machines fast, people slow.** Cars, trains, clouds and light are sped up until they become lines; the one slowed moment is something fragile (a soap bubble, steam, a flag, a flock), and people appear as crowds, tracks or long-exposure ghosts.
- **Few words, each one earned.** On-screen text is a title, a handful of numbers that state the size of the place (each from an official source), an archive date, and one line from a real public-domain text at the end.
- **It is not** a travel reel (no drone-porn montage on a pop track), a vlog, a news package, an explainer with a narrator, or a slideshow of postcards. No lower thirds with names, no headers, no centred title cards with page-turn transitions, no logo stings.

## 2. Materials & rendering

- Footage only (2D). Sources mixed freely: tripod time-lapse, long single-camera time-lapse (≥ 12 h, sunrise and sunset in the same frame), hyperlapse, drone aerials (top-down is gold), high-frame-rate slow motion, archive film (pre-1931), photographs (a pair from the same camera position is gold), a scanned page of a historic text.
- Everything is unified into one **35 mm release-print** look: 1.85:1 matte (21 px bars on 1920×1080), warm highlights, lifted blacks, highlight bloom, clumped mid-tone grain, ±0.5 px gate weave, soft vignette.
- Never generated images; never restored, colourised or speed-corrected archive copies; never YouTube mirrors of archive films.
- Upscale limits: archive ≤ 2.5× (denoise → lanczos → light sharpen → grain); modern ≤ 1.5×.

## 3. Colour logic

| Use | Value |
|---|---|
| Type (warm white) | `#EDE8DF` |
| Secondary line (what it counts, labels) | `#B0AAA0` |
| Sodium orange — the only accent (rules under numbers, source lines, crowd tracks, the day ring's hand) | `#D9772F` |
| Matte and black | `#000000` |

Grade: per-shot partial grey-world white balance first (only pixels with luminance 0.12–0.88, strength 0–0.6; **0 for night shots**, which keep their sodium and blue), then one LUT for all shots: S-curve (sigmoid slope 6.2, pivot 0.47, blended 55/45 with linear) → black 7/255, white 250/255 → R ×1.025, B ×0.965 (warm highlights, a little cold in the shadows) → saturation 0.86. Bloom: pixels above 170/255, blurred 6 px at ⅛ size, added back × (1, .82, .62); 0.09 by day, 0.15–0.2 at night. Grain: half-resolution Gaussian noise up-sampled and blurred 0.6 px, weighted `0.35 + 1.3·L·(1−L)`, strength 9/255. Archive film stays black-and-white and goes through the same LUT, so it reads as part of the same print.

## 4. Type & subtitles

- **Michroma** (OFL), capitals, tracking 0.06–0.32 em, for everything on screen. Credits: Michroma 13–16 px.
- **Left-aligned**, left margin 168–196 px, never centred, never on a box. Legibility comes from a very soft elliptical darkening behind the block (α ≤ 0.6), not a panel.
- **Number card**: the number in Michroma 84 px (44 px when three numbers stack); a 2 px sodium rule grows under it; one line (24–28 px) says what it counts, a smaller line (14–16 px) the source and year. A census-type number locks digit by digit on sixteenths (one glockenspiel note per digit); a flow number counts up from 0 in 0.6 s (ease-out). "About" numbers carry `≈`.
- **Archive date**: just the year, Michroma 22 px, bottom-left of the archive panel.
- **Closing quote**: on the page shot the whole sentence is lit; on the card, a short fragment over the last moving shot — Michroma capitals 40–48 px, the source line 14 px in sodium, fading in within 0.25 s and held just past the reading time.
- One line, in one language, never wrapped; every text block stays fully in frame at least letters ÷ 15 + 1.5 s. Text may stay up across cuts underneath it, but only while the shots under it belong to what it counts.
- `.srt`: the video has no voice, so the subtitle file carries the on-screen text (one line per cue) for muted or accessible playback.

## 5. Motion quality

- Speed is the main instrument. Shot speeds run from 0.3× to 75×; every speed above 1× uses **frame blending** (a 360° shutter): each output frame averages the source frames it covers, capped at N frames. Headlights become continuous lines, crowds become fog, clouds become water.
- **Speed ramps** are smooth (smoothstep between key speeds) and always mean something: a corridor accelerates out of real time (1× → 6×), a time-lapse ramps into a frenzy (1× → 7×), a fast shot brakes into slow motion (2.2× → 0.3× in 0.55 s) on the bar where the music stops.
- Camera moves are added sparingly in post: slow push-ins (1.00 → 1.05–1.10 over the shot), a falling push on the opening still (1.0 → 1.3 in 0.35 s, ease-out, then accelerating to ×2 by the cut). No shakes, no whip pans, no digital zooms past the upscale limit.

## 6. Camera grammar — editing

**Cut-point table (the score decides; numbers at 120 BPM and 30 fps: 1 beat = 15 frames, triplet = 5, sixteenth = 3.75)**

| Score texture | Cut length | Frames | Use |
|---|---|---|---|
| Opening hit + eighth-note arpeggio | 2 bars → 1 bar | 120 → 60 | the opening still, the first single-camera time-lapse |
| Eighths | 2 beats → 1 beat | 30 → 15 | dawn, match cuts |
| Triplets against eighths (3:2) | 1 beat → ½ beat | 15 → 7/8 alternating | morning, the montage of streets |
| Sixteenths, full ensemble | grid cells light every 1–2 frames; cells re-cut every sixteenth | 1–4 | the grid |
| Arpeggios stop, one long chord | 3–4 s, one or two shots | 90–120 | the brake: the slowed thing, the archive split |
| Sixteenths + triplets + horns | ½ beat → 4 frames → 2 frames | 7 → 4 → 2 | dusk to night, the reverse flashback |
| Dry cut of the whole ensemble, reverb left ringing | hard cut to black on the bar line | — | the hard stop |

Rules:

- **Cuts land on beats.** Every cut time is computed from a bar and beat number; shot lengths are never typed in seconds. The music is written on the same grid.
- **One long single-camera time-lapse is the clock.** It returns three or four times (night → dawn, noon clouds, a one-second nightfall, a day/night flicker), always from the same position, so the viewer knows the time without a caption.
- **Density follows the score.** The editor never cuts faster than the current subdivision, and the slowest picture sits under the place where the arpeggios stop.
- **Shape match cuts** on the beat: clock → clock, arch → arch, grid of streets → grid of cells. A small-to-large punch-in on the same shape is allowed.
- **The grid** is the split screen of this style: 1×2 → 2×2 → 3×3 → 4×4, one stage per half bar or bar, the new cells lighting up in a scattered order over the previous stage within 0.3 s (never back to black), gutters 6 px black; in the last beat the cells re-cut on every sixteenth.
- **Counterpoint split**: two halves, archive left, today right, the same kind of place or shape; the gutter grows from the centre in 8 frames.
- **Day/night flicker**: the same camera, a noon frame and a night frame alternating every 2 frames; a pair of same-position photographs alternating every 2 frames.
- **Reverse flashback**: in the last bar before the hard stop, earlier shots return in reverse order, 4 frames each, then 2 frames each.
- Transitions: hard cuts only, plus the hard cut to black. No dissolves except fades from black for the page and the end card.

## 7. Sound palette

- **Music only.** No narrator, no source sound (the footage soundtracks are other people's music), no sound effects. A narrator would turn watching into listening and would fight the score for the structure; that is why the style has none. If a voice is ever required, one short line at the very start or end, never over the cuts.
- Orchestration (sampled CC0 instruments from a free sample library): pipe organ (full and soft stops, pedal), winds staccato (flute, clarinet), strings (spiccato cellos and violins, sustained cellos, violins, double bass), horn pair for the last two bars, concert bass drum on section downbeats, suspended-cymbal crescendos into the hits, glockenspiel only for numbers locking.
- Writing: arpeggios over a one-chord-per-bar progression; additive layering (eighths → triplets over eighths → sixteenths); the *break* is all arpeggios stopping at once into one held chord (maj7 or 9th); the return is a full-organ hit; the hard stop is a dry cut of every instrument in 15 ms with the reverb tail left ringing; the coda is one soft chord that does not resolve, with the opening figure returning in quarter notes under the end card.
- Reverb: a room (size 0.7, mix 0.28) for the body, (size 0.78, mix 0.36) for the coda. Master to −14 LUFS / −1.2 dBTP, with no grain added at the end: the grain is already in the picture.

## 8. Native moves (and how they are built)

| Move | How it is built |
|---|---|
| **Light river** | Integrate the speed curve to source time; each output frame averages the source frames in its window (capped). Speed 40× / blend 30 at night, 37.5× / 24 for clouds, 75× / 30 for a one-second nightfall. |
| **Speed ramp** | speed keyframes `(t, v)`, smoothstep between them, same integrator. |
| **Brake into slow motion** | ramp 2.2× → 0.3× with motion-compensated interpolation (ffmpeg `minterpolate` mci, bidir) for soft subjects; a crossfade of the two nearest frames for thin lines such as cables, where motion compensation tears. |
| **Crowd → tracks** (people as data) | background = per-pixel median of the whole fixed-camera shot; blobs that differ by > 22/255 (scipy `ndimage.label`, area 8–900 px at half size) are people; each centroid joins the nearest one from the previous frame (< 70 px) with a 2 px line; lines fade × 0.9 per frame; the plate is darkened and desaturated as the tracks appear (0.15 → 0.55 s). Fixed cameras only. |
| **Traffic → light** | a static or slowly drifting top-down aerial at 5× with full frame blending. |
| **Grid** | a pool of 30-frame clips held at 960×540; a table of stages; light-up order scattered; the last beat re-cuts cells every sixteenth. |
| **Counterpoint split** | archive 4:3 centre 960 px | today centre 960 px, 6 px gutter grown from the centre. |
| **Day/night flicker** | two 15-frame clips from the same camera (noon, night), alternating every 2 frames. |
| **Photo that moves** | a same-position photo pair alternating every 2 frames. |
| **Number lock** | one digit locks per sixteenth while the others roll; or an ease-out count-up; the music adds one glockenspiel note per lock. |
| **Day ring** | a thin 24-hour ring bottom-right with a sodium hand and a 3-hour arc: it runs with the video's day, **freezes and dims during the brake**, and **spins backwards during the reverse flashback**. It is a graphic, not a clock reading. |
| **Reading light on a page** | scanned page, 16:9 window pushed 1.06 → 1.56 page widths, side light (bright top-left), paper tint (1, .93, .80), a Gaussian band (σ 95–140 px) over the quoted line growing to +38 %. |
| **Hard stop** | picture cuts to black on the bar line; the music's dry signal is cut in 15 ms on the same frame; only reverb remains. |

## 9. Pitfalls of the medium

- **Watermarks and slates hidden in CC footage**: corner logos (scale from the centre until they leave frame, within 1.5×), opening thank-you cards, end-card music credits, title text over the first shots. Check a one-frame-per-second contact sheet (ffmpeg `fps=1,tile`) of every source before choosing in-points.
- **Hidden cuts inside sources.** Hyperlapse reels hide 2–3-frame jump cuts and whip transitions; frame blending across a cut makes ghosts. Scan with `ffmpeg … select='gt(scene,0.25)',showinfo` and keep every clip's source window inside one shot.
- **Too much blending** turns noon clouds into grey mush: about 40 % shutter (24 of 60 frames) looks better than 100 %.
- **Grey-world balance kills night**: it washes sodium light to white. Strength 0 for night shots.
- **Tracking needs a fixed camera.** A drifting drone flags every building as motion. Use a median background only on tripod shots; for moving aerials use blending instead.
- **Motion-compensated slow motion tears thin lines** (cables, rails, text): use the crossfade mode there.
- **Text over bright sky** disappears: put number cards over the dark half of the frame or add the soft darkening; never a box.
- **A slow face is not a free subject.** Do not make an identifiable ordinary person the slowed or close-up hero. Slow a thing; show people as crowds, tracks or ghosts. Public figures and people in news events are a different case.
- **Numbers drift.** Official pages update; quote the page and the year, keep the quote in the facts file, and recheck before the last render. Prefer one clean figure over a range.
- **CC BY credits are long.** Each one needs author, full title and licence on the end card. Treat them as fine print (16 px, 29 px line pitch, the licence and changes on one header line) and keep the end card short (4–5 s); a 10 s card of text on black loses the audience. The video's last moving shot runs on under the card, darkened.
- **Don't end on dead black.** After the hard stop, the coda is a page (≈1 s), then the quote laid over one last moving city shot (≈4 s, just past its reading time), then the end card over the same shot.
- Commons rate-limits (HTTP 429): search and download one request at a time with back-off; for long 4K files download only the needed excerpt (`ffmpeg -ss … -t …`, or an HTTP range) or the 1080p transcode.
- **The app's buttons**: in a reel, a number card or the day ring below y 1248 or right of x 900 hides under the app's text and buttons; on YouTube, the bottom 12 % is under the player controls.

## 10. Footage: where it comes from

1. **Ask the user first** whether they have their own footage, photographs, documents or data for the place: their own time-lapses, a phone hyperlapse, family photos, a city's open data. Their material comes first.
2. If not, search these sources, and log each file's title, author, licence and page:
   - **Wikimedia Commons** — modern time-lapse, aerial and slow-motion footage under CC BY / CC0, photographs (for example the Carol M. Highsmith Archive, dedicated to the public domain), scans of old maps and books. Check the licence on each file page. Many videos are YouTube or Vimeo imports: use one only when its page carries a passed review (YouTubeReview / VimeoReview / LicenseReview / Flickrreview with a reviewer and a date) or the author's own source page still shows the licence. A pending review is not enough: a channel can later switch to the standard licence and claim the footage through Content ID.
   - **Library of Congress** (loc.gov, also mirrored on Commons) — archive films published in the US before 1931 are public domain; a rights statement of "no known restrictions" alone is **not** enough: you need the publication date or another public-domain basis.
   - **NASA** (images.nasa.gov, ISS crew photographs) — public domain; the night photos of cities from orbit make a strong opening.
   - **Internet Archive** — scanned books and documents marked NOT_IN_COPYRIGHT with a pre-1931 publication date; take the line you quote from the scan, not from a modern edition.
   - **National archives** (US National Archives, other governments' open archives) — check each country's terms.
   - Licences allowed: public domain, CC0, CC BY. Not allowed: CC BY-SA, "no known restrictions" without a basis, YouTube mirrors, unknown sources, restored or colourised archive copies.
3. **Before downloading, tell the user** what you will download, from where, under which licence, and how it will be credited.

Data for number cards comes from official pages (census, transport department, the place's own statistics); write the claim, URL and quoted wording into the facts file.

Recipe for another place: one single-camera time-lapse of ≥ 12 hours (the clock); 10–15 ground time-lapses and hyperlapses (streets, stations, bridges); 2–4 aerials, one of them top-down at night; one slow-motion shot of a fragile thing; one fixed-camera crowd shot for tracks; one archive film of the same kind of place; one night photograph from orbit or above; a same-position photo pair; three official numbers; one public-domain sentence written about the place.

## 11. Variation space

- Place: any city, port, airport, market, campus, factory, a river over a year (the clock becomes a season).
- Length: 20–45 s as a reel, minutes on YouTube in movements; one brake at least; one hard stop always.
- Score: organ/winds/strings is the default; a choir, a piano ensemble or analogue synth arpeggios also work if the writing stays additive and the break stays a sudden held chord.
- Tempo 96–132 BPM; at 30 fps prefer tempos whose beat is a whole number of frames (120: 15, 100: 18, 112.5: 16).
- Grid sizes and the counterpoint pair change with the material (archive vs today, day vs night, two cities).
- Number cards: 2–4 at most; the day ring may be dropped for non-daily structures.
- Fixed: footage only, the frame-blended light, cuts on the beat, the brake, few words, one quote, the hard stop, the release-print grade.

## 12. Build

Follow [building](../../../references/building.md). For this style:

- The pixel work happens before the page: a preparation script (Python with numpy and scipy, plus ffmpeg) integrates each shot's speed curve, blends frames, runs the slow-motion interpolation and the crowd tracks, applies the grey-world balance, LUT, bloom and grain, and writes each shot as a JPEG sequence at its display size (with the 1.85 matte in 16:9; a 9:16 window, or its drift, in a reel).
- The page is a canvas drawn from `t` that plays those frames by `floor(t · 30)`; grids, splits and flickers are composed there from pooled 960×540 clips (or prepared as their own sequences when the pool is too heavy). Number cards, the quote and the day ring are drawn over them, unscaled by any push.
- There is no voice, so the score's bar map is the clock: every cut, grid stage, digit lock and the hard stop are computed from bar and beat at a tempo whose beat is a whole number of frames; render the score on the same map.
- Rolling digits come from a hash of the frame number and the digit's index, so a seek never changes them.
- `cues.json` holds only the few pack sounds folded into the score (the organ hit, a riser, one note per digit lock); the hard stop cuts the score's dry signal in 15 ms on the cut frame.
