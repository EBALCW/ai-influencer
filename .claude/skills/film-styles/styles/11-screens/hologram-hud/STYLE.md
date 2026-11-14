# Sci-fi Hologram HUD

> An object is scanned into a glowing wireframe. Target boxes lock onto its parts; each opens in a local exploded view, a leader pulls out, and its number rolls from garbage glyphs into the real value. It may light up, once, into a solid hologram. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): the heads-up displays of superhero blockbusters (target boxes, callouts, rolling numbers, layered depth); the interfaces of minimalist near-future sci-fi (one colour, hairlines, space); CAD exploded views. Copy none of their layouts, icons, fonts or colours, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The stage, dot grid and corner brackets bleed to the edges; everything to be read sits inside the safe box (x 72–900, y 269–1248). Stack, don't shrink: where 16:9 puts the subject beside its cards, the reel puts it above them. The subject and its pad are centred on x 540 between y 420 and 900, filling at least 600 px of width; the spec card sits below it (x 72–900, y 930–1090) with the leader dropping straight down from the part; finished chips dock in a row under the subject // mode label (y 330–380) instead of a side rail; the subtitle plate is centred on x 540, at most 720 px wide, baseline near y 1200. The orbit camera's screen offset moves the target up, not sideways; long parts are stood upright, so a lateral dolly becomes a crane.
- **The first 3 seconds.** Frame 1 is the scan plane already halfway up the wireframe, its front hot. By 0.5 s the first target box snaps onto a part on the downbeat and flashes white; by 3 s the leader is out and the first number has rolled from glyphs into its accent value: the payoff, inside 3 seconds.
- **Length and pace.** 20–40 s at 30 fps on ones. Two to four parts, one bar (about 2 s) per lock, each value held ≥ 2.5 s before it docks; one beat of digital silence before the biggest value.
- **Captions.** The HUD subtitle plate with its voiceprint bars, in the spoken language, Rajdhani Medium at 44–48 px; never on the wireframe.
- **Sound.** `metallic-riser` into the scan-in, `latch` on each target lock, `typing-tick` under rolling digits, `clean-ding` when a value turns accent, `zoom-swish` on whips, `shimmer` on the one solid-hologram ignition. The synth score, servo and pneumatic foley and the projector hum come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** The body as written: subject beside its cards, the chip rail on the other side, subtitles bottom centre. Lift the subtitle plate and the bottom telemetry line above y 950 (the player's controls cover the bottom 12 %), and keep brackets, rulers and the status line inside the 5 % margins.
- **Length and structure.** 2–6 min at 24 fps on ones. A chapter is one part, or one layer of a teardown. Its title card is the scene itself: a target lock, then the part's name rolling in like a value with a mono chapter number. Between chapters the scan plane erases and rescans, or the loupe iris opens. Re-hook every 30–60 s with an explode, a loupe, an old-to-new roll or a drop in the score.
- **The first 10 seconds.** One part locked in close-up, its number rolling into accent; by 5 s the question (what makes this possible?) as the camera pulls back and the rest scans out from it; by 10 s the promise, an empty chip rail with one slot per part to come. Any channel sting after that.
- **Captions.** The subtitle plate burned in as HUD, plus an `.srt`.
- **Thumbnail.** The frame where the key value locks in accent beside its exploded part; the number and unit as the words.

### Good for

Spec walkthroughs, teardowns, hardware launches, upgrade comparisons, trade-show loop screens, engineering explainers on YouTube.

## 1. Essence, and what it is not

A **scene style**: it does a practical job (a spec walkthrough, a teardown, a loop screen) for any object with parts. See §11 for the jobs.

The subject is always a **line wireframe made of light** above a round projector pad on a near-black stage, never a rendered object. Everything reads as *scanned data*: a scan plane grows the model, parts pull apart along their assembly axes, numbers are *computed* on screen.

Three depth layers are always present: a **background dot grid** (slow parallax), the **subject** with its pad and floor, and the **foreground HUD** (corner brackets, rulers that parallax faster, status text).

Not a type-driven keynote (**Dark Tech Keynote**), not a drafting sheet (**Blueprint**), not a product render (**Glass Product Render**). The subject stays a wireframe; it may gain translucent faces once, and even then the lines stay on top.

## 2. Materials & rendering

- **Stage**: near-black tinted by the hue, a radial lift behind the subject, a fading dot grid, a strong vignette.
- **Projector pad** in true perspective: concentric rings (one bright, one dashed), ticks, faint rays; it rotates slowly and spins with any turntable move.
- **Wireframe**: additive ~1.3 px strokes in a few alpha levels set by **depth fog** (near bright, far ~25 %), plus two low-res glow passes.
- **Hot edges** (near-white of the hue) only for what matters now: the scan front, inner pieces marked hot when opened, a light wave, a part being pinged.
- **Real CAD topology**: tubes are rings plus longitudinal lines. **Every part is physically connected**: a floating piece is noticed first.
- **Solid hologram**: faces filled with a screen-space **Fresnel** × a scrolling **interlace**; lines thicken as it ignites; a light wave climbs the model. A **beam** (one path, nonzero winding) with faint rays and dust.
- **HUD furniture**: corner brackets, parallaxing rulers, subject // mode top left, a live status line top right, telemetry at the bottom.
- **Text never sits on the wireframe**: every text block has its own **dark plate** (translucent near-black, 1 px border, corner ticks); the camera still keeps the subject clear of text.

## 3. Colour logic

- **One cold hue plus one warm accent**, both parameters (e.g. mint/orange, violet/lime, ice-blue/red; choose from the subject).
- The hue carries lines, HUD and fills. The **accent is spent on locked values only**: a number turns accent-coloured at the frame it becomes true. Nothing else ever uses it.
- White is heat: near-white edges and one-frame flashes mark what is active. Everything at rest sits in the hue's alpha levels.
- One object may keep its own colour (the single-colour exception), for a brand mark, never for decoration.

## 4. Type & subtitles

- Rajdhani, all caps: Light for big numbers and the product name (wide tracking), Medium/SemiBold for labels. Share Tech Mono for micro data (coordinates, counters, zoom).
- Numbers are **monospaced** so rolls never jitter; the decimal point is a small square (a glowing "." reads as a comma).
- Subtitles are HUD: a dark plate with corner brackets and "voiceprint" bars moving with the speech, near-white Rajdhani Medium, bottom centre; in just before the voice, hold ≥ max(1.8 s, speech + 0.6 s), at most about eight words per plate.
- The title is part of the scene (no title card): the name rolls in like a value, then code, category and tagline.

## 5. Motion quality

- **Everything on ones at 24 fps** (30 in a reel). Only glyph scrambling steps, every frame.
- **Target lock**: oversized, rotated 45°, faint; snaps to fit in ~0.2 s (cubic ease-out), flashes white 3 frames on the downbeat.
- **Explode** along each piece's assembly axis: the shell slides *along its own axis*, the contents stay in place and glow. Open over a beat or two, close fast.
- **Leader**: anchor ring → diagonal → horizontal to the card in ~0.5 s (straight down to the card in a reel). **Rolling value**: characters lock right-to-left and turn accent on the downbeat with a one-frame flash.
- **Chip dock**: a finished value slides into a side rail (a top row in a reel) and stays until the end.
- **The camera follows the box**: cubic ease, starting *before* the next lock, **real motion blur** only inside the whip (sub-frames, 180° shutter); HUD stays sharp.
- **No cuts or fades inside the scene**: only the scan plane (scanning in or erasing) and a loupe iris. A **glitch** of three frames at most once, on the biggest change.

## 6. Camera grammar

An orbit camera (yaw, pitch, distance, narrow fov) with a screen position for the target, so the subject can sit beside text (above it in a reel). A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| High 3/4, slow orbit craning down | Examination; a scan plane reads as an ellipse | a scan-in; a survey |
| Top-down plan view | Layout, order | a parts inventory; an assembly sequence |
| Eye-level profile, locked | The object as it stands in use | a height; a before/after |
| Push-in, then drift, 3/4 | This part matters; internals come towards the lens | the key spec; a flaw |
| Whip following the target box | Attention jumps to the next part | a list of parts |
| Orbit around a part's own axis | Axial structure only reads in rotation | rotors, stacks, hinges, lenses |
| Lateral dolly along a long part | Length, a path | a beam; a cable run |
| Pull back + loupe (frame in frame) | Where (wide) and what (loupe) | small parts; a sensor |
| Crane to eye level or back up | Status change: the object stands up or settles | a transformation; scale |
| Turntable 360° | Every side | a whole object; a symmetry |
| Nearly static, slow dolly | Reading time without a dead frame | a spec sheet; a checklist |

Framing: the subject is ≥ ⅓ of frame height at every key moment. Cards on one side, the chip rail on the other, subtitles bottom centre, a loupe above them: never colliding. Shorten explode vectors rather than fly a piece into text.

## 7. Sound palette

- **Music first**, on a grid (a bar = one information beat); locks land on downbeats, checked against the score.
- **Synth palette**: saw/square arpeggio with ping-pong delay (scooped 1–4 kHz for the voice), square pulse, 8th bass, synth hats and claps, detuned saw pads.
- **Density follows information.** Tools to pick from, in any order (most videos need two or three): half-time for reading time; one beat of **true digital silence** (nothing, not even UI blips); a drop (808-style glide + wide saw chord) for the biggest change; a layer added or removed per part; deceleration by longer note values; a key change; a single sustained tone under a long hold.
- **Foley follows the material**: light = sines and FM blips **in the key**; machines = servo slides, pneumatic puffs, hydraulic hiss, metal tinks (J-cuts); a lock = thump + clack + two-tone beep; rolls tick at frame rate. Ambience: projector hum (40/80/120 Hz) and room tone.
- **Voice**: one calm, confident narrator. Duck music *and* foley with a **held** envelope (no pumping between words); lock transients escape. Master −14 LUFS.

## 8. Native moves

Each move serves information, not story. A menu: use the ones your video needs.

- **Scan growth = "this is real data."** *Fits content like:* a coffee machine; a satellite; an architectural model.
- **Target lock = "look here now."** The box is the camera. *Fits content like:* a car's sensors; a laptop's ports; a robot arm's joints.
- **Local explode = "why the number is true."** *Fits content like:* the burr set of a grinder; the layers of a running shoe sole; the elements of a camera lens.
- **Rolling digits = the payoff beat.** *Fits content like:* a brew temperature; a tolerance in microns; a price.
- **Chip accumulation = reading time.** *Fits content like:* 3–5 facts that must all be read.
- **Loupe = two scales at once.** *Fits content like:* a screw inside a watch; a chip on a board; a valve in an engine.
- **Solid hologram + beam = "the whole is ready."** Once, if at all. *Fits content like:* a launch reveal; a finished assembly; a v2 replacing v1.

## 9. Pitfalls of the medium

- Target boxes balloon → box the rest pose, skip internal pieces, give long attachments no box.
- Long diagonal leaders point at the wrong part → ring on the part body, flash the part.
- Two parallel boxes moving don't read as an explode → shell slides on its axis, contents stay and glow.
- A part built from generic boxes doesn't read as that part → give it its characteristic silhouette.
- Voice masked by foley, not music → duck foley too, hold the duck through word gaps.
- UI blips inside a silence break it → check cues against silence windows.
- A whip written inside the next segment plays as a hard cut → start it in the previous one.
- In a reel, a card or chip below y 1248 or right of x 900 sits under the app's buttons; on YouTube, the bottom telemetry line must clear the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Canvas 2D (or WebGL), the whole frame drawn from `t`, with your own projection from the orbit camera plus a screen offset. Draw order: stage and grid, pad, wireframe, glow, faces, HUD last.
- Models are line lists built from primitives (tube = rings + longitudinal lines, ring, disc, box, wheel, battery cells) or extruded from any 2D outline path; each part carries its assembly axis, an explode distance and flags for hot inner pieces and boxless attachments. Normalise every model to a unit size on load, so the same cameras work for any object.
- Wireframe as additive strokes in a few alpha levels from depth fog, plus two glow passes drawn into half- and quarter-resolution canvases, blurred and added back. The scan plane clips lines by height and draws its hot front; explodes offset each part along its axis.
- The solid hologram fills faces with a screen-space Fresnel term times a scrolling interlace; the beam is one path filled with nonzero winding. Whip motion blur averages sub-frames (180° shutter) for the 3D layer only; the HUD is drawn sharp on top.
- Glyph scrambles pick characters from a hash of character index and frame, so every seek gives the same garbage; digits lock on the score's downbeats (a beat table shared with the music), subtitle plates on the voice's word timings.
- One cue per visible event in `cues.json`: scan-in, every lock, roll ticks, whips, the ignition, the glitch.

## 11. Variation space

You decide the object, its model, which parts and in what order, the opening, the ending, the camera path, the colours, the pacing and the music. Use cases are **grammar for the order and duration of information**; build your own timeline from the user's facts.

| Use case | Information order | Hold per layer | Length |
|---|---|---|---|
| **Spec walkthrough** | Name + tagline → one spec per part (label, value, unit, detail) → weight / price → CTA | Title ≥ 5 s; value ≥ 2.5 s, then docked; final sheet ≥ 3 s | 30–40 s, 2–5 parts |
| **Loop screen** | Name → 3–5 specs → CTA, no voice; last frame = first | 3 s per spec, 5 s final | 20–30 s loop |
| **Teardown** | Part → what it does → one number; internals only when opened | 4–6 s per part | 40–60 s |
| **Upgrade** | Part → old value (dim) → new value (accent); old part scan-erased, new one scanned in | 3 s per upgrade | 20–30 s |
| **Assembly order** | Step number → part name; parts snap home one by one | one bar per part | 20–40 s |

On YouTube, each part of a teardown or walkthrough can grow into a chapter with longer holds.

- Structures: **a loop screen** that never names a product and cycles five sensors; **a teardown** one layer deeper per shot until the core is a single hot piece; **an upgrade** where two versions share the pad and every number rolls from old to new.
- Openings: **a part first** (one component locked in close-up; the rest scans out from it); **a flat outline** (a 2D silhouette extrudes into the wireframe); **plan view** (top-down, the pad as a dial, the object arriving as its footprint).
- Endings: **one value at eye level** (the wireframe dims around the single number that matters); **knolling** (parts fly into a labelled top-down layout); **power-down** (edges cool, HUD panels switch off until only the pad glows).
