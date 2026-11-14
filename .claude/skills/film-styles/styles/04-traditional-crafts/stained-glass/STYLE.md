# Stained Glass

> A medieval stained-glass window seen from inside a dark stone hall, alive only where the sun touches it: light is the clock, the camera and the story. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): the window prologue of *Beauty and the Beast* (1991) (chapters pane by pane, a storyteller's pace); the glass knight of *Young Sherlock Holmes* (1985) (glass that cracks and recombines piece by piece); 12th–13th-century Chartres glass (colour logic, grisaille, leading). Copy none of their characters, compositions, subjects or music.

## Formats

### Reel (1080×1920)

- **Layout.** A lancet is already tall: one lancet (or a pair) fills the frame's height inside its embrasure, medallions stacked, stone bleeding to the side edges. The pane that is "now" sits inside the safe box (x 72–900, y 269–1248), its figures at least 600 px tall in close-ups. Stack, don't shrink: trucking with the light becomes tilting up or down one lancet; a rose is framed from its centre; the floor projection is seen top-down, wall at the frame's bottom. The banderole unfurls centred on x 540, at most 720 px wide, at y ≈ 1100–1230; incised titles sit on the stone sill.
- **The first 3 seconds.** Frame 1 is a pane already lit, a figure caught mid-action, the band of light moving. By 0.5 s the band slides onto the next pane and wakes it, figures stepping; by 3 s the glass cracks, or the camera tilts down the shafts to the story playing on the floor, with the question in the voice.
- **Length and pace.** 25–45 s: four to six panes of 4–7 s, each woken by the light; one crack or re-leading; the sun moving a whole day in the length of the reel. Figures at 8 fps; light, shafts, dust and camera at 30 fps.
- **Captions.** The banderole is the only caption layer: 44–52 px, at most six words a line, two lines.
- **Sound.** `clean-ding` each time a pane wakes, `shimmer` as shafts appear, `sub-impact` under the crack, `sparkle` on each weld spark of the re-leading. Organ, harp, chimes and the glass and lead foley come from a free sample library (or are synthesised, section 7), or the user's music.

### YouTube (1920×1080)

- **Layout.** Sections 2 and 6 as written. The banderole sits above the bottom 12 % (the player's controls); incised titles stay inside the 5 % margins at ≥ 30 px.
- **Length and structure.** 2–6 min at 24 fps. The sun's day is the video's clock: dawn, noon, afternoon, dusk, moonlight. A chapter is one pane, lancet or hour of light (40–90 s); its title card is the chapter's name in incised Roman capitals in the stone below the window, revealed by the moving band of light. Re-hook every 30–60 s: the light leaving one pane for the next, a crack, a tilt down to the floor projection, a rack between a lit pane and a dark one, the re-leading, a pull-back to the whole window under a new light. Ending under dusk, moonlight or clouds gives the end screen quiet edges.
- **The first 10 seconds.** The strongest pane on frame 1 (a crack, or a figure mid-action); the question by 5 s; by 10 s a pull-back to the whole window with its panes still dark, and the promise that each will wake. Any channel sting comes after: the channel's name incised in the stone, revealed by the light.
- **Captions.** The banderole stays burned in; export the same lines as `.srt`.
- **Thumbnail.** A close-up of one lit pane in cobalt and ruby, a figure large, a crack or its coloured patch on the floor; up to three words on the banderole or cut in the stone.

### Good for

Legends and fables, heritage sites, holiday stories, a company history in chapters, a process in stages, a product line laid out as a window.

## 1. Essence, and what it is not

- **Cut pieces of coloured glass in dark lead cames**, faces and folds **painted in brown grisaille**.
- Glass has no light of its own: it **glows only when the sun is behind it** and throws a soft coloured copy onto the stone floor; unlit, it is dark and milky.
- Figures move **piece by piece**, rigid and stepped.
- The room is always there: stone, a splayed embrasure, iron saddle bars, a floor that catches light.
- **Secular**: no crosses, saints, halos or other religious imagery; borrow the craft, not the subjects.

Not vector art with black outlines, not a kaleidoscope or Voronoi filter, not Tiffany Art Nouveau, not mosaic (mosaic reflects; glass transmits).

## 2. Materials & rendering

One formula for everything (a WebGL compositor), so every element sits in the same light:

```
glass   = tonemap( backlight(x,y,time) × transmittance × glass texture ) + weathering haze × room light
surface = albedo × (room ambient + glow spilled from lit panes + point lights)          // stone, lead, iron
floor   = flagstones × (ambient + projected colour-patch map, blurred + halo)            // perspective or top-down
+ additive light shafts with dust · bloom (bright glass eats into the lead: the "irradiation" effect)
```

- **Hue-preserving tone mapping**: per-channel `1-exp(-x)` turns cobalt pastel; blend to per-channel only at the very top so a sun disc burns white while blue stays jewel blue.
- **Unlit panes**: weak sky light + room-lit weathering haze, figures ghostly but readable. **Lit panes**: backlight ~2–3×, a soft, slightly skewed moving band edge.
- **Pieces**: smooth Catmull-Rom cuts (no deep concave corners). **Every piece is textured** (`multiply` in its clip): streaks at a per-piece angle, hue drift (±10 %), darker aged edges by the lead, ±9 % thickness variation. The shader adds seed bubbles, scratches and thickness clouds in world space; fade small features below ~0.6× zoom or they sparkle.
- **Lead**: near-black, one planar network, thinner on small pieces, round joins, faint grey flange, solder blobs; only where colours meet (one colour = one piece).
- **Grisaille**: tapered trace lines in translucent dark brown; **matting** (stippled wash, graded shade, soft band inside the lead); **scraped highlights** (a thin stroke beside each fold in the piece's own colour: the only highlight transmitted light allows). Patterns (mail, scales, plates) are grisaille arcs and bands.
- **Faces**: almond eyes, heavy upper lid, big pupils, brow flowing into the nose. **Expression lives in brows and mouth**; change it by swapping the face piece, never morphing.
- **Backgrounds**: hand-cut **lozenge quarries** (jittered lattice, shared vertices, a painted motif each); borders of a coloured band with pearls and a white fillet with a running vine.
- **Room**: warm grey ashlar, a lighter embrasure, mullions; floor of **large irregular flagstones**, never the wall's running bond.
- **Floor projection**: blurred, ~20 % desaturated, modulated by the stone, haloed, mirrored (the window's top lands farthest into the room). **Shafts**: additive with dust, near 0 at the window, peaking ~40 % down.

## 3. Colour logic

- Two hues **carry the picture** (one deep, one hot); three or four more only as **small touches**. Example (Chartres logic): cobalt ground, ruby, touches of gold, green, murrey.
- Greenish white glass sparingly (faces, fillets, sky). **Flesh darker than you think**, or backlit faces burn white.
- A story light (candle, lamp, screen) may take a colour no glass uses, so it reads as a source.
- **The sun's colour is the clock**: blue-white dawn, near-white brightest noon, gold afternoon, deep orange dusk (raise intensity rather than redness), weak blue moonlight. Patch length follows sun height.
- Stone and lead take colour only from spilled or projected light.

## 4. Type & subtitles

- **Subtitles**, in the one spoken language: a parchment **banderole** near the bottom (curled ends, gentle sag, thin rule), IM Fell English ~44 px in dark ink, about eight words a line at most; in 16:9 it sits above the bottom 12 % of the frame. It unfurls from the centre; text fades in only once it is ≥ 75 % open; pad the ribbon well past the text. Hold ≥ max(1.8 s, speech + 0.6 s).
- **Titles**: incised Roman capitals (Cinzel 600) in the stone, dark cut, light lower lip, gilding, revealed by a moving band of light; small lines ≥ 30 px on screen. In the glass, text only as grisaille on a white-glass scroll.

## 5. Motion quality

- **Figures step at 8 fps**; light, camera, shafts and dust move on ones (24 fps; 30 fps in a reel): stepped light reads as flicker.
- Rigid pieces on 2D FK (`setTransform(base · T(part))`, free draw order); long bodies are spine chains of banded pieces.
- **Freeze rule**: a pane's figures use `min(t, t_lightLeft)`. Actions land on the beat.
- **Crack**: jagged lines race from the impact in ~¼ s, bright with light, a short white flash and a 2-frame shake.
- **Re-leading**: piece groups slide one beat each with a small outward bump along the lead, each ending in a weld spark; cracks become mending leads.
- Glass never bends or morphs; things appear by being lit, not faded in.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| Truck sideways with the band of light | Time passing, the story moving on | a sequence of steps; a day; chapters |
| Locked close-up on one pane | This panel is "now" | a line being read; a character's decision; a detail |
| Pull back to the whole window | The rule, or the whole story at once | learning the system; a summary; aftermath |
| Tilt down the shafts to the floor, then top-down | The picture leaves the glass and becomes light | an event too big for its frame; a dream; a memory |
| Hold through a crack, no cut | The event is the medium breaking | a turning point; a loss; a revelation |
| Slow push toward a small light | Attention narrowing to one source | a discovery; a secret; hope |
| Tilt up to a rose or tracery | Something above the panels governs them | a clock; a cycle; an overview |
| Rack between two panes, one lit, one dark | Past and present side by side | before/after; two lives; cause and effect |
| Low angle along the embrasure, glass raking | The window as architecture, scale | awe; an institution; a long history |
| Return to an earlier framing under new light | The rhyme shows what changed | growth; nightfall; repair |

Framing: subjects big (close-ups ~1.3–2.3× a lancet width); in a narrow lancet stack figures diagonally; a revealed thing near centre, ≥ ~1/8 frame width with glow. Transitions: moving light, shafts, a crack, darkness; never a dissolve, wipe or flip.

## 7. Sound palette

- **Instruments**: organ (pedal drone, soft stops, full), harp, hand chimes, tubular bells, recorder or a chant-like voice, water-glass notes, timpani; also hurdy-gurdy drone, psaltery, portative organ. No generic piano or strings.
- **Mode families**: church modes (Dorian, Mixolydian, Aeolian, Lydian), open fifths, drones, parallel organum.
- **Options**: free unmetred chant for darkness; one note meaning "the light" each time a pane wakes; an organ pedal that holds and then cuts out; a rising scale, one step per lit piece.
- **Foley, material first** (synthesizable): struck glass = inharmonic partials ~1 : 2.32 : 4.25 : 6.63 : 9.38; crack = snap + pane thump + rain of tinkles; lead = stick-slip creak; glass sliding in a came = gritty band noise + faint squeal; solder = hiss + tick; air on light moves; stone-hall ambience; birds in the vault; iron ticking as it cools.
- **Silence**: a hard stop, reverb tails included, only the glass's own ring or creak inside; a single long-reverb bell can close it.
- **Mix**: big and reverberant; heavy hits avoid word onsets; music ducked ~9 dB under voice; −14 LUFS. **Voice**: one gentle, even storyteller, few short lines.

## 8. Native moves

A menu: use the ones your story needs.

- **Light is time, and the camera.** Only the lit pane is alive; figures freeze when the light leaves. *Fits content like:* the steps of a recipe; a factory's shifts; four seasons of one farm.
- **Glass projects onto stone.** A key scene plays in the floor patch, which stretches as the sun sinks. *Fits content like:* a memory seen larger than life; a sports play replayed as shadows; a data trend drawn by lengthening light.
- **Glass cracks, lead mends.** Pieces slide along the leads into a new picture, leaving scars. *Fits content like:* a company's reinvention; an injury and recovery; an old building restored.
- **A window holds its own light.** At night one pane glows from a source inside the story. *Fits content like:* a lighthouse keeper; a night-shift nurse; a server that never sleeps.
- **The window as a diagram.** Lancets as columns, a rose as a wheel or dial, the border as a timeline. *Fits content like:* a product lineup; the parts of a cycle; a family tree.

## 9. Pitfalls of the medium

- Hidden leads show through front pieces → erase the surface under each piece before stroking its lead.
- Pastel glass → hue-preserving tone mapping; darker flesh. Red dusk × blue glass = mud → keep blue alive, raise intensity.
- Voronoi reads as a filter; flat fills read as clip-art → hand-cut lozenges, texture on every piece, heavy grisaille.
- A sharp floor patch looks like a decal → blur, desaturate, stone-modulate, halo. Shafts at full strength at the window wash out the pane.
- Top-down projection is flipped → put the wall at the frame bottom so figures stand upright (mirrored, correct).
- Patch-map canvas size mismatched with the code draws into a corner of the texture → one constant size.
- Carved text in a dark wide is unreadable → push in, park a light on it.
- **The banderole under the app or the player**: in a reel, keep it inside x 72–900, y 269–1248; on YouTube, above the bottom 12 %.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **A WebGL2 compositor drawn from `t`** that applies the one formula of section 2 to glass, stone, lead, iron and floor, with hue-preserving tone mapping and bloom. The backlight is a function of position and `t` (a soft, skewed band moving across the panes); the sun's colour, intensity and patch length come from one day-clock function of `t`.
- **Glass pieces drawn once on 2D canvas** into textures: Catmull-Rom cut paths, per-piece streaks and hue drift multiplied inside each clip, the lead network (erase the surface under each piece before stroking its lead), grisaille trace, matting and scraped highlights, lozenge quarries and borders. Bubbles, scratches and thickness clouds are added in the shader in world space and faded below ~0.6× zoom.
- **Figures** are rigid pieces on 2D forward kinematics, long bodies as spine chains of banded pieces, faces swapped not morphed. They read a stepped clock (`Math.floor(t * 8) / 8`) frozen per pane at `min(t, t_lightLeft)`; light, shafts, dust and camera use full-rate `t`.
- **Architecture and scene**: lancets, rose, borders, wall and incised carving; a floor projection rendered from the lit panes into one fixed-size patch map, blurred, desaturated and mirrored onto the flagstones; additive shafts with seeded dust; the banderole. Make model sheets and style frames from the real engine before shooting.
- **Timing and cues**: panes wake, cracks land and re-leading slides on beats placed on the voice's word timings, keeping heavy hits off word onsets; `cues.json` gets each pane waking, crack, slide and weld spark. The struck-glass and lead foley of section 7 can be synthesised from the same events.

## 11. Variation space

You decide the window (lancets, a rose, a medallion, a clerestory), the subjects, the order of light, opening, ending, camera path and pacing:

- Structures: **a rose window as a dial** (petals lit in turn like hours, the centre the answer); **one tall lancet read bottom to top** (a tilt up a life or a process, medallion by medallion); **two windows facing each other** (the sun lights one side in the morning, the other in the evening; the floor between them holds their meeting).
- Openings: **the floor first** (only a coloured patch on stone; tilt up to find its source); **a lit window from outside at night** (a figure passes a glowing pane, then we are inside); **the glazier's bench** (a single piece cut and leaded, becoming the first piece of the picture).
- Endings: **clouds cover the sun** (every pane fades to grey at once; one line lingers); **a new pane leaded in** (an empty lancet filled with the last scene); **the camera leaves through the door** (the window small behind, its patch still on the floor).
