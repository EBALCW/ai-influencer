# Archive Light Table

> Real archive objects (glass negatives, slides, letters, telegrams, clippings, drawings) lie on a cool, backlit light table. A loupe comes down on one of them, and inside the glass the object comes alive: a negative turns positive, a line of type lights up, a number lifts off the page, a photograph opens into depth. Precise catalogue numbers, dates and readings are pinned to the objects. Clean, modern and quiet, with no vintage filter. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): archive documentaries that push into still photographs; visual investigations that annotate real imagery (one line, one reading, one source per screen); product macro films (glass edges, transmitted light). Copy none of their layouts, typefaces, shots or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The table bleeds to every edge. Lay the objects out in a column, so a timeline of documents runs down the table and the glide is a vertical one. The loupe lands at the safe box's centre (x 486, y ≈ 720) with a lens interior about 720 px across; labels hang on their vertical leaders and the reading's caption plate sits above the loupe, all inside the safe box (x 72–900, y 269–1248). Two records stack one above the other instead of side by side. Into the photograph, crop to a tall slice of the scan and let the lateral shift become the parallax move. The caption strip is centred on x 540, at most 720 px wide, baseline y ≈ 1200.
- **The first 3 seconds.** Frame 1 is inside the loupe on a glass negative, the develop front already spreading from the lens centre. By 0.5 s the positive is half revealed (a face, a machine, a place). By 3 s the loupe rises, the table shows, and one line on the document beside it lights up with a number that doesn't match.
- **Length and pace.** 20–45 s, three or four objects. Glides 1–2 s; each dive lands in 0.4 s, pushes, holds the reading ≥ 2.5 s and rises. One real silence before the verdict.
- **Captions.** The caption strip on its dark plate with the signal edge is the caption layer: one line, about 44 px, in the spoken language.
- **Sound.** `thock` as the loupe lands on glass, `shimmer` under the develop front, `tick` for scale ticks and counters, `ui-pop` as labels land, `zoom-swish` into the photograph space, `sub-impact` when one record is struck. Ballast hum, paper sweeps, a pen stroke, felt piano, strings and bowed glass from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** As in sections 4 and 6: readings and labels clear of the subtitle strip (bottom 140 px, which also clears the player's controls), anchors and plates inside the 5 % margins.
- **Length and structure.** 2–8 min at 24 fps on ones. A chapter is one object or one dive, in date order; it opens as the loupe lands and the object's tag (identifier, date, holder) draws on its leader, with the chapter title in the serif on a caption plate. Re-hook every 30–60 s with a change of state inside the lens: a negative turned positive, a line lit, a photograph opened into depth, two records held side by side.
- **The first 10 seconds.** The contradiction first: two records held together, one number struck in signal orange. By 5 s the question (which one is true?); by 10 s the promise (the original plates and the archive will say). Any channel sting after that.
- **Captions.** The caption strip burned in, plus an `.srt`.
- **Thumbnail.** The loupe on a glass negative half turned positive, a signal ring on the subject and one number: at most three words.

### Good for

Brand and company history, archive and museum stories, "what really happened" history videos, anniversaries, product heritage.

## 1. Essence, and what it is not

- **The objects are real**: scans of public-domain or licensed archive items, at their true proportions, with their real damage (broken corners, emulsion edges, folds, pencil marks). Nothing in them is drawn or generated.
- **Light comes from below**: the table glows a near-white cool grey; film and glass transmit it, paper glows warm at its edges, opaque things read darker than the table.
- **The loupe is the camera's door**: every dive into an object goes through a loupe that lands on it. The inside of the lens is where the object changes state.
- **Catalogue truth**: every object carries its real identifier, date and title from its holder; numbers on screen come from the record.
- **One signal colour** for marks, readings and anchors; everything else is the archive's own greys and paper tones.

**Sources and licences.** Open collections with masters and catalogue records: the Library of Congress (files on `tile.loc.gov`; records from its SRU server `lx2.loc.gov:210/lcdb` when loc.gov pages are blocked), Smithsonian Open Access (CC0), the Rijksmuseum (CC0), NARA, Europeana (check each item's rights statement). CC0, public domain and CC BY (credited) are fine. "No known restrictions", CC BY-SA and other terms are not CC0: name the terms to the user and ask. For brand history, ask the user for their scans, archive numbers and right to use them. Never stand a generated image in for an archive object. Keep a facts file in the project folder (claim, source URL, quoted wording, or how a figure was derived) and deliver it with the video.

Not Halftone Dossier (no newsprint dots, no aged-paper grade), not Satellite Briefing (objects on a table, not the ground from orbit), not Data Storytelling (no charts; the numbers live on the objects), not a keynote (no slides or header bars).

## 2. Materials & rendering

- **One world, one camera**: every object is a textured quad on the table with a centre, rotation and scale (texture px → world units at true size). The camera is a 2D centre, zoom and roll; the table and every mark go through the same world → screen function.
- **The light table**: an emissive surface (≈ 0.97 white, slightly cool), soft falloff, diffuser noise, an aluminium frame and a dark desk beyond. It can be switched off (ambient ≈ 0.04) and flicker on.
- **Glass negatives**: transmission from the scan's positive, `T = 0.035 + 0.9 · (1 − pos)^1.25`, with a warm silver-gelatin tint; the emulsion mask comes from the scan (white margin touching the border = no glass), so broken corners show the table. Dust and scratches are procedural, anchored to the table.
- **Paper**: backlit, its colour is transmission (paper tone × light); lit lines get darker ink and brighter paper; unlit text can dim to bring one line forward.
- **The loupe**: inside the lens each pixel maps back to the table through the magnification (≈ 2.5×) with a pincushion term (k ≈ 0.16 at the rim), slightly different per RGB channel for colour fringes. Around it: a black ring with a bevel highlight and a clear acrylic skirt that refracts the table and glows at its foot. Landing and lifting, it scales by about 1.35× and casts a soft shadow.
- **The photograph space**: after the push the lens stops being a lens. A photo gains depth from a ground-plane nearness map (zero at the horizon, linear in the row below it), cut-out layers for upright subjects and a filled background; a dolly and a lateral shift drive parallax, and a subject layer may drift. Things left on the ground plane lean: centre the dolly between them.
- **Sampling**: all texture reads inside the branching lens code use explicit gradients (`textureGrad`), otherwise quads that cross a branch pick a wrong mip level and leave dashed seams.
- **Marks** live on a 2D canvas above the picture: hairlines 1.5–3 px, rings, crop corners, underlines, leaders. Table marks are clipped out under the loupe; marks inside a photograph use its forward mapping, parallax included.
- **Post**: a light vignette and fine moving grain (heavier inside photographs). No film damage, no sepia, no halftone.

## 3. Colour logic

- Neutral ground: the light table (near-white, cool) and the archive's own tones (silver greys, paper tans). Do not regrade the archive into a colour scheme.
- **One signal colour** (e.g. a signal orange) for marks, readings, anchors and the verdict; never as a fill behind pictures, never for decoration.
- Text is ink (near-black) on light areas and paper-white on dark caption plates; choose the contrast by the ground, never colour on colour.
- Positives inside the lens may be gently levelled (black and white points) so a weak scan reads; negatives stay as the glass gives them.

Example: table #F7F9FB, ink #15171A, signal #FF5A1F, caption plates rgba(14,15,17,0.74).

## 4. Type & subtitles

- **Roles**: a monospace for identifiers, dates and readings (e.g. IBM Plex Mono, 17–34 px; readings 74–120 px); a sans for labels in the video's language (e.g. Inter, 21–36 px); a serif only for titles and the one name a photograph carries (60–76 px). OFL, self-hosted, subset to the characters used.
- **Labels attach to objects**: an anchor dot and ring, a vertical leader, then the text. A reading sits in a dark caption plate with a small label above and the source (the catalogue number or the original wording) below.
- **Subtitles** are a caption strip at the bottom centre, on a dark plate with a 3 px signal-coloured edge, one line in the spoken language. Hold ≥ max(1.8 s, speech + 0.6 s); labels stay ≥ letters ÷ 15 + 1.5 s.
- **Quote the source when you can**: a crop of the actual line, or the record's wording in quotation marks, beats a paraphrase.

## 5. Motion quality

- 24 fps on ones; every camera parameter on smooth monotone curves through keys (no overshoot, no stepping).
- The camera glides across the table, slows to let the loupe land, then pushes. Speed lives in the glides and pushes; holds are for reading.
- The loupe lands with a fast ease-out (≈ 0.4 s), lifts the same way. Lines draw on in 0.3–0.6 s; text wipes in from its leader side; numbers count up and land with the voice.
- What never moves: the archive's own content outside a photograph space, and the table itself.

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| table glide (pan and roll) | surveying; moving to the next piece of evidence | a timeline of documents; a product family; an album |
| loupe landing + push into the lens | choosing one object; "look closer" | the claim; the key photograph; a signature |
| inside the lens: tracking along a line | reading | a letter, a ledger line, a caption, a spec |
| photograph space: dolly + parallax | being there | the event itself; the founding moment; the place |
| rise out of the lens | stepping back, the evidence noted | a transition; a summary |
| pull back to the whole table | scale; everything at once | an index, a timeline, a closing |

Framing: at a reading moment the subject fills at least a third of the frame height; readings and labels stay clear of the subtitle strip (bottom 140 px). Transitions are made by the loupe (land, push, rise, lift) and the glide; no cuts, fades to black or page turns between objects.

## 7. Sound palette

- **Ambience**: the light table's ballast hum (100 Hz and harmonics), starter clicks, room tone. Inside a photograph the hum gives way to that place's air.
- **Foley**: the loupe on glass (a clack with a high ring), paper sweeps for glides and lit lines, ticks for scales and counters, a pen stroke for a verdict, soft clicks as labels land.
- **Music**: restrained and small: a felt piano, a few strings, glass or bowed metal for the moments of seeing. Build by subdivision and register, not by drums. Leave real silences before a reveal or a verdict; the first sound after them should be the loupe, the place or the verdict.
- **Voice**: a calm narrator, short sentences that state what the object says. Music about 10 dB under the voice, ducked while it speaks; master −14 LUFS.

## 8. Native moves

- **Negative to positive under the loupe.** A develop front spreads from the lens centre with a thin warm edge, turning the glass negative into its positive only inside the lens. *Fits content like:* a founder's portrait plate; a factory on a lantern slide; an X-ray film becoming the product inside.
- **The line lights up.** On paper inside the lens one line of type brightens while the rest dims, an underline draws under it, and one word or number lifts out into a reading card. *Fits content like:* a ledger entry; a patent claim; the first order on an invoice.
- **Into the photograph.** The lens rim grows past the frame while the view inside widens; the photograph gains layered depth and a subject drifts. *Fits content like:* the first shop front; a launch day crowd; an expedition camp.
- **Measuring on the photograph.** A ruler laid on the ground plane in perspective, with ticks that crowd toward the horizon and a counter that lands on the recorded figure, marked as a schematic when it is one. *Fits content like:* a race distance; a bridge span; a building's height.
- **Two records, held side by side.** Two caption cards, each with a crop of its source, held still until both are read before one is struck. *Fits content like:* a misprinted date; two versions of a founding story; specification against delivery.
- **The table becomes the index.** Pull back to the whole table; each object's tag flies into one list with its identifier and its reading. *Fits content like:* a company timeline; a collection catalogue; a product family.

## 9. Pitfalls of the medium

- **Over-magnifying a weak scan**: keep the lens interior under about 1.5 screen px per scan px; choose items by scan size. A reel's tall crop of a landscape photograph needs a bigger scan still.
- **The loupe sweeping over empty table**: lay objects close together, land the loupe straight onto the object (drop in, don't slide in), and glide the camera over objects, not gaps.
- **Shear in the photograph space**: one depth map for a photo with people or machines in it tears them apart. Cut upright subjects into layers, fill behind them, and keep 2.5D moves small enough that the fill is barely seen.
- **Labels that scroll away**: a label on a moving table leaves the frame before it is read; hold the camera, or fix the caption on screen.
- **Vintage creep**: no sepia, no halftone, no paper-ageing overlay. The age is in the objects, not the grade.
- **The app's buttons**: in a reel, a label or reading below y 1248 or right of x 900 is hidden; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **WebGL drawn from `t`, one shader for the table.** Objects are textured quads (centre, rotation, scale, with texture ↔ world conversions at true size); the camera is keyed centre, zoom and roll through one world → screen function. The fragment shader holds the light table, backlit paper, the negative's transmission curve, the photograph-space parallax and the loupe's rim and skirt. Sample with `textureGrad` everywhere inside the lens branches.
- **A dive is one data record**: the loupe's point on the object, its land and lift times, and the lens interior as its own keyed tracks (magnification, develop front, lit line, push). Each shot at `t` resolves which dive is active; marks inside a photograph go through the photograph → screen mapping, parallax included.
- **A 2D overlay** above the picture for annotations (anchor, ring, leader, label), the perspective ruler, the two-record comparison and the closing index panel; table marks are clipped out under the loupe.
- **Scans prepared before the render** with numpy, SciPy and Pillow: emulsion masks from the negative scans, difference matting of an upright subject against a smooth sky, ground-only cuts, and a push-pull fill behind the cut-outs.
- **Timing and cues**: the loupe lands on the word that names the object, a counter lands with the voice. One cue per loupe landing and lift, develop front, lit line, label and struck record in `cues.json`. The score uses free sample libraries: a felt or grand piano (Salamander), strings (VSCO 2 Community Edition), glass and bowed vibraphone (VCSL).

A minimal example: one 35 mm slide on the table, a loupe landing on it, and one line lit inside the lens.

## 11. Variation space

The agent decides the objects, their order, the story, which native moves to spend and where, the camera path, the subject of the photograph space, and the signal colour.

- **Three structures**: a company's founding told as five objects in date order, each dive revealing one person; a single photograph explored in three dives (the place, the people, the date on the back); a before/after pair of plans and photographs of one building.
- **Three openings**: the table switching on in the dark; a loupe already on a plate, rising to reveal the table; a hand-written date on an envelope filling the frame.
- **Three endings**: the index of everything on the table; the last photograph held in depth with one line of text; the light table switching off, leaving one object glowing.
