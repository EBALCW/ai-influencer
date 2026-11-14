# Impasto Oil Painting

> Thick oil paint laid with a palette knife: big, flat, sharp-edged planes of colour, raked by light so every ridge of paint shows. Clarity first: value structure before texture, hard edges at the focus, calm planes everywhere else. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): the overhead umbrella choreography in the opening titles of a 1964 French musical (moving colour read from above); palette-knife street paintings (Leonid Afremov and the genre around him: knife mosaic, vertical wet reflections, warm lights against cool shadow); Sorolla / Sargent (few, decisive strokes and strong light); music-locked comedy editing (one action, one sound, one cut). Never copy their images, compositions, melodies or characters, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Plates are designed tall, not cropped: the reference illustration is drawn at 1080×1920, with lights above and their wet reflections running down below, or the overhead crowd seen as a tall pattern. Paint bleeds to every edge and the camera stays inside the plate. The subject sits in the middle third (y 640–1280) with the hard edges and smallest strokes; titles are laid in by the knife in y 300–600; small text and any subtitle stay crisp, centred on x 540, at most 720 px wide, last baseline y ≈ 1200, over a calm plane.
- **The first 3 seconds.** Frame 1 is a finished plate under raking light, a grey world with the one coloured thing already in colour; by 0.5 s it moves on a beat (an umbrella snaps open after its anticipation dip) with a pop; by 3 s colour starts spreading from it stroke by stroke, promising the whole world will be re-laid.
- **Length and pace.** 20–40 s, music-led: four to eight shots, one action = one sound = one cut, one hard silence, the colour wave as the climax.
- **Captions.** Often none: music and foley carry it. With a voice, plain serif subtitles in the spoken language, ≤ 2 lines, in a calm plane; titles are laid in with the knife.
- **Sound.** The pack's `clean-ding` for each pop, pitched up as a rising arpeggio, `zoom-swish` into a whip-pan, `shimmer` under the raking-light peak, `thock` for a snap or a door. Knife scrapes, wet dabs, rain beds and the strings, accordion or harp come from a free sample library or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 6 as written, with plates designed at 1920×1080; titles and crisp text inside the 5 % margins and above the bottom 12 %, where the player's controls appear.
- **Length and structure.** 2–5 min at 24 fps, smooth, no stepping. A chapter is one painted set or one season, opened by a paint-over sweep with its title laid in by the knife; the same wide returns to show what changed. Re-hook every 30–60 s with a colour event, a whip-pan into a new plate, motion painting the picture or the raking light.
- **The first 10 seconds.** The strongest plate first (the one coloured thing in a grey world), the question by 5 s, the promise by 10 s; a channel sting after that.
- **Captions.** Subtitles are plain text, not part of the look: ship the `.srt`, and burn them in only when the user wants them.
- **Thumbnail.** The one coloured thing in a grey plate under raking light, up to three words laid in with the knife.

### Good for

Music videos, art and culture, emotional ads, brand relaunches, seasonal campaigns, spoken-word pieces.

## 1. Essence, and what it is not

A moving oil painting made of knife strokes. Each stroke is a real object: a slanted plane of paint with a ridge where the blade pressed, a lip where it lifted off, broken streaks where the paint ran out, two colours dragged into each other. The world is **repainted from its strokes every frame**, but static paint never moves: only things that move in the story move. Light rakes across a height field, so the paint has body.

The look is clear and graphic (readable like a children's book at thumbnail size) but has the tactile surface of impasto at 100 % crop.

Not a Van Gogh swirl filter (strokes boiling everywhere), not a brush texture over flat vector art, not watercolour (paint is opaque), not a "painterly" photo filter (strokes are designed, not sampled from noise).

## 2. Materials & rendering

- **Value first.** Design each set as a flat, value-planned illustration (3 values minimum), then convert it to strokes. If the reference doesn't read at 480 px wide, no brushwork will save it.
- **Stroke sizes by importance and depth.** Coarse to fine: large planes in sky and walls, a few px only at edges and faces (per shape: a maximum stroke size, a detail level and a stroke direction).
- **Strokes never cross shape groups**, so silhouettes stay crisp. Lost edges are opt-in (put two shapes in the same group).
- **Thin underpainting** (the reference itself, blurred ~1.5 px) under the strokes, so the canvas never peeks through as outlines.
- **Knife stroke**: longer than wide (≈ 1.7–3.1 × radius long, 0.95–1.45 × radius wide), slanted ends, small angle and value jitter (≈ ±13°, ±6 %). Solid objects that must read as silhouettes (figures, props) get little or no ragged run-out.
- **Light** rakes over a height field; wet or glossy surfaces get slightly more specular.
- **Reflections** (wet ground, glass, water) are **explicit stacks of short horizontal knife dabs** under each light source, broken and fading; never a painted rectangle.
- Render supersampled (2×). **No film grain**: grain plus compression eats the knife edges.

## 3. Colour logic

- Planes of mixed, slightly broken colour; each stroke may drag a second colour into the first. No gradients made by blending pixels: gradients are made by stroke-to-stroke steps.
- Warm light against cool shadow is the default temperature structure; the brightest, purest chroma is reserved for the story's subject (a prop, a crowd, a light source), not the background.
- **Colour can be an event.** Every stroke can hold a grey and a colour version; a monochrome world with one coloured exception, or a world re-laid from grey to colour, is native to the medium. The grey version is the luminance of the same strokes, slightly cool, with a small colour residue.
- Examples of palettes that fit: an after-rain sunset (cobalt → peach → gold sky, ochre facades, full-chroma props); a harvest field (straw yellow, burnt sienna earth, one viridian tractor); a night kitchen (umber shadows, sodium-lamp orange, one cold blue window). Choose from the topic.

## 4. Type & subtitles

- Titles are **laid in with the knife** (a stroke-by-stroke appear sweep of about a second) and can be taken off by the world (washed by rain, scraped, painted over). They move with the world.
- Small text (credits, data, captions) stays crisp DOM text over the painting: knife strokes can't carry small letters.
- A serif display face (e.g. Cormorant, OFL). Subtitles, if there is a voice: plain serif, one language, ≤ 2 lines, in a calm plane; hold ≥ max(1.8 s, speech + 0.6 s).

## 5. Motion quality

- Static paint is static. Only the things the story moves move (weather, figures, props, ribbons, light). Smooth 24 fps, no stepping: clarity is the brief.
- Moving figures are procedural strokes rebuilt each frame from **fixed seeds**, so their paint doesn't boil (walk cycles, IK arms, props that open and close).
- Actions sit on the music grid: a change of direction, a pop, a swell lands on a beat.
- Anticipation → action → follow-through on every gesture (lift before the strike, dip before the snap, swing after the stop).

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Slow truck + push on a wide | a world observed; patience | a place; a routine; a crowd |
| Push-in through a silence | inner pressure | a doubt; a decision; giving up |
| Tilt-up from the ground or a reflection | discovery from below | a small character entering; a first sight |
| Pull-back from a close-up | reaction; the world answering | consequence; a reveal of who is watching |
| Rotating crane-out, overhead | pattern emerging from many | choreography; traffic; a gathering |
| Same wide, repeated | before/after | change of colour, season or time |
| Locked frame, light moves | time and weather as the actor | a day passing; a storm arriving |
| Macro slide along the paint surface | the matter itself | a texture; a crafted object; a map |
| Whip-pan into a new painted plate | energy, a jump | a list; montage; travel |

Framing: keep the camera **inside the painted plate** (`half = W/2/zoom`), or the canvas shows. The subject gets the hard edges and the smallest strokes; everything else stays in big calm planes. Transitions: paint-over sweeps and scrapes, hard cuts on beats; no dissolves (two layers of knife ridges turn to mud).

## 7. Sound palette

- **Foley follows the paint and the world**: palette-knife scrapes on every repaint or paint-over, wet dabs, the materials of the scene (wet stone, nylon, wood, fabric, glass).
- **Beds** in layers (a hiss, near grains, one distinct detail), filtered when the camera goes under cover.
- **Acoustic instruments with a hand-made grain**: solo strings, accordion, pizzicato, harp arpeggios, glockenspiel or celesta for pops, piano, guitar, woodwinds; a solo instrument for a lonely world, an ensemble for a shared one.
- Options: **one action = one sound = one cut** (music-locked edit); pops pitched as a rising arpeggio so a sequence of events climbs; an unresolved phrase that the video resolves later; a hard silence that cuts music and beds to digital zero, containing at most one sound; a J-cut of the next scene's foley into a silence.
- Mix: music and ambience duck under any voice (~8 dB); master −14 LUFS. Music and foley can carry a video without narration.

## 8. Native moves

A menu: use the ones your story needs.

- **Colour re-laid by the knife.** Every stroke keeps a grey and a colour version; a reveal wave re-paints them stroke by stroke. *Fits content like:* a town waking up; a patient recovering; a brand relaunch; a season turning.
- **The one coloured thing.** The world drawn in its grey version, one object in colour. *Fits content like:* one person in a crowd; the fruit that ripened; a warning light.
- **Motion paints the picture.** Moving objects drip their colour as knife dabs; seen from above, their paths leave a painted pattern. *Fits content like:* a dance; delivery routes across a city; a football play; migration.
- **Raking light.** At the peak, drop the light to a grazing angle so every ridge catches it, then let it settle. *Fits content like:* a sunrise; a moment of recognition; unveiling a sculpture.
- **Paint-over transition.** The next shot's strokes are laid over the previous one in a sweep, with a scrape on the soundtrack. *Fits content like:* a renovation; memory replacing the present; a timeline of versions.
- **Sound made visible.** A note or a voice becomes a paint ribbon that carries colour to what it touches. *Fits content like:* a song reaching listeners; a radio broadcast; a rumour spreading.

## 9. Pitfalls of the medium

- Confined strokes shrink near edges and leave canvas-coloured outlines → add the underpainting texture.
- Draw order in the reference matters: painting the ground after the buildings covers their feet.
- Plain rectangles read as posts or blocks → give silhouettes taper, a lit edge, and one or two defining dabs (shoulder, hair, handle).
- Proportions carry the object's identity at this stroke size: a prop drawn too wide reads as a different thing. Check silhouettes at thumbnail size.
- Film grain or heavy compression destroys the knife edges → no grain, supersample, high bitrate.
- Strokes that are re-seeded every frame boil → fixed seeds per stroke.
- WebGL traps at the engine level: GLSL reserved words used as variable names, and vertex-array state left bound from one draw to the next.
- A 16:9 plate cropped for a reel leaves the subject tiny or cut → paint the reel's plate tall from its own reference illustration.
- Text under the app's buttons → in a reel, keep titles and subtitles above y 1248 and left of x 900; on YouTube, above the bottom 12 %.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- A WebGL renderer drawn from `t` at 2× supersampling: each stroke is a quad with a height profile (ridge, lip, ragged run-out, a second colour dragged in), written into colour and height buffers; a finishing pass rakes light across the height field (more specular on wet or glossy shapes) and grades.
- A stroke is a record: position, angle, length, width, colour, second colour, type (knife, brush, dab, line), taper, alpha and a fixed seed. A small mark — your mascot or a logo — is a handful of them: four tapered knife points round a centre and one bright dab as the core.
- Plates start as a flat, value-planned reference illustration made of shape groups; a converter turns it into coarse-to-fine strokes confined to their groups, over the reference blurred 1.5 px as underpainting. Static plates are batched once and drawn with the camera, a grey-to-colour mix, a reveal front and an appear sweep; moving strokes are rebuilt every frame from their seeds.
- The reveal wave is per stroke: each stroke switches from its grey to its colour version when the front passes its position, so the world is re-laid stroke by stroke rather than faded.
- Actions are keyed to the music's beats (or the voice's words); one cue in `cues.json` per pop, scrape, whip-pan and snap. Encode at a high bitrate (CRF 16 or lower) with no grain.

## 11. Variation space

You decide the structure, the cast (or none), the sets, the opening, the ending, the camera path, the pacing, whether there is a voice, and where colour lives. All far from the obvious:

- Structures: **one object, many hands** (a bowl or a boat passes through the people who make and use it, one painted plate per hand); **a still life comes alive** (a locked table whose objects move in turn, the light crossing it hour by hour); **a portrait in layers** (a face painted coarse to fine as a voice tells one life, each layer a decade).
- Openings: **the bare canvas** (underpainting only; the first knife stroke is the first event); **macro on a ridge of paint** that pulls back to become a mountain or a roof; **mid-action** (a figure already running across a finished plate).
- Endings: **scraped back** (the knife takes the painting off to the underpainting, leaving one mark); **the light goes out** (raking light sinks until only the ridges glow, then black); **the frame in a room** (the video was a painting hanging somewhere, seen by someone).
