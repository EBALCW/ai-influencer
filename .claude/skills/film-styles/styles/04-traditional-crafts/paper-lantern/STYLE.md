# Paper-cut Lightbox

> A layered paper-cut shadow box (the paper-carving lamp, *zhidiao deng*) lit from behind: 6–9 sheets of cut card stacked in a shallow box, a warm light glowing through the paper, windows and moons burning through holes, soft shadows falling from each layer onto the next. The camera is a macro lens inside a lamp: it can show the box, or let the paper scenery fill the whole screen. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): commercial paper-cut shadow-box lamps ("shadow box lightbox") for the layer stack and backlight; Lotte Reiniger's silhouette films for the cut-out, jointed figure language (when a video has figures); Chinese *jianzhi* paper-cut motifs (auspicious clouds, eaves, mountains) as one possible vocabulary. Do not copy any specific lamp design, film frame or character.

## Formats

### Reel (1080×1920)

- **Layout.** Full-bleed is the reel's main framing, the stack composed tall: sky at the top, ranges and streets in the middle, the dark front layer across the bottom third, under the app's buttons. The story layer and its lit windows sit inside the safe box (x 72–900, y 269–1248). Box framing uses a portrait box (cavity about 0.33 × 0.56 m), never a landscape box shrunk into the middle. Stack, don't shrink: tilting up or down the stack is the reel's native move; lateral travel keeps its parallax with the subject framed higher. Subtitles sit centred on x 540, at most 720 px wide, on the front layer's dark band, baseline y ≈ 1200; paper text strips grow in the upper half.
- **The first 3 seconds.** Frame 1 is already lit and mid-scene: a figure in a glowing street, a vehicle with its windows burning. By 0.5 s a layer slides or windows switch on in a stagger; by 3 s a rack focus shows it is all paper, or the lamp's light cue runs back to front while the voice asks its question.
- **Length and pace.** 20–40 s: three to five shots of 5–9 s, moves short and slow; one light-cue cascade (~0.4 s per layer); at most one lamp-off silence. On ones at 30 fps.
- **Captions.** The burned-in serif subtitles are the only caption layer: ~44 px, at most six words a line, two lines.
- **Sound.** `ui-click` for the lamp switch with `shimmer` rising as the light comes on, `clean-ding` as a chime on reveals, `thock` for a lid or card-stock tap, a soft `zoom-swish` for a near-plane curtain. Felt piano, music box, harp and the scene's bed (rails, river, crickets) come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Sections 2 and 6 as written, with section 4's subtitles raised to clear the bottom 12 % (the player's controls); in box framing the box edges stay inside the 5 % margins or clearly beyond them.
- **Length and structure.** 2–6 min at 30 fps. A chapter is one box with its own ladder (40–90 s): a new ladder says another place. Its title card is a paper strip growing from its edge inside the box, with a small seal; chapters are joined by a near-plane curtain, the light going off and on, or a new sheet sliding in at the front. Re-hook every 30–60 s: a light cue, a rack focus that finds a clue in another layer, a lid lifted on a burst of light, a step out to the real lamp on a table, a lone silhouette in a window. Save the one lamp-off silence for the turn.
- **The first 10 seconds.** A lit scene in motion on frame 1; the question by 5 s; by 10 s a pull-out shows the box (a story told), with the promise. Any channel sting comes after: the channel's name as a paper strip writing itself.
- **Captions.** Burned in, as section 4; export the same lines as `.srt`.
- **Thumbnail.** A nearly frontal frame: one lit window burning through dark front layers, the accent colour on the object that matters, up to three words as a paper strip.

### Good for

Journeys and travel, farewells and anniversaries, places and their stories, bedtime stories, gift and product reveals, memorial pieces.

## 1. Essence, and what it is not

Every shot is made of **one physical object**: a shallow box (a cavity about 0.56 × 0.33 m, 0.16 m deep) holding parallel sheets of cut paper. Two framings are both valid, and a video may use either or both: **box framing** (the lamp's edge or frame is in the picture) and **full-bleed** (the lens is inside the box and the paper scenery fills the screen). The stack, the backlight and the shadows are the same in both. Everything on screen is one of three things:

1. **A paper layer**: a flat cut sheet, one flat colour, fibre grain, a thin warm **rim of light on its top edge** and a **dark band on its bottom edge**. Back layers lighter and cooler, the front almost black: that value ladder *is* the depth.
2. **Light through paper**: a warm, cloudy translucency (pulp mottling), strongest near the light source. Windows, lanterns, trails of light are **holes / emissive windows** that burn and bloom.
3. **Shadows**: a top spot casts **soft shadows** from every layer onto the layers behind. This sells "real paper in a real box"; never turn it off.

The video may step out of the box into the **real world** (the lit lamp on a table, spill light on nearby objects) to say "this is an object someone keeps"; whether, where and how often is a choice of the video.

Not flat paper-cut animation (here: depth, backlight, cast shadows), not shadow puppetry (no single screen, no rods), not a 3D diorama (every element is a flat sheet parallel to the box front).

## 2. Materials & rendering

- **Units in metres, y up.** Layers from z ≈ −0.14 (sky) to 0 (front); camera at z ≈ 0.2–0.56, fov ~26°. In box framing, sheets are **never larger than the cavity**. In full-bleed shots that travel, a layer may be a long strip that scrolls past, and the sky panel moves with the camera so its edge never shows.
- **A layer** is a Canvas2D drawing in metre space mapped to a plane; cut-outs are `destination-out` holes. Finish on every sheet: fibre grain (`source-atop`), a warm top rim and a dark bottom shade, each shifted a few px.
- **Backlight shader**: `emissive += albedo × lightCol × trans × lit × falloff × (base + cloud)`, with a Gaussian falloff around a per-shot light point and a tiled pulp-mottle texture. `trans` per layer goes from ~.9 (far) to ~.05 (front).
- **Emissive windows**: a second canvas (white = light) gated by a 0→1 "switch on" uniform; bloom makes them burn. Titles, lights and curtains in front neither cast nor receive shadows.
- **Lens**: shallow depth of field, bloom, a gentle vignette; supersample 2× so cut edges stay crisp.
- **Real-world set** (when used): wood frame, black lining, a dark room, an area light as the box's spill onto real objects.

## 3. Colour logic

- **Back layers bright and translucent, front layers dark and opaque.** Each layer is one flat colour; the ladder of values from back to front is the depth. Never break it (a pale front layer flattens the box).
- **One temperature per stack**, chosen by the scene (cool night, warm interior, violet or green elsewhere). Changing ladder is how the video says "another place".
- **Light is warm** (amber to gold) against the stack, and it is the only saturated element besides one accent.
- **One accent colour** (a seal red, or a single object's colour) marks what the story is about. A second accent only when the story has two sides (one each).
- Examples of ladders: night village — `#0a1330` sky → `#6a86c2` far → `#3f5a92` mid → `#0e1532` front, windows `#ffb862`; desert caravan — `#f0c890` dusk sky → `#c07850` dunes → `#6a3020` → `#1e0e08`, fires `#ffd080`; winter forest — `#dfe6ee` → `#9aaec4` → `#4a6078` → `#101820`, one red scarf.

## 4. Type & subtitles

- **Text in the picture is paper**: titles, letters, poems and captions are cut strips inside the box, revealed by growing from an anchor edge (scale the texture repeat with the mesh so glyphs aren't squashed), with an optional small seal.
- Faces: an OFL serif (e.g. Cormorant) for titles and paper text, an OFL handwriting face for letters. Chinese characters cut into a sheet (a shop sign, a seal) are picture, set from an OFL brush font (e.g. Ma Shan Zheng).
- **Subtitles** are quiet and burned in, in the one spoken language: warm off-white serif (500), soft shadow, fading in just before the line. Where they sit depends on the framing:
  - **box framing**: under the box, on the dark of the room, ~38 px in 16:9, baseline just above the bottom 12 % of the frame; frame the box so it ends above them;
  - **full-bleed**: on the darkest band at the bottom of the scene (the front layer), the same height, never over a figure, a lit window or a light. A faint dark band behind the text is allowed when something lit has to sit there.
  - No wrapping: a line longer than about eight words becomes two cues, split at the comma nearest the middle.
- **Words that appear as paper are not subtitled**: never show the same words twice.
- Hold ≥ max(1.8 s, speech + 0.6 s).

## 5. Motion quality

- **Everything moves like paper on a stick**: layers slide (x/y), rotate about a pivot, scale in from 0 along one axis ("written out"), or light up. No squash and stretch, no morphing, no bending.
- **Figures are optional.** A video can tell its story with lit windows, vehicles, lamps and objects, and have no figure at all. When it has figures, they are jointed silhouettes: a body sheet + separate limb sheets anchored at the joint; animate rotation only.
- **Light cues are the big motion**: the source, then each layer's translucency in a ~0.4 s stagger, then windows, then flicker (`1 + .06·sin(7.3t)·sin(3.1t)`).
- **Hard action lands on spoken words** (use the voice's word timings): an object slams, a character flashes, a light arc grows on its word.
- Hand-held micro-drift on the camera (~0.6 mm) keeps a locked frame alive. Render on ones at 30 fps; never step.

## 6. Camera grammar

A vocabulary, not a route. The lens is small and the box is shallow: moves are short. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Slow dolly in, nearly frontal | intimacy; being drawn into a place | a memory; a detail that matters; a lit window |
| Slow dolly out | context; loneliness; scale | a figure alone; before/after; the whole place at once |
| Rack focus between layers | attention moving in depth | two people near and far; a clue behind; now and then |
| Lateral travel with depth parallax | journey; time passing | a road trip; a process in stages; a timeline |
| Top-down layer stack | a made thing seen as a craftsman sees it | a recipe; a letter; a map; a product being assembled |
| Pull out of / push into the box | the frame as object; "this is a story told" | a keepsake; a framing device; returning to the present |
| Locked frame with only light changing | waiting; the passage of a day or a night | a vigil; seasons; a city going to sleep |
| Tilt up/down the stack | climbing; falling; sky vs ground | a mountain; a well; hope and weight |
| Near-plane occluder wipe | a curtain between scenes | chapter changes; dreams; a secret revealed |
| Travelling alongside | speed; being carried along (near layers rush past, far layers drift) | a journey by train or boat; a delivery; a migration |

Framing: the story layer in focus, foreground and far layers soft; box edges fully out of frame inside, clearly in frame outside, never half. Transitions: dissolves (0.5–1.2 s), an iris, light off/on, a near-plane curtain whose halves meet exactly. No whip pans, no digital zooms.

## 7. Sound palette

- **Instruments** that sit like light behind paper: felt piano, music box, celesta, harp or plucked zithers, bamboo flutes, soft strings; a solo instrument of the topic's culture. No drum kit; percussion only as single soft strokes (woodblock, small gong, hand drum).
- **Foley is paper and light**: switch click + rising shimmer when a light turns on; paper rustle and slide; card-stock tap; lid thud; chimes on reveals; soft whoosh for curtains; beds from the scene (river, rails, city hum, crickets, snow wind).
- **Silence**: the lamp switched off — all sound but a room tone drops out, then returns with the light.
- **Mix character**: voice compressed and forward (RMS ~−18 dB), music underneath with ~5–6 dB of ducking under speech, foley low (−24…−34 dB), peak-limited, final at −14 LUFS.
- **Options**: a new instrument entering when the video changes place; one foley sound per light cue; a music hand-over solved backwards so a swell lands on the line that matters.
- **Voice**: one warm storyteller at a table, not an announcer. Proof every line against a transcript; where the voice misreads a name, give it a respelling and keep the real spelling in the subtitles.

## 8. Native moves

A menu: use the ones your story needs.

- **The lamp turns on.** Source, then far layers, then windows light up one by one. *Fits content like:* a shop opening at dawn; a startup's first customer; a stadium before a match.
- **Two windows, one light.** Two lit places sharing one light source (a moon, a lighthouse, a satellite). *Fits content like:* a long-distance friendship; two labs working on the same problem; a sister city pair.
- **Depth as distance.** A stack of ranges or streets makes "far away" visible; travel moves layers at speeds proportional to depth. *Fits content like:* a migration route; shipping a parcel; the history of a river.
- **Paper that writes itself.** A strip grows from its edge on the spoken word. *Fits content like:* a recipe; the terms of a treaty; a child's first word.
- **The box as keepsake.** The camera finds the real lamp in a room, real objects lit by its spill. *Fits content like:* a wedding anniversary; a product unboxing; a museum object's story.
- **Light burst from an opened thing.** A lid lifts and analytic glow spills out. *Fits content like:* a gift; a discovery; a new idea.
- **Silhouette in a window.** One figure inside a lit frame, or none: a lit window alone is enough. *Fits content like:* someone working late; a portrait of a craftsperson; a patient waiting.

## 9. Pitfalls of the medium

- `destination-out` cut-outs need an **opaque fillStyle** before punching, or the hole is half-cut.
- Soft shadows bleed and halo: layers that must not take part need shadow casting **and** receiving both turned off.
- A transparent radial-gradient texture shows a square edge as an additive glow → use an analytic falloff in the shader.
- A near-plane curtain whose halves don't meet at their **front edges** leaves a slit of the old shot.
- Sheets larger than the cavity poke through the frame in outside shots.
- **Grade state must not carry over** between shots: every grade key a shot omits must fall back to a default each frame, or renders depend on which frame a worker started on (visible pops at worker boundaries).
- **Light over paper text**: a lamp's glow or a headlight flare over a name board or a card washes the letters out. Keep every lit point clear of text.
- **Subtitles over a lit window** lose their contrast: frame so the bottom band is dark, or put the faint band behind them.
- **Subtitles under the app or the player**: in a reel, keep them inside x 72–900, y 269–1248; on YouTube, above the bottom 12 %.
- Headless Chrome must run with GPU flags; SwiftShader is ~6× slower.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **A WebGL scene in metres (three.js works), drawn from `t`.** Each sheet is a plane carrying a Canvas2D texture drawn in metre space (cut-outs punched with `destination-out` over an opaque fill; grain, top rim and bottom shade baked in), with an optional glow map and reveal uniforms; a sky panel, a moon, paper text strips and an analytic light burst are the other primitives. A top spot casts soft shadow maps between sheets; the backlight term of section 2 lives in the material's shader.
- **Shots as functions**: each shot builds its own scene and returns an update of `t`, a post setup and a grade; one timeline picks the shot (two during a dissolve) and calls them. Every grade key a shot leaves out resets to its default on every frame.
- **Post**: depth of field, bloom, vignette, the transitions (dissolve, iris, light off and on, near-plane curtain) and the grade, rendered at 2× supersampling. Run headless Chrome with GPU flags.
- **Light cues as data**: source, layer translucency staggered ~0.4 s, window switch-on uniforms, flicker; keyed to the voice's word timings along with slams and paper strips writing out.
- **Cues**: `cues.json` gets each switch, light-on shimmer, reveal chime, lid or tap and curtain; the scene's bed and the music hand-overs are placed against the same times.

## 11. Variation space

You decide the places, the figures (or none), the ladders, the light source, the framing, whether the real world appears, the opening, the ending and the camera path. Some directions:

- Structures: **one window, one year** (a locked lamp; the scene inside changes season by season, light the only transition); **a vertical stack** (the video tilts down through sky, city, street, underground, each a chapter); **a relay of objects** (a single object passes hand to hand across five small boxes, each a different ladder).
- Openings: **already lit, mid-scene** (a figure walking through a lit street; we learn it is paper only when the camera racks focus); **darkness and one hole** (a single pinprick of light widens into a moon, a door, an eye); **top-down** (hands' view of a sheet being cut; the cut sheet slides into the stack).
- Endings: **rack focus to the front layer** until the story blurs into warm light; **a new sheet slides in** at the front, starting the next story; **pull out to the lamp on a table**, its spill on the objects around it.
