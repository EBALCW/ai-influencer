# Crayon World 3D

> A real 3D world, flown through by a moving camera, but every frame is redrawn as a child's wax-crayon drawing on textured paper: one dark outline crayon, zig-zag colouring that overshoots the lines, paper showing through, a new drawing twelve times a second. Perspective, parallax and first-person flight with the honesty of a kid's picture. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): children's drawings at five to eight (a band of sky, front-facing houses, one outline colour, colouring that runs over the line); wax crayon on toothy paper (wax catches the peaks, the valleys stay white); non-photorealistic rendering that turns 3D into line drawings; dream flights and first-person journeys in animated film (the camera as a character); hand-drawn animation on twos with boiling lines. Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The drawing bleeds to every edge; the camera's view is taller, so the sky band and the ground both get more room.

| Zone | Position | Content |
|---|---|---|
| Sky | y 0–620 | hatched blue band with cloud outlines left as paper |
| Horizon | y ≈ 700–820 | hills in two greens, the far village small |
| Subject | centred on x 540, y 560–1200 | the person, flower or house the story is about, at least a third of the frame tall at key moments |
| Foreground | y 1250–1920, bleeding | big flowers, a fence, grass hatching; nothing to read |
| Written words | centred on x 540, ≤ 720 px wide, last baseline y ≈ 1200 | on paper the crayon leaves blank |

  First-person flight stacks naturally: sky above, the path ahead in the middle, the ground rushing by below.
- **The first 3 seconds.** Frame 1 is already a finished drawing, swaying: a first-person view from a flower or a windowsill in the wind. By 0.5 s the view lifts; by 3 s the camera has taken off over the landscape, which is the reason to stay (where is it going?).
- **Length and pace.** 25–45 s. Slow and lyrical: one place per 6–10 s, one held breath of stillness before the turn, the words late.
- **Captions.** Handwritten on the paper (section 5), never on a box.
- **Sound.** `shimmer` at take-off and landing, `zoom-swish` (soft, low in the mix) for swoops of the flight, `ui-pop` when an object is drawn in, `clean-ding` when the words begin to write, `sparkle` on the last image. No heavy impacts. Music box, nylon guitar, clarinet and recorder from a free CC0 library (VSCO 2 Community Edition, VCSL, FreePats); birds and water synthesised.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Written words stay above y 950 and inside x 96–1824.
- **Length and structure.** 2–5 min. One place or one memory per chapter (40–90 s), joined by flight; each chapter opens with its place being drawn in (outline first, then colouring row by row) or by flying into it. Re-hook every 30–60 s with a landing, a change of point of view (a cut into another character's eyes), a new season of crayons, or a place drawing itself in.
- **The first 10 seconds.** The most beautiful drawing first (the subject close, in its world, swaying), the question by 5 s as the camera turns away toward something unseen, the promise by 10 s as it takes off.
- **Captions.** Narration lines are handwritten on a strip of blank paper at the bottom (section 5); export the same lines as `.srt`.
- **Thumbnail.** A first-person frame with the subject large and close, crayon texture visible, at most three handwritten words on paper left blank for them.

### Good for

Short stories; tributes and memorials; journeys and homecomings; childhood and family memories; gentle charity or community films; children's explainers about places.

## 1. Essence, and what it is not

1. **3D computes, crayon draws.** The scene is a real 3D model and camera, but its render never reaches the screen: only its shapes do, redrawn every step as wax on paper.
2. **A child's hand.** One navy outline crayon for everything, colouring in zig-zag rows that overshoot, skip a row now and then, and leave paper showing.
3. **Twelve drawings a second.** The world, the camera and the jitter all step together; lines boil slightly from drawing to drawing.
4. **Paper is the white.** White things (clouds, walls, shirts, stones) are outlined and left as paper or barely coloured.
5. **The camera is a character.** First-person flight, swaying, bobbing, landing, looking; one cut into someone else's eyes is the turn.

Not a flat crayon picture book (pages with no camera through space): here perspective, parallax and flight are the point. Not a toon-shaded 3D render (smooth flat fills by lighting, clean outlines, no paper): nothing here is filled flat. Not **Tilt-Shift Miniature**: no depth-of-field blur, no tiny-world scale cues; everything is in focus, as a child draws it.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Sky | y 0 to the horizon (or to a ragged edge at y ≈ 330 when words need room) | light blue in two crossing hatch passes; cloud outlines drift across |
| Horizon | y ≈ 400–460 in flight, lower when landed | hills in grass and olive, the far village small and simple |
| Subject | central third, x 640–1280 | a person, house or flower; at key moments a third of the frame tall or more |
| Foreground | bottom quarter, bleeding | flowers, fence, hatching rushing past |
| Hero words | on blank paper right of centre, centred near x 1450, y 400–640 | the one line that matters, written in |
| Running captions | a strip of blank paper at the bottom, baseline y ≈ 915 | narration lines |

Leave the area for words empty in the 3D scene itself, or let the crayon thin to paper there before the line arrives; never print words over colouring.

## 3. Materials and rendering

- **Shapes from 3D.** Every mesh belongs to a region with its own drawing recipe. Each step, the scene is rendered off-screen at half size into an identity buffer: region number, a simple light value (Lambert, light from the upper left) and depth. Each region's outline rings are traced from it (marching squares), simplified, densified and smoothed twice; the dark side of shaded regions (light below about 47 %) is traced as its own rings.
- **Colouring.** Back-and-forth hatching rows at the region's angle, spacing (4–14 px) and crayon width (6–14 px), overshooting the outline by up to 6 px. Rows are counted from a fixed point of the object projected to screen, so the colouring travels with it instead of reshuffling every drawing. A hand mode bows and leans each stroke, skips about 7 % of rows, adds an extra row about 12 % of the time, and breaks long rows into overlapping strokes. Sky gets a second, crossing pass at 55 % pressure.
- **Shading.** The dark side gets a second pass at a different angle (+1.1 rad), slightly tighter, 15 % harder; lit areas are coloured lighter (pressure × (1.05 − 0.25 × light)). Never a darker colour, never grey.
- **Outlines.** Navy, 6–8 px for scenery, 9–10 px for characters, 3–5 px for small details, at 92 % pressure; each line wobbles (about 1.7 px over 85 px), changes width ±30 %, tapers at the ends, and carries two thin streaks. No outline along the frame edge: a child doesn't draw the edge of the page.
- **Wax on paper.** Strokes go into pressure layers (colour plus pressure). A compositor deposits wax only where pressure beats the paper's tooth (a height field with fibre grooves): light pressure catches the peaks, heavy pressure fills the valleys and deepens the colour. Characters are drawn first and the background is coloured around them, so their colours never sit on top of sky or grass.
- **Paper.** Warm off-white with slow mottling; the tooth stays about 1 px on screen and pans with the camera. A final pass embosses the tooth (lit from the upper left, smoothed where wax fills it), adds a faint wax sheen and a warm vignette (0.28).
- **World vs screen.** Shapes, colouring rows and outlines follow the 3D world; paper tooth follows the camera's pan; the vignette is screen-space.

## 4. Colour logic

- **A box of twelve crayons**, no more, and no mixing on screen beyond what overlapping hatches do.
- **One outline crayon** (navy) for every line, including faces and the written words.
- **Light by pressure, not by hue.** Sunlit sides lighter, dark sides with a second crossing pass; shadows are never grey or black.
- **Each thing keeps its crayon:** a roof is brick-red in every shot, a character's shirt never changes colour.
- **Never:** gradients, black, pure flat fills, saturated colours with no paper showing through.

Example palette (from the code):

| Crayon | Hex | Crayon | Hex |
|---|---|---|---|
| Outline navy | `#2C2F6B` | Caramel | `#D9932F` |
| Sky blue | `#8CC3E8` | Earth brown | `#8A5A35` |
| Grass | `#6CB24A` | Brick red | `#C8452F` |
| Olive | `#8A8F3A` | Rose | `#EC8A9A` |
| Yellow | `#F2D43A` | Skin cream | `#F4C49A` |
| White (wax) | `#FFFFFF` | Plum | `#8A4F8C` |
| Paper | `#F4EFE3` | | |

## 5. Type and captions

- **Faces (both SIL OFL).** Patrick Hand for Latin text, Long Cang for CJK when it belongs to the picture. Both read like a careful child's or grandparent's handwriting.
- **How words appear.** Words are drawn in crayon like everything else: glyphs filled in the navy outline crayon, through the same wax-on-paper compositor, jittering ±0.7 px with each drawing, and written in one character at a time at the drawing rate (12 per second).
- **Hero line.** 64–72 px Latin (up to 132 px for CJK), on paper the scene leaves blank, right of centre. Before it is written, the crayon there thins to blank paper over about 1.7 s, as if the child left room for it; blank from the start reads as a mistake.
- **Running captions.** Patrick Hand 48–52 px in 16:9, 56–60 px in a reel, navy, centred on a strip of paper where the ground's colouring stops at a ragged edge. One language, the spoken one.
- **Hold.** ≥ max(1.8 s, speech + 0.6 s), counted from the moment the last character is written; the hero line holds 4 s or more.

## 6. Motion

- **Frame rate and stepping.** 24 fps for YouTube with twelve drawings a second (each held two frames); reels render at 30 fps on the same twelve-a-second clock. Everything steps on that clock: scene poses, camera, wobble seed, hatching jitter. Nothing slides between drawings.
- **Boil.** Each new drawing moves whole lines by up to ±0.8 px and re-wobbles them slightly; colouring rows keep their place but their ends and pressure change. The boil is gentle: the hand is the same, the drawing is new.
- **Weight and timing.** Slow, lyrical moves with cubic ease in-out; flight paths through Catmull–Rom curves. Wind sways flowers and washing on slow sines (about 1.3 rad/s); clouds drift about 0.35 m/s.
- **Characters.** Built from simple primitives (capsules, cylinders, boxes, spheres); walking steps switch at 4 per second; small flappers (wings) alternate two drawings on twos.
- **Drawing in.** An object can appear by being drawn: outline traced along its length, then coloured row by row, odd rows left to right, even rows right to left.
- **Never moves:** the outline colour, the paper's grain size on screen, the written words once written.

## 7. Camera

| Move | What it expresses | Can serve |
|---|---|---|
| Swaying on a flower or ledge (sway grows in over 1.5 s) | being small, being alive | openings, landings, waiting |
| Take-off and first-person flight (field of view 56°, bobbing about 5 cm at 5.3 rad/s plus 3.5 cm at 2.2 rad/s) | longing, freedom, a journey | travel, memory, going home |
| Gaze that lags (direction smoothed over 0.3–0.38 s) | attention following something | following a person, noticing |
| Low pass over a garden or fence | arrival | reaching the place that matters |
| Cut into another character's eyes (narrow field of view, about 27°) | the other side of the story | the turn, the reveal |
| Looking up, following something into the sky | letting go | the ending |

Smooth the gaze direction, not the look-at point (a smoothed near point whips the camera); keep a clearance above terrain. Allowed transitions: continuous flight, a landing, the crayon thinning to paper, an object drawing itself in, and one hard cut at the turn. Forbidden: dissolves (two drawings overlapping read as a mess), wipes, zoom punches, camera shake.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Score | slow 3/4 (about 78 BPM) in a major key, starting on its relative minor; a music box for the main character from the first frame to the last; nylon guitar picking six eighth notes a bar; long low clarinet notes under the flight; the recorder holds back the one tune until the turn and plays it once in full; single glockenspiel notes over places | story beats land on bar lines |
| Foley | water from a can or ladle (filtered noise), a soft crayon-on-paper scratch only while something is drawn in on screen | close and small |
| Ambience | a few birds (sine chirps at 2.7–4.4 kHz), light wind | sparse |
| Silence | one breath of silence when the subject stops at the thing that matters | |
| Ending | the theme ends on the home chord, then the music box runs down | |

If there is a voice: one warm, unhurried narrator, about 10 dB over the music. Master at −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Waking on a flower.** A first-person view swaying with a flower in the wind, the world drawn and alive, then lifting off. Fits content like: a story opening; a memory returning; a new day.
2. **Flight over the drawing.** Low first-person flight over hatched fields and simple houses, bobbing, gaze leading the turns. Fits content like: a journey; a tour of a place; looking back over a life.
3. **Drawn in.** A house, a person or a word appears outline first, then colouring row by row. Fits content like: introducing a place; a plan taking shape; building something.
4. **The child colours around you.** A character steps in front of the sky and the sky's colouring stops at their outline, leaving them clean. Fits content like: the subject stepping forward; a portrait; "this one is special".
5. **Room for words.** The crayon thins to blank paper over 1.7 s, then a handwritten line writes itself in. Fits content like: the line that matters; a dedication; a closing message.
6. **Into their eyes.** One hard cut to another character's point of view with a narrower field of view. Fits content like: the reveal; the other side; the twist.
7. **Letting go.** The camera follows something small up into the hatched sky until it is a speck. Fits content like: goodbye; release; hope.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js (MIT) vendored next to the page and imported through an import map, as the pack's `3d-character` skill does. Build the world from primitives; every mesh gets a region (at most 255) with a recipe: crayon colour, pressure, hatch angle, spacing, width, overshoot, outline width, layer (background, character, foreground) and whether it gets a shade pass.
- Each drawing step: `ts = Math.floor(t * 12) / 12`; pose the scene and camera at `ts`; render to a half-size target with a shader that writes region, light and depth; read it back; trace rings per region (marching squares, Ramer–Douglas–Peucker at 0.7 px, densify to 8 px, Chaikin twice); drop rings under about 40 px² of area.
- A Canvas 2D crayon engine draws fills, outlines and text into pressure layers (RGB colour, A pressure), with every random value hashed from the region, the row number and the drawing step, so a frame is a pure function of `t`.
- A WebGL2 compositor lays paper, deposits each layer's wax against the paper tooth, knocks the background out behind character silhouettes, and finishes with emboss and vignette.
- Words and the hero line go through the same crayon text routine; register their boxes so reading time can be checked.
- `cues.json` on bar lines: take-off, each landing, each object drawn in, the cut, the words.

## 11. Pitfalls

- **Swimming hatching.** Rows counted from the region's bounding box reshuffle every drawing; anchor them to a fixed point of the object.
- **Smooth 24 fps motion.** Drawing every frame breaks the illusion of drawings; step everything at twelve a second.
- **Thin things vanish.** At half-size analysis, stems, ropes and wires under 2 px disappear; thicken them in 3D or draw them as crayon lines.
- **Muddy layering.** Without the knock-out, sky and grass wax show through characters.
- **Over-detailed meshes.** Bevels and small parts become noisy regions; a child draws a house as a box and a roof.
- **Gaze whip and terrain clipping** in first-person flight: smooth the direction, keep clearance.
- **Huge files.** Every drawing has new texture; skip added grain and encode at a higher CRF (about 26–30), then check outlines and words still read at phone size.
- **Words on colouring.** Handwriting over hatching is unreadable; always clear paper first.

## 12. Variation space

The agent decides per video: whose eyes the camera is, the world (village, city roofs, seaside, school), the twelve crayons (keep twelve), where the flight goes, the one cut, and the words.

- **Three structures:** a flight to one place and the reveal of who is there; a tour of three places drawn in one after another; two points of view, the journey and then the person who receives it.
- **Three openings:** waking on a flower in the wind; a blank page where the first place draws itself in; already in flight low over a field.
- **Three endings:** the hero line written on paper the sky leaves blank; the camera following something up into the sky; landing back where it began as the music box runs down.
