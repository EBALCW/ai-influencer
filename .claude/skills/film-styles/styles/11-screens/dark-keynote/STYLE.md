# Dark Tech Keynote

> A software launch video where the interface itself is the star: near-black gradient, hairline grid, soft light, one brand accent, and UI that moves with snap-grid precision. Light reveals, one giant number, and a sound design that is as ordered as the pixels. A 9:16 reel, or a 16:9 video for YouTube.
> **References (grammar only):** the big hardware makers' product reveals (black stage, light sweeps, one line per screen, the lone giant number); the launch videos of developer-tool and payments startups (snap-grid motion, 1 px lines, one accent); minimalist process music (phasing, subtraction); the fast insert cuts of kinetic comedy editing. Never use their names, interfaces, fonts, system controls, melodies or logos, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** Stage and grid bleed to every edge. The one focal element sits in the upper middle of the safe box (x 72–900, y 269–1248), around y 500–1000; the caption toast is centred on x 540, at most 720 px wide, baseline near y 1190, and product content lifts while it is up. Stack, don't shrink: side-by-side windows stack top and bottom; the snap grid becomes a tall grid (4–6 columns, 8–12 rows); a lateral track becomes a vertical track down a list; a pull-back opens upward from one point low in the frame. The giant number gets its own screen, centred, Inter Tight 600 at 320–380 px, inside the safe box.
- **The first 3 seconds.** Frame 1 is a locked extreme close-up on the blinking cursor in a window already crowded with problem-red badges. By 0.5 s the first notification drops and bounces on the beat; accumulation doubles each beat, and at about 2.5 s everything freezes mid-air at digital zero. The viewer stays for the snap.
- **Length and pace.** 20–40 s at 30 fps on ones. Shots 1–3 s, half-second inserts in the overload, every move landing on the beat. One ~1 s freeze before the snap; the big number holds 2 s alone.
- **Captions.** The bottom toast is the only caption layer, in the spoken language; text the cursor types in frame is never burned twice.
- **Sound.** `ui-click` on cursor ticks and presses, `ui-pop` on each notification spawn, `typing-tick` under typed text and the digit scramble, `zoom-swish` on each UI expand or whip pull-out, `shimmer` under the light reveal, `sub-impact` on the snap. Tuned percussion and pads from a free sample library (VCSL is CC0), plus notification glass, low-profile keys and fan room tone.

### YouTube (1920×1080)

- **Layout.** The body as written: dark stage, hairline grid, one focal element in generous negative space, the toast bottom centre. Keep the toast's baseline above y 950 (the player's controls cover the bottom 12 %) and the number and every label inside the 5 % margins; only grid and stage bleed.
- **Length and structure.** 3–6 min at 24 fps on ones. A chapter is one feature, or one problem and its turn. Its title card is a UI element: a tab expands into the frame with a mono small-caps label (`02 · SYNC`) and collapses into the first shot. Re-hook every 30–60 s with a new accumulation, a dive into a small element, or a number from glyph noise.
- **The first 10 seconds.** The giant number scrambling to its value on black, the question typed into a search box by 5 s, the promise by 10 s (the cursor snaps a few windows home). Any channel sting, the accent dot growing into the mark, after that.
- **Captions.** The toast burned in as part of the UI, plus an `.srt` that also carries the typed text.
- **Thumbnail.** The frame just after the snap grid lands, one tile lit in the accent, or the giant number alone; at most three words.

### Good for

SaaS and feature launches, developer-tool changelogs, pricing reveals, workflow before-and-afters, product keynotes on YouTube.

## 1. Essence, and what it is not

A keynote-grade product video for **software**. There is no physical product and no glass render: the protagonist is the interface (a cursor, windows, notifications, tiles, a number). It lives on a dark stage lit by soft, cool light, with **one brand accent** reserved for the single most important element.

The style is defined by **precision**: every element snaps to a grid, every motion lands on a beat, every sound belongs to one designed family. Drama comes from contrast: disorder shown as generated UI, one decisive action, then empty space.

Not **Glass Product Render** (no physical object), not **Living Screencast** (no real OS or apps), not **Sci-fi Hologram HUD** (no scanlines), not **Data Storytelling** (one number, not a chart).

## 2. Materials & rendering

- **Stage**: a near-black base with a radial lift at the upper centre, one large cool glow at single-digit opacity off-centre, a 50–55 % corner vignette. A hairline grid (white at ~3 %, every 4th line ~6 %) on a 48 px module. No grain.
- **UI kit, all original and drawn in code**: rounded windows (title bar with only a small glyph and title; never traffic-light buttons, menu bars or docks), notification cards, file icons with mono filenames, procedural thumbnails, list rows, tabs, badges, bars, uniform tiles.
- **Surfaces**: three steps of raised dark surface, 1 px border (~8 % white), 1 px inner top highlight, soft shadows.
- **Depth**: a 2.5D camera (`s = 1/(1/zoom − z)`); cards near the lens blur with magnification. Rotations use strip-rendered perspective (rotY ≤ ~24°).
- **Light** is the reveal tool: only pixels the light has passed turn on; unlit areas sit at a few percent.

## 3. Colour logic

- A cool neutral ladder only: near-black stage, three surface steps, text in three greys (primary, secondary, label). Neutrals are slightly blue, never warm brown.
- **One accent**, saturated and luminous, with its own glow. It is reserved for what the product *is* or *does*: the protagonist element, the call to action, confirmations, the key number. If two things are accent-coloured, one is wrong.
- **A problem colour** (typically a red for badges and warnings) may exist only while the problem exists; after the turn it never returns. Problem colour = noise, accent = the product.
- Secondary hues only as **category codes** in motion (a trail per data type), desaturated, and never on static UI.
- Example accents, pick one per video: lime `#B7F34A`, electric violet `#8B7CFF`, signal orange `#FF7A1A`.

## 4. Type & subtitles

- **OFL faces**: Inter (UI, captions, headlines; variable weight), Inter Tight 600 for giant numbers (tracking around −4.5 %), JetBrains Mono for labels, filenames and status text (wide tracking in small-caps labels).
- One line per screen for headlines. The big number gets its own screen and **no caption over it**: the number is the message.
- **Captions are a UI component**: a bottom-centre toast (dark translucent pill, 1 px light border, soft shadow, Inter 500 around 40 px in 16:9 and 44–48 px in a reel, a small accent "speaking" dot). It enters with a small rise + fade in ~0.16 s and can turn more opaque over busy frames. Hold ≥ max(1.8 s, speech + 0.6 s); at most about eight words per toast.
- **Typed text is its own subtitle**: text the cursor types in frame is not burned twice (it goes only into the `.srt`).
- Lift product content while captions are up so toasts never clip it.

## 5. Motion quality

- 24 fps on ones (30 in a reel), no stepping, no boil: this is precision, not craft.
- **Everything lands on the grid and on the beat.** Moves start a beat early and land on it. Easing is fast-out with one small overshoot (`back`, s ≈ 1.3) and an immediate settle. No floaty sine drift.
- **Spawns are short and typed** (drop + bounce, fling, slide-in, pop; 0.2–0.3 s), one motion per element type. Tension can be a tremble of a few px.
- **Flights** follow curved paths with overshoot along the final tangent; same-type elements bend the same way and never cross.
- **A living element can act**: squash, stretch, anticipation (≥ 8 frames of wind-up), a 2-frame contact, spring follow-through. The blink of a cursor makes a natural metronome.
- **Disappearing is designed** (retract one part per beat, CRT-off squash into a point); nothing just fades.
- The stage and grid never move on their own; only the camera moves them.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| Locked extreme close-up on a tiny UI element | Intimacy, one thing alive on a screen | a single action; a thought forming; a quiet status |
| Continuous pull-back, keyed per bar in log space | Accumulation, scale growing out of one point | spreading load; a network growing; a team joining |
| Push-in through a frozen frame | Time stopped, focus narrowing | a decision; the instant before a commit; a bug found |
| Whip pull-out in one beat | Cause and effect seen at once | a sync completing; a deploy landing everywhere |
| Dive into a small UI element (log-zoom) + match cut | Going inside the detail | a counter that matters; a log line; a setting |
| Half-second inserts expanding from their source | Overload, too much to read | notification storms; errors; choice overload |
| Near-locked frame while an object turns and light sweeps | Presentation, the product as hero | a reveal; a new version; a feature name |
| Slow lateral track across a UI plane (vertical in a reel) | Order read by the eye | a timeline; a pipeline |
| Top-down plan over the grid | System view, structure | architecture; permissions; a workflow map |
| Return to an earlier framing | Rhyme: what changed | before/after; a loop closed; an echo |

Framing: generous negative space, one focal element, the accent at the focal point. Dutch angle and wobble only for disorder.

**Transitions = UI expand / collapse**: every shot change is an interface element expanding into the frame or the frame collapsing into an element. No fades, no blank frames. An expansion on a beat starts one frame early so the beat frame is already ~80 % open.

## 7. Sound palette

- **Tuned percussion and pads**: marimba, vibraphone (mallet or bowed), glockenspiel, celesta, a synth pad or drone, a low sine pulse, a shaker, plucked synth, felt piano. Clean, dry, minimal; samples e.g. VCSL (CC0).
- **Music as a visible process**: options include phasing (two voices on one pattern, one drifting), additive build (one note per bar), subtractive process (notes removed until one is left), dividing the beat to accelerate instead of changing tempo, or one chord that everything lands on. Picture events can spawn on score notes from a shared note table.
- **Two sound families = story**: disorder sounds *scattered* (detuned by tens of cents, random pans, a different timbre per source); the product's sounds are *one family* (felt ticks, glass taps, all in one mode, centred), so many landings form one in-key shimmer.
- **Foley materials**: cursor tick, low-profile keys, notification glass, file plop, window whoosh, glitch accents, stacking thumps, felt mallet + sine drop for a press, light-sweep shimmer, digit grains, CRT-off.
- **Ambience**: a quiet room, a computer fan, a high coil whine that can grow with pressure. Fan and whine live in the voice band: keep them down until a line ends.
- **Silence is a tool**: digital zero on every track when the screen pauses; near-silence (a −60 dB room) for a breath. The first sound after a silence is the most important one.
- **J / L cuts** carry sound across UI transitions (a chord ringing on, a shimmer arriving before the light).
- **Mix**: music ducks ~8 dB and foley ~4 dB under voice; master −14 LUFS; no grain. **Voice**: one confident, restrained narrator, short declaratives.

## 8. Native moves

A menu: use the ones your story needs.

- **Generated accumulation.** UI spawned by rule, faster and faster, hundreds of items; you don't draw the mess, you generate it. *Fits content like:* unread tickets piling up; cloud costs creeping; a dependency tree exploding.
- **The snap grid.** A whole promise in one motion: everything flies into a grid in one beat; the grid stays invisible until then. *Fits content like:* a CMS publishing to every channel; a scheduler filling a week; an audit turning green.
- **The living element.** The cursor (or the product's smallest live element) is the protagonist and the brand mark. *Fits content like:* a search box that grows ambitious; a progress ring that refuses to finish; a status dot.
- **Freeze.** Everything stops mid-air and the sound drops to digital zero; only a screen can stop time like this. *Fits content like:* a security breach caught; a failed deploy; the second before "send".
- **Light reveal.** A soft band sweeps across and only lit pixels turn on (soft front, glint ≤ 20 %, ≤ ~1.3 s so nothing stays dark). *Fits content like:* a redesign; a new pricing page; an API console.
- **Number from glyph noise.** Digits scramble and lock one per sixteenth note with a small bounce. *Fits content like:* latency cut; a count of users; a price.
- **Type streams.** Elements fly to their own rows along coloured curved trails, so categories read as streams. *Fits content like:* an inbox triaged; logs routed by severity; files synced by device.
- **Put-away.** The UI dismantles itself one part per beat until one element is left. *Fits content like:* "less is more" features; offboarding; focus mode.

## 9. Pitfalls of the medium

- Strip perspective of a semi-transparent canvas shows vertical seams (overlapping slices double alpha) → project the *opaque* surface, then light it in screen space.
- A hard white glint reads as a sticker reflection → soft front, glint ≤ 20 %.
- Nearest-slot snapping looks like a flicker, not a collapse → typed destinations, curved paths, trails.
- Too few elements leave holes in a grid that read as a mistake → generate by rule, then trim or pad to exactly the slot count per group.
- A flat tinted rectangle for "closing" looks like a placeholder → squash the real surface.
- A toast or number below y 1248 or right of x 900 in a reel sits under the app's buttons; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D, the whole frame drawn as a pure function of `t` at twice the size. Draw order: stage gradient and glow, hairline grid, panels and UI kit, trails, the lit layer, the caption toast last. One accent colour is set once and every component reads it.
- Light reveals as a mask: draw each surface at a few percent, then redraw it through a soft moving band (soft front, glint ≤ 20 %), so only pixels the band has passed turn on.
- A 2.5D camera with `s = 1/(1/zoom − z)` per layer; blur grows with magnification for cards near the lens. Rotations cut the *opaque* surface into vertical strips and scale each strip, then light it in screen space.
- Generated accumulation and the snap grid from seeded rules (hash the item index): each item has a spawn time, a typed destination slot and a curved flight with overshoot, so seeking any frame gives the same mess and the same landing. Digit scrambles pick glyphs from a hash of the digit and the sixteenth-note step.
- Spawns and lands come from one note table shared with the score; the voice's word timings place the toast captions and the decisive action.
- One cue per visible event in `cues.json`: spawns, clicks, snaps, swishes, the light sweep, the lock of each digit.

## 11. Variation space

You decide the product's verb, the protagonist element (or none), the problem image, the accent, the structure, the opening, the ending, the camera path and the score process. Vary them per video:

- Structures: **a countdown** (a release checklist ticking through its items, each a UI moment, ending on "shipped"); **side by side** (two versions of a workflow run in split screen, stacked in a reel, the old one drowning, the new one finishing early); **a zoom ladder** (one pixel → a component → a screen → a fleet of devices, each level a new fact).
- Openings: **the number first** (a huge stat on black, its meaning revealed backwards); **a plan view of an empty grid** that fills slot by slot; **a hard insert storm** from frame one, calm arriving only later.
- Endings: **one tile left** lit in the accent on an empty grid; **the product running quietly** in a wide shot, no text; **a shipped state** (a single confirmation toast, then darkness).
