# Data Physicalization

> Real statistics built as real objects: every unit is a countable piece of material (a plate, a block, a coin, a bar) stacked to exact scale on a crafted base, shot like a product in a studio — soft key, long shadows, shallow depth of field, physically based materials. The camera reads a number at the edge of one plate, follows the data as it grows, and pulls back until the chart is an installation. Made as a 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): data-sculpture and physical-visualisation practice (one unit = one object, the object is the axis); product and still-life photography (a warm key at a low angle, a cool rim, a seamless sweep); annual-report editorial design (one reading per screen, a source line, a quiet grotesk). Copy none of them; never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The sweep fills the frame. Stacks are native to the tall frame: frame one stack, or a pair side by side, so it rises through the safe box (x 72–900, y 269–1248), and crane with the top instead of pulling wide. The verdict sits at the top of the safe box (x 72, y ≈ 300); a pair's readings stack in one column beside or above the stacks, never below y 1100; the source line is right-aligned to x 900 at y ≈ 280. Subtitles are centred on x 540, at most 720 px wide, baseline y ≈ 1200, with the ink rule above. For the pull-back, a round dial fits as it is; a skyline or map-shaped base is turned so its long axis runs up the frame.
- **The first 3 seconds.** Frame 1: a macro on the edge of a stack, one piece already being placed, its edge in focus. By 0.5 s it lands with its sound and the bracket reads "= 10 GW". By 3 s the focus racks back along the stack to its height and the question lands (when does the other series catch up?).
- **Length and pace.** 20–45 s: the unit rule, one feed or paired climb (cascades 0.5–1.0 s, feeds 8–16 pieces a second), the crossover held still ≥ 2.5 s before the verdict, then the last object or the pull-back. The camera creeps 2–5 % on every hold.
- **Captions.** One line on the paper plate with its ink rule, 40–44 px, in the spoken language.
- **Sound.** `tick` for metal plates landing, `thock` for acrylic or wood pieces, `clean-ding` for each ruler piece when no sampled mallet is used, `hook-impact` for the last object, `zoom-swish` on the pull-back. Marimba, vibraphone, glockenspiel, glass harp, horns and timpani from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** As in sections 4 and 6: readings in empty background, the verdict in the upper-left third, the source line in a corner away from the subtitles, subtitles bottom left with their baseline above y 950 (the player's controls); everything inside the 5 % margins.
- **Length and structure.** 2–8 min at 24 fps, one studio set per video. A chapter is one series, one period or one comparison, on its own base along the same sweep, joined by a low lateral track. Its title card is a slow orbit of that base with the title in the serif. Re-hook every 30–60 s with assembly: a feed, a crossover, a unit close-up on a new material, a last object; save the chart-to-installation pull-back for the end.
- **The first 10 seconds.** The finished installation from above first, the total engraved on the last object. By 5 s the dive to one piece and the question; by 10 s the promise ("one plate is 10 GW; watch twelve years stack up"). Any channel sting after that.
- **Captions.** Subtitles burned in, plus an `.srt`.
- **Thumbnail.** The two stacks at their crossover in a low three-quarter view, warm key and long shadows, with the accent verdict: at most three words.

### Good for

Annual reports and investor updates, energy and economics explainers, ESG data, "how big is a billion" scale videos, company milestones.

## 1. Essence, and what it is not

- **The unit is an object.** One plate, block or coin equals one stated quantity, and the rule is said on screen once ("1 plate = 10 GW"). A heavier material marks every tenth unit, so the stack is its own ruler.
- **Scale is exact.** Heights, counts and areas are computed from the data; rounding is one unit at most and written in the facts. Two series compared on the same base use the same unit.
- **Studio light, real matter.** Metal reflects an HDRI, wood shows grain, acrylic transmits; nothing glows, nothing is outlined, no fake UI.
- **Growth is assembly.** Data increases by pieces being placed, one after another, with weight and sound; it never scales or morphs.
- **The pull-back.** At least once the chart is revealed as a made thing: a dial, a table piece, a landscape of stacks.
- **Every number has a source on screen**: real published statistics (or the user's own figures), credited in frame.

Not Isometric Infographic (no icons, no flat colour coding), not Glass Product Render (the object is data), not Data Storytelling (no paper chart or inked axes), not Dark Tech Keynote (no black stage or neon), not Brick Toy (no toy proportions, no characters).

## 2. Materials & rendering

- **Pieces**: thin boxes or cylinders instanced in the thousands, each with a few-millimetre random offset and yaw, a ±7 % value change and a hairline gap: that is what makes a stack read as stacked, not as a bar.
- **Material per series**, chosen so two series separate in one glance at thumbnail size: brushed metal against tinted acrylic, pale wood against dark stone, copper coins against paper. A third material (e.g. brass) only for the ruler pieces, shared by every series.
- **Base**: a real-texture slab (wood veneer, stone) with inlaid marks: a tick ring, the series' paths, the labels of categories or years, cut into the surface at the base's own scale, lit with the scene.
- **Rendering**: PBR (transmission for acrylic), an HDRI at low intensity for reflections only, a warm key at 20–35° with long soft shadows, one or two cool rims so metal and acrylic separate from wood at distance; GTAO, physical depth of field, 2× supersampling, a light vignette.
- **Screen space only for type**: readings, verdicts, the source line, subtitles, the title card. Every reading is pinned to its object through the same world → screen function as the camera.
- **Post**: grain light (the background is pale), no lens flares, no chromatic aberration.

## 3. Colour logic

- The set is warm and neutral: a seamless greige sweep, the base in a natural material, the series in material colours (silver, pale teal, brass, oak). Material, not paint, separates series.
- **One accent** (e.g. signal orange) for the reading or verdict that matters on this screen; nothing else is accent-coloured.
- Ink is near-black at two strengths (value, then labels at ~60 %).
- No rainbow series palettes, no colour ramps on the objects, no dark mode.

Example: sweep #C4BEB4, walnut base, aluminium #C8CCD1 (metal), acrylic #9FD3D6 with teal attenuation, brass #D2B07A, ink #1C1D20, accent #D4521C.

## 4. Type & subtitles

- **Roles**: a light grotesk for numbers (e.g. Inter 200–300; the hero reading 130–170 px, a stack reading 46–56 px); a sans for labels and verdicts in the video's language (e.g. Inter 500, 24–46 px); a monospace for units, years and source lines (20–24 px); a serif only for the title. OFL, self-hosted, subset to the characters used.
- **A reading** = a dot on the object, a 1.4 px leader, a small swatch of the series' material, the category line, then the value and unit, on a translucent paper plate (~84 %). Two readings of one pair stack in one column, larger value on top.
- **The source line** (dataset, publisher, year, licence, e.g. "Data: IRENA (2026), compiled by Our World in Data · CC BY 4.0") is in frame with the data, small (20–22 px, ink at ~60 %) in a corner away from the subtitles, at least from the first reading to the summary, and on the title card.
- **A verdict** sits in the upper-left third on its own plate in the accent colour, underlined by a growing rule; it appears only after the readings it judges have been still for ≥ 2.5 s.
- **Subtitles**: bottom-left, a 2 px ink rule and a paper plate fading right; one line in the spoken language, measured with the real font (`nowrap`), split into two cues rather than wrapped. Hold ≥ max(1.8 s, speech + 0.6 s).
- Labels hold ≥ letters ÷ 15 + 1.5 s; a counter reports its landing value; nothing below 20 px.

## 5. Motion quality

- On ones, 24 fps; the camera never stops (2–5 % creep on holds).
- **Cascade**: a stack assembles bottom-to-top in 0.5–1.0 s, each piece dropping a few centimetres with an ease-out.
- **Feed**: one period's increase arrives piece by piece from out of frame, quintic ease-out, a yaw that unwinds ("placed", not "dropped"), 8–16 pieces per second, the counter rolling with the pieces landed.
- **A single heavy object** falls with gravity, lands with one small damped bounce, its shadow tightening.
- Readings fade in with a 16 px rise and draw their leader; they leave by fading, never by sliding.
- Never moves: the base, a piece once landed, the ruler pieces.

## 6. Camera grammar

| Move | What it expresses | Can serve |
|---|---|---|
| Macro dolly along a stack's edge, rack focus | the unit is real and countable | the rule "1 piece = X"; a single record |
| Low lateral track along the series | time passing; growth | a decade; a ranking; a sequence of sites |
| Locked three-quarter frame on two subjects | comparison | before/after; A against B; a crossover |
| Crane with the rising top | accumulation | one year's increase; a target being reached |
| Pull-back to near top view | the whole as an object | a summary; a ratio; an ending |
| Slow orbit around the base | the installation as sculpture | a title; a breath |

The subject fills at least a third of the frame height at key moments; readings live in empty background, never over the subtitle strip; comparisons keep both subjects completely in frame. Transitions are camera moves inside one set (one continuous take where possible); no cuts to a chart, no wipes, no page turns.

## 7. Sound palette

- **The material's own sound** is the foley: metal plates tick bright and short (inharmonic partials 3–8 kHz), acrylic toks duller (1–3 kHz), wood knocks, coins ring. A cascade is a burst of these at the landing times, scaled down as density rises.
- **The ruler sings**: every ruler piece (each 10th) rings a pitched mallet note, one timbre per series (e.g. glockenspiel for metal, glass harp for acrylic), climbing a pentatonic scale with the count — the chart becomes an arpeggio.
- **Score**: mallets and air — marimba ostinato, bowed and struck vibraphone, harp, glass, a soft synth pad and a pulse bass with audible 2nd/3rd harmonics; horns for a turn. Accelerate by subdivision (8ths → 16ths), not tempo.
- **Impacts**: a turn or a last object lands on punch (60–120 Hz) + bass drum + timpani + a bell; the two or three designed impacts are the loudest moments.
- **Silence**: a 0.3–0.6 s suck-out (music and foley −30 dB) before each designed impact; a thin studio-air bed stays.
- **Mix**: voice ~10 dB over music, ruler notes under the voice, master −14 LUFS, true peak ≤ −1.2 dBTP. Voice: calm, precise, short sentences.

## 8. Native moves

- **The unit close-up.** Push into the side of a stack until one piece fills the frame; bracket one piece ("= 10 GW") and one ruler piece ("= 100 GW"). *Fits content like:* tonnes of CO₂ as steel plates; a budget as banknote bricks; a population as wooden discs.
- **The paired climb.** Two series on one base, one material each, built year by year as the camera tracks; the crossover is held still with both readings before the verdict. *Fits content like:* imports vs exports; renewables vs fossil capacity; two companies' revenue.
- **The feed.** One period's increase arrives piece by piece onto last period's level, the counter rolling with the landings. *Fits content like:* this year's new hires on last year's team; a quarter's sales; a record harvest.
- **Chart to installation.** Pull back until the bars are a dial, a skyline or a table piece; the base's inlaid marks become its typography. *Fits content like:* twelve months as a clock; regions as a map-shaped base; product lines as a city.
- **The last object.** One single heavier piece (a brass puck, a coin, a weight) lands on the base carrying the final number engraved. *Fits content like:* a total; a ratio; a target met.

## 9. Pitfalls of the medium

- Two materials too alike (bright aluminium vs clear acrylic) read as one series: give one a tint or a finish change, and check at thumbnail size.
- Long shadows and warm reflections turn metal brown at distance: add a cool rim light and keep the base darker than the pieces.
- Thin pieces moiré at 2–3 px per layer: random per-piece value and offset, 2× supersampling.
- A reading pinned to a moving object can leave the frame: clamp it to a safe box (in a reel, x 72–900, y 269–1248).
- Counters that roll by time instead of by landed pieces lie; tie them to the object count.
- Rounding to whole pieces can invert close values; when two values are within one unit, say so on screen or choose a finer unit.
- Transmission streaks at low angles: acrylic roughness ≥ 0.2, tinted attenuation.
- A map-shaped base follows [directing](../../../references/directing.md#maps).

## 10. Build

Follow [building](../../../references/building.md). For this style:

- **three.js drawn from `t`.** One set: the studio HDRI for reflections, a warm key and cool rims, the base with its inlay drawn to a canvas texture, the pieces as one instanced mesh per material, and the last object. Change the series, the unit and the materials to make any single or paired series.
- **A landing schedule is the clock.** Precompute, for every stack, each piece's landing time (cascades, feeds, the ruler pieces); a function "how many pieces of this stack have landed at `t`" drives positions, counters and foley alike, so counters never roll by time.
- **The camera** is keyed in cylindrical coordinates (azimuth, radius, height) around the set, with focus on a target point for the physical depth of field. The reading kit (pair labels, verdict plate, material swatch, counter, subtitles) goes through the same projection, every text registered for the reading check.
- **Foley is synthesised from the landing schedule**: a bright metal tick (inharmonic partials 3–8 kHz), a duller acrylic tok (1–3 kHz), ruler notes climbing a pentatonic scale, and suck-outs before each designed impact; mix it with the score under the voice. Pack cues go in `cues.json` for the last object, the pull-back and anything the synthesis doesn't voice.
- **Assets**: a CC0 studio HDRI (about 12 MB) and a walnut veneer from Poly Haven; for a sampled score, free libraries such as VSCO 2 Community Edition, VCSL and FreePats. Anything else (a spreadsheet reader, other textures) goes in a private environment inside the project folder.

A minimal example: one series of twelve monthly values on a 12-position circle, the annual total engraved on the last object.

### Sources, licences, facts

- **Statistics for a new topic**: Our World in Data (each chart's "About this data" names the original source; CC BY 4.0 — credit both), World Bank Open Data (CC BY 4.0), Eurostat (CC BY 4.0), US Census / BLS / EIA (public domain); UN Data, IRENA, IEA free tables and other national statistics offices: check each dataset's terms. Search the portal for the indicator, download the CSV, keep the file and its metadata in the project's data folder.
- **Licences**: CC0, public domain and CC BY are fine with a credit. ODbL, CC BY-SA, "no known restrictions" or "free for non-commercial use" are not CC0: name the terms to the user and ask before using them. Textures and HDRIs: Poly Haven / ambientCG (CC0).
- **The user's own numbers** (annual report, ESG data, sales): ask for them and for the document they come from; never invent or round them into a better story. Never let generated images stand in for real data or material.
- **Keep a facts file in the project folder** — each on-screen number and spoken claim, its source URL, the quoted wording or row, and how any derived value (ratio, difference, units per piece) was computed — and deliver it with the video.

## 11. Variation space

Decided per video: the unit and its materials, the base and its shape, which series share it, the camera route, pacing, the last object, accent hue within the colour logic.

- Structures: a single series rising to a record; two series and their crossover; a ranking of regions laid out as a map-shaped base.
- Openings: the macro of one piece being placed; the finished installation seen from above, then the dive to the first unit; an empty base with its inlay waiting.
- Endings: the last object landing at the centre; a slow orbit of the whole installation; a single piece lifted off to show what one unit is.
