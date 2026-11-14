# Ukiyo-e

> Edo-period woodblock prints brought to life: flat colour blocks, carved ink lines, bokashi skies, paper you can feel, and a camera that moves over the print like an unrolling handscroll. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): Hokusai's *Thirty-six Views* (one constant subject placed differently each time; bold geometric cropping); Hiroshige's *Fifty-three Stations* and *Hundred Famous Views* (small figures, rain lines, extreme foreground framing); the anime *Mononoke* (2007) (print texture alive in motion, flat layers sliding, seals as screen language). Never reproduce a specific famous print (no copy of *The Great Wave*, *Red Fuji*, *Sudden Shower over Ōhashi*), and never copy their characters or compositions.

## Formats

### Reel (1080×1920)

- **Layout.** Many prints were tall already: each view is an upright sheet (an ōban, or a narrow pillar print) filling the frame inside its double border, the mount bleeding to the edges. The view cartouche and seal sit upper right (x 740–880, y 300–700); the subtitle cartouche sits centred on x 540, at most 720 px wide, at y ≈ 1090–1240, with figures and ground lines above it and water or foreground free to run under the app's buttons. Stack, don't shrink: sky-to-ground layers grow taller; a triptych is panned sheet by sheet and seen whole only in a final pull-back; the scroll still slides right to left, one sheet at a time.
- **The first 3 seconds.** Frame 1 is a close crop already printed (a lantern, a sleeve, a wave's claw filling the sheet) with one small action moving. By 0.5 s a colour block lands with its baren sweep and snaps into register; by 3 s the pull-back finds the whole print and the seal stamps, or the scroll starts sliding to the next station.
- **Length and pace.** 20–40 s: four to six views of 4–7 s, each with one or two small actions; the native move held about a second; one cut to a blank sheet (*ma*) of about a second. Camera on ones at 30 fps; figures at 8 fps, rain and fast water at 12 fps.
- **Captions.** The subtitle cartouche is the only caption layer: 44–52 px, at most six words a line, two lines.
- **Sound.** `thock` as a seal stamps, a soft `zoom-swish` on a crash-zoom into the texture, `clean-ding` (low, bell-like) on a view's full stop, `sub-impact` under the taiko at the climax. Shamisen, shakuhachi, koto, taiko, clappers and the paper foley (baren rub, scroll slide) come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** Sections 2 and 4 as written: one landscape sheet fills the frame at zoom 1. The subtitle cartouche sits just above the bottom 12 % (the player's controls); the view cartouche and seal stay inside the 5 % margins.
- **Length and structure.** 2–6 min at 24 fps. The video is a series of views on one mounting scroll: a chapter is one station (40–90 s, one to three views), its title card the vertical view cartouche, series tab on top, stamped by the seal as its full stop. The handscroll slide carries from chapter to chapter. Re-hook every 30–60 s: an alternate impression of the same view (day to night, spring to snow), something breaking out of the border into the mount, a crash-zoom into the woodgrain, a cut to a blank sheet, a triptych pan. The last chapter pulls back from one sheet to the whole series, which also gives the end screen quiet edges.
- **The first 10 seconds.** The strongest print's close crop on frame 1; the question by 5 s; by 10 s a pull-back along the scroll shows the stations still to come, with the promise. Any channel sting comes after: the channel's seal stamped onto a blank sheet.
- **Captions.** The subtitle cartouche stays burned in; export the same lines as `.srt`.
- **Thumbnail.** A full sheet with a bold foreground crop and the red seal; up to three words in the vertical cartouche, where the print already expects words.

### Good for

Travel stories, Japanese culture and craft, poetry, one place through the seasons, a product seen in many homes, a history in stations.

## 1. Essence, and what it is not

Every shot is **a complete woodblock print**: a sheet of washi, a thin double ink border, flat areas of colour printed from separate blocks, a black key-block line on top, a vertical title cartouche and a red seal. The world is flat on purpose. Depth comes from stacked horizontal layers, mist bands and bold cropping, never from perspective rendering, lighting or shading.

What makes it read as *printed* rather than *vector*:
- **Paper** is always visible: warm washi, long fibres, slight edge ageing.
- **Each colour is its own block**, slightly **out of register** (1.5–2.5 px) with the key line.
- Large colour areas show **woodgrain** and **baren rubbing** (uneven ink density, circular streaks) and fine **goma-zuri** specks.
- **Bokashi**, hand-wiped gradients, in skies and water.

Not a flat vector illustration with a paper overlay (no woodgrain, no misregistration), not Chinese ink wash (no bleeding washes, colour is printed, not painted), not anime cel shading (no light and shadow on forms).

## 2. Materials & rendering

- **The sheet is the frame**: the print fills the screen at zoom 1, inside a thick + thin ink border, with a paper margin beyond. Sheets can sit on a long mounting scroll (darker tan paper, a roller at one end), so the camera can travel from print to print.
- **Blocks**: draw each colour group into its own offscreen canvas, cached once (key lines; blues; greens / secondary; reds / figures). Composite each with a small fixed registration offset (1.5–2.5 px, a different direction per block).
- **Texture every colour block**: woodgrain (`source-atop`, strongest in sky and water) → baren streaks → goma-zuri specks (both `destination-out`); the key block gets specks only; light paper fibres over the finished sheet so paper shows through the ink. Big dynamic fills get the same textures inside their clip. Woodgrain = iso-lines of a warped noise field; baren = blurred circular arcs + zigzag streaks, kept faint (specks α ≈ 0.3, fibres α ≈ 0.09).
- **Bokashi** is generated per pixel: a gradient whose top edge wanders by low-frequency noise per column (±20–30 px). Never strips of `fillRect` (vertical seams).
- **Line**: key lines 2.4–3 px; large contours are variable-width filled strokes, tapered at both ends, with ±20–35 % low-frequency width jitter. Distant things get a grey key line or none.
- **Motifs of the medium**: mist as long rounded flat bands (suyari-gasumi) fading at both ends; pines with flat-topped **needle pads**; fields as high, flat, parallel layers whose cross lines are **parallel and slanted**, never converging; rain as two sets of fine straight lines at slightly different angles under a sumi bokashi sky; water as banded blues with bokashi between bands, foam and spray left as paper.
- **Seal**: characters cut out of red, chipped edges (the characters are picture). **Figures** are small in the landscape (roughly 80–130 px at full sheet), flat, with a clear silhouette; faces in a few strokes.

## 3. Colour logic

- **A pigment set, not a colour wheel**: 6–9 flat hues, each printed from its own block, over the paper ground. No gradients except bokashi, no shading on forms.
- **Sumi key line** over everything; **paper is the white** (no white pigment for foam, snow, mist, blank sky).
- **One dominant hue family** carries sky and water (in the 19th-century prints, Prussian blue); **red is rare**: seals, a sun, one garment or tab.
- Far layers pale and low-contrast, near layers saturated with dark key lines.
- Examples, one per video: an indigo-and-beni landscape (Prussian blue, pale blue, beni red, ochre, greens, sumi); a bijin-ga interior (pale pink, mauve, grey-green, lacquer black, a mica-grey ground); an autumn surimono (persimmon, ochre, grey-green, deep brown, one blue).

## 4. Type & subtitles

- **Subtitle = a horizontal cartouche**, in the one spoken language: a cream slip with a thick + thin ink border and a small red seal at the left; a calm OFL serif (e.g. EB Garamond 500) in sumi, centred near the bottom, about eight words a line at most. It "prints" in with the reveal mask and fades out. Hold ≥ max(1.8 s, speech + 0.6 s). In 16:9 it sits just above the bottom 12 % of the frame (y ≈ 800–950): keep ground lines and figures above it.
- **View cartouche**: vertical cream slip, thick + thin border, a pale tab with the series title, the view title below in a brush font (e.g. Yuji Syuku), a seal beside: the "full stop" of each view. Japanese characters in a cartouche are picture; the meaning is carried by the subtitle or the voice. Titles live on the print as cartouches and seals, never as floating type.

## 5. Motion quality

- Prints are still. **Most of the frame does not move**; each view has one or two small actions (steam, rain, a lantern, a falling leaf).
- **Figures and nature step at 8 fps**; rain and fast water at **12 fps**; **the camera moves on ones (24 fps; 30 fps in a reel)**. A stepped camera judders.
- **Printing reveal**: each block appears over ~0.3 s with a diagonal baren sweep with a noisy edge, sliding 5–6 px into registration as it lands (pure noise looks like mould).
- Cartouches drop in (fade + a short slide); a seal *stamps* (scale ~1.35 → 1 in 0.2 s).
- A native move needs a **held beat of about a second** to be read; a peak flashed in under a second reads as noise.

## 6. Camera grammar

The camera moves *over* prints and between them; it never rotates in 3D space inside one. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Locked frame on one sheet | Reading a print on a wall | a place; a portrait; a still moment |
| Handscroll slide, right → left through the mounting gap (shorter slides = urgency) | Travel, the next station | a journey; a sequence of steps; a race |
| Very slow push toward a framing device (a window, a fan, a gate) | Attention narrowing | discovery; longing; a detail that matters |
| Tilt past the border into the mount | Something larger than the print | a flood; a rumour; a giant |
| Pull-back from one sheet to many | The series seen whole | a summary; a timeline; a collection |
| Crash-zoom into the texture (grain, specks, fibres) | The medium itself becomes the image | a dream; a breakdown; a memory dissolving |
| Pan across a triptych (three sheets side by side) | One scene too wide for one sheet | a procession; a battle; a festival |
| Hard cut to a blank sheet | *Ma*, a held breath | aftermath; a pause before a decision |

Framing: bold cropping and extreme foreground elements (a branch, a post, a lantern crossing the frame) are native; depth by stacking, never by perspective. Allowed transitions: scroll slides, printing reveals, a wash back to paper, a cut to blank. No cross-dissolves, no 3D flips.

## 7. Sound palette

- **Japanese instruments, not piano and pads**: shamisen (with sawari buzz; sampled or physically modelled), shakuhachi, koto, taiko and shime-daiko, kotsuzumi / ōtsuzumi calls, hyōshigi (wooden clappers), a small bell.
- **Modes**: miyako-bushi (in scale), yō, ritsu; long breathy tones with a slide into each note and *meri* drops at phrase ends suit the shakuhachi; the shamisen can hold a pulse or an ostinato.
- **Techniques, as options**: absolute silence as *ma* (cut reverb tails too); a single sawari note left ringing; free-rhythm breath phrases against a steady pulse; clappers that accelerate (the kabuki curtain call); a taiko heartbeat that tightens into a roll; a koto glissando for a turn of season; a drum call (*kakegoe*) before an entrance.
- **Foley follows the material**: paper (baren rub = band-passed noise with a slow circular modulation; scroll slide; seal = low thump + tacky peel), wood (block set down, hollow steps), glass (wind chime), water, birds and insects of the season.
- **Voice**: one calm narrator, few short lines, like a poem written beside the print. Duck music ~8 dB under voice, ambience ~4 dB. Loudness −14 LUFS; no added grain in the final mux (the paper is the grain).

## 8. Native moves

A menu: use the ones your story needs.

- **A series of views.** One constant subject in different compositions; the story is told by *where it sits in the frame* each time. *Fits content like:* one building through a century; a product in five homes; the same street in four seasons.
- **The handscroll.** Scenes don't cut; the camera slides right to left and the next print arrives. *Fits content like:* a supply chain; the stations of a pilgrimage; the steps of a recipe.
- **Printing, block by block.** Key line first, then each colour lands slightly off and snaps into register. *Fits content like:* a building going up; an idea taking shape; a character being "made" for the story.
- **Paper is the white.** Foam, snow, mist and blank sky are unprinted paper; white can flood the frame and wash the print back to a blank sheet. *Fits content like:* a snowfall that erases a town; forgetting; a clean start.
- **The frame is an object.** Border, cartouche and seal are physical; something big enough breaks out of the border into the mount. *Fits content like:* a festival that can't be contained; a legend; a runaway success.
- **Alternate impressions.** The same key block reprinted with different colour blocks (day → night, spring → winter). *Fits content like:* before and after; a city lit at night; two lives in one house.
- **The triptych.** A scene split across three sheets that join. *Fits content like:* three generations; a panorama of a harbour; a debate between three voices.

## 9. Pitfalls of the medium

- Bokashi from `fillRect` strips leaves vertical seams → build it per pixel.
- Too much speckle or fibre makes dark areas look like sandpaper or scratched film → specks α ≈ 0.3, fibres α ≈ 0.09.
- A perspective grid for fields looks digital → parallel, slanted, flat layering.
- Pine clusters drawn as half-discs look like parasols → flat pads with needle fans.
- Offset curves self-intersect at tight bends → build inner lines from the gentle side of the contour; force control points x-monotonic.
- Breaking out of the print must escape **both** the sheet clip and the frame clip.
- A seal drawn with `multiply` vanishes on dark ground → `source-over` there.
- **Cartouches under the app or the player**: in a reel, keep the subtitle inside x 72–900, y 269–1248; on YouTube, above the bottom 12 %.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **Canvas, drawn from `t`.** Each view is a set of colour blocks drawn once into cached offscreen canvases, plus a per-frame paint for the one or two things that move; the frame composites the blocks with their fixed registration offsets, the reveal masks and the camera. Figures and nature read a stepped clock (`Math.floor(t * 8) / 8`), rain and water a 12 fps one; the camera and scroll use full-rate `t`.
- **A reusable print core**: paper and fibres, woodgrain from warped-noise iso-lines (`source-atop`), baren arcs and zigzags and goma-zuri specks (`destination-out`), per-pixel bokashi with a noisy top edge, tapered variable-width key lines, the diagonal noisy-edged reveal mask with its 5–6 px slide into register, cartouches and chipped seals.
- **A kit of motifs**: mountains, needle-pad pines, rocks, rain sets, birds; banded water with fractal claws and paper-white spray; a flat figure rig with a clear silhouette. Build inner lines from the gentle side of each contour.
- **The mount**: sheets laid on one long scroll in world space, so a slide, a pull-back to the whole series or a break out of the border is just the camera moving; anything breaking out is drawn outside both the sheet clip and the frame clip.
- **Timing and cues**: block reveals and seal stamps keyed to the voice's word timings; `cues.json` gets each seal, block landing, scroll slide and crash-zoom; the score's clapper accelerations and taiko rolls are written to the same times.

## 11. Variation space

You decide the constant subject (or none), the number of views, the characters, the opening, the ending, the camera path, the pacing and the pigment set:

- Structures: **alternate impressions** (one key block of a single street, reprinted for dawn, rain, festival night and snow); **a triptych unfolding** (three sheets revealed one at a time, the story only readable when all three join); **a print being made** (the carver's blocks, one per shot, each block's colour telling one chapter).
- Openings: **a close crop** (an extreme foreground detail, a lantern or a sleeve, fills the sheet; the pull-back finds the print); **the bare block** (carved wood inked, the paper laid on, the baren rubs; lifted to reveal the first print); **the mount first** (a closed scroll unrolls to its first sheet).
- Endings: **a seal alone** (the print fades back to paper, only the red seal remains); **the album closes** (sheets stack like pages, the cover lands); **the last print left unfinished** (key line only, colour blocks never land).
