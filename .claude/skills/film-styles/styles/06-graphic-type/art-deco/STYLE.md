# Art Deco

> Black lacquer, engraved gold line and airbrushed geometry: a 1930s poster that moves. Every composition has a centre axis, transitions open or close along it, and light arrives as bulbs switching on one by one. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): **A. M. Cassandre** posters (giant geometry, steep perspective, airbrush inside hard edges); **Chrysler Building / Rockefeller Center ornament** (setbacks, sunbursts, chevrons); **Busby Berkeley** overhead numbers (human kaleidoscopes); **The Great Gatsby (2013) title sequence** (gold line drawing itself on black); **Gershwin-era symphonic jazz** (clarinet, piano, muted trumpet). Never copy a poster layout, a real building, a character, a typeface design or a melody.

## Formats

### Reel (1080×1920)

- **Layout.** Deco is already vertical: towers, stepped arches, blade signs. The centre axis is x 540, so anything symmetric that must be read stays within ±360 px of it (x 180–900). A stepped title bar sits near the top of the safe box (y 290–450); the protagonist stands on the axis below it, filling at least a third of the frame height; the subtitle card unfolds from the axis with its bottom edge above y 1240. Below y 1248 lie the lacquer floor, mode-7 tiles and reflections, never type. Door leaves still split on the vertical seam. The low oblique along a marquee becomes a vertical blade sign lit top to bottom; the architectural section is a tall cutaway the camera rises through.
- **The first 3 seconds.** Frame 1 is a bulb sign with its first letters already lit, a sunburst behind it. By 0.5 s the next bulb ignites on the beat with its overshoot and relay chunk; by 3 s the doors split along the axis on a hit and the protagonist, in the one accent colour, stands under a dial that shows the deadline.
- **Length and pace.** 20–45 s: counted light on the beat, a threshold every 4–8 s, a dial or clock for the stakes, one drop to a single clock tick before the payoff.
- **Captions.** The lacquer subtitle card, in the language spoken, unfolding from the centre like every other title.
- **Sound.** `latch` for the knife-switch chunk as each bulb lights, `tick` for clocks and relays, `hook-impact` as the doors split on the first big hit, `sparkle` on a sheen sweep, `clean-ding` for the elevator and each milestone. The symphonic jazz (stride piano, clarinet glissandi, muted trumpet, harp) and the material foley (marble heels, bronze clang, a champagne cork) come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 2 as written; the subtitle card sits above y 950 (the player's controls cover the bottom 12 %), and title bars, dials and badges stay inside the 5 % margins.
- **Length and structure.** 3–8 min as a building or an exhibition: each chapter is a floor, room or pavilion behind a threshold door (40–90 s), titled by a stepped gold bar that unfolds from the centre and takes a sheen sweep; a floor indicator or dial carries progress across the whole video. Re-hook every 30–60 s: a door split, counted light, a Busby Berkeley overhead, a push-in on a dial, a pull-out to the cutaway. 24 fps, characters on twos.
- **The first 10 seconds.** The payoff first (the whole sign lit, the tower in a Cassandre tilt); the dial and the question by 5 s; the promise by 10 s. A channel sting comes after that.
- **Captions.** The card burned in, plus an `.srt`.
- **Thumbnail.** The protagonist in the accent colour under a sunburst arch, up to three words in Limelight on the gold title bar.

### Good for

Luxury and hospitality, galas and award nights, invitations and launches, countdowns, company histories, exhibition guides.

## 1. Essence, and what it is not

A world built from **gold keylines on warm black**, filled with **airbrushed hard-edged volumes** (Cassandre, Lempicka), organised around **one vertical axis**. Ornament *is* the picture: sunbursts are backgrounds, stepped arches are frames, a dial is a progress bar, a bulb marquee is a reveal. Motion is **mechanical and symmetrical**: things unfold from the centre, doors split along the seam, lights switch on in counted order. Native register: glamour with a clock ticking (an event, a deadline, a launch).

Not a gold-foil slideshow (things move and have volume), not Art Nouveau (no whiplash curves, no flowers), not a flat vector poster (volumes are airbrushed and rimmed), not a 60s spy title (no silhouettes on flat colour).

## 2. Materials & rendering

- **Ground**: warm lacquer black, never neutral grey-black; a night sky may drift toward a deep emerald near the horizon.
- **Gold is a banded metal gradient** (dark – light – hot – light – dark); animate its sheen offset for a light sweep.
- **The signature stroke**, the gold line: a dark engraved underline ~1.6 px wider than the line, the gold gradient line, and a hairline highlight on top. Optional glow and a parallel twin. Nothing gets a black cartoon outline.
- **Volumes**: hard edge + airbrush: a directional gradient from shade to light inside the shape, one consistent light direction (upper left by default), a thin gold rim on the lit side.
- **Motifs** (sunburst, stepped arch / ziggurat, fish-scale, chevrons, fan, four-point sparkle, speed lines, clock face, dial) are structural (a background, a frame, a transition), not stickers.
- **Perspective is real**: true one-point (mode-7 floors) and two-point perspective through a pinhole camera, so dolly, tilt and pan change perspective instead of scaling flats.
- **Characters are deco too**: about 7 heads tall, tapered streamline bodies, faceted lacquer planes (Lempicka), almond or arc eyes, a one-stroke nose, airbrush + gold rim. Give each lead one or two silhouette marks readable at a quarter of frame height.

## 3. Colour logic

- Three constants: **warm black ground, gold line and metal, ivory** for paper, gloves, light and type.
- **One saturated accent reserved for the protagonist** (or the one object the story follows). It is the only large saturated area, so the eye finds it in any wide shot. A cooler jewel tone may carry secondary surfaces, never competing in area.
- **The one-colour exception**: any single element can be drawn in its own colour through the same fill + keyline + glow while everything else stays gold.
- Always expand hex to six digits in code (three-digit hex breaks colour mixing).
- Examples of the triad (accent / jewel / metal): burgundy / emerald / gold; coral / sapphire / pale gold; jade / plum / rose gold.

## 4. Type & subtitles

- **Type (OFL)**: Limelight (titles), Poiret One (numbers, sign skeletons, plaques), Josefin Sans (subtitles, labels), Italiana (numerals).
- **Titles are architecture**: a stepped gold title bar over an arch or sunburst, optional badge and wings; drawn on in gold, then a sheen sweep.
- **Subtitle card**: one language, the one spoken, on a lacquer bar (~88 % black) with stepped ends like the title bar, double gold keyline, Josefin Sans SemiBold ~40–42 px ivory (~50 px in a reel, up to two lines), an optional small speaker icon per voice. It **unfolds from the centre** like every other title, so titles, subtitles and transitions are one system. Hold ≥ max(1.8 s, speech + 0.6 s).
- Numbers carry plot without narration: dials, clock faces, floor medallions, badges.

## 5. Motion quality

- **Characters step on twos (12 fps)**; camera, light, bulbs, gold draw-on and sheen run on ones (24 fps). A stepped camera reads as stutter.
- **Everything unfolds from the centre**: a point → a hairline → bars open symmetrically → text rises → wings and sparkle.
- **Draw-on follows the music**: a gold line grows at the speed of the phrase under it and lands on the hit.
- **Bulbs have an ignition overshoot** (~1.6× flash settling in ~0.18 s) and a relay "chunk"; once a sign is lit, a fast chase may run across it.
- **Mechanical easing**: doors, dials and hands move with firm ease-in-out and a small settle, like machinery; nothing floats.
- **Performance beats get anticipation** and escalation in threes (once, twice, mash).
- What never moves: the centre axis of a composition. Symmetry may rotate or open, but it never drifts off-centre.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Symmetric split (two door leaves hinged at the edges; or a revolving-door wipe) | a threshold crossed | a new place; a new chapter; a reveal behind a façade |
| Leaves sliding shut over the live shot | a door closing on a moment | leaving; a decision made; the end of an era |
| Extreme low-angle Cassandre tilt | scale and aspiration | a goal far above; a tower, a rocket, a monument |
| Architectural section (pull out to a cutaway of the whole building) | progress through a structure | climbing, descending, a process in stages; a company's floors |
| Busby Berkeley overhead, mirrored and rotating | people become pattern | a team, a release, a celebration, a system of parts |
| Push-in on a dial, medallion or clock | the number is the plot | a deadline; a count; a milestone |
| Match-cut on shape (circle → circle, ray → ray) | two places, one rhyme | jumping between departments, cities, eras |
| Low oblique along a sign or marquee | light travelling letter by letter | a name revealed; a launch; a score being counted |
| Pull back from detail to skyline | where the moment sits in the world | aftermath; a city-wide effect; scale |

Framing: the centre axis is sacred; an asymmetric frame must resolve to it within the shot. At an emotional peak the protagonist fills ≥ ~1/3 of frame height (smaller, the face reads as a prop in the ornament). Transitions: splits, revolves, arch openings, shape matches; never a generic dissolve or slide.

## 7. Sound palette

- **Symphonic jazz of the 1920s–30s, not a 60s big band.** Options: stride or concert piano, clarinet (trill; a glissando by time-varying resampling of a long note), strings (tremolo, rushes, pizzicato), muted trumpet commentary, trombone and sax section, walking pizz bass, brushes or sticks, tubular bells, harp glissandi, banjo, xylophone runs, celesta.
- Rhythm families to choose from: foxtrot, Charleston, tango, a slow torch-song ballad, a fanfare in the manner of a newsreel.
- **Techniques (options)**: one hit per unit of counted light; accelerate by dividing the beat; plant a theme in fragments so its full statement is a payoff; low-pass a band that is physically far away and open it as we approach; move a period narrator through acoustic spaces (horn, radio, PA, live mic) to make distance audible.
- **Foley by material**: brass clicks, bronze clang + chain, iron treads, marble heels, silver trays, wooden doors + spring twang, paper flutter, knife-switch "chunk" + filament hum, relay ticks, elevator ding, champagne cork.
- **Silence as a tool**: before the most important sound, drop to one small diegetic sound (a clock tick, wind) and cut back in with that sound alone.
- **J/L-cuts** carry architecture: the next room's sound enters a bar before its door opens.
- Mix: duck music ~−9 dB under voice (less under a period announcer who is part of the texture), beds −6 dB, master −14 LUFS, light film grain over the picture. Voice: one period announcer, crisp and warm.

## 8. Native moves

A menu: use the ones your story needs.

- **Counted light.** A bulb sign lights one letter per beat or per event, so the audience can count. *Fits content like:* the countdown to a product launch; the letters of a city name lighting as a train arrives; votes tallied into a winner.
- **Threshold doors.** Every scene change is a door split along the seam. *Fits content like:* the departments of a company; the rooms of a museum; stages of a career.
- **Machine kaleidoscope.** People or objects become a mirrored, rotating pattern that locks into a symbol. *Fits content like:* a team becoming a logo; gears of a supply chain; a choir becoming a clock.
- **Dials carry the plot.** A floor indicator, a clock or a gauge moves instead of narration. *Fits content like:* a funding thermometer; the altitude of a climb; a stock ticker at the opening bell.
- **The architectural cutaway.** Pull out until a building is a section and the protagonist a coloured dot with speed lines. *Fits content like:* data moving through a server stack; a letter through a post office; a skier down a resort.
- **Sheen sweep / draw-on.** Light crosses a gold object on a hit; a gold line engraves itself at the speed of a glissando. *Fits content like:* unveiling a trophy; a map route; a signature on a treaty.
- **The one colour.** One element keeps its own colour in a gold world. *Fits content like:* the one product among competitors; the patient among doctors; the new idea in an old firm.

## 9. Pitfalls of the medium

- Bulb signs from glyph skeletons break on curves (G, S, R): Zhang–Suen staircase pixels fool a neighbour-count junction test → use the **crossing number** and weld chain ends within ~14 px.
- A generic cartoon character looks pasted in → characters are deco (§2).
- Fish-scale reads as brickwork → lower half-circles row by row, each overlapping the previous row, plus an inner arc.
- Door leaves over a flat "interior" read as a blank frame → draw only the leaves, closing over the live shot.
- A gold point on pure black trips ffmpeg's `blackdetect` and the review's black-frame check → lift the background wedges and glow slightly.
- Period loudspeaker distortion is unintelligible under music → gentle drive; transcribe every line from the final mix to check it.
- A wide marquee or title bar shrunk into a reel turns to gold dust → stack it (a vertical blade sign, a two-line title bar), keep the axis, keep it inside x 180–900.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D, deterministic in `t`, with two clocks: characters step at 12 fps; camera, light, bulbs, gold draw-on and sheen run on every frame. Six-digit hex everywhere.
- A deco drawing kit that renders **any path in the deco manner**: the banded gold gradient with an animated sheen offset; the gold line (engraved underline ~1.6 px wider, gradient line, hairline highlight, optional glow and twin) drawn on by arc length; airbrushed volumes (directional gradient clipped to a hard edge, gold rim on the lit side); the motifs as parametric shapes; the one-colour exception as the same fill, keyline and glow in another colour.
- Type pieces: the stepped title bar with badge and wings, digits, badges, dial and clock, and the subtitle card, all unfolding from a centre point. A bulb-sign maker turns any text into bulbs: render the glyphs, thin them to a skeleton (Zhang–Suen), find junctions by crossing number, weld chain ends within ~14 px, space bulbs along the chains, and give each a lit time with its ignition overshoot.
- A pinhole camera for one- and two-point perspective: flats are cards placed in 3D and projected each frame, floors are mode-7 planes, so a dolly changes perspective rather than scale. Render model sheets and style frames from the same code before the full render.
- Draw-on speed is set from the phrase under it so the line lands on the hit; bulbs light on beats or on the words that count them; door splits land on downbeats. Cues in `cues.json`: each bulb's relay, each door split, each sheen sweep, dial ticks, the elevator ding.

## 11. Variation space

You decide the structure, the characters (or none), the settings, the opening, the ending, the camera path, the pacing, the accent colour and what gets counted. Push past the obvious night at a grand hotel:

- Structures: **the exhibition** (five pavilions of a world's fair, one idea of the topic behind each door); **the ocean liner** (three decks from engine room to ballroom, a horn per stage); **the trophy night** (nominees as sunburst panels, the winner revealed in light).
- Openings: **the machine room** (gold gears and pistons building to the first beat); **the engraved map** (a gold route crosses a continent before anyone appears); **the telegram** (ticker tape types the premise).
- Endings: **the lights go out** (letters switch off in reverse until one bulb remains); **the dawn** (lacquer black warms to a pale sky); **the poster** (the last shot flattens into a printed poster with a date).
