# Silkscreen Travel Poster

> Opaque, hard-edged flat inks pulled one colour at a time through a screen: 4–6 inks per poster, stepped colour bands instead of gradients, thin paper-white gaps where the registration slips. Information is revealed the way the print is made: one layer, one beat. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only):
> - **1930s–40s WPA national-park screen prints**: 4–6 flat inks, lit and shade faces, stepped-band skies, a dark information band, concentric sun rings.
> - **Contemporary national-park print series**: restraint, paper as a colour, a series on one template with a new palette per poster.
> - **The physical process**: hinged screen, squeegee pushing an ink bead across mesh, split-fountain pulls, drag streaks, pinholes, off-register slivers.
>
> Never copy a real poster's composition, park name, lettering or logo, and never name a real agency.

## Formats

### Reel (1080×1920)

- **Layout.** Two templates, both tall. The **full-bleed print** at 9:16: art to every edge, a stepped-band sky on top with the name printed into it (y 290–480), planes stepping far → near down the frame, the darkest near ink filling the bottom third under the app's buttons; the info panel or ticket stub printed last, centred on x 540, at most 720 px wide, ending above y 1248. Or the **portrait sheet** on the table at about 720×1080 (x 180–900, y 160–1240), so its info band ends inside the safe box; table, screen and squeegee frame it. A dolly along a row of prints becomes a crane down the drying rack, the series wall a two-column grid.
- **The first 3 seconds.** Frame 1 is the squeegee mid-pull with a split-fountain bead, half the sky already in stepped bands, half bare paper. By 0.5 s the pull finishes and the name prints into the sky; by 3 s the accent ink (the sun, the route, the date) lands on a downbeat and the loose layers snap into register.
- **Length and pace.** 12–40 s, sized from the use-case table in §11: one ink per musical event, facts held chars ÷ 12 + 1 s after their last item, the final lockup ≥ 3 s.
- **Captions.** The poster text is the caption. With a voice, a printed strip (a band pull) in the language spoken, centred on x 540, at most 720 px wide, above y 1248.
- **Sound.** `hook-impact` on the first full pull's downbeat, `thock` as the screen drops, `latch` on the snap into register, `tick` for each dash of a printed route and each info item, `zoom-swish` for the diagonal re-ink. Squeegee on mesh, ink squelch, ambience and the hand-played score (guitar, banjo, upright bass, harmonica) come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. In the full-bleed print, the ticket stub and info panel end above y 950 (the player's controls cover the bottom 12 %), and headers stay inside the 5 % margins.
- **Length and structure.** 3–8 min as a destination series: each chapter is one poster (a place, product or event, 40–90 s), its layers pulled on the beat, the name printed into the sky as the chapter title, the info band printed last as its facts, then through a foreground silhouette into the next. Re-hook every 30–60 s: a palette re-ink, a snap before key facts, a crane through loose planes. The series wall closes the video. 24 fps.
- **The first 10 seconds.** The finished series wall first; the question as a printed strip by 5 s; the promise by 10 s. A channel sting comes after that.
- **Captions.** The printed strip burned in when there is a voice, plus an `.srt`.
- **Thumbnail.** One finished poster with its accent sun or route, the name in the sky: up to three words.

### Good for

Destination guides and city series, event and festival promos, product drops in colourways, trail guides, seasonal hours notices.

## 1. Essence, and what it is not

A **scene style**: it does a practical job (a guide, an event poster, a destination series) for any place, event or product with a few facts. See §11 for the jobs.

A poster being **printed on camera**. Every colour is an opaque ink laid by its own pull; later ink covers earlier ink completely. No halftone, no fluorescent ink, no line work: a shape's edge is where one flat ink stops. **Gradients are forbidden**: skies and haze are **stepped bands** (a flat colour, thinning stripes, the next colour).

What makes it read as silkscreen and not as flat vector art:
- **Registration**: every layer offset 1–3 px at 1080p; a knocked-out shape leaves a crescent of bare paper.
- **Overprint edge**: a faint multiply ghost ~2 u off under each ink, leaving a darker sliver where ink laps over ink.
- **Ink thickness**: a light rim top-left, a dark rim bottom-right, fills only; fresh ink has a wet sheen that fades within a second.
- **Paper**: cream stock with fibres; mottle and pinholes in paper colour, visible only on ink.

Not risograph (translucent fluorescent overprint with halftone grain), not ukiyo-e (key-block line work with bokashi), not woodcut (carved line), not low-poly (3D facets). This style is opaque, line-free, flat and banded.

## 2. Materials & rendering

- **One `Path2D` per ink layer**, filled in the current transform's units; knock-outs are holes in the path. Any shape can be printed.
- **Pull reveal**: a ragged squeegee front as a clip (a ~30 u drag tail); blade, bead and a sliver of handle ride on it.
- **Ink bead**: a round tube with lit half, dark underside, rolling glints and viscous strands; a split fountain puts several colours in one bead.
- **Screen**: a hinged frame with mesh, emulsion and tape; its shadow is a ring (even-odd), never a full rectangle.
- **Shapes**: ridges with a jagged lit facet, pines as one outline of drooping tiers, water as a flat body with glint bars. Hard edges everywhere.
- **Poster templates**: a portrait sheet (1000×1500 u: paper border, art area, a dark **info band** at the foot holding a name, a number, a rule and a row of stats; columns sized by content), or a **full-bleed print** (16:9, art to every edge, the name printed into the sky, a dark info panel such as a ticket stub printed last). In a full-bleed video the camera stays inside the print.
- **Texture budget**: fine paper tile, mottle multiply ~55 %, pinholes ~75 %, light encode grain. More reads as risograph.

## 3. Colour logic

- **One palette per poster, ≤ 6 inks**, assigned by role: light sky, deep sky / bands, far, mid, near (darkest; also the info band), and **one bright accent** (sun, route, highlights, key number). An optional lit-face ink.
- **Values step from far (light) to near (dark)**; depth is value, never blur.
- **The accent is rare**: the sun or light source, the one route or product, the most important number.
- **Paper is a colour**: an unprinted area is the brightest thing on the sheet (water, snow, a beam of light).
- **A series = one template, a new palette per item** (time of day, season, colourway, neighbourhood). Re-inking the same geometry in another palette is a statement.
- **Text inks are chosen by contrast** against the ink underneath (WCAG), never by a fixed key; a night palette must not swallow a header.
- Examples (sky1 → near, accent): dawn `#F6CD98 #EE9A73 #9A7FA8 #3E7079 #1E3B3F #FBE6B4`; harbour noon `#E8F0F2 #7FB3C8 #D9C7A3 #2F6E8E #173247 #E8553D`; winter `#EEF1F4 #B8C9D9 #8B9BB0 #4A5D78 #1F2A3C #F2B134`.

## 4. Type & subtitles

- **Condensed display** for names and values (e.g. Big Shoulders Display, League Gothic), auto-fit; a geometric sans for letter-spaced labels (e.g. Outfit 600).
- Headers are **printed into the sky**, tracked out; the info band is printed last.
- **The poster text is the subtitle.** No narration is needed; if there is a voice, subtitles are a printed strip (a band pull) in the spoken language, never a floating caption.
- **Reading rule**: each text stays ≥ chars/12 + 1 s (min 1.5 s) after its **last** item lands, and ≥ max(1.8 s, speech + 0.6 s) with a voice. Compute it from the content, round up to the beat.
- On a wall shot, labels stay ≥ ~18 px and values ≥ ~30 px at 1080p (about 28 px and 44 px in a reel); close-ups on a band keep the whole band in frame with ≥ 5 % side margins.

## 5. Motion quality

- **Pulls are linear and steady** (a squeegee does not ease). Accent inks start half a beat after the main ink of their layer.
- **Info items** print left to right on subdivisions of the beat. **There is no fade anywhere.**
- **Screen lift**: the frame hinges up (vertical squash + growing shadow) in ~0.4 s.
- **Palette re-ink**: a wide squeegee travels diagonally over the sheet in ~0.35 s; geometry identical on both sides of the blade, only the inks change. Show only the blade, bead and a sliver of handle.
- **Loose layers**: in a multi-plane move, planes parallax by depth with paper gaps and thickness shadows, then **snap into register** on one hit.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| Truck with the squeegee, slight roll, frame edge in view | the act of printing; colour arriving | a hook; a split-fountain sky |
| Locked top-down full sheet | layers stacking into a picture | watching a poster build; a comparison |
| Fast pull-back as the screen lifts | the reveal of a finished layer | a scene complete; a title |
| Push + tilt to the info band | reading | facts; a date; a price |
| Truck through a foreground silhouette (tree, lamp post, sail) in screen space | passing into the next poster | poster-to-poster transitions |
| Crane through loose planes (multi-plane parallax) | depth, a journey inside the print | a route; a climb; a street |
| Slow lateral dolly along a row of prints (a crane down the rack in a reel) | a set, a range | a series wall; colourways |
| Push into the mesh until the weave shows | the craft, the grain of the medium | an intimate beat; a detail |
| Log-zoom pull-back to the wall or window | the poster in the world | a final lockup (hold ≥ 3 s) |

Close-ups on a portrait sheet keep its edge in frame (a full-bleed print has no edge to show); a squeegee across a close-up is tilted with the handle hidden, so it doesn't split the frame. Layers change by squeegee, posters through foreground silhouettes, a diagonal sweep that prints the next poster behind the blade, or a table move. No dissolves, no bare cuts.

## 7. Sound palette

- **Acoustic, hand-played instruments**: strummed guitar, slide guitar, harmonica, upright bass, cajon or brushes, banjo, fiddle, accordion, harmonium, ukulele. Choose the family from the place: folk, surf, bossa or brass band all fit.
- **One pull, one hit**: each ink lands on a musical event (a strum, a hit, a chord change); accelerate by subdividing, not by changing tempo. A registration snap is a loud downbeat.
- **Foley by material**: squeegee on mesh (band-passed noise with a ~220–280 Hz mesh grain; faster = brighter), wet ink squelch, screen clack and hinge creak, paper stamps, ticks for dashed routes, paper hiss, a wood-and-metal clamp, drying-rack clips.
- **Ambience from inside the print**: a finished scene may "wake up" (surf, street, crowd), J-cut in and L-cut out. Room tone under the table.
- **Silence as a tool**: the music drops out for a beat before the key facts; what remains is one ambience, and the first sound after is a decisive gesture (a clamp, a long slide up).
- Music ducks a few dB under foley; a voice, if any, is one warm guide, unhurried, with the music under it. Master −14 LUFS.

## 8. Native moves

Each serves information order. A menu: use the ones your video needs.

- **One ink, one beat.** Facts print last, when they are read. *Fits content like:* museum hours; a ferry timetable; tasting notes.
- **Split fountain.** Several inks in one pull fill the frame with colour. *Fits content like:* a festival's night sky; a sunset beach bar; a rainbow of colourways.
- **Palette re-ink.** Same poster, another palette = time passing, a season, a variant. *Fits content like:* summer vs winter hours; three jacket colourways; day and night at a market.
- **Registration slip → snap.** Loose layers clamp into register with one hit, before the key facts. *Fits content like:* the date of a race; a launch price; a ticket sale opening.
- **Paper as a colour.** The unprinted sheet is the brightest element. *Fits content like:* a ski slope; a lighthouse beam; fresh snow on a roof.
- **The route as a printed layer.** A dashed accent line stamped segment by segment. *Fits content like:* a bus line; a marathon course; a delivery path.
- **The series wall.** Every print ends up hung together as the final lockup. *Fits content like:* a city's four districts; a band's tour dates; a product family.

## 9. Pitfalls of the medium

- Stroke edge effects draw internal lines on unioned paths → fills only (fill, then fill shifted inside a clip).
- A full-rectangle screen shadow muddies the print → ring shadow.
- Cool shadow facets next to water read as water → shadows in the near ink.
- Jagged ink beads read as paper edges → a round bead.
- Parallax alone reads as "the mountains are moving" → paper gaps and thickness while loose, snapped to zero with a sound.
- Silhouette wipes hold a dark blank → centre on the switch so full cover lasts ~1 frame.
- Very wide banners are slivers in 16:9 → about 4:1; in a reel, about 3:1, or two stacked lines.
- Random coloured dots on the table read as confetti → a real workbench (planks, grain, muted stains, tape).
- Too many items at honest reading times overrun the length → print items side by side in the same pulls, or let secondary ones be read on the final wall.
- An info band at the foot of a full-height reel poster sits under the app's buttons → print the facts as a stub or panel that ends above y 1248, and let only the near ink run below it.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D, drawn as a pure function of `t`. Each ink layer is a `Path2D` filled with its registration offset, an optional clip, a wet sheen that fades within a second and an overprint trap (the multiply ghost); thickness rims are the same fill shifted inside a clip, never a stroke. Paper tile, mottle and pinholes are generated once from a seed, mottle and pinholes masked to ink.
- A pull is a clip: a ragged squeegee front plus a ~30 u drag tail, advanced linearly from the pull's start to its end; the blade, the rolling bead (split fountain as bands within it) and a sliver of handle are drawn on that front. The screen frame lifts with a vertical squash and a ring shadow. Stepped bands are a helper that replaces every gradient.
- A poster is a list of ink parts in print order (sky bands, far, mid, near, accent, text, info band), at any print size; the same list re-inked with another palette is the re-ink. Loose layers are the same parts on parallax planes with paper gaps and thickness, snapped to zero offset on one frame. Text inks are picked per item by WCAG contrast against the ink underneath.
- Timing: with no voice, the music grid is the clock (each pull on a strum or hit, info items on subdivisions); with a voice, a fact prints on the word that names it and the pulls stay on the grid. Holds are computed from the content and rounded up to the beat.
- Cues in `cues.json`: every pull, the screen dropping and lifting, the registration snap, each route dash and info item, the re-ink sweep, the final wall.

## 11. Variation space

You decide the subject, the scenes and their planes, the palettes within the colour logic, the number of posters, the camera path, the opening, the ending, the instrument family and the length. Use cases are **grammar for the order and duration of information**; build your own timeline from the user's facts.

| Use case | Information order (print order) | Hold per layer | Length |
|---|---|---|---|
| **Trail / attraction guide** | place → per item: scene → name → difficulty → distance → time → footer | title ~3 s; name ≥ chars/12 + 1 s; stat row ≥ 2.2–3 s after its last item | 30–40 s, 3 items |
| **Event / festival poster** | scene pulls → headline → date → venue → call to action | headline 2.5 s, date + venue 3 s, final 3 s | 15–20 s |
| **Destination series** | one template, a palette per place: name → one fact → series wall | 2.5 s per poster + 4 s wall | 20–30 s |
| **Product drop** | layers around a flat product silhouette → name → colourway ×3 (re-ink) → price / date | 1.8 s per colourway | 12–18 s |
| **Seasonal / hours notice** | one poster re-inked per season → season + hours | 2 s per swap | 10–15 s |

Push past the obvious city-by-city journey:

- Structures: **one poster, many runs** (re-inked for each of four nights, the line-up changing in the band); **a street walk** (one multi-plane truck down a street, each shop sign printed as we pass); **a misprint story** (registration drifts until the last pull lands true on the date).
- Openings: **the empty screen** (light through a blank mesh, a stencil being exposed); **the accent first** (a lone product in the bright ink on bare paper); **the finished wall at night**, then back to the table.
- Endings: **the drying rack** (prints clipped in a row, swaying); **the poster in use** (pasted on a bus shelter, rain starting); **the last pull is paper** (the squeegee runs dry, leaving a white silhouette).

A new place is a new scene, built as ink parts in print order; reusing an earlier video's places or timeline is not a way to make a new one.
