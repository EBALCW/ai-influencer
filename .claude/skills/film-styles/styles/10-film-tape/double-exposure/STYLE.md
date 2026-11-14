# Double Exposure

> A silhouette that is a window: the outline of an animal, a person or an object stands in a quiet monochrome world, and inside it a second photograph (a forest, a city, a coast) prints in like film in a developer, with a few warm lamps glowing. The camera pushes through one window into the next place, and at the end the picture inside lines up with the real world outside. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): in-camera double exposures of portrait and landscape photography (take the dark shape filled with a lighter place, and the soft fade where they meet); 2010s title sequences built on silhouette composites (take the slow camera through one image into another); the darkroom (take the print developing up from the bottom, and the warm safelight against grey); nature documentaries (take patient, weighty animal motion). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The silhouette is the picture: 800–1000 px tall, centred, its top above y 500 and its weight around y 900. Upright subjects (a standing figure, a tree, a bottle, a bird with wings raised) suit the phone; long ones (a fish, a car, a train) are tilted 15–25° up toward the top right or cropped to head and shoulders.

| Zone | Position | Content |
|---|---|---|
| Outer world | full bleed | sky above y 400–700, ground or sea below y 1300 |
| Silhouette | centred, y 450–1300 | the window |
| Moon or sun | top third, opposite the head | one soft disc |
| Caption | centred on x 540, ≤ 720 px wide, bottom edge y 1230 | over a soft pool of shade |

- **The first 3 seconds.** Frame 1 shows the silhouette already standing in its world, its inside dark; by 0.5 s the inner photograph starts developing from the bottom up with a shutter click; by 3 s it has printed fully and the first warm lamp inside switches on.
- **Length and pace.** 30–50 s. Three to five windows, 7–12 s each, one transition per window (push through, whip, dive, morph, breach) and one register at the end.
- **Captions.** One caption layer: plain words over a soft shade, no box.
- **Sound.** `camera-shutter-light` on each develop, `tick` on each lamp switching on, `zoom-swish` on pushes and whips, `shimmer` as a sweep of lights comes on, `sub-impact` on a breach or a landing. Harp, cellos, horn, clarinet, bowed vibraphone and glockenspiel from the [VS Chamber Orchestra Community Edition](https://github.com/sgossner/VSCO-2-CE) (CC0).

### YouTube (1920×1080)

- **Layout.** Section 2 as written; captions sit opposite the subject and end above y 950; the 5 % margins hold.
- **Length and structure.** 2–5 min, one chapter per place or per character. Each chapter is one silhouette: arrive in its world, develop its inner place, light its lamps, then leave by a transition that carries the camera into the next. Re-hook every 30–60 s with the inner place coming alive (lamps one by one, a sweep of lights), or with a transition that shows a new shape.
- **The first 10 seconds.** The strongest image first: a full silhouette already printed and lit against a night sky; the question by 5 s ("what does a place leave inside us?"); the promise by 10 s, as the camera pushes through the window into the first inner world.
- **Captions.** Burned in as part of the look, and exported as `.srt`.
- **Thumbnail.** The most striking silhouette with its warm lamps lit, moon behind, at most three words in the serif.

### Good for

Brand and city films, documentary and series openings, music video intros, travel and place stories, "who we are" pieces, memorials.

## 1. Essence, and what it is not

1. **The silhouette is a window, not a cut-out.** Inside it is a second place, at its own depth and parallax; the outline never carries a stroke until the very end.
2. **Monochrome, plus warm light.** Everything is grey, black and white; the only colour is warm lamplight (and the moon), so the eye goes to the lights inside.
3. **Develop, don't fade.** Inner photographs print into the dark shape from the bottom up, like a print in a tray.
4. **One move per transition.** The camera pushes through a window, whips, dives or rises; the next place is always reached by moving, not by cutting.
5. **Register.** The last inner picture slides until it lines up with the real horizon outside; the silhouette lets go and stays only as a faint second exposure.

Not **Silhouette Rhythm** (flat graphic shapes on colour, cut to a beat; here the shape is a window into a photograph and moves slowly). Not **Vintage Engraving Collage** (no engraved cut-outs or paper edges). Not **1920s Silent Film** (no flicker, title cards or sepia). Not a masked slideshow: the outer world is a living scene, and the inside moves at its own depth.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Sky | top 45–70 % | grey gradient, fbm clouds, stars at night |
| Moon or sun | top right or left third, r 40–60 px | soft disc with a wide glow |
| Silhouette | centre, 330–780 px tall, often x 270–1490 for a long animal | the window, head into the open side |
| Horizon | y 770–940 | far hills or sea line |
| Ground or sea | below the horizon | grass ridge, water, mist |
| Caption | opposite the subject: left-aligned at x 128 or right-aligned at x 1792, baseline ≤ y 930 | one line plus an optional second |
| Title, credit | an empty part of the sky; title right, credit top left | develops from blur |

At least a third of the frame is open sky. The subject faces into open space; the caption sits on the side it faces away from.

## 3. Materials and rendering

- **The silhouette mask** is made once from a vector outline: a texture whose red channel is the sharp alpha, green a soft alpha blurred by 3 % of the shape's height, and blue a signed distance field (an exact Euclidean distance transform at half resolution, 0.5 at the edge). Sharp alpha cuts the window, soft alpha shades its inner edge and lifts a halo outside, the distance draws the outline at the end.
- **Inside**: a black-and-white photograph mapped in its own world coordinates (it does not move with the silhouette), at a depth of 0.2–0.7 of the outer camera's motion. Its tone is lifted and curved (`0.05 + 0.86 · f^1.45`), darkened toward the edge by the soft alpha (× 0.42 at the rim), with drifting fbm mist and grain-sized noise (±2.5 %).
- **Warm lamps**: up to 40 points in the inner photograph's coordinates, each a tight bright core and a wide warm glow (a Gaussian of radius r and one of r × 0.19), switched on at their own times.
- **Halo**: just outside the edge, the soft alpha lifts the outer world by 6–9 %, so the shape floats off the sky.
- **The outer world is drawn in code**: gradient sky with two scales of fbm clouds, a sun or moon with two exponential glows, two or three ranges of hills at depths 0.2, 0.5 and 0.8 with mist bands between, grass blades 6 px apart swaying, snow, water surfaces with shivering highlights, spray of 170 drops under 950 px/s² gravity.
- **Shapes move with their bodies**: necks pivot, breathing lifts the chest by 0.6 %, fish carry a sideways wave head to tail, swimming mammals a vertical wave toward the tail. The inner picture bends with the body.
- **Grade, last, over everything**: a soft tone map `c / (1 + 0.12c)`, an S-curve at 42 %, highlights warmed (+5 % red, −5 % blue above mid-grey), shadows cooled (+1.4 % blue), a vignette of 55 % at the corners, grain of ±1.4 % changing 24 times a second, and a final 3.5 % zoom creep across the ending.

## 4. Colour logic

- The world and every photograph are monochrome (desaturate the sources fully).
- Warm light is the only hue: lamps, windows, the sweep of a city, a thin outline at the end. Nothing else is coloured.
- Day scenes are high-key (sky 0.62–0.93 grey), night scenes low-key (sky near 0.05) with the moon as the brightest disc.
- Inside should be lighter than the shape's surroundings, or the window reads as a hole.
- Text is warm off-white, never pure white.

Example palette: lamp `#FFA152` (rgb 1.0, 0.63, 0.32), lamp core `#FFDB9E`, title `#F5E6CC`, credit `#EDE3D1`, caption `#F1EADF`, caption second line `#D6CEC1`, shade under captions `#06080A` at 42 %.

## 5. Type and captions

All faces are SIL OFL from Google Fonts.

| Role | Face | Size (16:9) | Rules |
|---|---|---|---|
| Captions | Newsreader Italic 400 | 32–36 px | warm off-white; a second line 28 px in a dimmer tone |
| Title | Newsreader Italic 400 | 58–132 px | develops from a 9 px blur to sharp over 0.9 s while fading in over 0.7 s |
| Credit, small labels | Newsreader 400 | 30–32 px | a 56×2 px rule between lines |

- **Captions** have no box and no outline: under them lies a wide pool of shade, a radial gradient flattened to 22 % of its width at 42 % opacity. They fade in and out over 0.3 s. Hold ≥ max(1.8 s, spoken line + 0.6 s). One language, the spoken one.
- Captions alternate sides with the subject: when the head faces right, the caption goes left.
- No numbers or labels on screen; this style speaks in places, not data.

## 6. Motion

- **Frame rate.** 30 fps, continuous (no stepping). Everything is a pure function of `t`.
- **Easing.** Smoothstep for almost everything; cubic in-out for camera arcs; ease-out for titles; zoom changes through a log or power curve so a push accelerates into the window.
- **Weight.** Animals breathe and shift weight on 1.3–2.1 s sines; heads turn 4–8° over a second; swimming waves at 0.3–1.1 Hz. Nothing bounces.
- **Develop.** A soft front sweeps up the shape over about 1.2 s, with a faint bright band (+6 %) riding on it, like developer reaching the paper.
- **Lamps.** Each lamp eases on over 0.2 s; several follow 0.2 s apart along a street or a shoreline, or a sweep crosses the inner city left to right in 1.6 s.
- **What never moves**: the stars and the moon are fixed on screen; the inner photograph never slides with the outline (only with its own camera depth).

## 7. Camera

| Move | What it expresses | What it can serve |
|---|---|---|
| Slow push on the silhouette (zoom 1.0 → 1.16 over 4 s) | attention gathering | the arrival of a character |
| Push through the window (into the shape until its inside fills the frame, 1.25 s) | entering what it carries | moving from a person to their memory, an animal to its home |
| Whip pan with motion blur (directional blur of 0.4 × screen velocity, capped at 600 px) | the next place, at once | a list of places, a change of pace |
| Dive (the shape grows ×10 and turns 0.22 rad over 1 s, with radial blur) | falling into something | a descent, a plunge, a deep detail |
| Rise through the surface (camera climbs 1300 px, split waterline) | breaking into a new world | a breach, a launch, an arrival |
| Register (the inside slides 3.4 s to line up with the real horizon) | the inner world is the real one | the ending; "it was here all along" |

Transitions: push through a window, whip with motion blur, a screen-blended dissolve on a dive (screen at 55 %, rising and falling with sin(π × mix) over 0.8 s), a morph where one whole silhouette prints out as the next prints in (never a blend of the two outlines), a waterline split. Forbidden: hard cuts between windows, wipes, flashes, colour grades, any shape morphing between outlines.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Voice | one slow, warm narrator, few words per window | about 10 dB over the music by RMS, compressed |
| Music | one minor key throughout, one harmonic colour per window (a relative major for a lift, a darker minor for a dive), resolving to the major at the register; harp ostinatos, cello and bass, horn calls, low clarinet, glockenspiel on lamps, bowed vibraphone on a sweep of lights, piano sparingly | ducked 5 dB in 300 Hz–4 kHz under speech |
| Foley | a soft shutter click when a window develops, a small tick per lamp, wind on ridges, animal calls, wing beats, a plunge and bubbles, river and sea beds, a splash when something breaks the surface | quiet; natural |
| Silence | a breath before the register | |

Pack ids as in Formats. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **The develop.** The inner photograph prints into the dark shape from the bottom up with a shutter click. Fits content like: a reveal; a memory surfacing; a product showing what it contains.
2. **Lamps on.** Warm points switch on one by one inside the window, each with its tick. Fits content like: a community; homes, offices, customers; things coming alive at night.
3. **Through the window.** The camera pushes into the shape until its inside fills the frame and becomes the next shot. Fits content like: entering a person's world; zooming from a brand mark to its places; chapter changes.
4. **Two whole shapes.** One silhouette prints out as the next prints in at the same place, overlapping in a screen blend, never a blend of outlines. Fits content like: one becomes another; growth; a handover between generations.
5. **The breach.** The camera rises through a waterline; air above, the inside below, the line lifted where the body breaks through, spray falling. Fits content like: a launch; an arrival; a surprise.
6. **A sweep of lights.** Across an inner city, lights come on along a front moving left to right in 1.6 s. Fits content like: a city waking; a network going live; an audience.
7. **Register.** The inner picture slides until its horizon lines up with the outer one; the outline lets go, a thin warm rim fades, and a pale ghost remains over the real place. Fits content like: the ending; homecoming; "this is where it was going".

## 10. Build

Follow [building](../../../references/building.md). For this style:

- WebGL2: each shot is one full-screen fragment shader into a float framebuffer, drawn from `t`; a composite pass mixes two shots for transitions, adds motion blur, the waterline split, spray, titles, captions, grade and grain. Seed all noise from the pixel and frame.
- Silhouettes from CC0 or public-domain vector outlines (for animals, [PhyloPic](https://www.phylopic.org) items marked CC0 or Public Domain Mark; for objects, the user's own logo or product outline). Bake each into the three-channel mask texture at load (sharp, soft, distance).
- Photographs: the user's own first; otherwise CC0 images on [Wikimedia Commons](https://commons.wikimedia.org), checked on each file page. Download at 2560 px wide, desaturate, and keep a record of title, author, licence and use. Tell the user what will be fetched before downloading. No identifiable people inside the windows.
- Every inner photograph has a world rectangle and a parallax depth; transitions are written as one camera moving through both shots, so the last frame of a push is the first frame of the next shot.
- Captions, titles and credits are drawn on a 2D canvas and uploaded as textures; titles carry their own blur radius into the composite.
- One sound event per develop, lamp, transition and splash in `cues.json`; the score's chord changes sit on the transitions.

## 11. Pitfalls

- **Busy inner photos.** Detail at full contrast fights the outline; lift and compress them so the shape still reads at a glance.
- **Inside darker than outside.** The window turns into a hole; inside must be the lighter value.
- **Outlines with holes and spikes.** Thin legs, antlers and fins break at small sizes; pick silhouettes that read as one mass, and soften spikes with the soft alpha.
- **Colour creeping in.** One unconverted photograph breaks the whole look; desaturate every source.
- **Blending outlines.** Morphing one shape into another looks like a screensaver; always print one out while the other prints in.
- **Cuts.** A hard cut between windows loses the dreamlike continuity the style lives on.
- **Licences.** "Free to use" sites are not enough; read the licence on each file page and keep the record.

## 12. Variation space

The agent decides per video: the chain of subjects and their inner places, day or night, which transition carries each change, where the lamps are, the final register.

- **Three structures:** a journey of subjects from one landscape to another (forest to coast, village to city), each carrying the next place; one subject whose window shows its life in stages; a portrait whose inside shows the places that made the person (with their own photographs).
- **Three openings:** a silhouette already printed and lit at night; a dark shape on a high-key ridge, developing in the first seconds; a push into a small window from far away.
- **Three endings:** the register onto the real horizon; a pull back from the last window to show every earlier shape faint in the sky; the lamps going out one by one until only the moon remains.
