# Isometric Picture Book

> A calm explainer of an everyday rule, set in one real place drawn in true isometric with flat colour: small faceless people seen from behind do the thing in order, while serif type lands on the ground, letter by letter, as if painted there. Whatever hides the action (a roof, a wall) is cut away or lifts off like a paper flap. The order of movement is the explanation. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): isometric explainers about public manners (queues, platforms, crossings) and picture-book cutaways where a roof or a wall is lifted away to show the inside. Take the calm pacing, people as the diagram and type on the floor; never copy their characters, layouts, typefaces or music.

## Formats

### Reel (1080×1920)

- **Layout.** The ground bleeds to all four edges. Keep the 16:9 scale (the same pixels per metre), so the reel sees a narrower, taller slice of the place: lay queues and routes along the up-left and up-right axes, which climb the frame, and follow a line from its tail at the bottom to its head at the top. Floor phrases and the people who matter sit inside the safe box (x 72–900, y 269–1248), the phrase above the action; the subtitle bar is centred on x 540, at most 720 px wide, baseline y ≈ 1200. The ground below is picture only.
- **The first 3 seconds.** Frame 1: the place already populated, the camera mid-drift, the key number half-painted on the floor. By 0.5 s its last letters land and the first person steps. By 3 s, **Order lighting** has lit the places in a surprising order, so the question is on screen before anyone sits.
- **Length and pace.** 20–45 s, three to five rules. A beat (one floor phrase, one diagram mark, one action) runs 3–5 s; at 1.5 m/s a 4 m walk takes 2.7 s, so keep routes short. One locked hold for the verdict, one rewind if two orders are compared.
- **Captions.** One line on the pale bar, Newsreader 500 at 44–48 px, switched hard per narration line; the floor carries only the key word or number, never overlapping the bar.
- **Sound.** `tick` per place lighting up, `latch` as a lid unhinges or a bin shuts, `thock` as a case lands or a person sits, `ratchet` under the rewind counter, `zoom-swish` on a rise to wide, `clean-ding` on the winning number. Piano, vibraphone, glockenspiel, pizzicato and place beds from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** The full-bleed place of section 2; floor phrases at least 5 % from every edge and, with the subtitle bar, above the bottom 12 % (the player's controls).
- **Length and structure.** 2–8 min at 30 fps, on ones. A chapter is one rule in one place, or one stop along the same ground (§11); its title is painted on the floor as the first person walks over it, then a lid comes off. Re-hook every 30–60 s with a move that changes the view: a lid off, a rewind comparing two orders, bars on the ground, a scale jump.
- **The first 10 seconds.** The verdict first: the room full, woven in four colours, the winning number on the floor. By 5 s the rewind runs it back to the empty place and asks why; by 10 s the promise ("two ways to board, one nearly twice as fast"). Any channel sting after that.
- **Captions.** The pale bar burned in, plus an `.srt`.
- **Thumbnail.** The lid-off view of a full room, the accent outline on the one spot that matters, the floor number and at most two words.

### Good for

Everyday rules and etiquette, queues and boarding, "why is this order faster" comparisons, how-a-place-works YouTube explainers, venue or service onboarding.

## 1. Essence, and what it is not

- **One real place, full bleed.** A platform, a gate, a cabin, a crossing, a counter: the ground runs off every edge of the frame. No floating board, no frame line, no vignette. A topic that travels (a parcel, a route, a production line) can still be one place: one continuous ground at one scale, with the stops along it (see §11); what breaks the look is a separate board, a map view or a change of scale for each stop.
- **People are the diagram.** Slim figures seen from behind, no faces and no hands, move only when the rule says so. Who moves first, who waits, who sits is the information.
- **Type lies on the ground.** Each idea is one key word or number painted on the floor, big and small sizes, one accent word or number, landing one letter at a time.
- **The cut-away.** Whatever stands between the camera and the action (a roof, a canopy, the top of a wall, a glass façade) is cut low or lifts off like a paper flap, so the camera always looks into the place from above.
- **Clean, always.** One place, one action, one phrase per beat. Large calm areas of ground around the type, people in tidy lines and rows, few props, every object instantly recognisable. A frame that needs a second look to find its subject is wrong.

Not **Isometric Infographic**: that style builds a model on a floating board over a dot lattice and labels it with sans-serif pins, icon statistics and inset bubbles to trace a process; here there is no board edge, no pins and no icons: the place is real and full bleed, the labels are serif words lying on its floor, and the explanation is people obeying a rule. Not **Low-poly Isometric Island**: no lighting, no faceted terrain, no shadows or glow; solids are flat three-tone paper colours and the ground is a printed plane. Not a cartoon (no expressions, no gags), not a slide (no headers, no centred titles, no cards).

## 2. Materials & rendering

- True isometric (axes at 30°), Canvas 2D, painter's sort. Every solid and every person is sorted by its **floor footprint** (x + y at floor level), never by the centre of its box: a seat back sorted by its centre height ends up drawn over the passenger sitting behind it.
- Solids are flat-shaded in **three tones per colour**: top lifted toward warm paper, +y face the base colour, +x face dropped toward a warm umber. Curved bodies (a fuselage, a column) are faceted and quantised to the same tones plus one in-between, so they read as round without gradients. No outlines on solids, no shadows, no textures, no highlight spots (a round tree crown or a ball is a flat disc or a faceted solid in the same tones, never a glint).
- **New objects** (vehicles, machines, buildings, trees) follow the same model: built from boxes, prisms and faceted solids at real size in metres, in the same three warm tones, recognisable from their silhouette at a glance, simpler than the people. Vehicles read from the body (cab, cargo box, a band of the subject hue); wheels are small, low and mostly under the body in one dark tone, never thick drums or tyre-and-hub detail.
- Ground surfaces carry only their functional markings (painted lanes, chevrons, lead-in lines, stop bars, seat squares) and a faint tile or slab grid.
- **Cut-aways** are part of the model: the near wall is cut low and the far wall keeps its windows; a lid is its own solid with a paper-coloured underside, hinged on the far edge so it opens away from the camera; glass is a pale tint with thin mullions and is cut to a parapet whenever it would stand between the camera and type or people.
- **People** are billboards anchored at their feet, about 1.6–1.8 m tall: a round hair-dark head with a sliver of skin at the ear, a two-tone torso, separate trouser legs, dark shoes, optional long hair or skirt, a rolling case. Seated people show only shoulders and the back of the head above a low seat back. Walking scissors the legs along the screen; arms counter-swing.
- Bodies obey space: people never pass through seats, walls or each other; a queue keeps about 0.75 m between feet; someone sitting down first steps back into the row's legroom, walks sideways to the seat and sits (never sinking into or floating above it); a lifted case travels up over the open bin and is lowered in, never into a wall or a seat.
- Everything is a function of time. A crowd that queues is simulated once at load (deterministic) and **sampled with interpolation**, so replaying it slowed down still moves every frame.

## 3. Colour logic

- A warm paper neutral for every ground (outdoor concrete a touch cooler, indoor carpet a touch warmer), one dark ink, **one accent reserved for the rule** (the key word, the "stand here" outline, arrows, a lit sign, the winning number, a stretch of floor that matters), one **subject hue** carried by the place itself (seats, livery bands, chairs in a paler tint, sign trim), one marking colour (lead-in lines, a tug, a baggage tractor). People wear four muted tops, so a filled room reads as an even four-colour weave.
- The accent never decorates; it appears only where the rule is. It stays small because its rarity is what makes the eye go to it: many frames carry none at all. A path in the accent marks the stretch being explained now (it grows ahead of the walker or the vehicle and fades behind it), not a trail left across the whole video.
- The subject hue and the marking colour must be clearly apart, in hue and in value, from the four tops: people have to stand out from the place they move through (a blue-green place swallows fog-blue people).
- Shade toward warm umber and paper, never toward grey or violet: dirty shadows are the fastest way to lose this look.
- Example palette: paper #F1E8D8, concrete #EAE2D3, carpet #F2E5CE, ink #2A2E29, accent persimmon #D0573A, subject green #3D6B59 / #A7C2B2, marking ginger #E2AE3A; tops ochre, fog blue, grey violet, oat.

## 4. Type & subtitles

- One family: a book serif (Newsreader, open licence), 700 for keywords and numerals, 500 for small words and subtitles, subset to the characters used.
- **Floor type**: big ≈ 1.5 m on the ground, small ≈ 0.8 m; read along the up-right axis (coordinates in §10). One phrase per beat, at most four words; one line where the frame is tight. One accent word or number per phrase, never a single thin glyph (an accent "1" or "I" alone reads as a line, not a word). Letters land ≈ 0.14 s apart (a word longer than seven letters lands by syllable, so no word takes more than about 1 s): fade and scale 1.22 → 1, pale ghost → ink. A painted title or a pair of numbers may scale up to ×1.6.
- Type sits on clear ground: nothing stands on it, nothing raised stands in front of it (see §9), at least 5 % from every frame edge, and clear of the subtitle bar.
- Signs in the world (gate signs, group signs, screens) face the camera side of the room at the iso angle, never a flat card facing the lens.
- Reading time: every piece of world text stays fully in frame ≥ letters/15 + 1.5 s.

### Narration & subtitles

When the video tells something, a narrator says it and the picture shows it at the same moment: one line per action or shot, each line starting as its action starts. A calm, quick reader in the video's language; the floor carries only that line's key word or number, never the sentence. Subtitles: one cue per narration line on a pale bar in the lower safe area, one line (≈ 34 px in 16:9), switched hard, never two cues on screen. Numbers the viewer must remember: at most three, each said with what it compares to, and held on screen ≥ 2.5 s.

## 5. Motion quality

- **30 fps, on ones**: crowds and walks are judged frame by frame (§9), and the check assumes this rate.
- People move only when the rule says so, in order; the order is the point. Walk ≈ 1.5 m/s; nobody moves faster than about 3 m/s on screen, even in a time-lapse: when a process must be compressed, show it as places filling (people settling into their seats) rather than people zipping past.
- Everything eases; nothing pops. A beat = one floor phrase + one diagram mark (an outline traced, an arrow grown ahead of the walkers, a light run along a path) + one action.
- A rewind runs the same motion backwards, faster, with a counter running down.

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| slow drift and push (≈ 6–8 % zoom) | calm attention on one rule | a call, a waiting room, a hold to read |
| follow the head of a line | the order of things | a corridor, a boarding, a procession |
| travel along the ground at the subject's pace | one place after another on the same road | a delivery, a parade route, a line of workshops |
| rise to wide while a lid opens | revealing a space whole | an interior, a capacity, a grid of places |
| locked frame | judging, reading | a verdict, a comparison, the last frame |
| step back to frame one whole incident | cause and effect in one view | one person blocking, one door jamming |
| tilt down from outside to the people | arrival, cause → people | an opening, a change of place |
| scale jump (room → building → site) | the result in context | a verdict, an ending |

The angle never changes (iso is fixed); camera moves are translation and zoom. Every move is motivated by the action, and text and subject stay inside the frame at both ends of it. Transitions: a continuous move, a lid opening, a run back along the same path, or a cut on the beat at the same angle. No page turns, wipes, black or blank frames; a pull-out shows its next subject (a mark being drawn) within half a second. A lid is a reveal only while it is seen: it finishes turning, paper side up, inside the frame before it glides off away from the camera.

## 7. Sound palette

Soft upright piano and vibraphone; a vibraphone note per landing letter group (keywords louder, the accent doubled on glockenspiel); pizzicato and shaker when people walk. Repeated actions become rhythm: a stuck queue is broken pizzicato stabs, an orderly one is one chord per group. Quiet place beds (hall air, cabin air, distant engines) and a sustained low string root overlap every cut so no scene change drops out; functional sounds of the place (a home-made chime, wheels on carpet and on metal, bin lids, a tug). A rewind plays the last second of music backwards. With narration, the music ducks about 16 dB under the voice and lifts between lines. Master −14 LUFS, true peak under −1.5 dBFS.

## 8. Native moves

- **Floor type.** The key word lands on the ground beside the action. *Fits content like:* a hospital triage rule; a polling-station step; a library's quiet zone.
- **Domino stand-up.** The group called sits together and rises one by one from the near end into a painted lane. *Fits content like:* an exam hall emptying by row; a ferry deck released lane by lane; a classroom drill.
- **Lid off.** A roof flips open on its far hinge, paper side up, and glides away; the camera rises to see the whole inside. *Fits content like:* a bus at a depot; a lecture hall; a container being packed.
- **Order lighting.** Places light up one by one in the order they will be used, before anyone moves. *Fits content like:* seat assignments; a parking plan; a vaccination queue by number.
- **Order arrows.** A flat accent arrow grows ahead of the walkers and branches where each one turns. *Fits content like:* escalator lanes; recycling bins by type; a one-way museum route.
- **Weave fill.** Places fill in a pattern (every other, window first) so the room becomes a woven grid in four colours. *Fits content like:* a stadium by sections; a cinema with assigned seats; a car park by level.
- **Bars on the ground.** Two quantities painted as strips on the floor in proportion, the difference marked by a dashed bracket after a still hold. *Fits content like:* two queue times; two routes' lengths; before and after a change.
- **People as the sample.** The people of a study stand on the ground in the shape of the thing they tested. *Fits content like:* a 72-person boarding test; a class of 30 in their desk plan; a jury in their box.
- **Stand here.** An accent outline or a lit stretch of floor marks the spot that matters. *Fits content like:* where to wait for a lift; the jammed stretch of an aisle; the right queue at a counter.

## 9. Pitfalls of the medium

- Anything raised by H metres hides what lies behind it (toward −x behind a face that looks +x, toward −y behind a face that looks +y): floor up to H metres back from a long edge, and a person standing there loses everything below the edge's top, vanishing completely within H − 1.7 m. It holds for low objects too: a 0.8 m belt or counter covers floor type 0.8 m behind it, a 3.2 m truck side hides people's legs up to 3.2 m behind it and whole people within 1.5 m, a glass wall or a wing hides type metres away. Keep type and the people who matter on the camera side of tall objects, or cut those objects down; check every frame in which a vehicle passes.
- A path that zigzags (turning at every vehicle or doorway) reads as noise; routes run along the world axes with few right-angle turns, and the walker or vehicle on them heads away from the camera (see the back-view pitfall below).
- A crowd folded into a serpentine reads as a solid block; one straight line reads as order. Numbers on the floor beside each person need spacing wide enough for the label (about 1 m).
- People walking toward the camera show a back view that looks wrong; route walks up-left, up-right or across.
- Seated people disappear behind high seat backs: keep backs low enough that shoulders show.
- Sorting boxes by their centre and people by their feet puts furniture over people (see §2).
- A generic shading helper that darkens faces toward grey or violet loses the look: derive every solid's three tones toward warm umber and paper yourself, and switch off any automatic white highlight on spheres.
- A simulated crowd sampled by rounding to frames steps on and off when replayed slowly; interpolate. Compressing a long process by moving people faster than ~6 m/s (0.2 m per frame) reads as teleporting.
- A camera move can drag a sign or a word across the frame edge, and background details (a far sign, a row of labels) can appear half-cut at the edge of another shot: anything meant to be read needs both ends of the move checked, and background text belongs only to its own shot. In a reel, check both ends against the safe box too.
- Check a crowd video frame by frame, not by eye: render every frame at 30 fps and list jumps, stop-start stepping and people standing closer than a body width, from positions each person reports as it is drawn (§10).

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **Canvas 2D, drawn from `t`, in metres.** x runs down-right on screen, y down-left, z up; depth toward the viewer is x + y + z. The camera only translates and zooms (k = pixels per metre, set every frame). Queue solids (box, prism on a footprint, cylinder along an axis, cone, roof) and flush them sorted; the queue sorts boxes by their centre and people by their feet, so a solid that should sort by its footprint gets a bias of −(z + h/2 − floor height). Inside a cut-away, draw solids immediately, between the back and front walls. A face can carry its own colour (a lit sign) or a decal (markings).
- **Tones and facets.** One function turns a colour into its three tones (top toward warm paper, +x face toward warm umber); any flat polygon in metres is toned by its outward normal, which is how fuselages, columns, lids and faceted spheres are made. A lid on any building is a faceted roof turned about its far edge.
- **Drawing on planes.** Markings, signs, windows and screens are drawn in metres on a plane: the floor (u = −y, v = +x), a wall facing +x (u = −y, v = −z), a wall facing +y (u = +x, v = −z).
- **Floor type.** Lay a phrase out once: position, start and end time, letter step, scale, and lines of [text, kind] (big ink, big accent, small, numerals). The first line's baseline lies along x = P.x and reads from y = P.y toward −y (up-right); its glyphs fill x ∈ [P.x − size, P.x], and later lines step toward +x. Keep the phrase's floor rectangle clear of solids and people (§4, §9) and report its screen box to the reading check. The letters land on the voice's word timings: the phrase starts on the word it names.
- **People and crowds.** A person is a billboard anchored at the feet (height, top, legs, optional skirt, long hair, case colour; a pose with walking phase, rolling case or case lifted overhead); a seated person is shoulders and head above a seat back. A new pose (a rider: the seated torso raised to a saddle, two leg quads swapping with the pedal phase) is built the same way, back view, flat parts in the top's three tones. Build the timeline from the narration lines' lengths, simulate the queue once at load, and sample it with interpolation. A new topic builds its own place (ground, markings, cut-away buildings), vehicles and machines (§2).
- **Checks and cues.** Each person reports its index, walking or seated, x, y and angle as it is drawn; a frame-by-frame pass at 30 fps lists jumps, stepping and people closer than a body width. In `cues.json`: one `tick` per lit place, `latch` on each lid or bin, `thock` on each sit or stow, `clean-ding` on the verdict number.

A minimal example: a lift lobby with two painted lanes, OFF FIRST on the floor, people stepping out of the car before the waiting line steps in.

## 11. Variation space

The agent decides the place, its cut-aways, the cast size, the rules and their order, the narration, the camera path, the pacing and the palette within the colour logic.

- Structures: one rule shown right once; the same group doing it two ways and compared (rewind between); a day in one place as five small rules; one thing travelling through several stops, one small rule each.
- A travelling topic is one way among others to stage, not a required form. One option: lay the stops along one continuous street, yard or hall, each a cut-away building or a marked stretch of the same ground, and join them with the travelling move, a run back along the path, or a cut on the beat at the same angle; keep each stop to one action and one floor phrase.
- Openings: the place empty, then people arrive; the title painted on the ground as the first person walks over it; a tilt down from the building to the room.
- Endings: the place empty again with the rule left on the floor; a scale jump out to the building; the last person stepping onto the outlined spot.
