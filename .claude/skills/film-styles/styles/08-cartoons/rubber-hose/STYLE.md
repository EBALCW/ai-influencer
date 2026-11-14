# 1930s Rubber Hose Cartoon

> Black-and-white hand-inked cartoons where every object is alive and swings to a hot jazz band. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): early Fleischer Studios shorts (c. 1930–33) for "the whole world dances", surreal transformation, the bouncing-ball singalong and ink-and-pen framing devices; *Cuphead* for how a modern team finishes the look and scores it with a big band. Never use an existing cartoon character, name or silhouette, and never copy designs, melodies or logos. **Avoid the "cup-head on a human body with a straw" design**: if your hero is an object, the *whole object is the body*.

## Formats

### Reel (1080×1920)

- **Layout.** The whole frame is the print: no pillarbox, rounded gate corners and vignette at the screen edges. The floor line sits near y 1350, so faces and gloves play between y 650 and 1200 inside the safe box (x 72–900, y 269–1248); only feet and floor run under the app's buttons. Stack, don't shrink: floor, counter, shelf and clock stack on one painted wall, so a chase climbs and falls instead of crossing, and the trucking pan becomes a tilt beside a climber. The title-card subtitle is centred on x 540, at most 720 px wide, at the top of the safe box (y ≈ 300), or at y ≈ 1120 when the action is high.
- **The first 3 seconds.** Frame 1: the hero mid-squash in a medium shot, the set breathing with it, the band already playing; no iris from black, no title card. By 0.5 s an anticipation crouch snaps into the first move. By 3 s the band stops dead and the hero stares at the goal or the threat; the chase starts on the next downbeat.
- **Length and pace.** 20–40 s. Shots of 4–8 beats, one band stop before the main gag, every take held at least 1 s. 90, 120 or 180 BPM keep each beat on whole frames at 30 fps and on whole drawings on twos.
- **Captions.** One language, on the period title card (about 50 px, at most two lines), weaving and flickering with the print.
- **Sound.** `thock` for wooden landings and the snap out of a hold, `tick` for each glance in a thinking hold, `ratchet` under a wind-up crouch, `ui-pop` as a title card pops on, `latch` when the iris is grabbed shut, `clean-ding` as a transformation lands. The hot dance band and porcelain, glass and spring foley come from a free sample library or the user's music; the whole mix goes through the optical-soundtrack pass.

### YouTube (1920×1080)

- **Layout.** Section 2 as written: the 4:3 gate in a black pillarbox. Title cards stay inside the gate and above y 950, so the bottom card sits at about y 860–940; nothing must-read in the pillarbox.
- **Length and structure.** 2–6 min at 24 fps. A chapter is one routine (a place, a goal, gags building to a peak where the whole world dances), opened by a window-shade title card (Shrikhand, Limelight sub-line) as the band changes key. The theme returns in a new arrangement each chapter; re-hook every 30–60 s with a band stop, a transformation or a new instrument on the melody.
- **The first 10 seconds.** The best gag image first, the problem by 5 s (a band stop and a stare at it), the promise by 10 s from the announcer; the title card rolls up as the sting after that.
- **Captions.** The title cards stay burned in, plus an `.srt`.
- **Thumbnail.** A hard-cut face close-up: pie eyes wide, "O" mouth, gloves flung up, with at most three words in Shrikhand.

### Good for

Retro ads, food and drink, jingles and slogans, mascot introductions, kids' lessons, holiday greetings.

## 1. Essence, and what it is not

Hand-inked black-and-white animation from the early sound era: characters with **rubber-hose limbs** (equal-width tubes, no elbows, no knees), **white four-finger gloves**, **pie eyes** (black oval pupils with a wedge cut out), huge round shoes, and bodies that squash and stretch like balloons. The backgrounds are soft grey watercolour paintings; the characters are flat white, grey and ink. Everything (furniture, machines, plants, the walls) **breathes in time with the music**. The picture looks like a worn 35 mm print projected in a 4:3 gate: flicker, scratches, dust, gate weave, vignette.

Not a 1950s flat cartoon (no limited animation, no colour, no graphic backgrounds), not a silent film (the synchronised music is the engine), not a "retro filter" over modern animation (no joints, no rendered shading).

## 2. Materials & rendering

- **Frame**: 1920×1080 output with a **4:3 gate** (1440×1080 centred, black pillarbox), gate corners rounded (r ≈ 28 px), soft inner shadow on the gate edge.
- **Characters**: flat fills, one hard-edged form-shadow band (light grey) on the side away from an upper-left light, ink outline **constant in screen space** at any zoom (transform points first, then stroke; ~6 px at 1080p), light **line boil** (±1.2 px, 3 drawings cycling at 12 fps).
- **Anatomy kit**:
  - Limbs: noodle tubes of constant width (about 1/20 of the character's height), one smooth bend, round caps.
  - Gloves: palm + 3 fat fingers + thumb, flared cuff with a fold line, 3 stitch lines on the back. Outline the union only (stroke all parts thick first, then fill all).
  - Pie eyes: white oval, big black pupil (≈ 64 % × 74 % of the eye) with a wedge cut toward the upper right; blink with an eyelid in body colour and a lid line.
  - Mouths: smile with cheek ticks, open grin, "O", wavy (scared), pucker, tongue-out. Shoes: big black ovals with a white toe glint.
- **Object characters**: the face sits on the body; a **secondary feature carries the mood** (steam, a flame, a lampshade tilt, a spring). A box-shaped object is a real projected 3D shape seen slightly from above, the face mapped onto its front.
- **Backgrounds**: painted once into a cached canvas at 1.25–1.5× (push-ins stay crisp): flat wash + soft blotches (±5 %) + inner edge darkening + a thin dark-grey outline + paper grain. They never boil. Period motifs: patterned wallpaper, panelled furniture, checker floors, brick, clapboard.
- **Film damage** (composite pass, not the scene): low-frequency gate weave (±1.2 px) with a rare jump; flicker ±4 %; 0–3 drifting vertical scratches; 3–8 dust specks per frame; an occasional hair; strong vignette; a small jump on every cut; slight blur. Grain over the whole frame as the last pass, not in the scene.

## 3. Colour logic

- **Strictly greyscale**: about 6 grey steps plus a separate character white. No hue anywhere, not even in the film damage.
- **Characters own the extremes**: character whites and ink blacks are brighter and darker than anything in the background. Backgrounds live in the middle greys (walls around mid grey, furniture one or two steps darker). Add a mild contrast boost (≈ 1.1–1.15) in the final composite: 1930s prints are rich black and bright white, never flat grey.
- Form shadow is one light-grey band, never a gradient.
- Examples of the grey ramp's temperature: warm paper greys; cool silver-nitrate greys; a faint sepia print. Pick one and keep it for the whole video.

## 4. Type & subtitles

- **Subtitles are a period title card**: a small near-black plate with a white double-rule border and dot-and-ring corner ornaments; text in **IM Fell English SC** (~36 px in 16:9, ~50 px in a reel), paper white. Drawn in the scene layer so it weaves and flickers with the film; pops on and off with no fades. Bottom by default, top when the action is low. One card may span two short voice clips; hold ≥ max(1.8 s, speech + 0.6 s).
- **Titles**: **Shrikhand** fat retro script, white face, heavy ink outline (~14 % of the cap height), ink drop shadow down-right; letters can hop in a travelling wave on the beat. Sub-lines in **Limelight** caps.

## 5. Motion quality

- **Characters on twos** (12 fps); camera moves on ones (24 fps, or every frame of a 30 fps reel). A stepped camera reads as judder.
- **Tempo grid**: choose a tempo where one beat is an **even whole number of frames** at 24 fps (8, 10, 12, 16 or 20 frames), so every beat lands on a drawing of the twos. In a 30 fps reel, 90, 120 and 180 BPM also land on whole frames.
- **Breathing**: every idle object squashes and stretches with `cos(2π·beats)`: an extreme on every beat (stretch on the beat, squash on the off-beat), sampled on twos, amplitude ~5–7 %, all props in phase. A peak of joy can raise the amplitude ×3 and squash the whole background painting around the floor line (~2.5 %).
- **Walk**: one step per beat with a body bob (sad = smaller steps, limp arms). **Run**: legs as a windmill (feet orbit a circle), lean forward, speed lines.
- **Anticipation–hold–action**: before every big move, crouch (squash to ~0.8), hold (let the band stop), then snap. Impacts get a squash with an exponential spring-back.
- **Held frames are acting**: a chain of holds, each glance on an eighth note with a woodblock tick, reads as thinking.
- **Freeze on a band stop**: when the music stops, freeze everything, background breathing included.

## 6. Camera grammar

A theatre camera: mostly locked, moving only to follow a runner or to land a gag. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Stage-wide, locked, eye level | A proscenium: the set is a stage and everyone on it performs | introducing a place; a group number; a routine |
| Hard cut to a face close-up | The reaction is the joke | a surprise; a taste; a realisation |
| Trucking pan beside a runner, eased start and stop (a tilt beside a climber in a reel) | Pursuit, momentum | a chase; a race; a delivery |
| Medium follow shot (character ≈ 1/4–1/3 of the frame height) | Every step is a note | Mickey-moused climbing, dancing, working |
| Tilt with a fall or a rise | Gravity as rhythm | a tumble; a rocket; a lift |
| Slightly high angle, one unbroken shot | The hazard and the answer in one frame | a danger; a stretch; a rescue |
| Tabletop pan (flat characters in front of a model set turning in depth) | The world is a real place | a street; a carousel; a factory floor |
| Pull-back from a close-up to a packed medium-full | One feeling spreads to everyone | a celebration; a crowd joining in |
| Iris in / iris out (grabbable by a character) | The film is an object | a beginning; an ending; a scene change with a gag |

Framing: faces must read, so no far-wide shot for a gag or a musical moment. The destination prop enters frame before the gag lands. Arcs and leaps stay inside the gate at the current zoom. Transitions: iris, a hard cut on a beat, a title card rolling up like a window shade; no dissolves.

## 7. Sound palette

- **1930s hot dance band / ragtime**: stride piano, clarinet, trumpet (open + plunger-mute "wah-wah"), trombone (smears), tuba oom-pah, banjo on 2 & 4, snare with brushes and rolls, xylophone, woodblocks, slide whistle, cymbal, kazoo, washboard, a pit organ. **No string pads, no modern synths.** One short original syncopated theme can be restated in different arrangements.
- **Mickey-mouse the score, as options**: a band member "answering" a character (trombone raspberry, trumpet laugh); a stop (hard silence, reverb tails too) before a gag or on a stare; a stinger per gag; slide whistle for every stretch or fall; a prop that *is* an instrument; a solo for tenderness; a key change for a lift.
- **Foley by material** (synthesised or sampled): porcelain and glass = hard inharmonic partials + a tiny transient; wood = woodblock; metal = bells and clanks; springs = "boing"; water = filtered noise + rising blips and bubbles; rubber = sawtooth creak through a band-pass.
- **Voice**: a period character (a radio announcer calling the action, a vaudeville MC, a crooner), few short lines. Radio chain: HP ~260 Hz / LP ~4.6 kHz, tanh saturation, a short room, compression. Duck the music ~8 dB.
- **Optical soundtrack pass** over music + foley: band-limit ~110 Hz–6.2 kHz, slight wow (~0.6 Hz) and flutter (~7 Hz), soft saturation; then a bed of hiss, crackle and a 24 Hz projector gate clatter, the *only* sound allowed inside a silence.
- Loudness −14 LUFS (two-pass loudnorm).

## 8. Native moves

A menu: use the ones your story needs.

- **Everything breathes on the beat.** The setting is a character; at the peak the *whole world* can dance in sync, walls included. *Fits content like:* a factory at shift change; a garden after rain; a city waking up.
- **Mickey-mousing.** Every step is a note; a prop becomes an instrument. *Fits content like:* stairs as a piano; a typewriter as a drum kit; fence posts as a xylophone.
- **Rubber-hose stretch.** Limbs reach any length in one unbroken shot. *Fits content like:* reaching a top shelf; a long-distance handshake; catching a falling baby bird.
- **Transformation.** Anything becomes something else mid-motion (a tail into a question mark, a hose into a saxophone). *Fits content like:* an idea turning into a product; a problem into a tool; a word into an object.
- **The bouncing-ball singalong.** Lyrics on a title card, a ball hopping from word to word on the beat. *Fits content like:* a jingle; a safety rhyme; a slogan to remember.
- **The film is a physical object.** Title cards roll up like window shades; the iris is grabbed and pulled shut; intertitles get bumped; the frame line slips. *Fits content like:* a brand reveal; a "the end?" twist; a character escaping the cartoon.
- **The ink bottle.** An artist's pen draws the hero, who then argues with it. *Fits content like:* a making-of; a mascot introduction; a lesson about drawing.

## 9. Pitfalls of the medium

- **Flat grey frames.** Push backgrounds to mid grey, keep pure white and ink for characters, add a contrast boost.
- **Wide shots kill gags**: a far shot makes characters tiny and Mickey-mousing unreadable. Use medium shots, and a packed medium-full for crowds.
- "Sad" brows drawn as "angry": define brows by inner / outer end (inner = near the nose), not by left / right.
- A limb drawn behind a body gets hidden by the silhouette (a handle, a tail): kick and reach outward past it.
- Painted characters collide with background props at some camera positions: check every shot's last frame.
- Smoke puffs in a row read as thought bubbles: scatter and grow them.
- Short voice clips make subtitles flash: merge consecutive lines into one card.
- **The app's buttons**: in a reel, a title card or a face below y 1248 or right of x 900 is hidden.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- One canvas drawn from `t`: characters and boil on a stepped clock (`floor(t * 12) / 12`, boil picking one of 3 seeded offset sets), the camera on `t` itself.
- **Constant-width ink**: push every point through an affine stack (camera × character × limb), then stroke at a fixed width, so a push-in never fattens the line. Gloves stroke all parts thick, then fill all, so only the union is outlined.
- Backgrounds painted once into cached offscreen canvases at 1.25–1.5×. Breathing props scale around their floor contact by `1 + a·cos(2π·beats)`, sampled on twos.
- The film pass is a separate layer drawn last: gate mask (full frame in a reel), weave, flicker, scratches and dust seeded from the frame index, a jump on every cut, the contrast boost, grain.
- Snap announcer lines, band stops and gags to the beat nearest their word timings. One cue per landing, glance, card pop, iris snap and transformation in `cues.json`; voice through the radio chain, then the whole mix through the optical pass.

## 11. Variation space

You decide the location (or several), the cast, the structure, the opening, the ending, the camera path, the tempo and the band's line-up:

- Structures: **a singalong** (verse and chorus, the bouncing ball carrying the message while the set acts out each line); **a talent show** (objects take turns on a stage, the smallest wins); **a relay** (a thing passed hand to hand across a town, each hand-off a new instrument on the melody).
- Openings: **out of the inkwell** (a pen draws the hero, who hops onto the set); **a curtain rise** (the band tuning up; a baton starts the video); **an iris on one eye** (it blinks, the iris widens to show whose eye it is).
- Endings: **the card pulled over** (a character drags "The End" in front of itself mid-gag); **the film snaps** (the frame burns, a gloved hand splices it for one last bow); **the band packs up** (instruments leave until one note remains).
