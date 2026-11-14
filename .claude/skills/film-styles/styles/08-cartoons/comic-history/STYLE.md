# Comic History Cartoon

> Felt-and-card puppets stand on a printed school-atlas map and fight over a piece of it: a patch of coloured paper is slapped on, torn off, pasted over, folded and stacked, while a narrator states the facts and the puppets only shout. Comic panels lie on a table and a page camera moves between them, one era per panel. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): nineteenth-century serio-comic war maps (the map as a stage, nations as broad types); 1970s cut-out animation (hinged limbs, head swaps, the snap of a part landing); felt-and-card craft television (soft paper edges, small shadows); classroom wall atlases (letter-spaced engraved names, coast ripples, the compass rose); newspaper comic pages (panels, gutters, balloons, caption boxes). Never copy their characters, layouts, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The comic page becomes a column of full-width panels (1080 wide, 1200–1920 tall, 60 px gutters); the page camera travels down it.

| Zone | Position | Content |
|---|---|---|
| Map | full bleed | turned and scaled so the contested patch sits near x 540, y 760 |
| Year tag | x 72, y 280, 120 px tall | year and one line of context |
| Balloons | y 330–720, inside x 72–900 | at most three words, tail to the mouth |
| Puppets | y 900–1900, bleeding off the bottom | about 0.5 scale; faces above y 1248, feet may fall below |
| Caption box | centred on x 540, ≤ 720 px wide, bottom edge y 1230 | narration, one or two lines |

  When two rivals must face each other, stack them above and below the patch rather than shrinking them under 380 px tall.
- **The first 3 seconds.** Frame 1 is already the map with a puppet mid-hop into frame (first landing by 0.5 s); scissors or a hand reach the patch by 2 s; the patch is slapped down with a shake and an ink-tick burst by 3 s.
- **Length and pace.** 30–45 s; three or four panels, one change of hands each; a gag every 2–3 s (hop, head swap, balloon, stomp), a page move every 6–10 s.
- **Captions.** The caption box is the only caption layer; balloons are dialogue, not subtitles.
- **Sound.** `hook-impact` on the first slap, `thock` on every patch or stamp that lands, `ui-pop` on balloons and year tags, `zoom-swish` on page whips, `latch` on a pin, `clean-ding` on the closing card. Tuba, trombone, accordion, xylophone, woodblock, low strings and timpani from a free sample library such as the [VS Chamber Orchestra Community Edition](https://github.com/sgossner/VSCO-2-CE) (CC0).

### YouTube (1920×1080)

- **Layout.** Section 2 as written: the caption box ends at y 940, above the player's controls; year tag and balloons stay inside the 5 % margins (x 96–1824, y 54–1026).
- **Length and structure.** 3–8 min. One chapter is one page of four to six panels: open on the whole page from above, push into panel one, travel panel to panel, pull back to the full page at the chapter's end. Re-hook every 30–60 s with a new act on the paper (slap, rip, fold, pin) and a new year tag; the chapter title is printed in the page's top margin and read by the camera on the way in.
- **The first 10 seconds.** The strongest image first: the finished stack of patches seen from the side, or two puppets mid-shout over the patch. The question by 5 s ("who actually owns this strip of land?"); the promise by 10 s (who owned it, and who never left).
- **Captions.** Burned-in caption boxes are part of the look; export the narration as `.srt` too.
- **Thumbnail.** Two puppets glaring over the patch, one balloon of at most three words, the year tag in the corner.

### Good for

Border and territory history, mergers and turf wars, market-share fights, who-owned-what explainers, rivalries told for laughs.

## 1. Essence, and what it is not

1. **The map is the stage and the prize.** Countries, companies or teams are printed areas; the thing fought over is a separate paper patch with a cream card margin that can be lifted, torn, pasted, folded and stacked.
2. **Puppets are cut-outs with hinged joints**: felt-and-card bodies, brass rivets, swapped heads for expressions, moving on twos. Each side is a broad type in costume, never a likeness of a real person.
3. **Facts in the narration, jokes in the balloons.** The voice states dates and outcomes plainly; the puppets only shout one to three words.
4. **Every change is a physical act on paper** with its own sound: snip, slap, rip, press, curl, pin. Nothing changes colour by itself.
5. **One serious beat.** One panel drops the gags: cold light, no comic sound, a faceless hand instead of a character.

The puppets are drawn by an image model: the look needs an image model the user brings, generating part sheets on flat chroma green. Without one, draw them in code as flat card shapes (Path2D bodies with a 7 px cream outline, brass-gradient rivets, two or three head drawings each).

Not **3D Map Explainer** (no terrain, globe or data layers; the map only changes by hand). Not **Paper Pop-up Book** (nothing folds up into scenery; paper stays flat). Not **Shadow Puppetry** (full colour, lit from the front, no screen). Not **Vintage Engraving Collage** (no photo or engraving cut-outs; only flat craft paper).

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Map | full bleed | printed atlas, the contested patch near the centre (x 860–1060) |
| Year tag | top left, x 96, y 54, 136 px tall | big year + one italic line |
| Context strip | 146 px below the tag, 52 px tall | a treaty, deal or date, taped at both ends |
| Puppet A | left third, neck near x 420, y 490 | about 700 px tall |
| Puppet B | right third, neck near x 1450, y 490 | the rival, facing in |
| Balloons | y 80–330, above the speaker | one line, tail to the mouth |
| Compass, scale bar | x 1540–1880, y 880–1030 | printed into the map; picture, not must-read |
| Caption box | bottom centre, bottom edge y 940, 108 px tall | narration |

Plan the projection and zoom so the patch has clear ground on both sides, and print place names where puppets and balloons will not stand. Narrow panels (720×1080) hold one close moment (a stamp on an ID card, a house) and sit at the right of the screen with the previous panel still visible on the left, so the table is never empty.

## 3. Materials and rendering

- **Paper texture, generated.** Mid-grey base; about 900 soft radial blotches (20–170 px, 3–6 % black or white); about 6000 short curved fibres (4–24 px, 0.6–1.5 px wide, 4–11 %); per-pixel noise ±11. Lay it over printed surfaces in `overlay` at 55–60 %, over plain card in `multiply` at 25–35 %.
- **The printed map.** Flat sea; coastlines ringed by six alternating strokes in two close blue-greys (9 px steps); a dashed graticule every 5° at 20 % ink; flat country fills with a 12 px cream inner glow (20 %) clipped inside; borders 1.3 px at 50 % brown, coast 2.2 px. Bake once at 1.25×. Geometry from Natural Earth; maps follow [directing](../../../references/directing.md#maps).
- **The patch.** A separate piece baked at 2.5× for close-ups, in its owner's colour one step off the printed country so it reads as new paper on old print; a 4 px dashed border inside (7/6 dashes), the region's name in cream small caps, and an 8 px cream card margin made by stamping the shape 24 times in a ring.
- **Lift is shadow.** Glued: 3 px blur at (3, 4). Held up: 33 px blur at (33, 48), and 8 % larger. Torn edges get a 7 px cream fibre line and a 1.2 px brown line.
- **Puppets.** Parts keyed by green dominance (g − max(r, b)) with a smoothstep alpha and despill, then given a 7 px soft paper edge. Arms are two-bone IK chains; heads swap between neutral, angry, smug and surprised; hats ride the head top with their own wobble. Each part casts a small shadow (6 px blur, offset 3, 4), the assembled puppet one big one (20 px blur, offset 13, 19, 42 %).
- **Props in code.** Scissors, stamps, pins, houses, ID cards, a giant hand: Path2D shapes with a 7 px cream outline, flat fill, brass rivets as radial gradients (`#FFF1BF` → `#D9B158` → `#7A5A1E`).
- **Page and table.** Each panel is its own canvas, framed by a 6 px ink border, on a cream page with a soft shadow, on a brown table. Everything inside a panel is world-anchored; screen grain goes on last. A warm radial vignette (24 % at the corners) closes every frame.

## 4. Colour logic

- Each side owns one hue: its printed country, its patch and its puppet's accent. Two hues far apart but equally muted (a soft blue against a slate grey works; never pure red against green).
- Neighbours are dusty mid-value pastels (mustard, sage, terracotta, sand) so the rivals stay loudest; the sea is one pale blue-green.
- A new patch is always one step lighter or deeper than its printed country.
- Red only for shouts and scissor handles; brass only for rivets, buttons, epaulettes. Ink is warm near-black, paper is cream; never `#000` or pure white.
- The serious panel is multiplied by a cool grey (`#BAC2CD`) with edges darkened to 50 % navy; its shadow spills onto the neighbouring panel.

Example palette: paper `#F1E8D2`, ink `#2B2219`, side A `#6E93D6` (patch `#5A80CC`), side B `#5D6672` (patch `#7A8390`), sea `#A6CCD3`, neighbours `#E2B85A` `#8DB56F` `#D9705F` `#E9CF83` `#C98A86`, red `#C8463A`, brass `#D9B158`, caption box `#F5E9C4`, table `#7B6A57`.

## 5. Type and captions

All faces are SIL OFL Google Fonts.

| Role | Face | Size (16:9) | Rules |
|---|---|---|---|
| Place names | IM FELL English SC | 50 px subject, 20–34 px others | tracked 3–13 px, ink at 86 %, rotated −3° to −10° with the land |
| Seas | IM FELL English Italic | 24 px | blue-grey at 55 % |
| Year | Old Standard TT Bold | 62 px | lining figures, a 1.2 px rule under it |
| Context, caption box | IM FELL English Italic | 26–29 px | warm brown `#5A4A3A` |
| Balloons | Lilita One | 64 px | upper case, one line |
| Every digit | Old Standard TT | matches the text around it | the engraving face's old-style figures misread (a 1 looks like a small-cap I) |

- **Caption box.** `#F5E9C4`, 3 px ink border, soft shadow (10 px blur, offset 4, 6), 108 px tall; it rises 18 px while fading in over 0.14 s and fades out over 0.1 s. Hold each box ≥ max(1.8 s, spoken line + 0.6 s). One language: the spoken one.
- **Balloons** belong to the world: cream `#FBF6EA`, 4 px ink stroke, 50 px corner radius, rotated −1.5°, popped in with the rivet spring. A shout gets a spiky outline (18 points, radii alternating 1.0 and 1.18).
- **Year tag.** A `#F3EAD6` slip with a double ink frame (2 px at 9 px inset, 1 px at 14 px); it drops 220 px into place over 0.22 s with a back ease, turning from −9° to −1.4°. The context strip slides in from the left over 0.25 s and gets two translucent tape pieces.

## 6. Motion

- **Frame rate.** YouTube at 24 fps, reels at 30 fps. Puppets, ink ticks and flecks step on twos (`ts = Math.floor(t * 12) / 12`); the page camera, shakes and paper lifts move every frame, so the world feels handled and the characters animated.
- **Easing.** Cubic in-out for the camera, cubic out for arrivals, back (overshoot 1.7) for slips and tags, and a rivet spring `1 − e^(−5.5u)·cos(3.1πu)` over 0.17 s for anything that pops in.
- **Weight.** Puppets enter in hops 0.5 s apart, heights falling 52 → 46 → 38 → 26 px. Hats lag with a damped wobble (5 Hz, decay e^(−7t)). Impacts shake the camera: 15 Hz, decaying e^(−11t), 8–24 px, with a roll of 2 % of the amplitude in radians.
- **Impacts on paper** add nine radiating ink ticks (three drawings over 0.25 s) and 14–22 paper flecks falling under 700 px/s² gravity for 0.75 s. Fast swings leave three to five curved smear lines.
- **Appear and leave.** Puppets pop up from the paper or hop in from off-frame and leave by hopping off or by the camera moving on. Patches arrive held up and land on a slap.
- **What never moves**: the printed map, its labels, compass and scale bar. Only the camera and the paper laid on top move.

## 7. Camera

| Move | What it expresses | What it can serve |
|---|---|---|
| Pull back (zoom 1 → 0.6, 0.45 s ease-out), slide to the next panel (0.55 s) | a page turns | a new era, a new owner |
| Whip across the gutter with speed lines (0.6 s; 26 ink lines, 180–600 px, re-seeded 24 times a second) | a sudden reversal | "and then it flipped again" |
| Drop down the page (ease-in to 0.66, ease-out into the panel, 0.7 s) | sinking into heavier times | the serious panel |
| Push-in on the patch (up to 2.3×) | the ground up close | a press, a fold, a stamp |
| Crane to the side (1.4 s, zoom 1 → 1.85, map squashed to 38 % height) | history as layers | every patch stacked, 22 px thick each |
| Shake | impact | slaps, thunks, the giant hand |
| Pull back to the whole page (0.7 s) | everything at a glance | the ending, a chapter recap |

Zoom interpolates in log space. Allowed transitions: page moves, whips with speed lines, a hard cut to a new page. Forbidden: dissolves, 3D flips, handheld drift, zooming past a bake's resolution.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Voice | one dry, amused narrator | about 10 dB over the music, whose 300 Hz–4 kHz band ducks further under speech |
| Music | 120 BPM, a bar every 2 s, bright major key; each side has an instrument accent (tuba-and-trombone oom-pah for one, accordion musette for the other) that plays when it acts; xylophone and woodblock under hops; the serious panel drops to low strings in a minor key and a slow timpani; the ending plays both accents in one tune | ducked |
| Foley | paper slap, snips (0.25 s apart), crinkle, rip, slide whistle on falls, puffs from a stomp, joint clicks, a page slide on every page move, a metal ping on helmets and pins, stamp thumps | one per visible act |
| Silence | the serious panel has no comic sound | |

Pack ids as in Formats; paper foley synthesised or from a free library. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **The slap.** A held patch swings down; on contact its shadow snaps to 3 px, the camera shakes, ink ticks burst, flecks fly. Fits content like: an annexation; a hostile takeover; a new rule pasted over an old one.
2. **Print the line, then cut.** A dashed ink line (13/9 px) draws itself along the border, then scissors snip along it, leaving a cream torn edge. Fits content like: a treaty line; a spin-off; splitting a budget.
3. **Rip and fling.** A puppet tears the rival's patch off and flings it, knocking the rival's hat off. Fits content like: a reversal; a comeback; a lost court case.
4. **The stamp on a person.** A narrow panel: a civilian's ID card, a stamp comes down, the civilian's head swaps from smile to worried. Fits content like: citizenship changing; a policy landing on ordinary people; a forced rebrand.
5. **The faceless press.** A dark paper hand with no insignia comes from above and presses a patch flat; later the patch curls at a fold. Fits content like: an occupation; a monopoly's squeeze; a crisis.
6. **The stack from the side.** The camera cranes down until every layer pasted on the patch shows, each 22 px thick in its owner's colour. Fits content like: repeated changes of hands; years of reorganisations; layers of regulation.
7. **The one who stayed.** On top of the stack the civilian from an earlier panel pops up again and a pin goes into the map beside them. Fits content like: residents through every regime; a long-serving employee; a family business.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas, drawn as a pure function of `t`: puppets read `twos(t)`, the page camera reads `t`. A key-frame helper `K(t, [[t0, v0], [t1, v1, ease]…])` drives every value from a `T` table of named times (slap, rip, press, tilt).
- Puppets need an image model the user brings: one part sheet per character (16:9, parts spaced out on flat chroma green, four head expressions), keyed and cut into PNGs with an index, plus a `RIG` table of neck, shoulder, hip and hat pivots. Without one, draw the puppets in code as flat card shapes with cream outlines and brass rivets.
- Bake map (1.25×), patches (2.5×), paper textures and a taller map for any crane once at load; per frame draw only bakes, puppets and effects. Seed every random choice; speed lines re-seed from `floor(t × 24)`.
- Each panel is a `scene(t)` drawn into its own canvas; a `PANELS` table holds page positions and each panel's clamped local time; a `PCAM` key list drives the page camera. When the camera rests exactly on a full panel, draw only that panel.
- One sound event per visible act (`hop`, `snip`, `slap`, `rip`, `stamp`, `press`, `curl`, `thunk`, `pin`, `whip`), panned from the puppet's x; pack cues to `cues.json`, score rendered from the same times.

## 11. Pitfalls

- **Likeness and symbols.** Types only (a uniform, a hat, a moustache), never a recognisable person; period insignia are fine, flags and political symbols are not.
- **Balloons carrying facts.** A date or number belongs in the narration and the caption box.
- **Labels under puppets or balloons.** A covered country name is a lost fact; place labels per shot.
- **Old-style figures** from engraving faces; set every digit in a lining face.
- **Patch the same colour as its country**: the pasted paper disappears.
- **Cut-out seams.** Green fringes and gaps at joints break the craft look; despill hard and overlap parts at every pivot.
- **Gags in the serious beat.** One wobble or slide whistle and the tone collapses.
- **Historical borders.** Modern borders stand in for old ones only where they match; trace the contested line by hand and note it in the credits.

## 12. Variation space

The agent decides per video: the region or market, the sides and their hues, the puppet types, how many changes of hands, which panel is serious, each side's instrument, the page layout.

- **Three structures:** one patch changing hands three or four times, ending on the stack; a tug-of-war that tears the patch in two, then the halves reunite; small patches pasted around a centre until the map is unrecognisable.
- **Three openings:** a puppet hopping toward an untouched patch; the finished stack seen from the side, then a rewind to the first patch; scissors already halfway along the dashed line.
- **Three endings:** a civilian on top of the stack, a pin going in; the camera pulling back to the whole page; the title card slapped onto the table like one more patch.
