# Glass Product Render

> Launch-video product rendering in transparent and frosted glass: a dark-field studio, strip-light sweeps, dispersion, caustics, light travelling inside the object, slow exploded views that snap shut on a downbeat. A 9:16 reel, or a 16:9 video for YouTube.
> References (grammar only): premium launch videos (a sweep drawing a contour in the dark, slow orbits, macro rack focus, cuts on the beat, ultra-thin wide type); transparent-hardware adverts (internals as ornament, exploded views, black and white plus one accent); dark-field glass photography. Copy none of their silhouettes, typefaces, sounds or colour templates, and never name them in the video.

## Formats

### Reel (1080×1920)

- **Layout.** The black studio bleeds to every edge. The hero sits centred on x 540, around y 700–1000; the tall negative space above holds title cards (ultra-thin, 90–120 px, inside x 72–900, between y 300 and 600), and the glossy floor with its caustics fills the frame below the object, running under the app's buttons where nothing needs reading. The frosted subtitle slab is centred on x 540, at most 720 px wide, baseline near y 1190, inside the safe box (x 72–900, y 269–1248). Stack, don't shrink: an exploded view spreads along a near-vertical axis (still ~40° to the view) so parts climb the frame; a line-up of variants runs near to far on a diagonal; low orbits under the object use the height.
- **The first 3 seconds.** Frame 1 is a sweep already crossing a dark object, drawing its contour with a rainbow edge. By 0.5 s a comet pulse fires inside on the first downbeat; by 3 s its caustic ring has spread over the floor and the parts have begun to drift apart.
- **Length and pace.** 20–40 s at 30 fps on ones. Shots of 2–4 s cut on bar lines; one exploded view that snaps shut on a downbeat; one stretch of total silence before the release.
- **Captions.** The frosted-glass slab, Inter Tight light at 44–48 px, in the spoken language; the product name and slogan are title cards, never subtitle lines.
- **Sound.** `shimmer` panned with each sweep, `metallic-riser` into the release, `latch` for magnetic clicks and the snap, `sub-impact` on the downbeat it lands on, `clean-ding` for the high glass ding. Bowed glass, granular crystal and the minimal electronic score come from a free sample library, or the user's music.

### YouTube (1920×1080)

- **Layout.** The body as written. Keep the subtitle slab above the bottom 12 % (the player's controls), and kickers and credits inside the 5 % margins; titles already sit in the upper third.
- **Length and structure.** 2–5 min at 24 fps. A chapter is one invisible thing the product does, made visible: dark → sweep → inside → snap. Its title card is the ultra-thin title on black with its glint, entered through a sweep passing through black. Re-hook every 30–60 s with a new native move (frost to clear, an exploded view, a caustic ring, light travelling inside).
- **The first 10 seconds.** The object fully lit first, light running through it and its caustic on the floor; by 5 s the question, as the shell frosts back to a silhouette (what is inside?); by 10 s the promise, the parts beginning to drift apart. Any channel sting after that.
- **Captions.** The slab burned in, plus an `.srt`.
- **Thumbnail.** The exploded view at the peak of its hover, axis ~40° to the view, accent light inside; at most three ultra-thin words, or one number.

### Good for

Product launches, consumer tech and hardware, beauty and fragrance, feature reveals, premium brand teasers, launch videos on YouTube.

## 1. Essence, and what it is not

A single hero object of **glass, metal and light** floating in an infinite black studio. Long strips *behind and beside* it turn clear glass into a thin white outline with rainbow edges; the internals show through as in a display case. Everything moves slowly and precisely; every cut, sweep and pulse lands on the beat.

The object is always **fictional**. Never reproduce a real product silhouette (a famous phone or headphone outline), a real brand name, logo, typeface or UI.

Not a white-cyclorama catalogue shot, not a wireframe HUD (**Sci-fi Hologram HUD**), not a keynote slide (**Dark Tech Keynote**): material and light are the subject.

## 2. Materials & rendering

- **Studio = a strip-light scene, not an HDRI.** Photo-studio HDRIs contain windows and clutter that print as messy streaks on glass. Build a tiny black scene of emissive planes and bake it to PMREM **every frame** (`pmrem.fromScene(env, 0, 1, 1000)`, dispose the previous RT): tall side strips behind (silhouette), a wide far strip (horizon rim), a soft top box (volume for frosted glass and metal), a weak front card (off when concave glass faces camera), a top-front key only when parts must be read one by one, an accent card driven by the pulses, and **the sweep**: a tall strip on an arc *behind the camera* (azimuth = camera + π). Being real geometry, its highlight, refraction and dispersion move physically; never paint a 2D highlight.
- **Clear glass**: `MeshPhysicalMaterial`, transmission 1, roughness ≈ 0.015, IOR ≈ 1.5, thickness sets lensing (thicker = stronger), **dispersion on** (three r163+), near-neutral attenuation, `side: DoubleSide` so other glass sees its back faces.
- **Frosted glass**: transmission ~0.85, roughness ~0.4, milky tint, thick. On black it reads as dark grey plastic unless **something bright is behind or inside it**: an opaque emissive shape inside (blurred into a soft internal glow) and/or a bright gradient behind.
- **Metals** make transparency worth looking at: satin bands, chrome (roughness ≥ ~0.14), brushed surfaces via a roughness map, boards with gold traces. **Anything inside transmissive glass must be opaque** (only opaque objects reach the transmission buffer).
- **Light guides**: dark polished opaque acrylic, clearcoat, emissive **comet pulses** along a UV axis via `onBeforeCompile` (Gaussian head, exponential tail, white-hot core, hue drifting with age). Idle emission ≈ 0.
- **Background**: black with an optional dark-grey radial sweep that separates glass edges; the floor fades into it, **no horizon line**. **Floor**: black gloss, blurred mirror, radial fade, procedural caustics (lens ring with R/G/B radii offset, warped Voronoi filaments, rings spreading from events).
- **Post**: 2× supersampling; physical DoF (shallow macro, deep exploded views); bloom only above ~1.1; **Neutral tone mapping** (AgX washes accents to white); grain 0. Model in mm, near plane 1.

## 3. Colour logic

- The world is neutral: black, greys, the white of strip reflections, the metals' own tints.
- **One accent colour family, reserved for light** (emission, caustic rings, the dispersion line on UI), optionally drifting between two neighbouring hues with age or energy. Examples: ice blue → soft violet; amber → rose; green → cyan. Pick it from what the product does, never from a brand.
- Emitters that only illuminate (inside frosted glass) stay cool-white and dim.
- Dispersion rainbows are allowed only at thick glass edges and in the caustic, never as a gradient on surfaces or type.

## 4. Type & subtitles

- **Subtitles are a slab of frosted glass**: a centred rounded bar filled with the live frame blurred (`filter: blur() brightness()` on the WebGL canvas, `preserveDrawingBuffer: true`), a little cool white, a thin highlight stroke and an accent line on top. A licence-free grotesk (e.g. Inter Tight), light weight, ~36–44 px (44–48 in a reel), near-white, one line in the spoken language, at most about eight words. Hold ≥ max(1.8 s, speech + 0.6 s).
- **Titles**: the same grotesk at an ultra-thin weight (200), very large (100–140 px) with very wide tracking, centred in the upper third; a diagonal glint sweeps across the letters in sync with the sweep light on the object. Small tracked caps (18–20 px) for kickers and credits.
- The product name and slogan are **title cards**, not subtitle lines.

## 5. Motion quality

- **Everything moves on ones** (24 fps, 30 in a reel), eased: ease-in-out for camera orbits, ease-out for parts decelerating into a float, ease-in for a snap back.
- **The camera always drifts**: slow orbits or push-ins; never a locked-off frame, never handheld, except a couple of frames of micro-shake on an impact.
- **Exploded view**: parts spread along the axis (~2× product size), each with a small deterministic tilt and a spin proportional to its offset; long ease-out apart → short drifting hover → **very short ease-in snap** on a downbeat.
- Objects lift out of cradles tilted toward camera and settle upright; lids hinge at the back and stand behind the object as a backlit halo.
- Light pulses and sweeps are events on the beat grid, not free animation.

## 6. Camera grammar

A vocabulary, not a route. Opening and ending come from the topic.

| Move | Expresses | Can serve |
|---|---|---|
| Sweep over a dark object, slow push | Contour before content | an unknown thing; a before-state |
| Slow high 3/4 orbit | The whole object in one move | a mechanism opening; variants |
| Macro, rack focus surface → part inside | Nothing to hide | an ingredient; a sensor |
| Side macro orbit | Material contrast | layers; a seam |
| Exploded view, axis ~40° to view, orbit | Technical beauty, suspension | architecture; a pause before a turn |
| Straight-on front, slight push | Declaration | a single number; a name |
| Top-down macro | A pattern at full size | channels; a circuit |
| Top-down on the floor | The effect leaving the object | range; spreading energy |
| Low orbit under the object | Monument, weight | durability; a flagship |
| Slow pull-back into negative space | Room for type | a claim; a question |

Framing: one hero, centred or on a strong diagonal, never cropped by the frame edge in a wide. Cut only on beats (bar lines where possible). Product videos need **no spatial continuity** between shots: each shot is its own presentation stage, so hide or move anything that doesn't serve it. Transitions are cuts on the beat or a sweep passing through black; never dissolves or wipes.

## 7. Sound palette

- **Minimal electronic, never piano-and-strings.** Timbres, as options: bowed-glass or wet-finger tones, granular crystal clouds, glass bells and FM glass plucks, a filtered tick grid for precision, a warm pad, sub drone, soft short kicks and claps, 808 bass (sine with pitch envelope, soft saturation, slides), noise and saw risers, a high glass ding. Minor and modal colours suit the dark studio.
- **Lock every pulse, sweep and snap to the score**: write the cue map first and share one hit list between the score and the renderer; light pulses may follow a syncopated bass pattern exactly.
- **Silence as a tool**: a short stretch of total silence (reverb tails cut too) before a release, at most a reverse whoosh inside it.
- **Foley follows the material**: glass shimmer for sweeps (band-passed noise + inharmonic partials, panned with the strip); glass-metal friction for moving covers; magnetic clicks (sub-2 ms transient + 3–5 kHz metal resonances + low thump); air puffs for moving parts; a snap = a cluster of clicks ms apart + an inharmonic glass chord (partials ×2.76, ×5.4); glass-on-glass ticks.
- **Voice**: one restrained, low, launch-like narrator, very few very short lines. Never a product name alone (speech-to-text and viewers mishear it): give it a verb.
- **Mix**: duck music ~12 dB and foley ~6 dB under the voice; limit the biggest bass peaks ~3 dB so loudness normalisation stays linear; master −14 LUFS; grain 0.

## 8. Native moves

A menu: use the ones your story needs. Adapting any topic: find **the invisible thing the product does** and make it visible as light inside glass.

- **Transparency.** The inside is the hero; rack focus from the shell to the part within. *Fits content like:* a juicer's blades; a watch movement; a supplement capsule's layers.
- **Lensing.** A thick glass dome magnifies and bends what is behind it; macro through it feels like looking into a jewel. *Fits content like:* a camera module; a magnifying tool; a water filter.
- **Dispersion.** A sweep crossing a thick edge becomes a moving spectrum. *Fits content like:* a prism lamp; a display's colour range; a skincare bottle.
- **Light that travels inside.** Energy (charge, data, heat, sound) runs as light through channels. *Fits content like:* a battery filling; a router's data threads; a kettle heating.
- **Caustics.** An internal pulse becomes a ring spreading over the floor. *Fits content like:* a speaker's range; a perfume's trail; a wireless charger's field.
- **Exploded view and snap.** Parts float apart and snap back on a downbeat. *Fits content like:* a modular backpack; a pen's refill system; a repairable phone.
- **Frost to clear.** A frosted shell clears (roughness and tint animate to zero) and the inside appears. *Fits content like:* a privacy feature; a fridge's contents; an honest price breakdown.

## 9. Pitfalls of the medium

- A manually updated mirror uses last frame's camera → call `scene.updateMatrixWorld(); camera.updateMatrixWorld()` first; the transmission pre-pass re-renders it → no-op its `onBeforeRender`, update once per frame.
- A coloured emitter inside frosted glass tints the whole object; idle glow under a lens dome becomes a pale blob; AgX turns accents white; frosted glass on black is black; mirror chrome becomes a white disc → the rules in §2–§3.
- An exploded view seen perpendicular to its axis is edge-on lines → axis ~40° to camera.
- Pure profiles read as simple shapes (mushrooms, pot lids) → 3/4 views, lids upright behind.
- Bass peaks without headroom push loudness normalisation into dynamic mode → limit them in the mix.
- Concave glass facing camera prints the front card as a grey rectangle → card off.
- In a reel, a title or slab below y 1248 or right of x 900 sits under the app's buttons; on YouTube, the bottom 12 % is under the player controls.

## 10. Build

Follow [building](../../../references/building.md). For this style:

- three.js (r163 or later, for dispersion), the whole frame drawn from `t`; three.js can be vendored next to the page and imported through an import map, as the pack's 3d-character style does. Model in millimetres with the near plane at 1; render at 2× and scale down.
- The studio is a small scene of emissive strips baked to PMREM every frame (dispose the previous target), so the sweep, whose azimuth is the camera's plus π, moves its highlight, refraction and dispersion physically. The floor is a blurred mirror with a radial fade and a procedural caustic shader (offset R/G/B lens ring, warped Voronoi filaments, rings spawned at event times); update the mirror's matrices before rendering it, once per frame.
- Materials are kept and the geometry replaced for each new object: clear and frosted glass as physical materials with transmission, metals, and light guides whose comet pulses (Gaussian head, exponential tail, white-hot core, hue drifting with age) are injected with `onBeforeCompile` and driven by event times. Anything inside transmissive glass is opaque.
- The exploded view is a pure function of time since its event: each part's offset along the axis, a deterministic tilt and a spin proportional to the offset, eased out apart, hovering, then snapped in with a very short ease-in on the downbeat. Physical depth of field, bloom above ~1.1, Neutral tone mapping, no grain.
- One beat-grid timeline is shared with the score: write the cue map first, then hang every pulse, sweep, snap and cut on it. Subtitles follow the voice's word timings; the frosted slab is DOM over a blurred copy of the canvas (`preserveDrawingBuffer: true`). One cue per visible event in `cues.json`: sweeps, pulses, clicks, snaps, rings.

## 11. Variation space

You decide the object (always fictional), internals, accent, structure, opening, ending, camera path, pacing and music. Vary them per video:

- Structures: **a line-up** (three variants compared by what glows inside); **a day in light** (one object through morning, noon and night, the strip kit rotating around it); **material stack** (one layer removed per beat until the core stands alone).
- Openings: **inside first** (one internal part; the shell forms around it); **caustic first** (light on the floor, followed up to the object); **silhouettes** (several dark outlines; one begins to glow).
- Endings: **floor only** (the object leaves, its caustic keeps pulsing); **cool down** (emission fades to bare strip outlines); **held macro** (no pull-back; one detail, the name small).
