# Sports Telestrator

> The TV football analysis segment: play the clip at full speed, rewind, freeze it, and draw on the broadcast picture — rings under players' feet, marker arrows for the ball, a red patch for the space nobody covered — then play on, switch angles, count the frames, and flatten the pitch into a board. Real match footage is the ground; every line is drawn on top of it and moves with it. A studio show's packaging (sting, corner bug, score bar, a yellow wipe) holds it together. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): touch-screen analysis segments in televised football (the "telestrator" pundit's board), and explainer channels that annotate real match footage. Never copy a broadcaster's or channel's logo, fonts, colours, idents or graphics, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The picture becomes a tall slice of the broadcast frame on the show's board colour; the packaging moves above it.

| Zone | Position | Content |
|---|---|---|
| Footage | full width, 1080 × 1215, y 330–1545 | a 960 × 1080 slice of the 16:9 frame at 1.125×, panning with the ball and across a freeze; logo and URL kept out or painted out |
| Corner bug | x 72–430, y 272–322 | as in 16:9 |
| Score bar | x 560–900, y 272–322 | as in 16:9; flips on the goal frame |
| Source clock | x 88, y 346, inside the footage | as in 16:9 |
| Subtitle bar | centred on x 540, max 720 px, baseline y ≈ 1210 | one line |

  Above and below the footage is the board colour. The dual-angle freeze stacks two 1080 × 640 windows; the shot map puts the goal at the top.
- **The first 3 seconds.** Frame 1 is the decisive moment already frozen, a yellow ring drawing under the scorer's feet, the score bar showing the deficit; by 0.5 s a marker arrow traces the ball's path; by 3 s REWIND ◀◀ runs under the question ("three goals in 12 minutes: how?").
- **Length and pace.** 30–45 s: one deep breakdown (live → rewind → two or three freezes → another angle) or two freezes-in-play, each freeze 1.8–2.4 s, ending on the board or the data card.
- **Captions.** One line in the video's language on the black bar with its yellow edge; freeze labels are graphics, not captions.
- **Sound.** The pack's `camera-shutter` on every freeze, `ui-pop` as each ring lands, `tick` for labels and the stopwatch, `zoom-swish` on the yellow wipe, `hook-impact` on the score-bar flip. The sampled band, marker squeak and tape whine come from a free sample library; match sound comes with the footage.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. The subtitle bar sits at y 872–944, above the bottom 12 % where the player's controls appear; the corner bug and the score bar stay exactly over the broadcaster's logo and URL even there, so a changed score is also said or labelled.
- **Length and structure.** 4–8 min at 30 fps. A chapter is one moment, opened by the yellow wipe and a match-record card (`67' · 3–2`); secondary moments get freezes-in-play, the decisive one the full breakdown, the last chapter the flatten. Re-hook every 30–60 s with a rewind, a new angle, a stopwatch or a score flip.
- **The first 10 seconds.** The goal frame frozen first, the question ("how does 3–0 become 3–3?") by 5 s, the promise ("three goals, three mistakes, one board") by 10 s; the show sting after that.
- **Captions.** Burned in on the subtitle bar, plus an `.srt`.
- **Thumbnail.** A freeze with one yellow ring, a red patch of open space and a marker arrow on the real picture, with up to three words in Barlow Condensed Italic.

### Good for

Sports analysis, match recaps, coaching breakdowns, racing and esports replays, "what went wrong" explainers of any filmed play.

## 1. Essence, and what it is not

1. **Watch it, then take it apart.** Every piece of action is seen moving before it is explained. A freeze always follows play; the explanation never comes first.
2. **One freeze, one finding.** Each freeze says one thing (the ball wasn't cleared; nobody stepped out; he struck it from outside the box) with one label and at most two groups of lines. The same few seconds of footage are reused, each pass going one layer deeper.
3. **Drawn on the real picture.** Rings sit under feet, arrows follow the ball's real path, the box line is traced over the real line. Nothing floats in an abstract diagram until the video deliberately flattens the pitch.
4. **Data counted from the footage.** Times come from frame counts (a stopwatch that runs on source frames), distances from the pitch markings (a perspective transform). What the footage can't measure (ball speed, sprint distance) is not stated.
5. **Studio energy.** Bright marker lines, a white flash and a punch on every freeze, the music stopping with the picture.

Not **Visual Investigation** (that is restrained, synchronised multi-camera evidence where the timeline is the protagonist; this is a pundit's show with packaging and enthusiasm). Not a **highlight reel** (no montage of goals to music; each clip is analysed). Not **Data Storytelling** or an infographic: charts are not the video; the top-down board appears once, as a summary, and is reached by flattening the real picture.

## 2. Frame and layout (1920×1080)

- **Full-frame footage** most of the time. The packaging lives in the corners:
  - **Corner bug**, top right (x 1452–1880, y 38–110): show name on a yellow block + a mode line in the mode's colour — LIVE (red dot) / ANALYSIS (yellow) / REPLAY (cyan). It is in every footage frame from frame 1, because it sits over the broadcaster's logo.
  - **Score bar**, bottom right (x 1392–1880, y 926–996): HOME n – n AWAY + minute. The away number flips on the frame the ball crosses the line (a 0.5 s roll with a yellow flash). It sits over the broadcaster's URL.
  - **Source clock**, top left (x 40–370, y 38–90), on every analysis shot: `❚❚ 04.20s F106` — source seconds and frame number; ▶ ½ in slow motion, ◀◀ in a rewind. Hidden in live play.
- **Labels** (black card, coloured left bar, one bold line + a small spaced line for the name or minute) sit in empty grass or crowd, never over the action they describe.
- **Subtitle bar** bottom, centred at x 880 (its right edge stays left of the score bar), y 872–944.
- **Split screen**: two 960×1080 vertical windows, each a 960-px-wide slice of a 1920 frame at 1:1 (no extra scaling), a 6 px yellow divider between them, a camera label at each window's top left (A MAIN CAMERA / B HIGH REVERSE). The slices are chosen so the broadcaster's logo and URL fall outside them.
- **Board pages** (shot map, data card): dark board `#0C1411` with a faint 60 px grid; left column text, right side drawing. No headers, no centred title-and-bullets.

## 3. Editing grammar

- **Order inside one piece of action:** live at 1× (original sound) → rewind (0.6 s, reversed with tracking bars and ◀◀) → freeze ① → slow play (0.6–0.85×, frame-blended) → freeze ② → slow play with a stopwatch → freeze ③ → ball flight with a comet trail → another angle (replay), possibly one more freeze.
- **Lighter variants** for secondary pieces of action, so the deep breakdown stays special:
  - **Freeze-in-play**: no rewind; play at 1× up to the decisive pass, freeze, draw, then play on to the goal.
  - **Dual-angle freeze**: both angles play side by side and each arrives at the same instant (each at its own speed) where both freeze together; the same player is ringed in both.
- **Freeze length** 1.8–2.4 s; a freeze longer than ~2.5 s needs a second action inside it. Two to four freezes per piece of action; more than four, split with a replay.
- **Cuts between segments**: only the packaging wipe — a yellow slanted band with dark edges crossing the frame in 0.34 s. Inside a segment, hard cuts. No dissolves, no page turns.
- **Comparison frames** (the shot map, the data card) are fully drawn early and held ≥ 2.5 s before the next cut.

## 4. Colour identity (the one rule that matters)

| Role | Colour |
|---|---|
| The team/player we follow, the ball, main marker lines | `#FFD400` fluorescent yellow |
| Opponents (rings, block arrows, link lines) | `#3FD8FF` cyan |
| Space (a patch nobody covers) | `#FF3B30` red, fill 0.34–0.38 + dashed edge |
| Pitch lines traced, neutral marks, stamps | `#F4F1E8` chalk |
| Show board | `#0C1411` ink green-black |
| Label / bug background | `rgba(8,12,14,0.9)`; opaque `#080C0E` where it covers a logo |

One colour, one identity, throughout the video: a label's left bar takes the colour of what it names. Change the hues if the show needs to, never the three roles.

## 5. Type

- Labels: Barlow Condensed 800, 44 px (32 px for a name); the small line Barlow Condensed 600, 21 px, letter-spacing 2 px, in the role colour.
- Packaging numbers (score, minute, stopwatch, big data): Barlow Condensed 800 Italic.
- Clock / frame numbers: IBM Plex Mono 500, 24 px.
- Board pages: title Barlow Condensed 800, 60–64 px, rows Barlow 700, 34–42 px with a grey note under each, numbers Barlow Condensed 800 Italic 64–150 px in yellow; text appears left to right with a clip reveal.
- **No handwriting fonts** anywhere: printed type on a dark card belongs to the same packaging; handwriting reads as a school notebook.
- Subtitles: Barlow Condensed 600, 36 px, on a black bar at 0.64 with a 4 px yellow edge; one line, in the video's language, never wrapped — shorten the line instead of shrinking it.
- All fonts OFL from Google Fonts, subset to the characters used.

## 6. Motion and drawing

- **Freeze entry**: white flash 0.1 s (0.55) + punch 1.035 → 1.0 in 0.35 s (ease-out) + desaturate 42 % + a cool cast + heavier vignette; then a slow 1.2 % creep. Overlays use the same transform as the picture, or they slide off the players.
- **Spotlight**: everything outside a focus ellipse darkens to 0.42 (even-odd hole), 0.3 s fade.
- **Marker line**: dark outline (w + 6, black 0.55) + coloured core with glow 18 + thin white highlight (w × 0.28); drawn along its length; an arrowhead pops in over the last 10 %; deterministic small wobble at the vertices so it feels hand-drawn. Dashed for intended or future paths (a cross, a run), solid for what happened.
- **Ring**: perspective ellipse (ry = 0.36 r) under the feet, drawn clockwise, outer dashed ring rotating at 60 px/s; a vertical light beam while the player moves.
- **Draw order inside a freeze**: ring (who) → area or link (what happened) → label (the one-line finding), 0.3–0.6 s apart.
- **Slow motion**: source frames at 0.6–0.85×, neighbours cross-blended (no stutter).
- **Rewind**: the clip reversed in 0.6 s (ease-in-out), ±13 px horizontal jitter, four white tracking bars, a big ◀◀ and the word REWIND.
- **Trails**: in screen space keep only the last ~0.6 s (ball 0.24 s) — the camera pans, so long trails land in the wrong place.
- **Stamp** (e.g. a VAR decision): a framed card that drops from 1.7× to 1× with overshoot, slightly rotated, with a small flash — once per video.
- **Perspective flatten**: see Native moves 7.

## 7. Grade and image quality

- Footage: `hqdn3d=1.2:1.2:2.5:2.5` → lanczos to 1920×1080 (modern footage at most 1.5×) → `unsharp=5:5:0.55` → `eq=saturation=0.9:contrast=1.04:gamma=0.97` + slightly cool shadows; one grade for every clip; light film grain added once over the finished frame.
- Broadcaster logos and URLs are covered by the packaging (bug and score bar placed exactly over them, present from frame 1), or kept outside split-screen windows — never by cropping past 1.5×.
- Prefer a broadcaster's native resolution over an "AI-upscaled" stream.

## 8. Sound palette

- **Layers**: voice-over (one line per freeze, ≈2.5–3 s) → match sound (commentary + crowd at full level in live play; under freezes only a low-passed crowd bed, looped; the goal roar on the goal frame) → score → foley. Voice ducks everything else to 0.55.
- **Score**: sampled band (drum kit, electric bass, staccato trumpet and trombone, timpani, horn, cellos, glockenspiel), about 120 BPM. The groove restarts at the head of each played segment, so cuts don't need a global bar grid. **On a freeze the drums stop**: one brass stab + timpani + low thump + camera shutter, then only closed hi-hat — the music freezes with the picture. Goals: a big brass chord with crash and glockenspiel on the score-bar flip.
- **Foley**: marker squeak (2–5 kHz band-passed noise with flutter) for each line, pops for rings, a tick per landed label, whoosh on every wipe, tape-motor whine on a rewind, a stopwatch tick every 0.2 s, a thump for the stamp, a long whoosh and a timpani roll under the flatten.
- Mix limited, then normalised to −14 LUFS.

## 9. Native moves (and how the code does them)

1. **Freeze and draw** — a freeze segment = one source frame + flash + punch + desaturate + spotlight; overlays drawn by their progress through the segment.
2. **Tracked ring** — hand keyframes of the feet point in source pixels every ~3–6 frames, linearly interpolated; check them with a debug mode that paints every tracked point in magenta.
3. **Frame-counting stopwatch** — starts at the receiving frame and counts source frames ÷ fps; stops and turns yellow on the strike.
4. **Score-bar flip on the goal frame**, one entry per goal in a list the score bar reads at every frame.
5. **Packaging over watermarks** — corner bug and score bar positioned from the logo and URL coordinates, drawn from frame 1.
6. **Dual-angle freeze** — two windows, each its own clip and frame range, both reaching their freeze frame on the same beat; overlays drawn in each window's source coordinates.
7. **Perspective flatten into a shot map** — for each shot, mark 6–8 known pitch points in its own frame (box and six-yard corners, where the penalty arc meets the box line; FIFA dimensions) and fit a ground-plane homography by least squares (residuals ≤ 6 px are fine). The strike frame is then drawn as a mesh of triangles in pitch coordinates (1.5 m cells), each vertex moving from its image position to its board position, each triangle affine-mapped; the picture fades out as the chalk board takes over, and the other shots' feet points, converted with their own frames' matrices, drop onto the same board. The broadcaster's URL is painted out of the source frame first, because the flatten drags it into the middle of the screen.
8. **Data card** — the counted numbers re-stated on a board page: label left, big yellow number right, red marker circle on the key one.
9. **Commentary transcript** — the commentary's words with timecodes in a small box during live play, translated into the video's language when the commentary is in another one; inaudible words become an ellipsis, never a guess.

## 10. Material

1. **Ask the user first** whether they have their own footage (club or academy video, their own camera, a licensed broadcast clip), line-ups, event data or photos, and the rights to use them. Their material comes first.
2. **Where to look** (judge every file on its own page):
   - **Wikimedia Commons** (search "goal", the match, the player): many clips are cut from broadcasters' own YouTube uploads under CC BY. Fine: CC0, public domain, CC BY. Not used: CC BY-SA, "no known restrictions", unclear licences.
   - **A broadcaster's or club's own YouTube channel** when its video page says *Creative Commons Attribution license (reuse allowed)*: check that the channel is the rights holder's official, verified channel (not a re-upload or a fan mirror), save the evidence (channel id, verification, licence field, date checked), and download the native resolution (yt-dlp works), not an AI-upscaled stream. Third-party re-uploads, fan mirrors, colourised or "restored" versions are never used.
   - **Facts** (scores, minutes, how a goal was scored): the league's or broadcaster's own match page or video description, then established newspapers; quote them in the facts file. When sources disagree, use the official list and leave the disputed detail out.
   - Photos of players: Commons (CC BY / CC0); state the year when the photo isn't from the match.
3. **Before downloading, tell the user** what you will fetch, from where and under which licence, and log each file's licence, author, page and the seconds used. Wikimedia rate-limits bursts (HTTP 429): one request at a time.
4. **People on screen**: players, referees and staff in the event are fine; never slow down or freeze on an identifiable spectator.

## 11. Build

Follow [building](../../../references/building.md). For this style:

- One canvas drawn from `t`; each clip is a JPEG sequence at display size, loaded on demand with a small cache (about 90 frames); hold the render until a segment's frames have loaded, so every seek draws the same picture.
- A segment table (clip, source frame range, speed, freeze frame, overlays, voice line) drives the page, the voice placement and the sound cues; the source clock and stopwatch read source frame numbers from it, never screen time.
- Overlays live in source-pixel coordinates and go through the same matrix as the picture (punch, creep, the reel's pan), so rings stay under feet; tracked points are hand keyframes, linearly interpolated, checked in the magenta debug overlay at full resolution.
- Preparation: the ffmpeg chain from section 7, the slices for split screens and reels, the URL painted out of frames that will be flattened, and one homography per shot from 6–8 pitch points (OpenCV `findHomography` or a numpy least-squares fit).
- One cue in `cues.json` per freeze (shutter + stab), ring, label, stopwatch tick, wipe and score flip; the band restarts at each played segment and is mixed with the match sound and the crowd bed.

## 12. Pitfalls

- **Wrong tracking points** are the biggest risk: reading coordinates off a scaled contact sheet is easily 20–50 px off. Read them on full-resolution crops with a pixel ruler, then check them in the debug overlay.
- **Overlays not under the punch transform** slide off the players during a freeze.
- **Balls vanish**: long shots are a few pixels with motion blur; colour tracking loses them; frames where the ball is invisible are interpolated and the number says "≈".
- **Numbers the footage can't support** (ball speed, distance run) are not written. Distances only from a homography fitted to visible markings, each shot in its own frame (the camera zooms and pans between shots).
- **Packaging late by one frame** shows the logo: bugs never fade in over footage.
- **Split-screen windows sliding in** reveal what's outside them (a logo, a URL): clip each window to its slice in source coordinates, not only to the screen half.
- **Score state must match the moment**: before the 67th-minute goal it is 3–2, not 3–3.
- **Names in the voice**: spell them phonetically in the text sent to the voice ("Zayits", "Saduk") and keep the real spelling in subtitles; transcribe each line back and note how the proper names came out.
- **Freeze labels echo the subtitle** and live only ~1 s; anything the viewer must read (scores, board rows, the data card) gets ≥ 2.5 s.
- **The app's buttons**: in a reel, a label, the score bar or the subtitle below y 1248 or right of x 900 hides under the app's text and buttons; on YouTube, the bottom 12 % is under the player controls.

## 13. Variation space

The agent decides per video: the sport (football, basketball pick-and-roll with screens drawn as bars, tennis rallies with landing zones, F1 overtakes with racing lines — anything with a wide camera that shows the whole play), the moments, the show's fictional name and colours (keeping the three roles), how many freezes.

- **Three structures:** chronological build-up to the deep breakdown (secondary moments get light treatments, the decisive one the full rewind-and-freeze); one moment taken apart from three angles; a "what went wrong" defensive breakdown ending on the space map.
- **Three openings:** the show sting into a match-record card (YouTube only, after the hook); the goal frame frozen in the first second, then rewind; the stopwatch running over live play.
- **Three endings:** the top-down board that sums up the moments; the data card with one number circled; the hero shot slowed with the minute and name.
