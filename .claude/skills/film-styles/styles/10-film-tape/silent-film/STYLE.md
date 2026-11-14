# 1920s Silent Film

> An engraved-illustration silent film projected in a picture house: ink line and silver wash, a 4:3 print that flickers and weaves between velvet curtains, intertitles instead of voices, and a cinema pianist who plays every beat. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): **Buster Keaton**, *The General* (1926) and *Sherlock Jr.* (1924) — the whole gag in one locked-off wide shot, a deadpan face, a body that does the acting; **Harold Lloyd**, *Safety Last!* (1923) — the near-miss; **Georges Méliès** — the iris and the trick shot; **The Artist** (2011) — how few intertitles a modern audience needs; **1920s photoplay piano cue sheets** — music by mood section, the piano doing the sound effects. Never use the Tramp look (bowler, toothbrush moustache, cane), any real film's gags, or any published melody.

## Formats

### Reel (1080×1920)

- **Layout.** The print is projected portrait: a rounded aperture about 1000×1640, centred, with the velvet pelmet and its fringe across the top ~140 px and the footlights' glow on the stage lip below; the drapes shrink to slivers at the sides. Stack, don't shrink: the locked-off wide composes top to bottom, so a chain of cause and effect falls, rolls and tumbles down the frame; a tracking chase becomes a tilt down a hill or a staircase; the figure doing the gag stands inside the safe box (x 72–900, y 269–1248), at least a third of the frame height in the key full shot. Intertitle text is centred on x 540, at most 720 px wide, around y 760 on its black card.
- **The first 3 seconds.** Frame 1 is mid-chase in a locked wide: the print already running, scratched and undercranked, the piano already on a Hurry. By 0.5 s the near-miss: a hand closes where the object was a frame ago. By 3 s the hero turns a deadpan look to us inside a half-open iris, or a three-word intertitle names what is at stake.
- **Length and pace.** 20–45 s. Locked shots of 3–6 s (the wait is the joke), two or three intertitles of 2.5–3.75 s, one silence where only the projector runs before the payoff.
- **Captions.** One language: the intertitles are the captions (Playfair Display SC or Old Standard TT Italic, about 64 px), a few words each.
- **Sound.** The pack plays the booth, never the action: `ui-click` for the lamp, `ratchet` for the motor spinning up, `camera-shutter-light` for the gate under a held moment, `latch` as the curtain lands or the film breaks. Everything else is the upright piano (sampled, from a free library) or the user's music in the photoplay idiom; no voice, no foley.

### YouTube (1920×1080)

- **Layout.** Section 2 as written: the 4:3 print in the centre, drapes at the sides. Intertitle text stays inside the gate and above y 950 (the player controls); nothing must-read on the curtains.
- **Length and structure.** 2–8 min at 24 fps, motion sampled at 16 fps. A chapter is a reel: the curtain parts or an iris opens, a "Reel Two" card in the deco border, its own tint and piano mood section (Hurry, Misterioso, Agitato, Tenderly), three to five cards at most. Re-hook every 30–60 s with a gag chain paying off, an intertitle twist, an undercranked rush or a tint change.
- **The first 10 seconds.** Mid-chase in a locked wide first; an intertitle question by 5 s; a card with the promise by 10 s; the title card and the curtain parting after that.
- **Captions.** The intertitles are burned in as picture; the `.srt` lists their text.
- **Thumbnail.** The half-open iris on the hero's deadpan face, or the near-miss frame, with at most three words in Playfair Display SC on a deco-bordered card.

### Good for

Comedy sketches, retro brand stories, sound-off storytelling, company archives redrawn, "how it was made" pieces, anniversaries.

## 1. Essence, and what it is not

A one-reel film as it would look *projected*:
- **A 4:3 print in a gate between theatre curtains**; the sides of the 16:9 frame are the picture house.
- **An ink drawing with washed greys and hatching**, printed on silver stock that flickers, weaves, scratches and burns at the edges.
- **Nobody speaks.** Beats are told by **action in wide shots** and by **intertitle cards**.
- **The only sound is a cinema instrument** (piano, organ) and the projector in the booth.

Not a noir (no hard shadows as mood, no voice-over), not a sepia photo filter on modern animation (the drawing itself is engraved and inked), not a Chaplin pastiche.

## 2. Materials & rendering

- **Tonal painting + Redraw.** Scenes are painted in grey values only (print densities roughly: ink 0.07, dark cloth 0.15–0.3, mid wood 0.45–0.6, skin 0.8, white linen 0.9–0.95), with soft light gradients and a thin separation line. A **Redraw** pass (WebGL2) inks the whole frame: difference-of-Gaussians contours on the dark side of every edge, luminance posterised into ~5 soft wash steps, and 45° hatching (then crossed) in the darks, re-drawn every two frames like hand-redrawn animation. Real video frames can go through the same pass so footage and drawing share one hand.
- **Print pass**: silver tone with a sepia amount between ~0.1 and ~0.36, print black ~0.055 and white ~0.93, S-curve, halation on highlights, uneven density, flicker, gate weave with occasional perforation jumps, broken vertical scratches (white = scraped emulsion, dark = dirt on the negative), brown burn creeping from the edges, vignette, two-octave silver grain; then dust, a hair in the gate, a rare blotch.
- **Frame**: 1440×1080 in the centre of 1920×1080, a rounded aperture with a soft dark rim; velvet drapes at the sides lit by the screen's spill and by footlights. Curtains can part and close. (Portrait in a reel: see Formats.)
- **Figures**: realistic proportions (7.5-head adults, ~5-head children) on a 2.5D rig (joints solved in 3D, projected with a yaw), silent-era make-up (pale skin, dark lids and lips); identity by silhouette marks (a hat, a garment, a tool).

## 3. Colour logic

- **Monochrome silver**, tinted only by the print: colder and harsher (more damage, less sepia) when things go wrong, warmer and cleaner when the video turns tender. Tint and damage are mood controls, set per section.
- Values carry everything: dark clothes against pale walls, pale faces against dark interiors; check every shot as a thumbnail.
- **One colour, at most**: an element drawn into a separate colour mask keeps its hue through the print (still getting grain, flicker, vignette). Use it for the single thing the video is about, or not at all.
- Period tinting of whole scenes (amber for day interiors, blue for night, rose for romance) is a valid alternative to sepia; one tint per section.

## 4. Type & subtitles

- **The intertitles are the subtitles**; the `.srt` lists their text. A card holds 2.5–3.75 s (≥ max(1.8 s, reading time + 0.6 s)).
- A black painted card with a deco border whose ornament follows the emotion: one heavy rule for a shout (the text shakes), a double rule with stepped corners and fans for narration, vines and small flowers for tenderness.
- Period faces (OFL): a small-caps display serif (e.g. Playfair Display SC) for titles and shouts, an italic old-style serif (e.g. Old Standard TT Italic) for narration and dialogue.
- A few words per card; three to five cards in a short video. A card never explains what the picture already shows.

## 5. Motion quality

- **Hand-cranked sampling**: character and camera motion sampled at 16 fps (18 or more to undercrank a fast scene); flicker, weave, grain and scratches change every output frame (24 fps, or 30 in a reel). That mix makes it look projected rather than merely low-frame-rate.
- **Speed is an emotion**: undercrank chases and panic (faster motion, faster flicker); return to 16 fps and a calmer print for tender scenes.
- **Deadpan performance**: the face barely changes; the body acts (crouch before effort, held poses, the two-frame snap of a double take, hands on knees). Objects act too (a wobble before a fall, a ritardando to rest).
- **Keyframed, eased poses**; only deliberate gags snap.

## 6. Camera grammar

A vocabulary, not a route. The period camera is heavy: most shots are locked. Opening and ending come from the topic.

| Move | What it expresses | Can serve |
|---|---|---|
| Locked-off extreme wide | cause and effect seen whole; the wait is the joke | a mechanical gag; a crowd; an elaborate process |
| Locked full shot | the premise in one frame | a character's routine; a confrontation |
| Tracking shot with foreground passing (a tilt down a slope in a reel) | pursuit; momentum | a chase; a race; a delivery against the clock |
| Iris in / out | attention on one thing; a beginning or end of a thought | an object; a face; a memory |
| Half-open iris, held | a character sharing a look with the audience | a wink; a secret; complicity |
| Slow motivated push-in | tenderness; realisation | a kneel; a letter read; a decision |
| Masked shot (keyhole, binoculars) | point of view; spying | a detective; curiosity; romance |
| Split screen / double exposure | trickery; dream; two places at once | a phone call; a ghost; a daydream |

Framing: wide and medium shots; big close-ups of rigged faces look like mannequins, so keep any close-up small or inside an iris. Transitions: iris, fade to black, straight cuts, the curtain. No dissolves between shots of the same scene, no modern whip pans.

## 7. Sound palette

- **The instrument is the sound design**, as in a picture house: an upright piano (optionally a reed organ, theatre organ, violin or small ensemble) plays every event. Mickey-mousing vocabulary (options): chromatic creep in the bass (sneaking), grace note (a wink), forearm cluster (a crash), swelling diminished tremolo (a wait), low rumbling tremolo (a storm, a machine), "plink … plonk" (emptiness), diminished sforzando (a shock), rolled chord (a door, a reveal), descending glissando (a fall), low "boing" (a bounce), nervous trill (hesitation), minor second (something breaking).
- **Photoplay idiom**: stride left hand, music by mood section in the manner of cue sheets (Hurry, Misterioso, Agitato, Tenderly, Maestoso), a theme that returns changed. Original music only.
- **No foley, no voice.** **The projector is the ambience**: lamp click, motor spin-up, claw-and-motor purr, film flapping on the take-up reel.
- **Silence**: the music stops and the projector alone remains; it frames a held moment.
- **Mix**: tame piano hammer transients with light compression before loudness normalisation (−14 LUFS). The grain lives in the picture, with only a touch more at the encode.

## 8. Native moves

A menu: use the ones your story needs.

- **The chain in one take.** A triggers B, B leaves the frame, the audience waits, B returns and hits C. *Fits content like:* a supply chain gone wrong; how a rumour spreads; a Rube Goldberg invention.
- **The near-miss.** A hand closes exactly where the object was a frame ago. *Fits content like:* catching a bus; a startup missing a deal; a goalkeeper.
- **The intertitle twist.** A card reframes the next shot in a few words. *Fits content like:* "Meanwhile, in the lab…"; "The machine had other ideas."; a statistic as a punchline.
- **Undercranked chaos.** Speed and damage rise together. *Fits content like:* rush hour; a kitchen at dinner service; a stock crash.
- **Iris on the look.** An iris stops half-way so a character can glance at the audience. *Fits content like:* a product winking; a cat that knows; a scientist's secret.
- **Redrawn footage.** Real video pushed through the ink pass becomes a period drawing. *Fits content like:* a company's archive; a family film; a sports clip.
- **The echo gesture.** A gesture from the start repeated by someone else with a new meaning. *Fits content like:* a teacher and a pupil; a handover; a tradition.

## 9. Pitfalls of the medium

- **Too much content kills a silent film**: a many-step chain at small figure scale is noise in a thumbnail. One legible chain with a pause in the middle beats three busy ones.
- **Puppet arms**: apply abduction before flexion, let the shoulder rise and swing forward as the arm goes up, slim the torso's shoulder corner on the raised side, hide the arm's contour where it lies over the torso. Raise arms sideways (or turn the figure) so they don't cross the face.
- **Pose pops**: drive every figure by eased keyframe lists, never by `if` branches.
- **Floating props**: hold a prop between the palms at the depth between the arms; tie a rolling object's rotation to distance (angle = distance / radius).
- Brow angles flip with facing direction: check expressions in a crop at final size.
- An iris must track its target in film coordinates after any camera zoom.
- A grab must put the hand exactly where the object is at the beat, or it doesn't read.
- Closed curtains lit only by a dark screen go pure black: add footlights.
- Heavy grain makes huge files → re-encode with `-tune grain` at a higher CRF.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- Paint each scene in grey values on a 2D canvas from `t`, figures and camera read a hand-cranked clock (`floor(t * 16) / 16`, 18 or more in an undercranked section); print damage reads the output frame.
- The Redraw pass (WebGL2) turns the tonal painting, or prepared real footage, into the ink drawing: difference-of-Gaussians contours, ~5 posterised wash steps, crossed 45° hatching in the darks, re-seeded every two output frames.
- The print pass and its damage stack on any canvas: silver tone, sepia amount, S-curve, halation, flicker, weave and perforation jumps, scratches, edge burn, vignette, two-octave grain, all seeded by frame, with an optional colour mask for the one coloured thing.
- Intertitles, deco borders, the iris (in film coordinates, so it tracks after a zoom), curtains and footlights are drawn around the print; figures use a 2.5D rig (3D joints projected with a yaw) on eased keyframe lists.
- One cue sheet of mood sections drives the picture (tint, damage, crank speed) and the piano score. One cue per lamp click, motor spin-up, curtain and film break in `cues.json`; the piano carries every on-screen event.

## 11. Variation space

You decide the genre (comedy, melodrama, adventure, newsreel), the characters, the gag or the drama, the cards, the tint plan, the opening and the ending:

- Structures: **a newsreel** (a sequence of "reports" with headline cards and a narrator card between them); **a melodrama in three reels** (each reel a tint: amber, blue, rose; a villain card, a rescue); **a trick film** (Méliès-style: one stage, a magician, objects appearing and transforming by substitution cuts).
- Openings: **mid-chase**, the film already running and scratched, no title yet; **a single intertitle question** before any image; **the projectionist's view**: the beam from the booth, then the screen.
- Endings: **the film breaks** (the print burns through and the lamp shows white); **a final card that addresses the audience** directly; **fade to black on a locked wide** with the piano holding one chord.
