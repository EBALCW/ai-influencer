# Silhouette Rhythm

> Near-black silhouettes against a burning sunset over still water: every step, turn and wingbeat snaps into place on the beat, the sun and its rays pulse with the music, and each footfall leaves a ring of light on the water. A wordless choreography of shapes and rhythm, with a few words landing on the waterline. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): 1960s–2000s silhouette title sequences and music-video choreography for figures read only by their outline; Lotte Reiniger's cut-silhouette films for poses that must read in pure black; nature photography of birds and people against low sun for backlight, rim light and reflections; Afro-Latin and pop percussion grooves for the beat grid. Never copy their characters, scenes, typefaces or music, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The horizon sits at y ≈ 1150 with the sun on it; one hero silhouette stands large against the sun disc (at least a third of the frame height); a formation crosses high in the sky; the lower part is water and reflection. Must-read text sits in x 72–900, y 269–1248.

| Zone | Position | Content |
|---|---|---|
| Sky | y 0–1150 | gradient sunset, cloud streaks, god rays |
| Sun disc | centred on x 540, radius ≈ 300, cut by the horizon | the frame behind the hero |
| Hero | centred on x 480–600, feet on the waterline | 650–900 px tall |
| Formation | y 300–520 | a line of small figures |
| Water | y 1150–1920 | reflections, rings, glitter column |
| Caption | centred on x 540, ≤ 720 px wide, baseline y ≈ 1230 | Barlow Condensed 500, 48 px, cream, a ring spreading under it |

- **The first 3 seconds.** Frame 1 already shows the hero silhouette mid-gesture against the sun with the rays streaming; at 0.5 s the first beat lands (a gesture snaps, the sun pulses, a ring opens on the water); by 3 s the group has moved together on four beats and the caption (or the music's first change) has set what the rhythm is about.
- **Length and pace.** 20–45 s at 110–128 BPM; a cut on a downbeat every 2–4 bars; one freeze with a short silence two thirds in.
- **Captions.** Words drop onto the waterline on the beat; the music carries most of the video, so keep lines few and short.
- **Sound.** `thock` for the group's accents, `tick` for a single figure's accent, `hook-impact` on the freeze, `zoom-swish` on take-offs and whips, `shimmer` on the sun's flash, `sparkle` on thrown droplets. Drum kit, marimba, kalimba and log drum come from free sample libraries.

### YouTube (1920×1080)

- **Layout.** Section 2 as written. The caption and title sit on the water above y 936; nothing to be read in the bottom 12 % or within 96 px of the sides.
- **Length and structure.** 2–6 min, in movements of 40–90 s. Each movement is one time of day on the sky clock (the sun a little lower, the palette a little deeper), one formation and one groove; the chapter title drops onto the water at its start. Re-hook every 30–60 s with a change the eye and ear feel at once: a take-off, a formation reversing, the music stopping dead on a freeze, a new instrument joining on each ring. A narrated version (a nature or team story) keeps the voice sparse and lets eight-bar passages run wordless between lines.
- **The first 10 seconds.** The strongest image first: the hero against the sun with rays already moving; the beat established by 2 s (four snaps, four rings); the question by 5 s (on the water, or in the voice); the promise by 10 s, when the whole group moves together for the first time and the camera rises to show the pattern their steps wrote on the water.
- **Captions.** Burned in on the waterline when there is a voice; export the lines as `.srt`.
- **Thumbnail.** The hero mid-leap or arms (or wings) raised inside the sun disc, rays streaming, its reflection below; at most three words in Anton, cream, on the water.

### Good for

Music videos, sports and team films, nature and festival openers, choreography and dance pieces, "together" brand films, wordless intros.

## 1. Essence, and what it is not

1. **Pure black shapes.** Figures are near-black with no inner detail; they are read only by outline, so every pose is designed in profile with limbs clear of the body.
2. **Backlight does the rest.** A low sun behind them gives a thin orange rim on the sun-facing edges, a soft halo, and god rays that the figures cut.
3. **The beat is the clock.** Every gesture lands on a beat or a defined subdivision; poses snap in, they don't drift.
4. **Water writes the rhythm.** Each step makes rings that catch the sky light; reflections wobble below every figure.
5. **The sky tells time.** Across the video the sun sinks and the palette deepens from orange to violet; story time is sky colour.

Not **Shadow Puppetry** (no screen, no rods, no lit paper; the world is a real sky and water). Not **Neon Tubes** or other light-line styles: the shapes are solid black, not glowing. Not a stock sunset with clip-art figures: figures act on a grid, and light, rings and reflections answer each action.

## 2. Frame and layout (1920×1080)

| Zone | Position | Content |
|---|---|---|
| Horizon | y 560–760 (52–70 % of the height) | low cameras put it near the middle, crane-ups push it lower |
| Sun disc | on a third, radius 250–330 px, cut by the horizon | the backdrop for the hero |
| Hero | in front of the disc, feet on the waterline, 400–900 px tall | the main figure |
| Group | left or right of the hero along the waterline, or a line high in the sky (y 200–330) | 5–12 figures |
| Water | below the horizon | reflections, rings, a glitter column under the sun, islets on the horizon |
| Title and captions | on the water, left-aligned at x 112, baseline y 880–916 | Anton 136 px for titles, Barlow Condensed 500 at 40–44 px for lines |

Keep the hero's head and hands out of the sun's exact centre (the rim lights the edges, not the middle). A dark vignette (0 → 55 % at the corners) frames everything.

## 3. Materials and rendering

- **Two passes.** Figures are drawn in one flat colour into three canvases: silhouettes, their mirrored reflections, and water light (rings and droplets). One fragment shader paints the sky and water and composites them.
- **Sky.** A vertical colour ramp by angle above the horizon, a sun glow and horizontal flare band, and long cloud streaks on a perspective plane (domain-warped noise), lit on their sun side.
- **Water.** A level pinhole camera over a flat lagoon: the sky is reflected with a 20 % darkening, small rippling offsets, a sun glitter column, and distance darkening.
- **Silhouettes** become `#090307`. A rim of about 1.6 px where the shape faces the sun, a soft halo outside the outline, and god rays computed by marching from each pixel toward the sun, darkened where the figures block it.
- **Reflections** are the same shapes flipped at the waterline, wobbled sideways by noise that grows with distance below the horizon, at 88 % darkness.
- **Rings and droplets** are drawn as thin ellipses (flattened by camera height) and dots, tinted from the sky's colour near the sun.
- **Figures** are built from closed splines and tubes along Béziers with width profiles, with joints solved from hip and foot positions; ragged "feather" edges come from noise along the outline, and a downy edge marks a young or different figure.
- **World-anchored:** figures, rings and reflections live in metres on the water; the vignette is screen-space.

## 4. Colour logic

- **The figures are never coloured.** One near-black for every silhouette; difference is shape, size and timing.
- **All colour is light:** sky, sun, rims, rings, rays. Warm near the sun, cool and violet away from it.
- **The palette moves with time:** early in the video the ramp runs gold → orange → coral → rose → plum → indigo; late it shifts one step deeper (orange → red → magenta → violet → near-night).
- **The sun's flash** on a climax beat adds a warm cream glow over everything except the silhouettes.
- **Type is warm cream**, the brightest thing that isn't the sun.

Example palette:

| Role | Hex |
|---|---|
| Horizon gold | `#FFB247` |
| Orange | `#FF801F` |
| Coral | `#FC4C2B` |
| Rose | `#E0245C` |
| Plum | `#80126B` |
| Indigo zenith | `#380A52` |
| Late zenith | `#1A083D` |
| Silhouette | `#090307` |
| Rim light | `#FF9E4C` |
| Type | `#FFF3E4` |

## 5. Type and captions

- **Faces (SIL Open Font License):** Anton for titles and chapter names; Barlow Condensed Medium for captions and secondary lines; Noto Sans in the right weight for other scripts.
- **Words land like steps.** Each word drops 46 px into place with a back ease (overshoot 2.2) in 0.22 s on its beat; a thin ellipse (`#FFD9A8`, 1.6 px) spreads under it on the water over 1.4 s, as if the word made a ripple.
- **Sizes (16:9):** title 136 px; chapter names 96 px; captions 40–44 px at 92 % opacity; credits 32 px.
- **Captions** are the spoken language only, one line at a time on the water; hold ≥ max(1.8 s, speech + 0.6 s), and start each line on a beat.

## 6. Motion

- **Frame rate.** 30 fps for both formats; smooth, every frame drawn.
- **The grid.** 110–128 BPM (0.5 s beats at 120). Group gestures land on beats; small figures may step on half or quarter beats; fills land on eighth-note triplets before a downbeat.
- **Pose snaps.** A gesture blends from the current pose to a named pose in 0.13 s with a back ease (overshoot 2.2); turns of the head or body ease out over 0.11 s; facing flips (left to right) take 0.16 s.
- **Gaits** are computed: feet plant on the beat, the hip bobs between, each plant makes a splash ring set (2–3 rings, gone in 1.8 s) and a few droplets on a parabola.
- **Take-off.** A run of quarter-beat steps accelerating to eighths, wings beating on the subdivisions, legs trailing, a crown of 30 droplets thrown up at lift-off.
- **The sun pulses** on every beat while the music plays: +25 % glow decaying with a 0.12 s time constant; rays and rims pulse with it.
- **Freeze.** On a hit, time stops for every figure and droplet, the pulse goes to zero, and a warm flash decays over 0.18 s; time resumes on a downbeat.
- **What never moves:** the horizon within a shot, the sun's position within a shot, any figure between beats except by its gait.

## 7. Camera

A level pinhole over the water: focal length (in frame heights), camera height, horizon line, sideways position, dolly and yaw.

| Move | What it expresses | What it can serve |
|---|---|---|
| Low and level (camera 0.3–0.55 m up, horizon at 54–64 %) | figures tall against the sun | marches, poses, the hero |
| Telephoto close (focal 3.6–5.25 frame heights) | one figure, huge disc behind | portraits, the freeze |
| Track alongside a run (camera follows, a 9 Hz wobble while things go wrong) | effort, chaos | races, first attempts |
| Crane up on a take-off (camera 0.55 → 1.15 m, horizon 60 → 70 % in 0.8 s) | release, flight | launches, climaxes |
| Whip yaw (−0.6 rad) | a fast exit or arrival | departures, entrances |
| High and wide, dollying back (camera 2.4 → 3.6 m, back 4 m) | the pattern on the water | formations, crowds, the ripples that remain |

**Allowed transitions:** hard cuts on downbeats, the whip, the freeze, a jump in sky time between movements. **Forbidden:** dissolves, blur, zoom transitions, any cut off the beat.

## 8. Sound palette

| Layer | What | Level |
|---|---|---|
| Groove | 120 BPM: kick on the beat, bass on the roots, marimba playing ninth chords (minor ninths, major sevenths, sus chords), claps and shaker, hats on the off-beats, tom fills into downbeats, crashes on section changes | ducked under any voice |
| Figures' accents | group gestures on a low log drum on the beat; a single figure on a bright woodblock (on the beat when in step, off when not); group snaps on claps plus a cajon bass; each glowing ring adds a kalimba and marimba note climbing a scale | these survive every music cut |
| Breaks | a record scratch into silence; a held low note with hats ticking down; a count-in of four kicks; a slide whistle for a fall | |
| Freeze | kick, crash and china together, then a held chord lifting to the relative major | |
| Foley | splashes per step (sized by the figure), running patter, wingbeats as soft low pushes, flaps as feathery whooshes, drips, distant calls, wind and water under everything | |

A CC BY drum kit needs its credit. Master −14 LUFS, true peak −1 dB.

## 9. Native moves

1. **On the beat.** Every figure snaps to a new pose on the same beat; the sun pulses and rings open under every foot. Fits content like: teams and choirs; product rhythms; anything about doing it together.
2. **Rings that remain.** Each step leaves a ring that fades fast, then lingers for a long tail, so a path is written on the water; later rings glow as someone passes over them. Fits content like: legacy; paths and trails; cause and effect.
3. **The take-off line.** Figures run and lift off one per half-beat at the same mark, each with a droplet crown, the camera craning up. Fits content like: launches; graduations; relays.
4. **The freeze.** A hit stops time with droplets hanging mid-air, a warm flash, the music cut; one beat of silence; then everything resumes on the downbeat. Fits content like: the decisive moment; the turn of a story; a record broken.
5. **Out of step.** One figure moves on the off-beat, heard as a woodblock against the group's low drum, until it lands on the beat. Fits content like: a newcomer; a dissenting idea; practice and mastery.
6. **The line across the sun.** A formation crosses the disc and the god rays strobe through the gaps between them. Fits content like: migrations; parades; a closing shot.
7. **The sky clock.** Between movements the sun drops and the palette deepens; the last movement ends at dusk. Fits content like: a day in a life; a season; an arc from start to finish.
8. **Words on the water.** Title words drop on consecutive beats, each sending a ring across the water. Fits content like: titles; chapter names; the last line.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- WebGL plus Canvas 2D: draw figures, reflections and water light into three offscreen canvases, upload them as textures, and let one fragment shader paint sky, water, sun, rims, halo, rays and vignette, all from `t`.
- Render at 30 fps; for YouTube lengths render at 1.5× and scale down; the ray march (56 samples) is the cost.
- Keep the whole film on one beat grid: helper functions that list beats between two times, schedules of named poses per figure, and step lists that drive both the drawing and the sound events.
- Project world metres through the pinhole camera so figures, rings and reflections share one space; shapes are drawn in local metres with y up.
- Sky time (sun height and palette phase) is a keyframed function of film time; seed every figure's noise from its id.

## 11. Pitfalls

- **Unreadable poses.** A limb in front of the body disappears in black; check every key pose as a pure silhouette at phone size.
- **Floating gestures.** A move that eases over half a beat looks lazy; snap in 0.13 s and hold.
- **Off-grid sound.** A splash or flag a frame off its beat breaks the whole idea; generate sound events from the same schedule as the motion.
- **Too much text.** Words compete with silhouettes; a line every few bars at most.
- **Mud at dusk.** Late in the sky clock the zenith nears the silhouette colour; keep figures against the bright band near the horizon.
- **Repeated sunsets.** A long video at one sky looks like a screensaver; move the sun between movements.

## 12. Variation space

The agent decides per video: the figures (people, animals, athletes, dancers), the groove and tempo, the time of day at each movement, the hero, where the sun sits, how much text.

- **Three structures:** one group, one routine, built up instrument by instrument to a full chorus; a day's arc in three grooves (a morning drill, a midday scramble, unison at dusk); call and answer between two groups across the water, ending in one line.
- **Three openings:** the hero already mid-gesture against the sun; the camera low on the water as rings spread toward it from an unseen first step; four heads snapping up on four beats.
- **Three endings:** the formation crossing the sun and leaving the frame empty with the rings still spreading; a freeze on the last hit with the title dropping onto the water; the camera rising high and wide to show the pattern all the steps wrote.
