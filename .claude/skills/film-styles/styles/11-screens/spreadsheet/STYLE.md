# Spreadsheet Film

> A whole film inside one spreadsheet: every picture is something a sheet can make (cell fills, values, borders, merged cells, hidden columns, reference boxes, comments, the formula bar), and one cell stands for one person, sale or event. Formulas are typed like lines of dialogue, conditional formatting paints the data, and cells hop across the grid to stack into charts made of themselves. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): screen-recorded spreadsheet tutorials (take the amber active cell, the typed formula, Enter as a beat); unit charts and isotype (take one mark per thing, counted not summed); pixel art and mosaic (take the grid as a picture plane); statistics teaching (take the reveal of a hidden variable). Never copy their characters, layouts, typefaces or music, never imitate a real spreadsheet product's look or logo, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** A portrait spreadsheet shell, flat, filling the screen; the shell never zooms, only the sheet does.

| Zone | Position | Content |
|---|---|---|
| Title bar and toolbar | y 0–200 | picture: window dots, file name, buttons |
| Formula bar | y 280–340, x 72–1008 | the typed formula, must-read |
| Column headers | y 340–370 | letters, highlighted with the selection |
| Sheet | y 370–1840, row header x 0–54 | the data, bleeding off the right and bottom |
| Cell comment (caption) | centred on x 540, ≤ 720 px wide, bottom edge y 1230 | the narration line |
| Tabs and status bar | y 1840–1920 | picture: sheet tabs, mode chip, a status message, zoom slider |

  Merged-cell labels and results that must be read sit inside x 72–900, y 380–1100; pivot bars stack vertically in the lower sheet.
- **The first 3 seconds.** Frame 1 is a close sheet (zoom 2.7–2.9) with the active cell already typing a formula; Enter lands by about 1.7 s and the result pops; by 3 s a second result beats the first and turns lime.
- **Length and pace.** 30–50 s, about 120 BPM: one typed formula or one rule per 4–6 s, one quiet beat before the turn, one big reveal (unhide, pivot or bloom).
- **Captions.** The yellow cell comment is the only caption layer.
- **Sound.** `typing-tick` for every typed character, `thock` on Enter, `ui-click` for selection hops and clicks, `tick` for each painted cell, `clean-ding` when a cell turns into a winner, `zoom-swish` on big sheet zooms. Drums, electric bass, piano, marimba, xylophone and glockenspiel from a free library such as [FreePats](https://freepats.zenvoid.org).

### YouTube (1920×1080)

- **Layout.** Section 2 as written; the comment caption ends above y 940; the status bar may sit in the bottom 12 % because nothing there must be read.
- **Length and structure.** 3–8 min as tabs: each chapter is a new sheet tab (its name is the chapter title), opened with a click on the tab bar. Every chapter follows one loop: a question typed as a formula, the answer cell, a rule that paints the data, a reveal that rearranges it. Re-hook every 30–60 s with a typed formula landing on Enter, a ripple of unhidden columns or cells flying into a pivot.
- **The first 10 seconds.** The strongest image first: the finished painted grid at low zoom; the question by 5 s as a formula being typed into the active cell; the promise by 10 s in the comment ("by the end you will know which number to trust").
- **Captions.** Burned in as cell comments; export the same lines as `.srt`.
- **Thumbnail.** The grid painted lime and red at low zoom, one merged cell with a big percentage, at most three words.

### Good for

Data literacy, finance and costs, analytics explainers, survey results, "the average lies" stories, team and sales reports told as a reveal.

## 1. Essence, and what it is not

1. **Only what a sheet can make.** Fills, values, borders, merged cells, hidden columns, reference boxes, comments, the formula bar, the status bar. No icons, no illustrations, no charts that are not made of cells.
2. **One cell is one thing.** A person, a sale, a day; counts are shown by counting cells.
3. **Formulas are the dialogue.** A typed formula asks the question; Enter answers it.
4. **Rules paint.** Conditional formatting colours the data cell by cell, and the colour carries the meaning.
5. **The grid rearranges, never morphs.** Cells hop from cell to cell along the grid; columns open and close; nothing slides off the grid.

Not **Data Storytelling** (no charts drawn over the screen; every chart is cells in the sheet). Not **Living Screencast** (no recording of a real app, no mascot, no browser). Not **Desktop Flythrough** (no 3D device or desk; the shell is flat and fills the frame). Not a slideshow of tables: the camera lives in one sheet from start to end.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Title bar | y 0–30 | three window dots, a 3×3 icon in the data colours, file name, a source line centred, "Saving…" at right |
| Toolbar | y 30–70, `#F1F0EB` | undo, font, size, B I U, fill, %, .00, Σ, a conditional-format button and a pivot button that press when in use, the current rule as text |
| Formula bar | y 70–120, `#F8F7F3` | name box (cell reference), cancel and confirm, fx, the formula |
| Column headers | below the formula bar, 26–38 px tall | letters; selected columns highlighted |
| Row headers | x 0–54 | numbers |
| Sheet | y ≈ 146–1026 | the film |
| Cell comment (caption) | x 76, bottom edge y 940 | narration |
| Sheet tabs | y 1026–1054, `#E5E4DE` | the active tab and others |
| Status bar | y 1054–1080, near-black | mode chip, a running status message, zoom slider and percentage |

Sheet geometry: cells 64 × 22 px at 100 %. Data blocks start a few rows and columns in from A1, with labels in merged ranges above them; results in wide merged ranges below. The view can never scroll above row 1 or left of column A.

## 3. Materials and rendering

- **Cells** are flat rectangles. Gridlines are 1 px `#DAD9D3` between empty cells and `rgba(6,4,18,0.42)` around painted ones, drawn in two batched paths per frame.
- **Values** are centred Inter 500 at 11 px × zoom; below 6.5 px they are not drawn. A column too narrow for its value shows `##`, then `#`, then nothing, as a real sheet does.
- **Painting** fills a cell and flashes it white (80 % fading over 0.14 s); background blooms flash at 60 % over 0.12 s.
- **Merged cells** hold every label, result and title: white or coloured fill, 1.5 px ink border, bold Inter inside.
- **The active cell** is a 3.5 px ink border, a 2 px white gap, then a dashed amber outline (7/5 px dashes) marching at 60 px/s, with a 10 px fill handle at the bottom right. When it hops, it leaves amber trails that fade over 0.22 s.
- **Reference boxes**: while a formula is on screen, every range it names gets a 2.5 px outline in that name's colour with 7 px square handles at its corners.
- **Hidden columns** are 0 px wide with a darker seam (28 % ink) where they fold; unhidden, they widen and the layout reflows.
- **Cursor and context menu** are drawn in screen space: an arrow that shrinks to 86 % on a click; a white menu that opens in 0.12 s.
- **Shell** is the only fixed layer; the sheet is drawn with the camera transform and clipped to the viewport.

## 4. Colour logic

- The sheet starts white. Colour arrives only through rules, selection and references, and every colour has one meaning for the whole film.
- Outcome colours: lime for yes or success, red for no or failure, each with its own ink so values stay readable.
- A second variable takes a dark and a pale tone of one hue (indigo and pale blue), so it never fights the outcome colours.
- Amber is the active cell and nothing else. Reference colours (blue, purple) belong to the names in formulas.
- Comments are pale yellow with a red corner tag.
- The final bloom uses a six-step pastel scale in bands from a centre; it is decoration, so it carries no meaning beyond "done".

Example palette: ink `#17120A`, amber `#FFB21F`, success `#B8F25A` (ink `#2C4A00`), failure `#E8382D` (ink `#FFE0DB`), category dark `#2A2F6C`, category pale `#DFE6F3`, reference A `#2F6FE0`, reference B `#B03AD6`, comment `#FFF4C7`, gridline `#DAD9D3`, pastel scale `#D4F57A` `#FFF09A` `#FFC99E` `#FFB3C9` `#B9DCFF` `#A8EFD5`.

## 5. Type and captions

One face: Inter (SIL OFL), with a CJK fallback only when the spoken language needs it.

| Role | Weight | Size (16:9) | Where |
|---|---|---|---|
| Cell values | 500 | 11 px × zoom | inside cells |
| Header letters | 500 | min(18, 12 × √zoom) px | column and row headers |
| Typed formula in a cell | 700 | 17 px × zoom | the active cell while editing |
| Merged labels | 800 / 600 | 24 / 17 px × zoom | block and group labels |
| Big results | 800 | 40–60 px × zoom | result ranges |
| Sheet title | 800 | 50 px × zoom | a merged range, typed |
| End card | 800 | 76 px × zoom | the last merged range, typed |
| Comment caption | 600 / 500 | 36 / 25 px | the yellow note |

- **Caption** is a cell comment: a `#FFF4C7` box, 1.5 px ink border, 104 px tall for two lines, a 14 px red triangle in its top-right corner; fades in and out over 0.12 s. Hold ≥ max(1.8 s, spoken line + 0.6 s). One language, the spoken one.
- **Formulas** are typed a character at a time; function names in ink, range names in their reference colour. Use readable named ranges (`sales`, `region`) instead of `B3:AC27`.
- Numbers on screen are always values in cells, never floating text.

## 6. Motion

- **Frame rate.** YouTube at 24 fps, reels at 30 fps; continuous.
- **Typing** paces a formula over 0.9–1.4 s (one key event per character); Enter commits it, and the answer pops 30 % larger, shrinking back over 0.2 s.
- **Painting** runs as a ring from the result cell out over the data; each cell paints when the ring reaches it, with a tick whose pitch climbs across the whole run.
- **Selection hops** move cell to cell in 7–9 steps over about 0.5 s, never gliding.
- **Flights**: a cell travelling to a pivot bar snaps to whole cells along an L-shaped path (rows first, then columns), eased in-out, 1.35× faster on rows; bars build bottom-up, successes first.
- **Unhide**: hidden columns open one after another, left to right, across about 1.3 s.
- **Enter pulses**: a pastel ring (speed 16 cells/s, 0.75 s) runs out over the white sheet from a committed result.
- **What never moves**: the shell (bars, headers, tabs, status). Only the sheet moves under it.

## 7. Camera

| Move | What it expresses | What it can serve |
|---|---|---|
| Close on a cell (zoom 2.7–2.9) | the question, the single value | typing a formula, one person in the data |
| Pull back (log zoom to 0.8–1.1 over 1.5–2.5 s) | the whole population | painting, the overview |
| Whip across the sheet (0.45 s, ease in-out) | "look over here" | jumping to a clue, a hidden column |
| Track along a row (about 2 s) | reading a block | following one variable |
| Wide (zoom 0.36–0.5) | the whole sheet at once | the unhide, the pivot, the bloom |
| Landing (scroll down to a merged range at 100 %) | the conclusion | the end card |

Zoom interpolates in log space; the camera's column coordinate rides the reflowing layout, so it stays on its target while columns unhide. Transitions: sheet moves only, plus a tab switch for chapters. Forbidden: cuts to anything that is not the sheet, 3D tilts, zooming the shell, blur.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Voice | one clear, friendly narrator | about 8 dB over the music |
| Music | 120 BPM in a major key: a groove of kick, hats, electric bass and piano stabs; marimba and glockenspiel lines; a rising arpeggio for the final bloom | ducked about 42 % under the voice |
| Foley | a key click per typed character, Enter as a clack with a low thump, soft clicks for hops and menu items, high clicks panned left to right as columns unhide, a 16 ms blip per painted cell climbing from about 1,300 to 3,000 Hz, a blip per landing cell pitched by its height in the bar, pops for counts and rates, a small ding for a winner, low-passed whooshes for camera moves | ducked about 35 % under the voice |
| Ambience | a very quiet office room tone | bed |
| Silence | one real silence before the turn, broken by a clock tick and a held low note | |

Pack ids as in Formats. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **Formula as a line.** The active cell types a formula, its named ranges light up with coloured reference boxes, Enter, and the result pops. Fits content like: asking the data a question; a definition; a quick calculation.
2. **Paint by rule.** A conditional-format rule shows in the toolbar, then a ring of painting spreads out from the result over every cell. Fits content like: who succeeded; which days lost money; where the outliers are.
3. **Unhide.** Select all, right-click, "Unhide columns": columns open as a ripple, the grid reflows and a new variable appears between the old ones. Fits content like: a confounder; the fee nobody saw; the context that flips a result.
4. **Cells into bars.** Every painted cell hops along the grid into pivot bars that build bottom-up, so the chart is made of the data itself. Fits content like: grouping; before and after; ranking.
5. **The comment.** One cell gets a yellow note with a leader line: who this is, and what the sheet does not show. Fits content like: one person behind the numbers; a caveat; a source.
6. **The winner fills.** A result range crossfades from white to lime over 0.25 s with a ding. Fits content like: the better option; a target met; the answer.
7. **Colour-scale bloom.** At the end, the whole sheet fills in pastel bands from a centre, cell by cell. Fits content like: a finale; "everything adds up"; a celebration.
8. **Typed end card.** The camera lands on a large merged range and the title is typed into it. Fits content like: the title; the takeaway; a call to action.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D, drawn from `t`: `layout(t)` computes column x positions (hidden columns animate their widths), `camera(t)` interpolates keyed centres in column/row units and log zoom, then sheet, headers, shell, menu, cursor and comment draw in that order.
- The data lives in code: one object per unit with its home cell, its destination cell, its paint time and its flight times; build home and destination maps keyed by `col,row` so the sheet loop looks each cell up once.
- Merged ranges are a table `{name: [c0, c1, r0, r1]}`; formulas are arrays of `[text, colour]` parts typed by time.
- A timing table `T` holds every beat, aligned to the voice's phrase starts; camera keys reference it.
- Draw only visible rows and columns; batch gridlines into two Path2D strokes.
- One sound event per key, Enter, painted cell, lift, landing, unhide, click, pop and win into `cues.json`; long runs (hundreds of paints) become one cue per cell with low gain.

## 11. Pitfalls

- **A real product's look.** No logos, product names or brand colours; a generic shell with neutral greys.
- **Ranges no one can read.** `B3:AC27` means nothing on screen; name ranges.
- **Values too small.** Below 6.5 px values vanish; zoom in for any number that matters, and put key numbers in merged result cells.
- **Gliding cells.** Anything that moves between cells must snap to the grid.
- **Colour drift.** Once lime means success, it means success for the whole film.
- **Fake data.** One cell is one real thing; take counts from the source and keep a facts file with each number's origin.
- **Shell zooming.** If the toolbar grows, the illusion breaks.

## 12. Variation space

The agent decides per video: the dataset and what one cell stands for, the outcome colours' meanings, the hidden variable, the formulas, which reveal is the turn, tab names.

- **Three structures:** a paradox (the total says one thing, the hidden column says the opposite); a build-up (one row typed, then the rule fills a thousand); a sorting story (unsorted cells fly into ranked bars, the last one surprising).
- **Three openings:** a formula being typed in a close cell; the whole sheet painted at low zoom, then a dive to one cell; a single comment on a single cell asking a question.
- **Three endings:** the colour-scale bloom; the camera landing on a typed end card; a pull back to the full painted sheet with the final result lit lime.
