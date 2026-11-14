# Directing a video in a film style

Pair this with one `styles/<group>/<style>/STYLE.md` (the look) and
[building](building.md) (how to make it). You are the director, not a tech demo. A
video is judged in this order: **the opening, sound, rhythm, camera, performance**.
Good-looking frames are only the starting point. Everything here holds for a reel and
for a YouTube video; [YouTube](#youtube) adds what a long landscape video needs.

## 1. Take the brief

The user gives a style and a topic, sometimes more (length, voice, must-have shots,
brand rules). Everything else is your decision. Ask once, in a single message, then
no more questions. Defaults:

- **Format**: a 1080×1920 reel at 30 fps, 15–45 s, unless the user asks for YouTube:
  1920×1080 at the style's frame rate, 2–8 min. A stepped style steps its own clock.
- **Voice and captions in the language the user writes in.** One caption language.
- **Loudness −14 LUFS.**

Requests that only change the plan:

- **No voice.** Then the captions carry everything; time them to the music grid.
- **Their own recording.** Use it as it is; `edit-video`'s `voice.py` gets the word timings.
- **Their own material**: logos, photos, footage, data. Ask whether they have any;
  what they give comes first, and the sources in the `STYLE.md` are the fallback.
  Before you download, tell the user what you will fetch, from where and under which
  licence.

## 2. Find a benchmark first

Before writing anything, pick one or two reference works (reels, films, title
sequences, games, ads) that set the bar for this style **and this topic**. Write down:

- **What to learn**: composition, pacing, camera grammar, colour logic, sound.
- **What not to take**: characters, designs, melodies, specific shots, logos, fonts.

The benchmark lifts quality more than any rule below.

## 3. Shape the story

- **Frame 1 already says something.** The topic, the number or the strange image is
  on screen in the first frame. No logo, no title card, no slow fade from black.
- **Something moves within half a second**, and the reason to keep watching (the
  question, the "but", the stakes) lands by three seconds.
- **One subject, one goal, one turn.** A character, object, product or idea wants
  something, something changes, it ends differently from how it began.
- **An ending that pays off or loops.** Bookend the opening, reveal the scale, or cut
  back into the first frame so the reel replays cleanly.
- **One native move**: a moment only this medium can do (a fold that becomes a
  transition, ink that blooms into the next scene, a type grid that snaps into the
  logo). Put it at the emotional peak. Each `STYLE.md` lists its native moves.
- **Cut the extras.** One idea people get at phone size beats three they can't.

## 4. Write the treatment

Write `TREATMENT.md` before drawing anything:

1. **Three candidate structures**, a few lines each (a single journey, a
   before/after, a countdown, a list that turns), then the one you chose and why. The
   first idea that comes to mind for a style is usually its cliché.
2. **Logline and arc**: one sentence, then hook → turn → ending.
3. **Benchmark**: learn / don't learn.
4. **Shot list**: for every shot, the framing, the camera move, the duration and
   **why** it is shot that way.
5. **Beat sheet**, second by second, with the first three seconds frame by frame.
6. **Cue map**: tempo and on which word or beat every cut, key action and caption lands.
7. **Sound table**: for each section, the bed, the main foley and the music state.
8. **Caption and title design**: the type is part of the style.

## 5. Prove the look

- **With characters**: a model sheet (turnaround, 3–4 expressions, 2–3 key poses,
  palette) plus two style frames.
- **Without characters**: three style frames from the video, one of them the first frame.

Render them with the real drawing code, not a mock-up, at phone size, and check them
against the `STYLE.md` before going on. Show a storyboard of 6–9 key frames only if
the user asked for one, then wait for approval.

## 6. Sound is half the video

- **Every visible action has a sound**: landings, page turns, cuts, clicks, cloth.
  Match the material (paper, wood, metal, ink and glass all sound different).
- **Three layers**: ambience, foley tied to actions, music. Duck the music under the
  voice and key foley.
- **At least one real silence** before the turn. The first sound after it should be
  one of the most important in the video.
- **Use sound as a transition**: bring the next scene's sound in early, or let the
  last scene's sound run over the cut.
- **Avoid generic "piano and strings".** Score in the instruments of the style's
  sound palette.

## 7. Rhythm

- Write the cue map before animating. The picture locks to the words and the grid.
- **Vary the pace**: fast and slow, one clear acceleration, one held breath. A video
  at one even speed has failed.
- One action, one sound, one cut, but don't cut on every beat. Leave time to see.
- **Pace for the viewer, not the clock**:
  - hold every caption at least 1.8 s, and never shorter than the spoken line + 0.6 s;
  - after text finishes animating in, hold it for about (letters ÷ 15 + 1.5) s;
  - give gags and failures enough time to be understood;
  - make it fast with fewer words per screen, not by cutting before people finish reading.

## 8. Camera: every shot needs a reason

- Use several different camera moves and real changes of framing. 2D has a camera
  too: push, pull, parallax, focus pulls, frames within frames.
- **One signature shot** people remember: a oner, a scale reveal, a transition made
  from the medium itself.
- **Design transitions inside the medium** (a page turn, a carved line growing, ink
  spreading), as one consistent grammar.
- **Vertical framing**: stack, don't shrink. At key moments the subject fills at
  least a third of the frame height, inside the safe box, with a readable silhouette.

## 9. Performance

- **Anticipation, action, follow-through** on every meaningful move. Characters
  change emotion; they don't just slide across the screen.
- **Motion continuity**, especially for characters built in code:
  - blend every pose with keyframes and easing; never switch poses inside an `if`
    (a deliberate one-frame comic pop is the only exception);
  - held props sit between the palms; a hand-over interpolates from one palm to the
    other; a rolling object turns by distance ÷ radius;
  - step through key actions at 0.2 s intervals, enlarged.
- Check every expression at final size, especially eyebrow direction: "worried" and
  "angry" are one flip apart.

## 10. The failures we see most

- The first frame is empty, dark or a title.
- Subject too small, too far away, or pushed against the frame edge.
- Text or the subject under the app's buttons (outside the safe box).
- Too dark to read, or a colour laid on the same colour.
- Captions covering the subject.
- A gag or failure too fast to understand.
- Blank frames in transitions.
- A timed effect (iris, zoom, follow cam) that doesn't track the subject after the
  camera moves.

## 11. Before you deliver

- Review the encoded file with `edit-video`'s review: contact sheets, 0.2 s strips of
  key actions, one full-speed viewing with sound, on a phone-sized preview.
- **One fix round.** Fix everything the review finds in one round, then check once
  more. The user's notes after delivery are new rounds: change only what they ask.
- **Not the textbook again.** Compare your treatment with the style's usual opening,
  signature shot and ending; at least half should be your own.
- Voice: every line transcribes back correctly.
- Loudness about −14 LUFS; no black frames; captions in sync and not covering key action.
- Every row of the sound table is actually in the mix.

**Deliver**: the video (`<name>.mp4` at the format's size, −14 LUFS), a real-frame cover or thumbnail,
`TREATMENT.md`, a credits file listing every third-party asset (music, samples, fonts,
images, footage, the voice engine) with its source and licence, and the source folder.
Tell the user where they are, and that they are responsible for the material they use.

## 12. Copyright red lines

- References teach grammar only. Don't copy characters, designs, melodies, shots,
  logos or type designs.
- No existing works, games, brands or events appear in the video unless the user owns
  them or has the right to use them. That includes the logos, photos and footage the
  user hands you: use them when they say they have the right, otherwise draw
  fictional stand-ins.

## YouTube

A landscape explainer is watched on a TV or a laptop, often to the end, and it is
found by its thumbnail and title. On top of everything above:

- **The first 10 seconds** carry the hook and the promise: the strongest image or
  number first, the question by 5 s, what the viewer will know by the end by 10 s.
  The channel sting, if any, comes after that.
- **Chapters.** One question per chapter, 40–90 s each, each with its own small arc
  and a title card in the style's own grammar. Put the chapter times in the description.
- **Re-hook every 30–60 s**: a new question, a reveal, a change of scale or place.
  A long stretch at one pace is where viewers leave.
- **Breathing room.** Hold diagrams longer than in a reel; let a drawing finish before
  the narrator explains it.
- **The last 20 s** stay picture-only at the edges so the end screen can sit there.
- **Thumbnail**: a real frame from the video, the subject large, at most three words,
  in the style's own look. Each style names a good candidate.
- **Captions**: export the lines as `.srt` even when the style burns captions in.

## Maps

- **No borders unless the video is about them.** Draw coastlines, terrain, imagery or
  streets. Prefer a regional view to a world map, and keep disputed areas out of frame.
- **Words follow the map.** Don't name a disputed territory as a country in labels,
  captions, the voice or data tables; a mixed list is "countries and regions".
- **Check and credit.** Enlarge every map shot before delivery; the credits name the
  map data and its source.
