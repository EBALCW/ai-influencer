# Live Countdown Split-screen

> An edit style, not a look. Real footage of one event with a known zero (a launch, a verdict, a final whistle, polls closing), shown in real time: screen time equals event time, a clock ticks every second, and the screen splits into more and more cells as the moment nears, every cell showing the same second. At zero the cells merge into one picture and the clock flips. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): the real-time clock and splitting screens of a 2000s real-time TV thriller; the multi-camera archive panels and mission-time codes of a 2019 archival documentary of the first Moon landing. Never copy their type, colours, sounds, graphics or shots, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** A control block at the top holds everything that must be read; the cells fill the frame under it and may run under the app's buttons.

| Zone | Position | Content |
|---|---|---|
| Control block | full width, y 0–530, panel `#0B0E11`; text inside x 72–900, from y 280 | control strip, clock (digits up to 120 px), the transcript line under it |
| Cells | x 24–1056, y 540–1896, 8 px gutters | 1 → one 1032 × 1356 crop of the action; 2 → stacked 1032 × 674; 3–4 → 2 × 2; many → 2 × 4 of 512 × 333 |
| Chips, flags | top-left / bottom of each cell | must-read only in cells above y 1248 |

  At zero the 2 × 4 grid becomes eight 540 × 480 tiles of one full-bleed picture; the control block thins to plates over it.
- **The first 3 seconds.** Frame 1 is the clock already running, a digit mid-fall, over the first camera with its chip; by 0.5 s a tick and the first call in the native sound; by 3 s a second cell has opened from its left edge on a call, and the T− says exactly how long the viewer has to wait.
- **Length and pace.** One uncut stretch of 30–45 s ending a few seconds after zero; a layout change every 3–6 s on a call, the shortest nearest zero, a quarter-second of silence before it.
- **Captions.** The live transcript is the only caption layer, word by word, in the language spoken; narrator lines in orange.
- **Sound.** The pack's `tick` for every whole second, `zoom-swish` + `latch` for each re-layout, `ui-pop` as a cell lands, `thock` for a checklist tick, `hook-impact` under the event's own climax at zero. The native audio leads; a 60 BPM score with a downbeat on zero comes from a free sample library or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 2 as written: hard cells on near-black, 24 px outer margin. Over full-screen footage, the clock and transcript plates end at y 940, above the bottom 12 % where the player's controls appear; chips and flags keep inside the 5 % margins.
- **Length and structure.** 3–8 min of uncut real time at 30 fps. A chapter is a control segment (ground → vehicle; prosecution → jury); its title card is that segment filling orange in the clock header. Re-hook every 30–60 s with a new cell on a call, a "heard" tag or a punch-in.
- **The first 10 seconds.** The clock and the strongest camera first, the open question ("will the hold clear?") by 5 s, the promise ("every camera, every call, uncut") by 10 s. No channel sting inside real time: it goes after the end.
- **Captions.** The transcript box is burned in; export the same cues as `.srt`.
- **Thumbnail.** The full grid one second before zero, every cell on the same instant, the clock at T−00:01, with at most three words.

### Good for

Launches, product drops, election nights, verdicts, cup finals, New Year countdowns.

## 1. Essence, and what it is not

1. **Real time.** One continuous stretch of the event, never cut, never re-ordered, never sped up. Slow-motion sources are played back at real speed. The clock and the picture can be checked against each other at any frame.
2. **The clock is the lead.** It ticks every whole second (sound and a falling digit), it says who is in control, and it changes state at zero.
3. **Cells show the same second.** Every video cell is synced to the clock, or says plainly that it is not (§8, "sync badge").
4. **The layout is the edit.** Cuts are layout changes, and every layout change lands on a real spoken call or event in the native sound, not on the music.
5. **More cells, closer to zero; one picture at zero.** The number of cells is the tension curve.

Not a montage (time jumps), not a security wall (the layout never moves), not a flashback structure (real time cannot go back), not a slide deck (cells that don't follow events, text filling the cells, centred titles with page turns).

## 2. Materials & rendering

- **Three kinds of material at once**: video cameras of the same moment (2–8), documents (a fact sheet, a filing, a schedule: shown as paper, never retyped as a slide), and photographs (the people of the day). Our own type explains them; type printed in the material is only picture.
- **Data drawn by us**: checklists, bars, a flight or process profile, a second countdown to the next milestone. Every number comes from an official source (§10).
- **Cells**: hard rectangles on near-black `#06080A`, 24 px outer margin, 8–9 px gutters, 1 px border `rgba(222,232,238,.16)`, a light radial vignette (to 36 % black) on video cells. No rounded corners, no drop shadows, no 3D.
- **Camera chip** top-left of every cell: dark plate 84 %, a square dot (orange = synced video, grey = unsynced or still), a code (`CAM 4`, `DOC`, `LIST`) and a short name.
- **Burned-in text in the sources** (broadcast bugs, camera IDs, timers, tracker readouts) is cropped by a per-shot usable region, or blurred out (ffmpeg `delogo`) after it has been used for syncing. Never shown as if it were ours.
- **One grade for every source** (ffmpeg): `eq=contrast=1.07:saturation=0.9:gamma=0.97:brightness=-0.01,colorbalance=rs=-0.02:bs=0.03:rh=0.03:bh=-0.02`, then light film grain over the finished frame. Cool shadows, slightly warm highlights: control rooms and launch pads look like one video.
- **Resolution**: modern footage at most 1.5× its source pixels; for a punch-in, extract that stretch at a higher resolution from the 4K source instead of enlarging a 1080p frame. Documents at ≥ 1 source pixel per screen pixel.

## 3. Colour logic

| Role | Value |
|---|---|
| Ground | `#06080A`; panels `#0B0E11` |
| Main text | `#F2F5F7`; secondary `#7C878D` |
| Accent: the T− sign, synced dots, ticks done, event flags, the active control segment | `#FF5B1F` |
| Speaking light, "heard" tags | `#FF3B30` |
| Plates over full-screen footage | `rgba(6,8,10,.80)` |
| After zero, the clock block | ground `#FF5B1F`, text `#0A0B0C` (inverted) |

Orange means "now / synced / done". Grey means "pending / not synced". Nothing else is coloured; colour belongs to the footage.

## 4. Type & subtitles

- Clock digits: a condensed sans with fixed-width digit slots (Barlow Condensed SemiBold works, drawn digit by digit in equal slots so the clock never jitters); size up to 132 px, the T−/T+ sign at 0.85×, tenths at 0.41× in grey, a ten-segment sub-second bar under it.
- Text: a clean grotesque (Barlow 500/700). Labels, codes and small print: a monospace (IBM Plex Mono). All OFL, as woff2 files in the project's assets.
- **The live transcript is the subtitle.** A fixed box (bottom right, or a cell in the grid): a speaking light and the speaker type (commentary / loop / narrator — the narrator, our own voice, is marked in orange so it is never mistaken for the event's audio), the line appearing word by word at the spoken times (0.08 s fade per word, a block cursor). **One line, in the language spoken, never wrapped**: a long sentence becomes two cues; each cue ≥ max(1.8 s, speech + 0.6 s). Transcribe only what is said; mark doubtful words in the facts file.
- Reading time for everything else: letters ÷ 15 + 1.5 s from the moment it is complete. A comparison (two bars, two numbers) stays fully on screen ≥ 2.5 s.

## 5. Motion quality

- 30 fps. Clock: on each whole second the new digits drop 14 px in 0.12 s (ease-out); the sub-second bar empties one segment per 0.1 s (fills after zero).
- Re-layout: 0.34 s `easeInOutCubic`. Cells that stay interpolate their rectangles; new cells open from their left edge; leaving cells close to the left; a new cell flashes a 3 px orange border for ~0.2 s when it lands. A grid filling up pops one cell per spoken count in 0.30 s.
- Swaps (one source replaces another in the same rectangle) wipe in from the left. Hard cuts only between full-screen sources.
- Photographs push in ≤ 6 % over their whole stay; names pop one by one 0.16 s apart. Documents move their window down a row in 0.45 s; the highlight sweeps left to right in 0.35 s.
- Never: slow push-ins on video to fake motion, page-turn transitions, centred pop-up words, speed ramps.

## 6. Edit grammar

- **Screen time = event time.** One mapping, `M = t − T0`, for the whole video. Each camera has its own source offset (`s = M + c`) measured once and baked into the frame extraction: frames are named by the video's frame number, so the page never computes sync.
- **Cut points are calls.** Each layout change starts on the first word of a real call in the native audio ("ten", "go for…", "ignition", a name) or on an event visible in the footage. The music follows; it never sets a cut.
- **Cell count rises toward zero**: 1 → 2 → 3–4 → many (6–9, the clock itself becomes the centre cell, the transcript a cell) → **one** at zero → a few again after zero (the event's consequences) → one under the title. The shortest layouts are nearest to zero.
- **Inside a cell, the source cuts itself** (a broadcast switching cameras): keep it; we only cut the layout.
- **Silence before zero**: the music drops out a quarter-second before zero; only the native sound and the clock remain.
- Full-screen moments carry the clock and transcript as plates at the bottom; a gradient (0 → 75 % black) under them.

## 7. Sound palette

Layers, top to bottom:

1. **Native sound** — the event's own audio (commentary, radio loops, crowd), high-pass 90 Hz, compressed, always on top; never ducked.
2. **Narrator** (sparingly, only in gaps of the native sound, never over it): one clean, close voice, a different gender or accent from the event's voices; transcribe every line back to check it.
3. **The clock**: a tick every whole second (two alternating pitches around 1.5–1.9 kHz, panned ±15 %), louder in the last ten seconds, a soft single pitch after zero.
4. **Interface foley**, one cue per layout event: re-layout whoosh + metallic snap; cell pop snap; checklist tock; event-flag whoosh; full-screen cut thump.
5. **Score**, 60 BPM so one beat = one second = one tick: a low synth drone whose low-pass opens toward zero, a bass drum per beat, off-beat hats, a tom per spoken count, timpani roll into zero, silence, then a low brass major chord with bass drum, crash and tubular bell at zero; after zero a new texture (pizzicato bass ostinato, lighter tick). Low brass, timpani, toms, tubular bells, glockenspiel; no piano-and-strings pad.
- Mix: music about 8–10 dB under the native sound and ducked under speech; the ignition (or the event's own climax sound) is the loudest moment; master −14 LUFS via a pre-limited mix so the master meets its true-peak target.
- **Changing the music** (e.g. the user's own track): never move the clock or the cuts; choose or stretch a track so a downbeat lands exactly on zero and a section change lands on T−10, and keep the quarter-second silence before zero.

## 8. Native moves (and how to build them)

- **Many into one.** At zero, every cell moves to its tile of the full frame (a 3×3 grid becomes nine 640×360 tiles) while each tile cross-fades to the same full-screen shot, chips and borders vanish in the first half, a warm white flash (`rgba(255,248,236,.7)`, decay τ ≈ 0.11 s) peaks, and the clock and transcript slide from their grid cells back to the bottom. 0.42 s. *Fits:* a verdict read out; the goal at the final whistle.
- **Clock inversion.** At zero the clock block flips from dark with an orange T− to orange with dark T+, and its header changes (countdown → elapsed). *Fits:* polls closing, a store opening.
- **Control strip.** Segments in the clock header (who has control: ground → vehicle → mission control; prosecution → jury → judge); the active one fills orange on the call that hands it over, with a short flash. The story's turns live here.
- **The grid fills on the count.** Empty grid slots show as dashed "standby" frames; each spoken number opens one camera. *Fits:* "three, two, one" before a premiere.
- **Sync badge.** Top-right of each video cell: `● LIVE SYNC` (synced), `○ SAME WINDOW · NOT FRAME-SYNCED` (hatched, grey: footage from the same minutes without a usable clock), `1× REAL-TIME` (slow motion re-timed). Honesty is part of the look.
- **Planned vs heard checklist.** Official milestones with their planned times tick as the clock passes them; when the native audio actually says one, a red "heard −32.1" tag with a small waveform appears beside it. *Fits:* a court schedule against what was said; a train timetable against the platform announcement.
- **Second countdown.** After zero, a smaller clock counts to the next official milestone (`−1:47 to booster separation, expected T+2:09`) along a schematic profile drawn by time, not distance. *Fits:* the next race split; the next ballot count.
- **Event flag.** An orange bar with black type slides in at the bottom of the relevant cell on its call (`RS-25 ×4 ENGINE START · T−6.36`), held ≥ the reading time.
- **Punch-in on a call.** A hard digital punch-in on the relevant detail when the commentary names it, from a higher-resolution extraction of the same source.
- **Document by rows.** A paper close-up shows two or three rows; a highlight bar and an annotation band below the paper re-set the row in plain words; the window moves only between rows (its edges in the white space).

## 9. Pitfalls of the medium

- **Unsyncable footage** (an edited "rover" reel with no clock or event to align on). Never fake it: label the cell "same window · not frame-synced", keep it out of the countdown's key seconds or use it only where nothing it shows contradicts the time, and say so in the facts file. Look first for a source with a burned-in timer, a visible ignition / flash / whistle, or the same audio.
- **Measuring zero.** Never trust metadata. Combine two independent marks: a visible event (ignition flash, a broadcast countdown bug's flip) and the spoken word timing ("booster" at zero). Re-measure on the file you actually cut: `ffmpeg -ss … -c copy` starts on the previous keyframe.
- **Audio and picture of one file can disagree** (a switched feed whose audio lagged its video by ~1 s). Sync each camera on its picture.
- **Slow-motion sources**: measure the factor from two events with a known gap (e.g. engine start to booster ignition = 6.36 s) and re-time with `setpts=PTS/k`.
- **Burned-in text**: broadcast bugs, camera numbers, timers, tracker data. Define per-shot usable regions (they change when the source cuts) or `delogo` them; check every source cut with a frame-difference scan.
- **A static wide shot for ten seconds** reads as flat. Give every 1–2 seconds a new element (a cell, a tick on the list, a flag, a punch-in), not a fake camera move.
- **Spoilers in the subtitle**: a whole sentence shown at once reveals the end of a count early. Split counts into separate cues, and let words appear at their spoken times.
- **The clock jitters** if digits are proportional: draw them in fixed slots.
- **Hot peaks** from broadcast audio and the ignition hit miss the true-peak target: pre-limit the mix at about −4 dBFS after normalising to −14 LUFS.
- **Logos.** No agency insignia as a graphic; cut slates and bugs; the video says it is unofficial.
- **The app's buttons**: in a reel, the clock, transcript or a flag below y 1248 or right of x 900 hides under the app's text and buttons; on YouTube, the bottom 12 % is under the player controls.

## 10. Material and facts

**Materials — ask first.** Before searching, ask the user whether they have their own material of the event: footage from several angles, recordings of the audio, photos, documents (schedules, filings, results), data. What they give comes first and is credited as they say.

**If not, where to look** (each item's own page decides; record it):
- **NASA** (images.nasa.gov, svs.gsfc.nasa.gov): U.S. federal government works, public domain in the U.S.; fine to use. Don't use NASA insignia as graphics or imply endorsement; check each item for third-party material.
- **Other U.S. federal agencies** (NOAA, National Archives, DoD DVIDS): public domain, same check for third-party material.
- **Internet Archive**: only items whose own record shows public domain (pre-1931 U.S. publications, U.S. government works) or CC0 / CC BY; skip `youtube-*` / "mirrortube" uploads and anything of unclear origin.
- **Wikimedia Commons**: read each file page; CC0, public domain and CC BY are fine (credit CC BY in full); CC BY-SA and "no known restrictions" are not fine without the user's explicit agreement.
- **Library of Congress**: check each item's rights statement; "no known restrictions" is not CC0.
- Not usable: re-uploads without a source, restored or colourised versions, news-agency footage, anything whose licence is not stated.

**Before downloading, tell the user** what you will fetch, from where and under which licence, in one message. Then fetch only the seconds you need (an HTTP range request on a large original, or `ffmpeg -ss … -t …` on a stream), log each file's licence, author, page and the seconds used, and keep the raw downloads under about 1.5 GB.

**Facts**: a facts file (claim, URL, quoted wording, or the measurement) covering every number, time, name and call on screen and in the narration; official sources only; planned times and actual (heard) times are kept apart. Check the script against it before the last render.

## 11. Variation space

The agent decides per video: the event, where real time starts and ends, the number of cameras, which documents and data, the control segments, the narrator's lines (or none), the closing layout.

- **Clocks**: T−/T+; a match clock; a wall clock (HH:MM:SS) for a news day; a countdown to a deadline that then counts up as "overtime".
- **Three structures**: rising cells to a merge; one cell that splits outward after zero (results arriving from many places); two parallel countdowns side by side that meet at zero (two teams, two cities).
- **Three openings**: a single wide shot and the first call; the clock alone on black, then the first camera opens; a document (the schedule) with the first item ticking.
- **Three endings**: the inverted clock over one full-screen shot; the grid refilling with consequences, then one title; the second countdown reaching its own zero.

## 12. Build

Follow [building](../../../references/building.md). For this style:

- One canvas drawn as a pure function of `t`: a table of layout keyframes (`grid`, `merge`, `cut`, `swap`), each a set of cell rectangles, interpolated over 0.34 s with `easeInOutCubic`; each camera drawn with cover framing inside its per-shot usable region, so burned-in text never shows.
- Sync lives in the preparation, not the page: ffmpeg extracts each camera's frames with its offset `s = M + c` already applied, named by the video's frame number, so the page draws frame `floor(t · 30)` of every cell. Slow-motion sources are re-timed with `setpts=PTS/k`; punch-ins come from a separate higher-resolution extraction.
- Draw the clock digit by digit in equal slots from `M`, the falling digit and the sub-second bar from its fractional part; the checklist, profile and second countdown read their planned times from the facts file.
- Transcribe the native audio for word timings and take the narrator's from its voice timing; each word fades in at its time, and every cue's width is measured in the page so none wraps.
- One cue in `cues.json` per tick (alternating pitches), re-layout, pop, checklist tock, flag and cut; the native sound and the score (downbeat on zero) are mixed with them and pre-limited before the −14 LUFS master. Transcribe the finished mix once more before delivery.
