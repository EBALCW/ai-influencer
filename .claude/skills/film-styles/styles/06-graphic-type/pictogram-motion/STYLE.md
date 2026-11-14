# Pictogram Motion

> A beat-locked video built from three things only: a **square-grid "core graphic"** of circles, half-discs and tiny patterned cells whose rows slide past each other; **geometric pictograms** (objects, vehicles, weather, signs, and a disc-headed figure when one is needed) made of round-capped bars, discs and capsules; and **bold type** that slides up out of masks. Every cut lands on a drum hit. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Otl Aicher's 1972 Munich pictograms (geometric athletes); multi-sport-games "look of the games" identity systems (a modular pattern + a colour set used for everything); Swiss sports-broadcast graphics (mono meta text, tick-bar progress). Learn the grammar; never copy any real event's pictograms, emblem, slogan, pattern artwork or colour names, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The pattern bleeds to every edge on the same 180 px cell (six columns across). The 16:9 side-by-side becomes a stack: the stage (sun disc and hero pictogram) on top, about y 300–820; the title block under it (y 860–1130), auto-fitted to 828 px; the HUD's mono meta and its N-tick progress bar along the top of the safe box (y 269–300), since the bottom corners lie under the app's buttons. Below y 1248 only pattern. Lateral tracks become vertical scrolls by grid rows, splits run along a horizontal grid line, the icon wall is three columns wide.
- **The first 3 seconds.** Frame 1 is mid-action: the hero pictogram already doing its verb on its disc over a full-contrast pattern. On the first beat (by 0.5 s) the rows shift one cell and the title slides up out of its mask; by 3 s the count lands ("ALL 24") and the progress bar shows how many cards are coming.
- **Length and pace.** 20–45 s at one tempo: one bar per card, half-bar runs for sub-families, one bar per chapter card, half a beat of muted drums before the big hit. Read cards hold ≥ 1.6 s.
- **Captions.** The card type is the text layer. With narration, a band in the chapter's darkest tone, in the language spoken, centred on x 540, at most 720 px wide, bottom edge above y 1240, never over the title.
- **Sound.** `hook-impact` on the first downbeat, `ui-pop` as a pictogram snaps into register and for tag chips, `zoom-swish` for whips, `tick` for progress ticks and a rolling count, `sub-impact` for the count-up slam after the silence. The percussion spine (frame drums, taiko, steel pans), plucks and mallets, and each chapter's matter hits (splash, clank, sizzle) come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Section 2 as written: one text column, one stage. Keep the bottom HUD corners and the caption band above y 950 (the player's controls cover the bottom 12 %).
- **Length and structure.** 3–8 min as a catalogue in chapters: each chapter is one hue (40–90 s), opened by a full-contrast pattern card with its name; the progress bar spans the whole video, so the viewer always knows how far in they are. Read cards may take two bars. Re-hook every 30–60 s: a new hue, a pace-ladder run, a long take down a track, a count-up slam, a push into one motif cell. End on the icon wall. 24 fps.
- **The first 10 seconds.** The icon wall of everything first; the count by 5 s; the promise by 10 s. A channel sting comes after that.
- **Captions.** Card titles are burned in; export the narration and the card titles as an `.srt` from the edit list.
- **Thumbnail.** One hero pictogram on its sun disc over a full-contrast pattern, with the count, up to three words.

### Good for

Public services and city guides, brand and event identity, catalogues and menus, how-to steps, sports explainers, year-in-review roundups.

## 1. Essence, and what it is not

Either a **catalogue video**: N items (products, dishes, steps, species…) shown one card at a time, fast, on the beat; or a **story told in pictograms**: one pictogram as the hero (an object, a vehicle, a sign as often as a person), a goal, a turn, an ending, told through the same cards, walls and transitions. Each card = **one pictogram doing one action + a huge title + a heavy second line + a mono index "07 / N"**. Cards group into chapters; each chapter owns one hue, opened by a full-bleed pattern card.

What makes a frame read as this style at a glance:
1. **The grid pattern**: big discs and half-discs spanning square cells, about half the cells carrying a small motif, all in **five tones of one hue**, with **whole rows cut and shifted sideways**: the signature that drives backgrounds and transitions.
2. **The pictogram set**: objects, vehicles, weather and signs, and a human figure only when the video needs one, all flat and built from the same geometry: round-capped bars, discs, half-discs, rings, capsules. Pictograms combine and turn into one another (a canopy is a half-disc of the pattern, a clock face is the stage disc). A figure, when used, is faceless, rounded bars and a disc head, far-side limbs mixed toward the background.
3. **Type as architecture**: a 900-weight grotesk title set very large, a heavy second line under it, small mono meta text in the corners like a broadcast HUD.
4. **Beat lock**: every shot starts on a beat, every key action lands on a beat.

Mood: premium broadcast identity; flat colour, light grain, one soft light sweep as the only gradient.

Not an isometric infographic (no depth, no 3D), not Swiss motion graphics (the pictograms and the pattern carry as much as the type), not a cartoon (pictograms never emote, figures have no faces), not a data video (numbers are labels, not charts).

## 2. Materials & rendering

- **Flat Canvas2D**, rendered clean; light grain added last, over the whole frame. **One square grid** (cell ≈ 1/6 of the frame height in 16:9, 1/6 of the width in a reel: 180 px either way) rules bands, transitions and walls.
- **Pattern model**: fill with a mid-dark tone; on grid nodes randomly place cell-radius discs in random tones and discs-with-inner-discs; then a fraction of cells get one motif from a library of generic geometry (quarter-discs, fish-scale waves, dot and triangle scales, concentric arcs, sun wheels, checkers, crescents…), rotated by multiples of 90°; never mascots, landmarks or logos. Draw it wider than the screen so any row can shift one cell.
- **Pictogram model**: one stroke weight family per video (round caps), solid fills, at most two tones per pictogram (a darker gore, a far side). Objects keep their silhouette at icon size; anything that cannot be read as a sign at 60 px is cut.
- **Figure model** (optional): unit = body height, origin at the hip; draw far limbs (mixed ~40 % toward the background), torso, near limbs, head. A second person sits behind, mixed further (~60 %). People can also appear only through their traces (footprints, a queue of feet).
- **Stage**: the hero pictogram (any object or figure) sits on a large **sun disc** in a neighbouring tone, crossed by one faint light sweep.
- **Environments** (water, nets, ramps, rails, rain) live in the hero's own buffer, masked to zero before the text column.
- **Frame rate**: 24 fps (30 in a reel); motion blur by sub-frame averaging only inside transitions, whips and fast camera moves.

## 3. Colour logic

- **A set of five hues + one dark neutral**, each hue in **five tones** (darkest → lightest, the middle one is the base). A chapter = one hue; a multi-hue chapter rotates through the set per card.
- Under type the pattern runs at **low contrast**; on chapter cards at **full contrast**.
- **Light hues take dark type and dark figures**, and their disc uses the lighter tone; dark hues take cream. On the dark neutral, the disc uses a lighter tone or it vanishes; its accent is one warm hue.
- One cream and one ink serve every hue. No outlines, no highlights except the sweep.
- Choose the set from the topic. Examples: warm festival (red, violet, forest green, gold, ochre); coastal (navy, teal, coral, sand, sky); kitchen (tomato, basil, saffron, aubergine, flour cream). Invent names for your hues; never borrow an event's colour names.

## 4. Type & subtitles

- Title: a 900-weight grotesk (e.g. Inter Tight), 150–330 px at 1080p (up to the 828 px measure in a reel), tight tracking, auto-fitted. Second line: the same family, heavy, about a third of the title's size: what the item does, or its number. Meta: a mono (e.g. DM Mono) ~22 px (~30 px in a reel), wide tracking; tags as mono chips.
- **HUD** on every card: mono corner text and a **progress bar of N ticks** (current tall, done dimmed, rest faint), N derived from the item list.
- **One language**, the one spoken (or the user's, with no voice): titles, second lines and captions all in it. A new language is a new version generated from the item list by a switch, never by hand-editing cards.
- The card type *is* the text layer. With narration, captions are one or two lines in a heavy face on a solid band in the chapter's darkest tone (an ink band on light hues), bottom left in 16:9, never over the title; hold ≥ max(1.8 s, speech + 0.6 s). A card that must be read (a spec, a number) holds ≥ 1.6 s.
- Deliver an `.srt` of the title cards, generated from the edit list.

## 5. Motion quality

- **A grid of time**: pick one tempo for the video; every shot starts on a beat and every key action in a pose (release, contact, landing) lands on an integer beat.
- **Pace ladder**: normal cards last one bar; related sub-items become half-length rapid-fire runs. A second tempo comes from dividing the beat, never from changing tempo.
- Easing: exponential ease-out for entrances, exponential in-out for whips and wipes; a back ease once at most.
- **Type enters by mask slide-up**: title first, second line ~0.08 s later, tag after; meta lines type on without a caret. Short cards compress all timings.
- **Pictogram assembly**: the hero pictogram and its stage arrive as horizontal bands sliding into register from alternating sides.
- **Backgrounds breathe**: rows drift in alternating directions; on chapter cards they jump a quarter-cell on beats.
- **Transitions** snap to the grid: sliding rows, dropping columns, a push, quarter-discs from cell corners, an iris from the last figure, a tile flip. Rotate them; each lasts a few frames around the cut.
- **Motion blur only where things move**: sub-frame averaging inside transition and whip windows; static frames render once.

## 6. Camera grammar

Mostly a locked flat frame; energy comes from row shifts, transitions and figure actions. When the camera moves, it moves along the grid. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Locked flat frame | clarity, the card as a poster | any item; a spec that must be read |
| Lateral track with a one-screen whip per beat | one continuous family, momentum | a line of stations; a production line; a route |
| Slow drift along a row | calm, browsing | a gallery; a menu; a slower chapter |
| Vertical scroll by grid rows | ranking, depth, descent | a top-ten; floors of a building; ocean depths |
| Push into one motif cell until it becomes the next frame | zooming into a part | an ingredient inside a dish; a city inside a map |
| Pull back to a tiled wall of items | the whole set at once | a summary; "all of them"; a comparison |
| Tiles collapsing to one point | many become one | a merger; a shared goal; a count reaching zero |
| Split screen along a grid line | two items side by side | versus; before/after; two versions |

Framing: text and figure never overlap (one text column, one stage; in a reel, stage above, title below); horizontal poses move the stage outward. The HUD stays in the corners (the top ones in a reel). Allowed transitions are the grid ones in §5; never dissolves, 3D camera moves, handheld shake or depth of field.

## 7. Sound palette

- **Type and music can carry the video alone**; a voice is optional, calm, one or two lines per chapter.
- **Percussion is the spine**: choose a drum family that suits the topic (frame drums, taiko, marching snares, steel pans, body percussion, an electronic kit) plus rim clicks, claps, shakers and crashes.
- Colour instruments on top: Karplus-Strong plucks (any lute, koto or harp-like voice, with pitch bends), mallets (marimba, glockenspiel), detuned-saw chord stabs, a synth bass, pads, risers and a drone.
- **Per-family accents**: every shot onset gets a hit chosen by chapter (a splash, a pok, a clank, a crack, a whoosh, a sizzle): foley reads the chapter's matter.
- **Picture-locked by data**: the score reads the edit list's shot times and places accents there; check every onset to ±15 ms.
- **Silence as a tool**: half a beat of drums-and-bass-muted before a big hit, or one whole bar stripped to a single ticking sound under a count.
- Mix: glue compressor and limiter, master −14 LUFS, ≤ −1 dBTP.

## 8. Native moves

A menu: use the ones your video needs.

- **One card = one item.** The count is the hook ("ALL N"). *Fits content like:* every tool in a workshop; every station of a subway line; every dish of a regional cuisine.
- **Chapter = colour.** Families become hues so the viewer always knows where they are. *Fits content like:* instrument sections of an orchestra; food groups; departments of a company.
- **One verb per item.** One body action readable in a bar, or a prop action (a gear turns, a cup pours). *Fits content like:* yoga poses; kitchen techniques; jobs on a construction site.
- **Pace ladder run.** A sub-family at double speed. *Fits content like:* four knife cuts; the bones of a hand; weekday routines.
- **Long take down a track.** Stations one screen apart, the camera whipping on each cut. *Fits content like:* the steps of a recipe; checkpoints of a marathon; stages of a rocket launch.
- **Count-up slam.** A big number rolls to its value on a bar. *Fits content like:* tonnes recycled; members of a club; years of a company.
- **Icon wall.** All pictograms return as a grid and turn one colour. *Fits content like:* a summary of a year; a periodic table of habits; a team roster.

## 9. Pitfalls of the medium

- Figure environments spread into the text column → render the figure layer into its own buffer and fade it out with a gradient mask before the text.
- Cream on light hues fails contrast → dark type and dark figures on light hues; their disc is the lighter tone.
- The sun disc vanishes on the dark neutral → use a lighter tone for it.
- Pattern canvases are large and seeded per card → cache with a bounded LRU; an unbounded cache runs out of memory with parallel renderers.
- Horizontal poses (swimming, lying, crawling) cross the title → move the stage outward and narrow the text column.
- Imitating a real identity too closely → your own palette, mark and slogan from the grid motifs.
- The HUD in the bottom corners of a reel sits under the app's buttons → move meta and the progress bar to the top of the safe box.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D, drawn as a pure function of `t` from a shot list in seconds on the beat grid. Every shot starts on a beat; the progress bar, the HUD, the captions and the grid transitions are all derived from the same item list.
- A seeded pattern generator: discs, discs-with-inner-discs and motif cells on the grid, five tones of one hue, drawn wider than the screen; rows are offset as whole rows. Seed per card and keep the canvases in a bounded LRU cache, so parallel renderers stay in memory.
- A pictogram library from one geometry (round-capped bars, discs, half-discs, rings, capsules): weather (drop, cloud, sun, moon, bolt), traces (a foot), a generic item, and the topic's own objects; an optional figure rig with hip origin and far limbs mixed toward the background. Each hero draws into its own buffer, masked to zero before the text column.
- Mask slide-up text with exponential ease-out; motion blur by averaging a few sub-frames (`t + k / (n · fps)`) only inside transition and whip windows, a single draw everywhere else.
- Cues in `cues.json` from the same shot times: an accent per onset chosen by chapter, the whips, the count-up slam, the progress ticks; check each to ±15 ms. With a voice, place lines between beats on their word timings and let cards hold for them.

## 11. Variation space

You decide the items, grouping, verbs, palette, chapter order, any long take, the pace ladder, opening, ending, music and voice. Push past the first idea the item list suggests:

- Structures: **a countdown** (items ranked from N to 1, the camera scrolling down rows, the pace speeding up as the list shortens); **a day in pictograms** (one figure, one card per hour, the palette moving from dawn to night hues); **an assembly** (each card adds one part to a single growing pictogram machine seen in the corner).
- Openings: **a single motif cell** (one cell fills the frame and splits into the grid); **mid-action** (the first pictogram is already running when the type slams in); **a blank grid** (hairlines draw the grid on the beat before any colour appears).
- Endings: **one card held long** (the last item stays while the pattern rows stop, one by one); **the figure walks off** (the last pictogram exits the frame and the HUD ticks out); **reverse assembly** (the grid disassembles into rows that slide off-screen, leaving cream).
