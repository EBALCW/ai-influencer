# Paper Pop-up Book

> A pop-up book on a real desk becomes a stage: flat cut-paper actors with white borders perform in front of paper sets that spring up from the page, under real lamp light and a real macro lens. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): paper-craft role-playing games (flat cut-paper actors with a white border in a 3D diorama, bubbles that type on with blips, action ratings); the great engineered pop-up books (layered V-folds, pieces rising back to front, pull-tabs); macro "tiny world on a real desk" photography. Never copy their characters, logos, UI or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The desk, the room and the open book bleed to every edge. The tall frame suits the book: the standing backdrop board fills the upper half (about y 300–950) and the page below is the ground the actors stand on, their heads around y 800–1050. Bubbles sit above their speakers and signs drop from above, all inside the safe box (x 72–900, y 269–1248); narration subtitles are centred on x 540, at most 720 px wide, baseline near y 1190. Stack, don't shrink: compose each spread with height (trees, towers, a sun on a stick high on the board); a top-down shot turns the book so the gutter runs across the frame and the two pages sit one above the other; a page turn is seen from a high 3/4 so the curl sweeps the whole tall frame.
- **The first 3 seconds.** Frame 1 is mid-turn: a page already curling past the lens, the next spread's back row springing up behind it (never the closed cover). By 0.5 s the page lands and the back pieces snap up; by 3 s the hero pops up in front, flips to face us and a bubble types on with blips.
- **Length and pace.** 25–45 s at 30 fps (60 if render time allows). Two or three spreads of 8–15 s; pop-ups staggered back to front; one held silence, the book still, before the turn that matters.
- **Captions.** Narration subtitles in cream with a thick dark-brown outline, rounded sans at about 48 px, in the spoken language; characters speak in paper bubbles.
- **Sound.** `zoom-swish` on page turns, `ui-pop` on each pop-up snap, `typing-tick` under typed bubbles, `ratchet` on a pull-tab slide, `thock` on cardboard thumps and the book closing, `sparkle` on an action rating. Paper crinkle, spine creak and the music-box score come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** The body as written. Keep narration subtitles above the bottom 12 % (the player's controls) and bubbles, signs and banners inside the 5 % margins.
- **Length and structure.** 3–6 min at 60 fps (30 to halve render time). A chapter is a spread; its title card is a cardboard sign dropping on strings over the new spread as the page lands. Re-hook every 30–60 s with a pull-tab mechanism, a crossing at the edge of the page, a real object joining the story or a typed rating.
- **The first 10 seconds.** The most spectacular spread first, mid-pop, at the actors' eye level; by 5 s the question in a typed bubble; by 10 s the promise, the camera rising to show the pages still to come. Any channel sting after that.
- **Captions.** Narration subtitles burned in, plus an `.srt`; bubbles stay in the paper world.
- **Thumbnail.** An eye-level macro of the paper hero before a freshly popped spread, lamp light warm, the room soft behind; at most three words on a cardboard sign.

### Good for

Children's stories, game trailers, story-led brand videos, step-by-step processes told as spreads, seasonal content, picture-book series on YouTube.

## 1. Essence, and what it is not

Two worlds in one frame. **The real world** at human scale: a photoreal surface lit by an HDRI room, a few real objects, a macro lens (shallow focus, warm practical light, soft contact shadows). **The paper world**: a hardcover book in that room; when it opens, one board stands up as the **backdrop** and the lower page is the ground. Every set piece is a **flat cut-paper card** that lies on the page and **pops up** around its bottom edge. Characters are cut paper too: a few centimetres tall, flat, with a thick off-white border, a grey cardboard edge and grain.

What sells it is the **mismatch of scale and material**: flat, saturated, outlined paper cartoons under real light, casting cut-out-shaped shadows and going soft in real lens blur. Keep the paper graphic; let light and lens make it real.

Not a papercut silhouette video (no one-colour lace, no backlight: that is **Red Paper-cut** or **Paper-cut Lightbox**), not a 3D cartoon (nothing modelled round), not claymation (paper hinges, folds, curls and slides; it never squishes).

## 2. Materials & rendering

- **Real units** (metres): page 0.3–0.5 m wide, actors 3–5 cm, near plane a few mm, so HDRI, shadows and depth of field behave like a real macro shot.
- **Cut-paper finish**: Canvas 2D art with a dark ink outline; its silhouette dilated (drawn at many angles on several rings, recoloured `source-in`) into a grey cardboard edge offset slightly down (thickness) and a wide off-white border; a shared paper grain on top (`source-atop`).
- **Drawing**: one dark-brown ink (never black), thick outline + thinner detail line, round joins; shading = one hard **crescent** (fill with shade, refill shifted with base); wobbly shapes (low-harmonic noise), never perfect geometry; simple faces.
- **Pop-up pieces**: planes with art on the front and plain paper on the back (same alpha); `alphaTest` + `alphaToCoverage`; a custom depth material with the alpha map so **the shadow is the cut-out silhouette**. Anything "3D" is several flat cards (front/back layers, triangles hinged on a keel).
- **The book** is modelled: cloth cover with foil title (roughness/metalness map), page block with edge lines, a curling leaf.
- **Real world**: HDRI environment and softly blurred background, real wood or fabric, a few CC0 props. **Neutral tone mapping** (ACES shifts paper colours).
- **Depth of field by hand**: CoC = aperture × (1/focus − 1/z), spiral gather that keeps far samples off a sharp foreground (stock bokeh looks fake at this scale); then light bloom, vignette, warmth.

## 3. Colour logic

- Saturated children's-book colour, **never neon**; the real world stays natural and slightly warm so paper pops against it.
- **One dominant hue family per spread**, so a page turn is also a colour change; a few accents (a red, a yellow, a gold) recur across spreads to stitch the book together.
- Ink dark brown, border off-white, card backs plain paper.
- Unfinished or "outside the story" pages lose colour: graphite on cream. Night is a change of the paper art; the real lamp keeps its warmth.

Examples of spread families: green meadow under sky blue; pink-and-lilac market with mint accents; ochre desert with a turquoise oasis.

## 4. Type & subtitles

- Rounded OFL faces: a rounded sans for subtitles, bubbles, signs (e.g. Fredoka); a chunky display face for cover, banners, action words (e.g. Lilita One); a storybook serif for taglines (e.g. IM Fell English).
- **Narration subtitles**: bottom centre, ~40 px in 16:9 (about 48 px in a reel), cream with a thick dark-brown outline and soft shadow, one line in the spoken language, at most about ten words. Hold ≥ max(1.8 s, speech + 0.6 s).
- **Speech bubbles** live in the paper world: white card, ink outline, tail projected each frame to the speaker; pop in with overshoot, type on with blips.
- **Titles are paper objects**: a cardboard sign dropping on strings and swinging; the cover itself is the video's title. Action words (italic display, gradient, double stroke, rays) sparingly, like a game rating.
- Subset fonts to the characters used; re-subset after every text change.

## 5. Motion quality

- On ones (60 fps suits the smooth macro camera; 30 is fine), all a pure function of `t`. Paper moves stiffly; life comes from easing: `back()` overshoot for pop-ups, springs for things on strings, squash and stretch on characters.
- **Pop-ups rise back to front** (delay grows with distance from the reader), far pieces lying back, near ones folding forward face-down; they fold down in the same order.
- Plants and light props sway a few hundredths of a radian around their base.
- **Characters are flat cards redrawn per quantized pose** (walk phase, arms, eyes, mouth, look, blink); walk phase follows distance walked, so feet don't slide.
- **Turning around = a `scale.x` flip** between front and back drawings; never `rotation.y`. Jumps: parabolic arcs, squash at both ends, a paper puff on landing.
- **Page turn**: a many-segment strip whose bend is integrated along its length, so it curls like paper.
- Never moves: the room.

## 6. Camera grammar

One virtual macro camera keyed as position / target / fov / aperture / focus with monotone-cubic interpolation; a new key list = a hard cut. A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Eye-level macro track, shallow focus | being inside the story at the actors' size | a walk; a conversation; a chase |
| Pull up to a 3/4 view of the spread | the mechanism, the map | a page turn; a new setting; a plan |
| Descending dolly from human height | entering the book's scale | an arrival; zooming into one part of a system |
| Push-in on a face | feeling | a wish; a fear; a decision |
| Reverse shot from inside the book to the blurred room | the world beyond the page is huge | curiosity; an outside threat; a reader watching |
| Rack focus paper ↔ real object | paper and reality touch | cause and effect; a real product in a paper story |
| Top-down over the open spread | a board game, a diagram | a route; two sides of the gutter compared |
| Locked frame on a pull-tab | the trick is the event | before/after; a count |
| Rising crane leaving the book small | scale, distance | aftermath; a summary; time passing |

Actors in focus, room objects as soft foreground or background; keep near pop-ups out of the lens path. Transitions: page turns, a book closing and reopening, a hard cut on a paper sound; never a video dissolve inside the book.

## 7. Sound palette

- **Paper foley is the signature**: page swish, cardboard thump, pop-up snap (short sine sweep + crinkle), fold and crease, pull-tab slide, footsteps as tiny taps with crinkle, slat flaps, string-drop tinks; the book's spine creak and closing thump. All synthesizable from the page's event list.
- **Character voices as typing blips**: one waveform and pitch range per character, a blip every other letter.
- **Narration**: one warm storyteller, unhurried, picture-book sentences; pronunciations kept apart from displayed text.
- **Music**: whimsical, acoustic or toy-like: music box, pizzicato strings, clarinet, glockenspiel, ukulele, toy piano, brushes. Options: a warmer cue for anything in the real room; a bar-aligned internal edit of a library track so its ending lands on a picture event; a pull-tab's clicks setting a cue's pulse.
- **Ambience**: room tone and a clock for the room; one bed per spread for the paper world.
- **Silence** = the book held still with only room tone; before a turn that matters, or a hesitation.
- **Mix**: voice high-passed, compressed, well above music; music ducked under speech with smooth release; limit SFX per channel; master −14 LUFS.

## 8. Native moves

A menu: use the ones your story needs.

- **The book opens**: creak, the board swings up, the world pops up back to front. *Fits content like:* a project launch; a first school day; a recipe book.
- **Page turn = scene change**: old pieces fold down as new ones spring up. *Fits content like:* stages of a process; a farm's seasons; chapters of a biography.
- **Pull-tab mechanisms**: flipping slats, a sun on a stick, sliding strips, a hinged door, pieces on strings. *Fits content like:* a forecast; old way/new way; a lock opening.
- **Paper as character**: crumpled, smoothed, refolded, torn, taped. *Fits content like:* a mistake becoming a lesson; recycling; a rejected draft becoming the design.
- **The edge of the page**: crossing between paper and the room, either way. *Fits content like:* a character stepping into a phone on the desk; a real object entering the story; a drawing coming true.
- **The real object plays a part**: a lamp as a sun, a mug as a tower. *Fits content like:* a product at home; the reader's presence; real clock time.
- **Typed bubbles and ratings**. *Fits content like:* a tutorial; a quiz; a small victory.

## 9. Pitfalls of the medium

- `rotation.y` shows a card edge-on, then its blank back → `scale.x` flip. Negative scale also swaps front/back materials → draw mirrored props instead.
- A one-plane container hides its contents → back card + front card, contents between.
- Near-lens foreground pop-ups fill the frame with blur → move them or close the aperture.
- Rectangle shadows kill the illusion → alpha-mapped depth material on every card; tight shadow bias and a big shadow map against acne on thin cards.
- A turning page goes black facing away from lights → emissive map = colour map.
- ACES shifts paper colours → Neutral.
- Headless Chrome falls back to software WebGL → GPU ANGLE flags; ES modules need HTTP.
- Redrawing character canvases each frame → redraw only on pose change.
- Font subsets miss new characters → re-subset after every text change.
- In a reel, a bubble or subtitle below y 1248 or right of x 900 sits under the app's buttons; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js (r170 works) with Canvas 2D art, the whole frame drawn from `t` in real units (metres); three.js can be vendored next to the page and imported through an import map, as the pack's 3d-character style does. Serve the page over HTTP (ES modules) and give the headless browser GPU (ANGLE) flags, or it falls back to software WebGL.
- Art is drawn once per pose at a fixed pixels-per-metre: ink outline and crescent shading, then the cut finish (silhouette stamped at many angles on several rings and recoloured `source-in` into the grey edge and the off-white border, grain `source-atop`). Characters are posable flat cards whose canvases redraw only when the quantised pose changes; walk phase comes from distance walked.
- Every card is a plane with front art and a plain back sharing one alpha, `alphaTest` + `alphaToCoverage`, and a custom depth material with that alpha map so shadows are cut-outs. Pop-ups hinge on their bottom edge with `back()` overshoot, their delays scheduled by distance from the reader; strings are springs; particles (paper puffs) are seeded by event index.
- The book is a model with an opening angle and a curling leaf: a many-segment strip whose bend is integrated along its length, with emissive = colour so it never goes black. The camera is a list of keys (position, target, fov, aperture, focus) with monotone-cubic interpolation; a new key list is a hard cut. Post: hand depth of field (CoC = aperture × (1/focus − 1/z), spiral gather keeping far samples off a sharp foreground) → bloom → vignette → warmth, Neutral tone mapping.
- Lock the voice first; narration subtitles come from its word timings, bubbles type on letter by letter with a blip every other letter. One cue per visible event in `cues.json`: every pop, fold, turn, tab slide, landing and blip; paper foley can be synthesised from the same event list (a snap is a short sine sweep plus crinkle).

## 11. Variation space

You decide the book, the room, the characters (or none), the spreads and mechanisms, the opening, the ending, the camera path and each spread's palette. Vary them per video:

- Structures: **the almanac** (one spread per month or stage, each pull-tab left running so the book fills with motion); **two books facing each other**, characters trading objects across the gap; **one spread pulled again and again**, each pull a step of how something is made.
- Openings: **mid-turn** (a page already curling, we land in chapter three); **inside the gutter** (low along the fold as the first piece rises over the lens); **a mechanism alone** (a tab slides by itself before any character appears).
- Endings: **the book closes** (pieces fold in reverse, a puff of air, stillness); **one piece stays up** (everything folds but the card that is the point); **the shelf** (the camera finds this book among many).
