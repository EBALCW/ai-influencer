# 80s Cel Anime

> Hand-painted cel animation from the golden age of Japanese OVAs, re-created in code: flat two-tone cels over airbrushed backgrounds, backlit neon, limited-animation timing, played back as a late-80s videotape on a CRT television. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): 1980s Japanese OVA and TV cel animation in general (painted-background vs flat-cel contrast, backlit light, held drawings, speed grammar, city-pop openings). Borrow the era's craft, never a specific work's characters, mecha, logos, place names or signature shots.

## Formats

### Reel (1080×1920)

- **Layout.** The tape picture fills the frame. Plates are painted tall (sky, towers, street, wet ground), so the multiplane crane becomes the main move. Stack, don't shrink: side tracking becomes a rear view into the canyon or a crane past the hero; a two-shot stacks in depth (one face near and low, one far and high) instead of side by side. Faces sit inside the safe box (x 72–900, y 269–1248), a third of the frame height at key moments; reflections and speed lines may bleed under the app's buttons. Subtitles centred on x 540, at most 720 px wide, baseline y ≈ 1180.
- **The first 3 seconds.** Frame 1 is the held bust, backlit, with a neon light band already sweeping across the cel and rain falling on ones (no power-on from black, no title). By 0.5 s the eyes open in three drawings. By 3 s a hard cut on the bar drops into a multiplane crane down the painted world to show where the hero has to be.
- **Length and pace.** 20–45 s. Cut on bars (about 2 s at city-pop tempo), shots of one or two bars, one painted still held 2–3 s at the peak after a beat of silence.
- **Captions.** One language, as tape subtitles inside the CRT pass: Barlow Semi Condensed 600 at about 60 px, cream-yellow, thick dark outline, at most two lines.
- **Sound.** `hook-impact` on an impact frame, `zoom-swish` on speed-line whips and truck-ins through a screen, `shimmer` as a title or sign glints on, `ui-click` for cassette and radio buttons, `metallic-riser` into the held peak. City pop (sax, FM piano, slap bass, gated snare), rain, engines and tape hiss come from a free sample library or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 2 as written (full 16:9, or a 4:3 pillarbox for the OVA feel). Subtitles rise from ~96 px to ~140 px above the bottom (baseline y ≈ 940) to clear the player controls; faces stay out of the lower 200 px; titles inside the 5 % margins.
- **Length and structure.** 2–8 min at 24 fps, cels on twos and threes. A chapter is an episode act, 40–90 s, opened by an eyecatch: a held painted illustration with the chrome title flickering on and a star glint. Re-hook every 30–60 s with a colour-model change (another hour), an impact frame, a song switched on a tape or radio, or tape tracking noise at a turn.
- **The first 10 seconds.** The backlit hero against the neon plate first, the question in one subtitled line by 5 s, the promise by 10 s; a short mock opening (chrome title, brass hit) as the channel sting after that.
- **Captions.** Tape subtitles burned in, plus an `.srt`.
- **Thumbnail.** The extreme close-up on eyes with a light band across them, or the backlit bust against neon, with at most three words in the chrome title lettering.

### Good for

Music videos, game trailers, nostalgia pieces, city and travel stories, launch hype, character introductions.

## 1. Essence, and what it is not

Four layers, and the contrast between them is the look:
- **Background painting**: soft airbrushed gradients, glowing windows, wet reflections; painted once at load (colour + emissive pair), then only slid.
- **Cel** (characters, vehicles, props): flat fills, **hard-edged** shadow and highlight shapes, **coloured** outlines, never pure black; stepped at 12 or 8 fps.
- **Light**: backlit cel (*tōkakō*): signs, lamps, title letters glowing *through* the frame; flares, halation.
- **Playback**: videotape on a CRT: chroma bleed, scanlines, grille, phosphor glow, darkened corners, faint noise.

If a frame looks like modern digital anime, one layer is missing. Not moe anime (round eyes, giant irises, hatched blush), not vector clip-art (uniform black lines, gradients in shapes), not a film-print pastiche (no gate weave or scratches: this is tape).

## 2. Materials & rendering

**Cel rendering.** Fill, then a **hard** shadow crescent, then a **hard** highlight crescent, then the coloured outline. No gradients inside a cel shape (exception: one "harmony" painted still at a peak). Automatic shading: clip to the shape and fill `shape − shape shifted toward the light` with the shadow colour (even-odd); the same shifted away for the highlight and for a saturated neon **rim light** (2–4 px). Add hand-placed cast shadows. Outlines ~2–3 px at 1080p, scaled down (0.45–0.8×) in extreme close-ups. **Colour models per lighting** (*iro shitei*): define each character in daylight, derive other sets by multiplying lit / shadow / line separately, plus a backlit silhouette set with a warm rim.

**People the 80s way.** Construct the head (sphere + jaw): long egg-shaped face, soft-point chin, far eye foreshortened with a cheekbone turn in 3/4. **Almond** eyes near the vertical middle of the head, a thick upper lash line flicking outward, a tall oval layered iris, two highlights, long thin brows. Nose = a shadow plane + one stroke; one faint blush layer, never hatched. Hair in overlapping locks with sharp uneven tips over a wider dark under-layer, a continuous "angel ring" highlight with a zigzag lower edge. Lines: skin thin warm dark brown, hair dark purple; only hard props near-black. Emotion lives in brows, lid height, iris size, mouth corners and shoulders. Build and approve a **model sheet** first; draw every shot from the same head function.

**Backgrounds.** Painted once at load: sky gradients, airbrushed clouds with lit undersides, buildings or landscape with painted light sources, and always a matching **emissive plate** that slides with the colour plate. Wet ground = a flipped, blurred, streaked copy of the plate darkened with ripple bands. Generic sign words only, never brands. Moving plates get a light horizontal smear (~16 px) against strobing.

**Light and lens.** Bloom strongly from the emissive canvas, weakly from the colour canvas above ~0.9; tint the widest bloom red-orange (halation). Flares: star-burst, anamorphic streak, hexagonal ghosts through frame centre. Stamp every cel's silhouette in black onto the emissive canvas so glow never bleeds through it.

**Videotape + CRT, restrained and deterministic:** chroma bleed (sharp luma, horizontally blurred and slightly shifted chroma), fine scanlines anchored to output pixels whose gap shrinks on brights, a faint RGB grille, phosphor glow, darkened corners without curved borders, faint signal noise. Subtitles are composited inside the pass after grading. Two optional accents: a **power-on** (dot → line → picture) and **tracking noise** (a few frames of tearing, rolling band, vertical hop). Check moiré on a 720p downscale (and at phone size for a reel). Frame: full 16:9 as a theatrical feature (4:3 pillarbox is valid for an OVA feel).

## 3. Colour logic

- Painted plates carry gradients and atmosphere; cels are flat, few-colour, saturated. Each time of day gets its own colour model, never a filter over the frame.
- The protagonist has **one accent colour** that pops in every lighting set. Line colours are dark versions of their fill.
- Skin gets its own colour in every set; multiplying daylight skin by a tint turns faces pink under neon.
- Examples: night city (indigo, violet, neon magenta, cyan, window gold); seaside noon (cobalt, white cumulus, sand, coral); classroom dusk (amber, chalk green, brown wood, purple shadows).

## 4. Type & subtitles

- Subtitles live on the tape, composited inside the CRT pass: a semi-condensed sans (e.g. Barlow Semi Condensed 600, ~50–56 px), cream-yellow with a thick dark outline and soft shadow, ~96 px above the bottom (higher on YouTube, see Formats); a second speaker may take a second colour and a small boxed tag. Hold ≥ max(1.8 s, speech + 0.6 s); a line yields to the next.
- Titles: heavy italic Latin in a **chrome gradient** (sky → white horizon line → violet → pink → gold), dark + neon outlines, an optional katakana line as part of the title picture (e.g. Dela Gothic One), glowing through the emissive layer, flickering on at 12 fps with a light sweep and a star glint.

## 5. Motion quality

- **Characters on twos (12 fps)**; performance beats (blinks, eye openings, lip flaps, gestures) on threes (8 fps). Camera, light sweeps, flares and rain on ones (24 fps, or every frame of a 30 fps reel); a stepped camera judders.
- **Cycles**: hair and cloth as ribbons driven by a travelling sine, 4-drawing cycle (6 when calm); bounce = a 12 fps jitter of a few px.
- **Move light, not drawings**: coloured bands sweeping across a held cel (`source-atop`).
- **Impact frames**: 2 frames of an inverted or monochrome silhouette over radial lines, then the result.
- **Hold the peak**: a painted still with a slow pan, only cycles moving.
- Fast blinks (one 8 fps closed drawing); eye openings in three drawings; lip flaps of 3–4 shapes at 8 fps ending on a held expression.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Multiplane crane over a tall plate | a world revealed layer by layer | arriving; descending into a place; rising above it |
| Side tracking, 3–4 parallax layers | steady momentum | a journey; a chase; progress |
| Rear view into a pseudo-3D canyon | speed, pressure ahead | a race; a tunnel; a countdown |
| Held bust with light bands | speed or tension without animation | a drive; waiting; a decision |
| Insert with bokeh and a sliding highlight | this object matters | a letter; a key; a ticket |
| Extreme close-up on eyes | resolve, recognition | a choice; a promise |
| Slow pan across a painted still | awe, a held breath | a peak; a memory; a landscape |
| Radial speed lines + one-beat freeze | the instant before impact | a leap; a collision; a goal |
| Truck-in through a window or screen | entering another world | a flashback; a broadcast; a dream |
| Locked two-shot with lip flaps | conversation | banter; a confession; an argument |
| An earlier composition repainted | what changed | after a storm; years later |

Cut on bars. Framing: cels readable against the painted plate; keep the lower ~120 px clear for subtitles. Transitions: cuts, white flashes, impact frames, tracking noise at a tape-related beat; no digital dissolves or wipes.

## 7. Sound palette

- **Instruments** (city pop, synth funk, anime-opening pop): saxophone or synth-brass lead, FM electric piano with a bell transient, slap bass, chorus-y 16th guitar chanks, gated-reverb snare and big toms, drum machine, arpeggiated analog synth, string pad, FM bell sparkle. Extended jazz-pop harmony (maj7, 9ths).
- **Techniques, as options**: band-pass the score to cassette/AM when a diegetic source plays, then open it; a brass hit on a title; a drum fill left open for an effect; one beat of true silence before a peak; a semitone lift for a last chorus.
- **Foley** (synthesised or sampled): engines from an RPM curve, rain, tire hiss, wind, bells, radio squelch, impacts, sparks, cassette clicks, crowd murmur, door buzzers, footsteps on wet pavement; tape accents get their own thunk, whine, hiss.
- **Voice**: a dubbed-anime feel, short lines; a second voice through a phone/radio band-pass (~380–2800 Hz). Check that every line transcribes back correctly.
- **Mix**: limit then compress the voice, voices ~10 dB over ducked music (duck ~9 dB), beds ducked ~3 dB, choruses louder than intros, two-pass loudnorm to −14 LUFS.

## 8. Native moves

A menu: use the ones your story needs.

- **Small flat hero in a huge painted world.** *Fits content like:* a first day in a big company; a child in a museum hall; a lone researcher at an observatory.
- **Stillness as drama** (held close-up or harmony still). *Fits content like:* an exam result; a goodbye at a gate; an unveiling.
- **Backlit light.** *Fits content like:* a lantern festival; a screen full of code; a lighthouse; stage lights.
- **Speed grammar** (speed lines, looping plates, impact frames). *Fits content like:* a sprint final; a data packet crossing the world; a kitchen rush.
- **Light-band sweep on a held cel.** *Fits content like:* a night train; a scanner reading a page; a heartbeat quickening.
- **A song as an object** (tape, radio, jukebox changes the score). *Fits content like:* a band's origin; a family memory; a call-in show.
- **Tape artefacts as punctuation.** *Fits content like:* found home video; a rewind to the past; an interrupted broadcast.
- **Colour-model change** (one place, another hour). *Fits content like:* a day in a shop; a farm's seasons; before/after a renovation.

## 9. Pitfalls of the medium

- White cels bloom pink → bloom from the emissive canvas; weak, high-threshold bloom on colour.
- Neon bleeds through characters → silhouettes stamped into the emissive canvas.
- Black holes in highlights → clamp before S-curves.
- Thick rim light swallows thin shapes → 2–4 px offsets.
- Hair like tentacles, a face like a paper mask, moe eyes, uniform black lines → the drawing rules in §2.
- Pink faces under coloured light → skin gets its own colour per set; weaker light sweeps on faces.
- Front views are the hardest drawing → hide them behind a visor, a windscreen or backlight when you can.
- Pseudo-3D points behind the camera flip into the sky → clamp z to the near plane.
- Canvas silently falls back to a serif → `document.fonts.load` every weight before painting.
- CRT detail inflates files → noise in the shader, only `noise=c0s=2:allf=t` in ffmpeg, CRF ≈ 23; loudnorm in two passes with `linear=true`; don't let a limiter flatten the dynamics.
- Subtitles at the 16:9 height sit under YouTube's player controls, and in a reel anything below y 1248 sits under the app's buttons.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D for plates and cels, then a WebGL pass for light, tape and CRT; the whole frame drawn from `t`. Cels read a 12 fps stepped clock (performance beats 8 fps); camera, light sweeps, flares and rain read `t`.
- Cel shading in 2D: clip to the shape, fill the shape minus itself shifted toward the light (even-odd) for the shadow, shifted away for highlight and rim. Colour models are tables of lit / shadow / line per lighting set, with skin set by hand. One head function (3 views × expressions) draws the model sheet and every shot; keep a model-sheet mode for approval.
- Plates are painted once at load into a colour canvas and a matching emissive canvas, both slid by the camera; every cel is stamped black into the emissive canvas before the bloom.
- The WebGL pass: strong bloom from emissive, weak bloom from colour above ~0.9, red-orange halation, grade, subtitles, then chroma bleed, scanlines, grille, phosphor glow, corners and seeded noise; power-on and tracking noise as timed uniforms. Keep a raw mode that skips it for checking drawings. Start small: one plate with its emissive pair and one shaded cel through the pass.
- Lip flaps at 8 fps from the voice's word timings; cuts on the score's bars. One cue per impact frame, speed whip, glint and tape click in `cues.json`.

## 11. Variation space

You decide the structure, the characters, the world, the opening, the ending, the camera path, the pacing and the colour models:

- Structures: **slice of life in four seasons** (one place, four colour models, a small change each time); **two-hander dialogue** (a locked two-shot comedy that breaks into one fantasy sequence); **the mock opening credits** (a character roster introduced one by one, each with a pose and a name card).
- Openings: **in the middle of a conversation** (lip flaps already moving, no establishing shot); **a TV being switched on** to an in-world broadcast; **a close-up of a drawing hand** in a classroom, then cut to the world it draws.
- Endings: **a freeze-frame** on a laugh with a "to be continued" card; **the tape runs out** into blue screen; **a slow pan up to a starry sky** from a quiet rooftop, no dialogue.
