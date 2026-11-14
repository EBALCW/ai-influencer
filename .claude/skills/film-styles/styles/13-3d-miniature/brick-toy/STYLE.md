# Brick Toy

> Stop-motion toy-brick videos shot like macro photography on a real desk: a world built from interlocking plastic bricks with round studs, animated a pose at a time. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): brick-film stop-motion on a tabletop and the "brick movie" approach of stepping characters while the camera moves smoothly; macro toy photography (softboxes on glossy plastic, shallow focus, real objects as landscape). Copy none of their characters, sets or music, and never use a brand name.

## Formats

### Reel (1080×1920)

- **Layout.** The real surface and the room behind it bleed to every edge. The tall frame favours height: the character at minifig eye level low in the picture, its head around y 750–950, with the real room (a mug, a lamp, a window) towering above it out of focus. Titles, signs and anything read stay inside the safe box (x 72–900, y 269–1248); the subtitle pill is centred on x 540, at most 720 px wide, its baseline near y 1190. Stack, don't shrink: a wide pan across the desk becomes a tilt from the build up to the real object behind it, or a crane down from the room to one brick; two builders on opposite sides become near and far in a high angle; tracking beside a moving object becomes a vertical track for things that rise (towers, rockets, ladders).
- **The first 3 seconds.** Frame 1 is an extreme macro on a stud with the room blurred behind and a brick already mid-arc above it. By 0.5 s the brick snaps home with a click on a 12 fps step; by 3 s a pull-back shows the character standing on it, looking up at something enormous on the real desk.
- **Length and pace.** 25–45 s at 30 fps, characters and bricks stepping at 12 fps, camera and focus on ones. Shots of 2–4 s cut on bars (a snap can be the cut point); one dead-silent beat at the failure.
- **Captions.** The dark rounded pill with a small brick icon, in the spoken language, Fredoka at about 48 px, at most two lines.
- **Sound.** `ui-click` on every brick snap, `thock` for plastic landing on wood, `zoom-swish` on throws and whips along the desk, `sub-impact` on a collapse, `clean-ding` for a discovery. The toy-piano and glockenspiel score, the crash of many clacks and the parts-pile rattle come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** The body as written. Keep the subtitle pill above the bottom 12 % (the player's controls) and every built sign or title inside the 5 % margins; foreground part piles stay out of the frame edges anyway.
- **Length and structure.** 2–5 min at 24 fps, characters on 12 fps steps. A chapter is one build or one stage of a build; its title card is a sign built into the set (a printed tile, a brick-built board) popping in on 12 fps steps like a piece being placed. Re-hook every 30–60 s with a collapse, a rebuild into something else, a scale reveal or a new real-object landscape.
- **The first 10 seconds.** The finished build first, in a low hero orbit; by 5 s the question, as it tips and falls apart or a hand pours a bin of loose bricks; by 10 s the promise, a plan view of the empty baseplate with the parts sorted around it. Any channel sting after that.
- **Captions.** The pill burned in, plus an `.srt`.
- **Thumbnail.** A low-angle frame of the character beside its build with a real object towering behind in soft focus; at most three words on a printed tile.

### Good for

Toy and kids' content, product builds, step-by-step assembly explainers, space and science stories, playful brand stories, YouTube build series.

## 1. Essence, and what it is not

A brick world on a **real surface** (a wooden desk, a kitchen table, a windowsill), shot with a **macro lens** and animated **in stop-motion**. The charm is the tension between the toy world and the real room.

One-glance traits: glossy ABS with clean rectangular highlights; studs on every top face; seams darkened by contact shadow; real objects out of focus behind; characters that move in held poses on twos.

**Never** use the LEGO name, logo or minifigure silhouette (trademarks). Characters are *built from bricks* (e.g. 1×1 columns for legs, a 2×2 brick for a torso, round bricks for arms, a round 2×2 helmet). Studs carry no lettering.

Not **Low-poly Isometric Island** (no flat-shaded facets, no floating diorama), not a clay or felt stop-motion (no deformation: bricks are rigid), not a clean product render of a toy (this world is played with, handled, knocked over).

## 2. Materials & rendering

- **Plastic**: ABS with strong clearcoat (~0.85, clearcoat roughness ~0.07); a roughness map with faint fingerprints and scratches (base ~0.17, scratches up to ~0.65); a bevel so edges catch a highlight.
- **Geometry**: rounded box bodies (bevel ~0.045 stud), studs with a thin lip. Unit = 1 stud pitch (8 mm); brick height 1.2, plate 0.4. Large baseplates are **matte** (lower clearcoat than bricks), or they reflect softboxes as a coloured wash.
- **Set**: a real surface with a real texture and real props at true scale (1 m = 125 studs). Household objects become landscape. Light it with a **neutral daylight studio HDRI**, never a tungsten interior (white bricks turn orange).
- **Light**: a toy-photography setup. A directional key from one upper side, warm-white, casting shadows (fit its shadow frustum to each shot so shadows stay crisp); two or three **RectAreaLight softboxes** (key front, cool rim behind, one over any big set) so glossy plastic shows clean rectangular highlights; environment kept low (~0.45) for contrast. Add a soft contact-shadow blob where the key's shadow falls behind a hero object.
- **Ambient occlusion is mandatory**: GTAO (radius a few studs) darkens seams between stacked bricks, stud bases and contact points. Without it bricks look pasted on.
- **Supersample 2×** (render 3840×2160 to deliver 1920×1080, 2160×3840 for a 1080×1920 reel): thin stud edges and bevel highlights shimmer without it.
- **Lens**: physical depth of field (CoC ∝ |1/focus − 1/z|). Scale aperture with shot size: widest for close-ups, less for mediums, least for a wide (too much blurs the hero at mid distance). Focus is always on a character's head or the brick being placed.
- **Effects are bricks**: fire, smoke, water, light, weather, celestial bodies are all built from plates, round bricks and translucent pieces, jittered or rebuilt per drawing. Nothing is a particle system or a soft gradient.

## 3. Colour logic

- A **toy palette**: a handful of saturated brick primaries plus white, black, greys, tan. Each built object has one dominant colour and at most one or two trim colours; characters and hero objects take the most saturated ones.
- The **real world stays natural and muted**: wood, paper, ceramic, daylight. The saturated colour belongs to the toys, which makes them pop against the room.
- **Whites must read white**: grade slightly cool so white bricks don't go cream from the room bounce; soft contrast, saturation lifted ~10 %.
- Translucent pieces (orange, yellow, clear, blue) are reserved for effects: fire, light, water, glass.
- Example palette (the classic brick primaries): red `#c91a09`, blue `#0055bf`, yellow `#f2cd37`, green `#237841`, white `#f2f2ee`, black `#1b2a34`. Others: pastels and tan; greys with one accent.

## 4. Type & subtitles

- A rounded, friendly OFL face (e.g. Fredoka) for titles and subtitles.
- Subtitles live on a **toy element**: a dark rounded pill low in the frame with a small brick icon beside the text, or a printed tile, or a sign built into the set. White on dark, ≤ 2 lines, about ten words at most. A second speaker type (radio, device, narrator) gets its own icon colour or tag. Hold ≥ max(1.8 s, speech + 0.6 s).
- Titles pop in on 12 fps steps, like a piece being placed; a short sub-line in a brick colour.

## 5. Motion quality

- **Characters and bricks step at 12 fps** (on twos); **camera, focus, fire and flying vehicles move on ones** at 24 fps (30 in a reel). Stepping the camera too reads as judder, not charm.
- Bricks **fly in on arcs** and **snap** with a tiny overshoot (a fraction of a stud → 0 in ~4 frames). Every snap is a click on the soundtrack.
- Characters act with **big readable poses** held for several drawings: a V of arms for pride, arms flung up for alarm, a bowed head for sadness, a hop for joy. Walk cycles swing legs about ±0.55 rad with a small bob. Arms and legs rotate at their joints; nothing bends.
- Collapses and falls use **real rigid-body physics**: tip about the base edge, then independent bodies with gravity (a lower-than-true value reads better at this scale), bounces (restitution ~0.3), friction, settling flat. Pre-simulate so every render is identical.
- Tiny imperfections are allowed. Bricks never stretch, squash or morph.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| Extreme macro on one brick or stud, real room blurred behind | The toy scale is the world | a beginning; a detail that matters; a single part |
| Low angle at minifig eye level | A tiny character made heroic | ambition; pride; standing up to something big |
| High wide over the whole surface | The scale reveal: it was a toy all along | a summing-up; irony; a finished build |
| Low, wide, lonely frame, character small in a corner | Smallness, failure | a setback; waiting; loss |
| Frontal close-up, hands and brick in focus | Intimacy, decision | a choice; a repair; a gift |
| Handheld shake on impact | Physical shock | a collapse; an arrival; a collision |
| Tracking alongside a moving object, destination ahead | Momentum toward a goal | a journey; a race; a launch |
| Top-down plan view | Order, layout, a map | a plan; sorting parts; a city from above |
| Rack focus from a real object to a brick (or back) | Two scales in one frame | "big world, small maker"; a comparison |
| Orbit around a finished build | Pride, inspection | a product; a monument; a result |

Framing: keep foreground clutter out of the frame edges (piles of parts love to block the lens); check headroom in every shot; check every real prop against every camera, because an object placed on one shot's axis sneaks into the background of another. Cut on beats or bars; a snap can be a cut point. No generic dissolves; transitions can be a hand-placed brick covering the lens, a whip along the desk, or a pull out of one set into the next.

## 7. Sound palette

- **Instruments**: small, acoustic, playful (glockenspiel, toy piano, pizzicato, ukulele, whistling, claps, melodica); a brass or orchestral swell for scale; a heartbeat drum for suspense. Licensed or original, edited to the picture (cut on bars, bar-aligned jumps, chroma similarity at joins) rather than looped under it.
- **Foley** (synthesizable): plastic creak before a failure, tiny plastic footsteps, a crash of many clacks, a brick click (short transient + resonances near 2.9 kHz and 4.6 kHz), clack on wood, rattle of a parts pile being stirred, whoosh on throws, a bell "ding" for discovery, bricks sliding over paper, motors and engines built from filtered noise.
- **Silence is a tool**: cut music dead at a failure or a surprise; leave only room tone and one small real-world sound (a ticking clock, a fridge hum, a distant bird). Music can also drop out before a big moment, leaving a pulse or a countdown.
- **Voice**: one warm storyteller, unhurried, few short lines with room to breathe; secondary voices through a device filter (band-pass ~380–2800 Hz + soft saturation), optionally with beeps. Verify every line with speech-to-text (whisper).
- Mix: voice compressed, music ducked ~40 % under voice, master −14 LUFS.

## 8. Native moves

A menu: use the ones your story needs.

- **Snap-together building.** The plot is an act of building; pieces fly in on arcs and click home. *Fits content like:* a company assembling its first product; a neighbourhood rising street by street; a recipe put together ingredient by ingredient.
- **Break without harm.** Things fall apart and the parts become something new; failure yields spare parts. *Fits content like:* a pivot after a failed plan; recycling; a team reshuffled into a better shape.
- **Toy on a real desk.** Real objects become landscape at toy scale. *Fits content like:* a laptop keyboard as a city grid; a houseplant as a jungle; a coffee spill as a flood.
- **Hand-made stop-motion.** 12 fps poses, tiny imperfections, even fire and water made of bricks. *Fits content like:* a weather report; a kitchen explained with brick flames; a science demo of a volcano.
- **Rebuild into something else.** The same pieces, rearranged on screen, become a different object. *Fits content like:* one career turning into another; a before/after renovation; a word re-spelled.
- **The scale reveal.** Pull back until the whole world is a toy on a table. *Fits content like:* a big ambition that is still small; a year in review; a child's imagination.

## 9. Pitfalls of the medium

- Tungsten HDRI → orange whites. Use a neutral studio HDRI and a slightly cool grade.
- Clearcoat on a large flat baseplate reflects softboxes as a coloured wash. Make it matte.
- Flat, slightly jagged first renders: even light, no AO, single-sample rendering, stepped camera. Fix: softboxes + low environment, GTAO, 2× supersampling, cool grade, camera on ones.
- Too much aperture blurs the hero at mid distance. Scale aperture with shot size.
- A fast-rising or fast-moving object becomes a dot on a blank wall. Track it and keep its destination in frame.
- Curved transparent parts made from a sphere segment vanish inside a cylindrical part. Use an open-cylinder panel.
- Real props on a later shot's camera axis sneak into the background. Check props against every camera.
- Random jitter used as a material or colour index can go negative → undefined material crash. Clamp.
- In a reel, a subtitle or sign below y 1248 or right of x 900 sits under the app's buttons; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js, the whole frame drawn from `t`; three.js can be vendored next to the page and imported through an import map, as the pack's 3d-character style does. Characters, bricks and brick effects read a stepped clock (`Math.floor(t * 12) / 12`); camera, focus, fire and flying vehicles read `t` itself.
- Geometry in stud units: rounded-box bricks, plates and round bricks with a bevel of ~0.045 stud, studs with a thin lip, built once and instanced. Plastic is a physical material with clearcoat and a roughness map carrying fingerprints and scratches; baseplates get less clearcoat. Wrap jittered colour or material indices so they can never go negative.
- The set: a real surface texture and real props at 125 studs per metre, a neutral daylight studio HDRI at low intensity, a warm directional key with its shadow frustum fitted per shot, two or three rect-area softboxes. Render passes: GTAO, physical depth of field (CoC ∝ |1/focus − 1/z|, aperture scaled to shot size), a slightly cool grade, all at 2× and scaled down.
- Characters are brick-built rigs that rotate only at joints, driven by named pose objects (pride, alarm, sadness, joy) held for several drawings, plus a walk pose of about ±0.55 rad with a small bob. Collapses are pre-simulated rigid bodies (tip about the base edge, low gravity, restitution ~0.3, friction), baked to per-frame transforms so every render matches.
- Lock the voice first; place poses and snaps on its word timings and on the music's bars. One cue per visible event in `cues.json`: every snap, landing, throw and collapse. The brick click can be synthesised (a short transient with resonances near 2.9 kHz and 4.6 kHz); edit the score at bar boundaries. A minimal start: a brick lighthouse on a stack of books under the softboxes, rendered as one still.

## 11. Variation space

You decide the structure, the characters (or none), the surface and its props, the opening, the ending, the camera path, the pacing, the palette within the colour logic and the music. Vary them per video:

- Structures: **a catalogue** (one build per beat, each a different object answering the same question, lined up at the end); **two builders** on opposite sides of the table whose builds grow toward each other; **a disassembly** (a finished thing is taken apart piece by piece to explain what's inside).
- Openings: **a hand pours a bin of bricks** onto the table and the pile settles into the first shape; **a real object first** (a mug, a phone), then rack focus to the tiny world at its base; **plan view** of an empty baseplate filling in like a map.
- Endings: **one piece left over** held in close-up, the question it raises unanswered; **the lights go out** in the room and only a lit brick window glows; **a real hand** reaches in and picks the character up.
