# Shadow Puppetry

> Chinese shadow theatre: translucent dyed-hide puppets, carved like lace, pressed against a cotton screen and lit from behind by oil lamps. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Lotte Reiniger's *The Adventures of Prince Achmed* (1926) for profile acting and lace-like scenery; Shaanxi / Huayin shadow theatre for carving, colour and gong-and-drum rhythm. Never reproduce a specific historical puppet, melody or recording, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The lit cloth fills the frame; in the audience-seat view the frame stands tall, cloth between y ≈ 250 and 1300, blurred audience heads below it under the app's buttons. Puppets stand in profile on a carved ground strip at y ≈ 1060, heads inside the safe box (x 72–900, y 269–1248), most of the cloth empty. Stack, don't shrink: a lateral pan across the cloth becomes a tilt from ground strip to top, or a procession entering one figure at a time; two figures facing each other stand closer, empty cloth above them. Title plaques press on at y 300–600; the storyteller's placard sits under the ground strip, centred on x 540, at most 720 px wide, at y ≈ 1100–1230.
- **The first 3 seconds.** Frame 1 is mid-show: a puppet already moving on bright cloth under full percussion, or one carved hole glowing in dark hide. By 0.5 s a piece presses on, large and blurred, and snaps sharp on a drum hit with a crash zoom; by 3 s a freeze pose lands on the gong while a lamp flares or the storyteller asks the question.
- **Length and pace.** 25–45 s: phrases of run, hop, freeze (about 1 s) and head turn, a freeze every 6–10 s, one hard-cut silence, one trip behind the screen if the story earns it. Render at 30 fps; swapped effect pieces step at 12 fps.
- **Captions.** The storyteller's placard is the only caption layer: 44–52 px, at most six words a line, two lines.
- **Sound.** `hook-impact` on the first press-on, `thock` for the storyteller's clapper and rod taps, `sub-impact` under the big gong on the decisive hit, `zoom-swish` on a whip pan along a moving piece. Drums, gongs, clappers, fiddle, the lamp's "fwoomp" and the leather foley come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Sections 2 and 6 as written. The placard sits above the bottom 12 % (the player's controls) and inside the 5 % margins; audience heads may fill the bottom edge, as picture.
- **Length and structure.** 2–6 min at 24 fps. A chapter is one act of the show (40–90 s): the lamps dim between acts, the storyteller's clapper opens the next, and its title is a cut-letter hide plaque pressed onto the cloth on rods, its words glowing. Lamp count can carry the whole video's arc (one lamp at the start, all of them at the climax). Re-hook every 30–60 s: a lamp lit or snuffed, a press-on with a crash zoom, a piece swap, a strip lifted off, a truck round to the back of the screen.
- **The first 10 seconds.** Mid-show percussion and a puppet in motion on frame 1; a freeze pose and the storyteller's question by 5 s; the promise by 10 s. Any channel sting comes after: the channel's name as a cut-letter plaque pressed on.
- **Captions.** The placard stays burned in; export the same lines as `.srt`.
- **Thumbnail.** A close on a carved figure frozen in its pose, holes blazing, on bright warm cloth; or the backstage view with rim-lit hands on the rods. Up to three words, cut into a hide plaque.

### Good for

Myths and folklore, heritage and festival stories, fables with a moral, "who pulls the strings" explainers, children's stories.

## 1. Essence, and what it is not

A white cloth screen; behind it, flat puppets cut from **translucent dyed hide**, lit by an **oil lamp**. Colour arrives *by transmitted light*: dyes glow like stained glass, carved holes shine brightest, overlaps go darker. Puppets are jointed with **visible thread rivets** and moved by **thin rods** (neck and hands) that show as soft grey lines just off the screen. It is live theatre, not stop-motion: the screen **flickers with the lamp**, puppets **tremble in the hand**, loose parts **swing on their rivets**.

Not a black silhouette film (colour is the second protagonist), not paper-cut (the light comes *through*), not stained glass (no lead lines; pieces move and overlap), not flat vector cut-out animation.

## 2. Materials & rendering

**Rendering model.** Per pixel: `image = tonemap( lampLight × hideTransmission × clothTexture )`.
- `hideTransmission`: a 2D canvas that starts **white**; every piece is drawn with `multiply`. Holes stay white, overlaps darken by themselves.
- `lampLight`: per lamp a broad lobe plus a tight hotspot (~6 : 1), each flickering independently (a few % of ~7 Hz value noise plus a faster sine). Warm light, never white.
- `tonemap = 1 − exp(−hdr)`, exposure ∝ `1/√(lamps lit)`: more lamps bleach the frame but keep it readable. Lamp count is a dial the story can turn.
- **Cloth**: procedural weave (sin × sin, noise-warped), fibre speckle, low-frequency density blotches, darker edges at the frame. **Post**: warm-tinted bloom, a **warm vignette** (toward brown, never grey), slight saturation, soft S-curve, light grain; heat haze only when the story burns.

**Hide and carving.** Multiply a tileable hide texture (mottling, fibres, specks) into each piece and restore its alpha with `destination-in` so holes survive. **Carving is density**: leave thin strips, cut out most of the area. Cut vocabulary: crescent rows (scales, tiles), diamond lattice, coin holes (round hole, square of hide inside), cloud collars and scrolls, tapered slits (cracks, rain, fur), strata along a ridge, leaf holes in a canopy. A dark carved outline (1.5–2.4 px) on every region. With `destination-out`, set `fillStyle = '#000'` first: fill alpha decides how much is cut.

**Figures are jointed puppets**: 8–12 pieces, head ~1.2× natural with large headwear, sleeves in a different dye from the torso, round joint lobes with a rivet (dark ring + pale knot), arms by 2-bone IK from hand targets, held objects as separate pieces on the hand line. Sympathetic figures have *open-cut faces* (features as thin strips around a hole); antagonists solid faces.

**Scenery** is carved set pieces on mostly empty lit cloth: one lace piece per element, a narrow carved ground strip, separate liftable strips for water or sky. Fire, smoke and moving water are carved pieces on rods, swapped and shaken, never particles.

**Stage and backstage.** A lacquered frame (lintel, pillars, warm spill on its inner edges), optional blurred audience heads. Backstage = the same transmission canvas with the camera mirrored (`x → −x`), dark wood around, hanging lamps (additive flame glow; snuffed ones trailing dark smoke), hands and sleeves as **silhouettes with a warm rim** (mask minus mask shifted away from the light), rods sharp.

## 3. Colour logic

- All colour is **transmitted**: a dye filters warm lamplight, so nothing is brighter than the lamp and every hue leans warm.
- 3–5 saturated dyes + **raw hide** (the neutral) + **ink** (outlines, hair, boots). Holes are the brightest value.
- Overlap is darkness: plan which pieces cross.
- Brightness comes from the number of lamps, not grading. Night is fewer lamps, never added blue.
- Thin things that must read (strings, shafts, text) are dark: pale pieces vanish on a bright cloth.
- Example sets: *court* (vermilion, ochre, malachite); *river* (indigo, jade, one ochre); *harvest* (flame orange, gold, one green).

## 4. Type & subtitles

- Subtitles belong to the theatre, in the one spoken language: a **storyteller's placard** (narrow dark-lacquer board, thin gold line, small carved seal), a label on a rod, or letters carved into hide. Classical OFL serif (e.g. Cormorant Garamond 600), 40–50 px in 16:9, cream on dark, short slide in, about eight words a line at most. Hold ≥ max(1.8 s, speech + 0.6 s).
- **Titles are puppets**: dark hide plaques with letters cut out (`fillText` + `destination-out`, so words glow), a carved border, carried on rods, pressed on to enter, lifted off to exit.

## 5. Motion quality

- **24 fps continuous** for puppets and camera (30 fps in a reel); only swapped effect pieces (fire, water) step at 12 fps.
- **Hand tremor** on every puppet (a few px, ~0.02 rad, low-frequency), stronger under tension.
- Body glides with the main rod; **legs, plumes, tassels are simulated** (damped pendulums / spring chains driven by body acceleration, pre-simulated at a fixed rate for determinism).
- Operatic phrasing: shuffling run → hop → crouch → **freeze pose on a percussion accent** (~1 s, only loose parts quiver) → head turn.
- Faces never change; attitude = head angle + body tilt (up = resolve, down = sorrow).
- **Press on / lift off**: arrivals come large and blurred onto the cloth and snap sharp (~0.5 s); exits grow, blur and fade (~1 s).
- A new lamp flares with overshoot; a snuffed lamp gutters with fast flicker.
- Never moves: the cloth, the frame. Nothing morphs: pieces rotate on rivets, slide on rods, or are swapped.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| Audience seat (whole stage, heads below) | "This is a show" | a legend; a lesson; a framed memory |
| Push through the frame onto the cloth | Entering the tale | a story within a story; focus |
| Lateral pan across a wide cloth | Extent, a place laid out | a journey; a disaster's reach; a procession |
| Follow a puppet, slight zoom | Being with one figure | a pursuit; a working day |
| **Crash zoom** of a few frames on a percussion hit | The drum becomes the camera | an entrance; a pose; a reveal |
| Whip pan along a moving piece | Cause to effect | a message sent; a strike |
| **Locked wide** | Every step of a change is seen | counting; repetition; stages |
| Medium-close, empty cloth between two pieces | Distance, hesitation | a choice; a parting |
| Close on a carved detail | Craft as meaning | a vow; a tool; a clue |
| Tilt from ground strip to top of cloth | Height, hierarchy | a tower; heaven and earth |
| Truck round to the back (mirror view) | The trick revealed | behind the scenes; who pulls the strings |
| Pull back from cloth into the dark room | The tale becomes an object | aftermath; a story ending for the night |

Puppets in profile; most of the cloth stays empty. When zoomed in, clamp the camera to the screen rectangle (no black bars); push on frame centre unless diving into a lamp. Transitions: lamps dimming, a blurred foreground pillar wipe, a piece lifting off in light, a flash to warm white; never a generic crossfade or digital wipe.

## 7. Sound palette

- **Percussion first, not piano and strings** (thinking in the gong-and-drum patterns of Chinese opera, *luogu jing*): low barrel drum, hard high clapper drum (woodblock), cymbals, small gong with rising pitch ("tai"), big gong with falling pitch ("kuang"); also a bamboo clapper board, pellet drum, sanxian pluck, a bamboo flute for quiet.
- **Bowed and reed voices**: a bright nasal fiddle (erhu-like: pitched up, nasal formant, pitch-curve resampling for slides and vibrato), plain pentatonic (**huan-yin**) or sorrowful microtonal (**ku-yin**: raised 4th, lowered 7th); a shrill suona-like reed (oboe + 1.2–3 kHz formant + saturation) at most once.
- **Techniques, as options**: a single tap inside a silence; one big gong per decisive hit; a heartbeat drum under dread; accelerating rolls into an entrance; one hit per visual step; a gong scrape to change space; a hard stop (≤ 30 ms, tails included).
- **Silence**: hard-cut the whole bed; at most one sound inside (a breath, a tap, a sizzle).
- **Foley follows the materials**: the storyteller's wooden clapper (*xingmu*), match strike, lamp "fwoomp" and "pfft" + sizzle, rod taps on cloth, dry leather flaps on lift-off, leather steps, creaks of hide and wood props, leather thwacks, cloth rustle, backstage room tone.
- **Voice**: one storyteller, few short lines, small-theatre reverb; music ducked ~12 dB, foley ~4 dB, voice ≥ 12 dB above the bed; −14 LUFS; check each line against a transcript, alone and on the final mix.

## 8. Native moves

A menu: use the ones your story needs; put the strongest at the peak.

- **The light is the world.** Lamp count drives heat and colour. *Fits content like:* city lights spreading at night; a fever rising and falling; servers switching on one by one.
- **Off the screen = big and blurry.** A piece pulled toward the lamp grows and blurs. *Fits content like:* a rumour growing; a memory fading; a deadline pressing onto the cloth and snapping sharp.
- **Go behind the screen.** Lamp, hands, rods. *Fits content like:* how a product is really made; who controls a market; a teacher revealing the method.
- **Carved and translucent.** Holes glow, overlaps darken, open faces vs solid. *Fits content like:* an x-ray of a system; good and bad actors in a fable; layers of a city.
- **Hand-held.** Tremor and swinging parts. *Fits content like:* a nervous interview; a tightrope; a toddler's first steps.
- **Piece swap.** One carved piece on a rod replaced by another. *Fits content like:* seasons; a machine's states; weather over a harvest.
- **Strip lift-off.** A band of scenery lifted to reveal another. *Fits content like:* geological layers; before/after a flood; an old town under a new one.

## 9. Pitfalls of the medium

- Flat clip-art look → hide texture, denser openwork, deeper dyes, carved outlines everywhere.
- Figures unreadable in profile → bigger head, fuller lower body, collar piece, contrasting sleeves.
- Radiating shapes read as saw blades or petals → flame tongues with a fat base, belly and hooked tip, alternating curl.
- Grey corners when overexposed → warm vignette.
- Thin pale pieces vanish → make them dark.
- Mirror view flips pieces when rotation uses the x scale for both axes → x scale for x, y scale for y.
- Smoke with `lighter` is invisible on bright cloth → dark wisps, warm additive only near a lamp.
- Push-in centred on an edge lamp shoves figures out → push on frame centre.
- Beds leaking into a silence → hard-cut them.
- Headless frame captures can time out under GPU load → retry.
- **The placard under the app or the player**: in a reel, keep it inside x 72–900, y 269–1248; on YouTube, above the bottom 12 %.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **A WebGL2 compositor drawn from `t`**: per pixel `tonemap(lampLight × hideTransmission × cloth)`, with the lamp field (lobe + hotspot per lamp, flicker from seeded value noise of `t`), exposure from the lamps lit, the mirrored backstage view, bloom, heat haze and the warm fade.
- **A carving library on 2D canvas**: piece sprites with cut, cut-line and tapered-cut operations (`destination-out`, fill alpha = how much is cut), the pattern vocabulary of section 2, a hide texture multiplied in and alpha restored with `destination-in`, rivets and carved outlines. Bake each piece once, then draw it into the white transmission canvas with `multiply` every frame.
- **The rig**: jointed pieces pivoting on rivets, 2-bone IK from hand targets, and pendulum and spring chains for legs, plumes and tassels pre-simulated at a fixed rate from the start and looked up by frame, so any `t` gives the same pose. Effect pieces (fire, water) swap on a 12 fps clock.
- **Stage parts**: frame, audience, pillar wipe, cut-letter plaques (`fillText` then `destination-out`), the placard, backstage silhouettes with a warm rim (mask minus a shifted mask), additive flames and dark smoke, landscape pieces and the ground strip.
- **Test pages first**: model sheets, single frames and the hands view drawn from the real engine. A good first test: carve a lantern-seller with a lattice basket, press it onto one lamp, light three more and watch the frame bleach.
- **Timing and cues**: freezes, crash zooms and press-ons land on percussion hits placed on the voice's word timings; `cues.json` gets each press-on, freeze, lamp flare or snuff, whip and gong hit.

## 11. Variation space

You decide the story, the figures (or none), what the lamp means, what leaves the screen, the opening, the ending, the camera path, the dyes and the pacing:

- Structures: **a procession** (one long pan; each figure adds a dye until the cloth is a full street); **two puppeteers** (rival hands argue through their puppets; backstage shows who is winning); **a workshop** (a puppet is carved, dyed and riveted on the cloth, then performs its own making).
- Openings: **backstage first** (rim-lit hands and rods before the front); **one hole of light** (the screen all dark hide; one carved hole glows and widens); **mid-show** (the camera finds a performance already in full percussion).
- Endings: **the lamp is carried away** (the cloth darkens from one side); **the puppets rest** (lifted off one by one, laid flat on a dim table); **the audience leaves** (the heads stand and go, the cloth still glowing).
