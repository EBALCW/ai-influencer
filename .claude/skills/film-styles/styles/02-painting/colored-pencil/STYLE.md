# Colored-Pencil Science Illustration

> A textbook cutaway drawn in layered coloured pencil on warm paper: a simple 3D world is rendered as hatching that sticks to its surfaces, gets coloured in as the camera arrives, and opens pencilled magnifier rings onto what is too small or too hidden to see. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): botanical plates (layer light to dark, leave highlights as bare paper); soil-profile diagrams in mid-century science textbooks (horizontal bands, one clean cut line); David Macaulay's cutaways (slice the world open, keep the outside in view); real-time hatching research such as Praun et al. 2001 (strokes that belong to surfaces). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** A cutaway is vertical by nature: sky wash on top, the ground line near y 620, the hidden layers below, bleeding off three edges. Tags, rings and the subject sit inside x 72–900, y 269–1248; below that the drawing is picture only. The magnifier ring is r 120 px, centred inside x 200–780, y 420–1100. In close shots the ground line rides near y 300 and the subject fills at least a third of the height.
- **The first 3 seconds.** Frame 1 is the finished surface picture (grass, a trunk, a stone) already coloured, with the soil cut line pencilled faintly underneath. At 0.3 s the camera starts to sink and the top horizon begins to colour in from the left; the question caption lands by 1.0 s; by 3 s something hidden (a root tip, a pipe, a nest) is visible below the line and still being drawn.
- **Length and pace.** 20–45 s. Three or four plates at most: surface → under → magnifier → pull back. One camera move at a time; a held, drifting beat of 2–3 s after every reveal.
- **Captions.** A paper slip centred on x 540, at most 720 px wide, bottom edge at y 1230; one line of 46 px, two lines at most. Nothing else is set in type.
- **Sound.** The pack's `zoom-swish` (low, under the start of the descent), `shimmer` (the magnifier opening), `ui-pop` (each paper tag landing), `tick` (each small grain absorbed), `clean-ding` (the followed thing arriving). Pencil scratching, wind and birds and the acoustic score come from a free sample library.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. Caption slip and tags stay above y 950 and inside x 96–1824; the sky band carries chapter titles.
- **Length and structure.** 3–8 min. A chapter is one plate at one scale, 45–90 s: it is coloured in, a ring opens on its key detail, one grain is followed, the ring closes, the camera pulls back. Chapters go down a scale ladder (landscape → organism → tissue → cell) and climb back for the ending. Each opens with its title hand-lettered in the sky band (88 px, about 1 s, underlined), then the camera sinks away from it. Re-hook every 30–60 s: a new ring, a layer not yet coloured, a dashed amber question path, or a second cutaway that disagrees with the first. The last chapter pulls back over the whole system, every hidden part now drawn in.
- **The first 10 seconds.** The strongest plate first: the full cutaway, half coloured, with the camera already moving. The question by 5 s ("what is down there doing all this?"); by 10 s a ring is drawn on the place the video will end up, as a promise.
- **Captions.** The paper slip is part of the picture, so it stays burned in; export the same lines as `.srt`.
- **Thumbnail.** The widest cutaway frame with the followed object in amber and a pencilled ring around it; at most three words hand-lettered on a paper tag in the sky.

### Good for

Natural-science cutaways, how a body or plant works inside, earth and geology layers, hidden infrastructure under a street, picture-book explainers for families.

## 1. Essence, and what it is not

1. **One drawing that is also a world.** A real 3D scene, but every pixel reads as pencil on paper: four layers of hatching, a visible paper tooth, wobbly dark contours, bare paper for highlights and clouds.
2. **Drawn in as you watch.** Every surface has a reveal time; it arrives as a faint underlayer, then local colour, then shading, then the deepest accents, about 1.2 s from first mark to finished.
3. **Strokes stick to things.** Hatching and paper tooth are computed in the surface's own coordinates, so when the camera moves the drawing moves with the world and never swims.
4. **Attention by colour.** What the story is about is fully coloured; everything else drops to a light wash. Focus pulls are done with pigment, not blur.
5. **Few words, pencilled.** Two to four paper tags per minute, each with a curved graphite leader; titles and tags are written stroke by stroke.

Not **Watercolor Brush** (no blooms, no wet edges, no granulation; every mark is a directional stroke). Not **Sketchnote** or **Marker on Paper** (no page of notes, no visible pen, no arrows-and-boxes diagram; this is a picture of the world, not of an argument). Not a **3D Miniature** (no depth of field, no tilt-shift, no lighting drama; light is only how dense the hatching gets).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Sky band | y 0–380 in wide plates | blue wash, clouds left as paper; chapter titles at x 104, baseline y 196; end card top right, right-aligned to x 1816 |
| Surface | ground line y 600–660 in wide plates, y 60–100 in close plates | grass, trunks, stones, whatever stands on the cut line |
| Cutaway | ground line to the frame bottom | horizons as bands of 120–260 px, the hidden subject crossing them |
| Tags | beside their subject, never closer than 60 px to an edge | 30 px lettering on a paper tag, curved leader to the thing |
| Magnifier | ring r 92 px, centred on the detail | opens to fill the frame; closes back to the same point |
| Caption slip | bottom left, x 96, slip from y 828 to 940 | one line, 40–44 px |

Wide plates keep about a third of the height above ground so "down" is always clear; close plates crop the surface to a strip of grass at the top edge. The subject sits on the centre column or a third, and a followed object stays within 300 px of centre.

## 3. Materials and rendering

- **The world** is low-detail procedural geometry: noise-profiled soil bands, tapered tubes along grown polylines, clustered lumpy spheres for canopies and stones, instanced grass. Detail comes from the pencil, not the mesh.
- **Paper**: warm off-white `#F8F4EA` with a tooth of three noises (fine grain, laid fibres turned about 20°, soft cockling). Pigment lands only where stroke pressure beats the tooth (±0.17 smooth threshold), so paper valleys show through every layer.
- **Four pencil layers**, multiplied over the paper with pigment `sqrt(colour ÷ paper)`: L0 a soft side-of-the-lead fill; L1 local colour in patches of short parallel strokes along the surface's hatch direction (4.4 px apart, 40 px patches, re-angled up to ±0.28 rad); L2 shading, cross strokes 1 rad off (3.8 px apart) in a darker, cooler version of the colour where light is below about 0.6; L3 deepest accents at −0.55 rad (3.2 px apart) in a sepia–indigo mix, only in the darkest 40 %. Strokes taper at both ends, vary in length and pressure, and bow slightly.
- **Contours** where object, depth or normal changes, through a small anchored wobble; a dark version of the local colour mixed with warm graphite `#33241C`, at most 82 %. The nearer surface owns the line.
- **Anchoring**: surface points are projected through a fixed reference camera per shot; hatching, tooth and wobble use those coordinates, so the live camera only translates inside a shot.
- **Distance** thins the hatching and pulls colour toward pale blue-grey (about 22 to 150 world units).
- **Overlays** in screen space (paper for tags and slips, graphite for writing and rings, coloured pencil for the question path) are composited through the same tooth.

## 4. Colour logic

- **Paper is the white.** Nothing is painted pure white; highlights, clouds and the brightest threads are bare paper.
- **Earth for the world, one warm accent for the story.** Horizons go dark at the top (humus) and warm in the middle (subsoil), grey at the bottom (rock). The thing the viewer follows is amber, the only saturated warm in frame. What flows the other way is one cool counter-accent (teal).
- **Hidden structures are pale.** Fine networks are near-paper cream so they read against dark soil without competing with the amber.
- **Accent never on its own hue.** If the amber object crosses an orange horizon, give it a paper halo or route it along a pale structure.
- **Unfocused means washed**: 35 % toward grey, lifted toward paper, density × 0.55. Graphite is for writing and lines, never fills.

Example palette from the code:

| Role | Hex |
|---|---|
| Paper | `#F8F4EA` |
| Tag paper | `#F9F2E0` |
| Graphite (writing) | `#382B24` |
| Contour graphite | `#33241C` |
| Sky wash, low → high | `#B3D4E6` → `#6BA1DB` |
| Leaf greens | `#759E6B`, `#9EB85C` |
| Humus / topsoil | `#4D301C` / `#664024` |
| Subsoil / weathered | `#BD753B` / `#B38C5C` |
| Bedrock | `#665E59` |
| Pale network | `#FCFAF0` |
| Accent: followed object / question path | `#ED9E33` / `#E28018` |
| Counter-accent: what comes back | `#549EB8` |
| Deep accent mix | `#765C57` with `#5C6180` |

## 5. Type and captions

- **Face**: LXGW WenKai (SIL OFL), a pen-written face whose Latin comes from Klee One (also OFL). Use it for everything; no second face.
- **Written, not typed**: titles and tags are revealed along each glyph's centre-line skeleton, stroke by stroke, at 0.18 s + 0.045 s per character; each glyph sits ±2.5 % of size off the baseline and turns ±0.035 rad.
- **Roles**: chapter or end title 88 px in the sky, underlined by one stroke (0.3 s); tags 30 px, at most four words, on a paper tag (6 px radius, pencil border drawn in 0.28 s, tilt ±0.02 rad, pop 0.9 → 1.0 in 0.14 s, 0.25 s fade out); end card 31 px, right-aligned.
- **Leaders**: a quadratic curve, 2.8 px graphite over a 9 px paper halo at 55 %, drawn in 0.3 s, then a 16 px arrowhead in 0.08 s; they track their subject as the camera moves.
- **Caption slip**: white at 93 %, corners 3–4 px out of square, a faint pencil line on its lower edge; text set straight (read, not drawn), 40–44 px, wiped in left to right over 0.28 s. Hold each at least max(1.8 s, speech + 0.6 s), ending 0.05 s before the next.

## 6. Motion

- **24 fps** for YouTube; a reel renders at 30 fps but steps its own clock. Contour boil and grass wind change at 12 fps, the boil cycling 3 drawings. Hatching never boils.
- **Drawing in** is the main motion. After a surface's reveal: L0 0–0.42 s, L1 0.10–0.62 s, L2 0.30–0.90 s, L3 0.50–1.15 s, each stroke taking its own turn. Bands sweep in left to right, each 0.4–0.8 s after the one above.
- **Growth**: branching things grow from their source at constant speed, main branches first, with gravity and wander, arriving half coloured so a tip is never a blank stick.
- **Easing**: camera moves and wipes use smootherstep (`k³(6k² − 15k + 10)`); fades use smoothstep. Nothing bounces.
- **Followed objects** move along their path with a blend of linear and smoothstep progress, scale in over 0.25 s, and are taken up by shrinking to nothing over 0.4 s.
- **Never moves**: the paper, the tooth, the strokes on a surface, the caption slip once placed.

## 7. Camera

A perspective lens of about 34°, pitched 0.06 rad down, the same in every shot.

| Move | What it expresses | What it can serve |
|---|---|---|
| Crane down through the ground line (4–6 s, smootherstep) | going below what we normally see | the opening of any "what is inside or underneath" story |
| Magnifier: ring drawn in 0.45 s, inset opens over 1.2 s | a change of scale, looking closer | cells, fine structure, a part inside a machine |
| Truck alongside a moving object (8–10 s) | following one thing on its journey | flows, exchanges, transport, a sequence of steps |
| Slow drift, under 1 % of the frame per second | the plate is alive while it is explained | long voice passages, labelled holds |
| Magnifier closes, then pull back (5–6 s) | the whole system revealed | conclusions, scale reveals, endings |
| Focus pull by wash (0.9 s, no camera move) | attention shifts between two parts | comparisons, cause and effect |

Allowed transitions: the magnifier (in and out), a fresh drawing that spreads from one point (about 1 s to the corners), and a hard cut between plates on a bar line. Forbidden: rotating, panning or tilting inside a shot (strokes swim), dissolves (two drawings ghosting), whip pans, lens-blur depth of field.

## 8. Sound palette

| Layer | What |
|---|---|
| Score | about 96 BPM (a bar = 2.5 s), a major key. Nylon guitar arpeggios on the surface; a flute phrase that asks and only resolves at the end; pizzicato bass stepping down the descent; bowed vibraphone and harp inside the magnifier; marimba calls answered by kalimba for any exchange; thin strings and harp for the pull back. |
| Foley | graphite writing and ruling; waxy hatching for every layer coloured in, panned to where it is drawn; long strokes as things grow; a dry crackle as networks spread; a wooden lens tock for the ring; soft plinks for grains. |
| Ambience | wind and distant birds above ground, low-passed as the camera sinks; a close, quiet earth tone inside the magnifier; the surface returns faintly in the final wide. |
| Silence | near-silence for one bar before the magnifier opens and again before the pull back. |
| Mix | voice about 10 dB over everything; under each line the music ducks 45 % and gives up 300 Hz–4 kHz; a small room on the score. Master −14 LUFS, true peak −1 dB. |

## 9. Native moves

1. **Coloured in as we sink.** The camera cranes through the ground line while each horizon is coloured left to right just ahead of it, so the descent itself draws the picture. Build: per-band reveal times and a sweep in x; key the crane so the next band starts as it enters frame. Fits content like: soil and rock layers; the floors of a building; the layers of skin or an ocean's depth zones.
2. **The pencil magnifier.** A ring is drawn round a detail, the inset opens to fill the frame, and the close view is drawn fresh from the ring's centre outward. Build: render the close camera to a second target, mask by ring radius, delay each surface's reveal by its distance from the centre (about 0.0011 s per px). Fits content like: a cell in a leaf; a microbe on a root; a valve inside a pump.
3. **Focus by pigment.** The part being explained fills with colour while its neighbour drains to wash. Build: a per-object focus value (1 full, 0.45 wash) eased over 0.9 s. Fits content like: an organ versus its neighbour; cause then effect; the old part and the new.
4. **Follow one grain.** A single amber drop travels along a pale path, the camera trucking with it and a tag riding above. Build: the object placed on a polyline by `t`, the camera's x keyed to it. Fits content like: a sugar through a plant; a nutrient through a gut; one water drop through a city's pipes.
5. **Drawn as it grows.** Branching structures grow from their trunk at constant speed, arriving half coloured. Fits content like: roots and rivers; veins and nerves; a family tree or a crack spreading through rock.
6. **The dashed question.** Where the science is unsure, an amber dashed line is pencilled between two parts and a large hand-lettered "?" is written over it; nothing solid is drawn. Fits content like: open research questions; a hypothesis being tested; a missing link.
7. **The whole plate.** The ring closes, the camera pulls back, and the hidden network is drawn across the entire scene in one long spread while the end title is written in the sky. Fits content like: an ecosystem joined underground; a city's wiring; how every step connects.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- The canvas/WebGL path: a three.js scene drawn as a pure function of `t` on `hf-seek`, at 2× (3840×2160, or 2160×3840 for a reel) and box-downsampled; at YouTube lengths 1.5× is enough.
- One custom material writes four render targets: albedo + object id; light + view depth + normal; hatch direction + outline weight + density; anchor coordinates (the surface point through the shot's fixed reference camera) + reveal time. A single post shader turns them into tooth, four hatch layers and wobbled contours.
- Seeded noise only; the boil index is `floor(frame / 2) % 3` and the wind clock `floor(t * 12) / 12`.
- A time table (`TL`) and a `SHOTS` table drive everything; each shot is a camera "view": position, reference camera, per-object focus, and an optional fresh-drawing centre.
- Overlays on three 2D canvases (paper, graphite, coloured pencil), uploaded as textures and composited through the tooth. Handwriting comes from glyph skeletons: thin each glyph of the font to a centre line once, then reveal it by stroking a wide mask along that path with `destination-in`.
- Every drawn action (colour layer, growth, tag, write, line, ring, grain) is pushed as an event with its time, length and pan; turn those into `cues.json` and the foley layer.

## 11. Pitfalls

- **Swimming texture.** Any hatching or tooth computed in screen space while the camera moves looks like a pattern sliding over the world. Anchor it, and never rotate inside a shot.
- **Mud from too many layers.** Shading strokes only where it is actually dark; let L0 and L1 carry most surfaces, and keep bare paper for highlights.
- **Hatching that aliases at phone size.** 4 px strokes need the 2× render and a clean box downsample; never scale the final frame up.
- **Boil as flicker.** Keep the contour wobble under 3 px and the boil on twos; strokes themselves stay still.
- **Blank white structures.** Growing tips and pale networks read as missing pixels unless they arrive part-coloured with a contour.
- **Label clutter.** More than one tag per subject per shot turns the plate into a diagram; say it in the caption.
- **Wash too light.** At phone size a washed object must still be recognisable; keep wash density above about 0.5.
- **The app's buttons.** In a reel, nothing that must be read below y 1248 or right of x 900; on YouTube nothing in the bottom 12 %.

## 12. Variation space

The agent decides per video: the world and its layers, the one followed object and its accent hue (keep exactly one warm accent), how many scales to go down, which parts carry tags, and the score's instruments within the acoustic palette.

- **Three structures:** a descent and return (surface → hidden → magnifier → pull back, seeing the surface anew); one journey (follow a single object from source to destination across three plates); a scale ladder (four magnifiers deep, then one continuous pull back to the start).
- **Three openings:** the ordinary surface with the question already captioned and the camera beginning to sink; a pencil ring already drawn on an innocent spot on frame 1; the cutaway half coloured, mid-descent.
- **Three endings:** the full plate with the network drawn in and the title written in the sky; the followed object arriving as the last stroke of colour; back at the surface, with a faint dashed path now visible under the grass.
